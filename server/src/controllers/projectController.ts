import { Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Project } from '../models/Project.js';
import { Design } from '../models/Design.js';
import { Asset } from '../models/Asset.js';
import { ProcessingItem } from '../models/ProcessingItem.js';
import { StorageService } from '../services/storage.js';
import { ActivityLogger } from '../services/activityLogger.js';

const projectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  coverAssetId: z.string().optional().nullable(),
  defaultWatermarkTemplateId: z.string().optional().nullable(),
});

export class ProjectController {
  /**
   * List all projects for current company
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const { search, tag, status = 'active' } = req.query;
      const filter: any = { companyId: req.user!.companyId };

      if (status) filter.status = status;
      if (tag) filter.tags = tag;
      if (search) {
        filter.name = { $regex: search as string, $options: 'i' };
      }

      const projects = await Project.find(filter)
        .populate('coverAssetId')
        .populate('defaultWatermarkTemplateId', 'name watermarkType')
        .populate('createdBy', 'name email')
        .sort({ updatedAt: -1 });

      // Attach design counts
      const projectIds = projects.map((p) => p._id);
      const counts = await Design.aggregate([
        { $match: { companyId: new Types.ObjectId(req.user!.companyId), projectId: { $in: projectIds } } },
        { $group: { _id: '$projectId', total: { $sum: 1 }, processed: { $sum: { $cond: [{ $eq: ['$processingStatus', 'processed'] }, 1, 0] } } } },
      ]);

      const countMap = new Map();
      counts.forEach((c) => countMap.set(c._id.toString(), { total: c.total, processed: c.processed }));

      const enriched = projects.map((p) => {
        const c = countMap.get(p._id.toString()) || { total: 0, processed: 0 };
        return {
          ...p.toObject(),
          designsCount: c.total,
          processedCount: c.processed,
        };
      });

      res.status(200).json({ success: true, data: enriched });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch projects.' });
    }
  }

  /**
   * Create a new project / jewellery collection
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      // Check permission: Designer can create project if company policy allows or has permission
      if (req.user!.role === 'Designer' && !req.membership!.permissions.canCreateProject && !req.company!.settings.allowDesignerCreateProject) {
        res.status(403).json({ success: false, message: 'Designer is not permitted to create projects under company policy.' });
        return;
      }

      if (req.user!.role === 'Viewer') {
        res.status(403).json({ success: false, message: 'Viewers cannot create projects.' });
        return;
      }

      const parsed = projectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.errors[0].message });
        return;
      }

      const project = await Project.create({
        companyId: new Types.ObjectId(req.user!.companyId),
        name: parsed.data.name.trim(),
        description: parsed.data.description || '',
        tags: parsed.data.tags || [],
        coverAssetId: parsed.data.coverAssetId ? new Types.ObjectId(parsed.data.coverAssetId) : null,
        defaultWatermarkTemplateId: parsed.data.defaultWatermarkTemplateId
          ? new Types.ObjectId(parsed.data.defaultWatermarkTemplateId)
          : null,
        createdBy: new Types.ObjectId(req.user!.userId),
        status: 'active',
      });

      await ActivityLogger.log({
        companyId: req.user!.companyId,
        actorId: req.user!.userId,
        action: 'PROJECT_CREATED',
        resourceType: 'project',
        resourceId: project._id,
        metadata: { name: project.name },
        req,
      });

      res.status(201).json({ success: true, data: project, message: 'Project collection created.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to create project.' });
    }
  }

  /**
   * Get single project
   */
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const project = await Project.findOne({
        _id: projectId,
        companyId: req.user!.companyId,
      })
        .populate('coverAssetId')
        .populate('defaultWatermarkTemplateId')
        .populate('createdBy', 'name email');

      if (!project) {
        res.status(404).json({ success: false, message: 'Project not found.' });
        return;
      }

      res.status(200).json({ success: true, data: project });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch project.' });
    }
  }

  /**
   * Update project
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role === 'Viewer') {
        res.status(403).json({ success: false, message: 'Viewers cannot modify projects.' });
        return;
      }

      const { projectId } = req.params;
      const parsed = projectSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.errors[0].message });
        return;
      }

      const project = await Project.findOneAndUpdate(
        { _id: projectId, companyId: req.user!.companyId },
        { $set: parsed.data },
        { new: true }
      );

      if (!project) {
        res.status(404).json({ success: false, message: 'Project not found.' });
        return;
      }

      await ActivityLogger.log({
        companyId: req.user!.companyId,
        actorId: req.user!.userId,
        action: 'PROJECT_UPDATED',
        resourceType: 'project',
        resourceId: project._id,
        req,
      });

      res.status(200).json({ success: true, data: project, message: 'Project updated.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to update project.' });
    }
  }

  /**
   * Delete collection and cascade delete all its designs & assets
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== 'Company') {
        res.status(403).json({ success: false, message: 'Only Company owners can delete projects.' });
        return;
      }

      const { projectId } = req.params;
      const project = await Project.findOne({
        _id: projectId,
        companyId: req.user!.companyId,
      });

      if (!project) {
        res.status(404).json({ success: false, message: 'Project not found.' });
        return;
      }

      // 1. Find all designs under this project
      const designs = await Design.find({
        companyId: req.user!.companyId,
        projectId: project._id,
      });

      const designIds = designs.map((d) => d._id);
      const assetIdsToDelete: Types.ObjectId[] = [];

      // 2. Collect all associated assets from designs
      for (const design of designs) {
        if (design.originalAssetId) {
          assetIdsToDelete.push(design.originalAssetId);
        }
        if (design.activeProcessedAssetId) {
          assetIdsToDelete.push(design.activeProcessedAssetId);
        }
        if (Array.isArray(design.processedAssetIds)) {
          for (const pid of design.processedAssetIds) {
            if (pid) assetIdsToDelete.push(pid);
          }
        }
      }

      // Include project's cover asset if set
      if (project.coverAssetId) {
        assetIdsToDelete.push(project.coverAssetId);
      }

      // Deduplicate asset IDs
      const uniqueAssetIds = Array.from(
        new Set(assetIdsToDelete.map((id) => id.toString()))
      ).map((id) => new Types.ObjectId(id));

      // 3. Delete physical files and Cloudinary assets via StorageService
      if (uniqueAssetIds.length > 0) {
        const assets = await Asset.find({
          _id: { $in: uniqueAssetIds },
          companyId: req.user!.companyId,
        });

        for (const asset of assets) {
          try {
            await StorageService.deleteAsset(asset);
          } catch (assetErr) {
            console.error(`Failed to delete asset ${asset._id}:`, assetErr);
          }
        }
      }

      // 4. Delete processing items referencing these designs
      if (designIds.length > 0) {
        await ProcessingItem.deleteMany({
          companyId: req.user!.companyId,
          designId: { $in: designIds },
        });
      }

      // 5. Delete all designs belonging to this project
      if (designIds.length > 0) {
        await Design.deleteMany({
          _id: { $in: designIds },
          companyId: req.user!.companyId,
        });
      }

      // 6. Delete the project itself
      await Project.deleteOne({
        _id: project._id,
        companyId: req.user!.companyId,
      });

      await ActivityLogger.log({
        companyId: req.user!.companyId,
        actorId: req.user!.userId,
        action: 'PROJECT_DELETED',
        resourceType: 'project',
        resourceId: projectId,
        metadata: {
          name: project.name,
          deletedDesignsCount: designs.length,
          deletedAssetsCount: uniqueAssetIds.length,
        },
        req,
      });

      res.status(200).json({
        success: true,
        message: `Collection and ${designs.length} product(s) deleted successfully.`,
        data: {
          deletedDesignsCount: designs.length,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to delete project.' });
    }
  }
}
