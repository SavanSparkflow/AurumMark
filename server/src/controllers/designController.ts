import fs from 'fs';
import { Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import sharp from 'sharp';
import { Design } from '../models/Design.js';
import { Asset } from '../models/Asset.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { WatermarkTemplate } from '../models/WatermarkTemplate.js';
import { ImageProcessorService } from '../services/imageProcessor.js';
import { VideoProcessorService } from '../services/videoProcessor.js';
import { SteganographyService } from '../services/steganographyService.js';
import { StorageService } from '../services/storage.js';
import { ActivityLogger } from '../services/activityLogger.js';

const updateDesignSchema = z.object({
  sku: z.string().optional(),
  tags: z.array(z.string()).optional(),
  projectId: z.string().optional().nullable(),
});

export class DesignController {
  /**
   * List all designs for current company with filtering, search, and pagination
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const {
        projectId,
        processingStatus,
        search,
        tag,
        page = '1',
        limit = '50',
      } = req.query;

      const filter: any = { companyId: req.user!.companyId };

      if (projectId) {
        if (projectId === 'unassigned' || projectId === 'null') {
          filter.projectId = null;
        } else if (Types.ObjectId.isValid(projectId as string)) {
          filter.projectId = new Types.ObjectId(projectId as string);
        } else {
          filter.projectId = projectId;
        }
      }
      if (processingStatus && processingStatus !== 'all') {
        filter.processingStatus = processingStatus;
      }
      if (tag) {
        filter.tags = tag;
      }
      if (search) {
        filter.$or = [
          { filename: { $regex: search as string, $options: 'i' } },
          { sku: { $regex: search as string, $options: 'i' } },
        ];
      }

      const pageNum = Math.max(1, parseInt(page as string, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
      const skip = (pageNum - 1) * limitNum;

      const [designs, total] = await Promise.all([
        Design.find(filter)
          .populate('originalAssetId')
          .populate('thumbnailAssetId')
          .populate('activeProcessedAssetId')
          .populate('projectId', 'name')
          .populate('uploadedBy', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Design.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: designs,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch jewellery designs.' });
    }
  }

  /**
   * Upload multiple jewellery images
   */
  static async upload(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role === 'Viewer') {
        res.status(403).json({ success: false, message: 'Viewers are not permitted to upload images.' });
        return;
      }

      if (req.user!.role === 'Designer' && !req.membership!.permissions.canUpload) {
        res.status(403).json({ success: false, message: 'Designer is not authorized to upload images.' });
        return;
      }

      const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
      if (files.length === 0) {
        res.status(400).json({ success: false, message: 'No image files provided.' });
        return;
      }

      const { projectId, skuPrefix, tags } = req.body;
      const parsedTags = tags ? (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : tags) : [];

      const createdDesigns = [];
      const companyId = req.user!.companyId;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo =
          file.mimetype.toLowerCase().startsWith('video/') ||
          /\.(mp4|mov|webm|mkv|avi)$/i.test(file.originalname);

        // Save original asset buffer
        const originalAsset = await StorageService.saveUploadedBuffer({
          companyId,
          buffer: file.buffer,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          assetType: 'original',
        });

        const baseName = file.originalname.replace(/\.[^/.]+$/, '');
        const sku = skuPrefix ? `${skuPrefix}-${String(i + 1).padStart(3, '0')}` : `SKU-${Date.now().toString().slice(-6)}-${i + 1}`;

        let thumbnailAssetId: Types.ObjectId | null = null;
        let designMetadata: any = {
          size: file.size,
        };

        if (isVideo) {
          // Extract video thumbnail for gallery card display
          try {
            const originalPath = StorageService.getAbsolutePath(originalAsset.storageKey);
            const thumbBuffer = await VideoProcessorService.extractThumbnail(originalPath, 0.5);
            const thumbAsset = await StorageService.saveUploadedBuffer({
              companyId,
              buffer: thumbBuffer,
              originalFilename: `${baseName}_thumb.jpg`,
              mimeType: 'image/jpeg',
              assetType: 'thumbnail',
            });
            thumbnailAssetId = thumbAsset._id as Types.ObjectId;
          } catch (thumbErr) {
            console.warn(`[VideoThumb] Notice: Could not extract thumbnail for ${file.originalname}:`, thumbErr);
          }

          designMetadata = {
            width: originalAsset.width || 1920,
            height: originalAsset.height || 1080,
            format: 'mp4',
            size: file.size,
            duration: originalAsset.duration || 0,
            fps: originalAsset.fps || 30,
            aspectRatio:
              originalAsset.width && originalAsset.height
                ? Number((originalAsset.width / originalAsset.height).toFixed(2))
                : 1.78,
          };
        } else {
          // Read metadata via sharp for static images
          const meta = await sharp(file.buffer).metadata();
          designMetadata = {
            width: meta.width,
            height: meta.height,
            format: meta.format,
            size: file.size,
            aspectRatio: meta.width && meta.height ? Number((meta.width / meta.height).toFixed(2)) : 1,
          };
        }

        const design = await Design.create({
          companyId: new Types.ObjectId(companyId),
          projectId: projectId ? new Types.ObjectId(projectId) : null,
          mediaType: isVideo ? 'video' : 'image',
          originalAssetId: originalAsset._id,
          thumbnailAssetId,
          processedAssetIds: [],
          activeProcessedAssetId: null,
          filename: file.originalname,
          sku,
          tags: parsedTags,
          metadata: designMetadata,
          uploadedBy: new Types.ObjectId(req.user!.userId),
          uploadStatus: 'completed',
          processingStatus: 'unprocessed',
        });

        createdDesigns.push(design);
      }

      await ActivityLogger.log({
        companyId,
        actorId: req.user!.userId,
        action: 'IMAGES_UPLOADED',
        resourceType: 'design',
        metadata: { count: files.length },
        req,
      });

      res.status(201).json({
        success: true,
        message: `Successfully uploaded ${createdDesigns.length} jewellery images.`,
        data: createdDesigns,
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      res.status(500).json({ success: false, message: err.message || 'Image upload failed.' });
    }
  }

  /**
   * Get single design details
   */
  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { designId } = req.params;
      const design = await Design.findOne({
        _id: designId,
        companyId: req.user!.companyId,
      })
        .populate('originalAssetId')
        .populate('thumbnailAssetId')
        .populate('activeProcessedAssetId')
        .populate('processedAssetIds')
        .populate('projectId')
        .populate('uploadedBy', 'name email');

      if (!design) {
        res.status(404).json({ success: false, message: 'Design not found.' });
        return;
      }

      res.status(200).json({ success: true, data: design });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to fetch design.' });
    }
  }

  /**
   * Update design metadata
   */
  static async update(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role === 'Viewer') {
        res.status(403).json({ success: false, message: 'Viewers cannot modify designs.' });
        return;
      }

      const { designId } = req.params;
      const parsed = updateDesignSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.errors[0].message });
        return;
      }

      const design = await Design.findOneAndUpdate(
        { _id: designId, companyId: req.user!.companyId },
        { $set: parsed.data },
        { new: true }
      );

      if (!design) {
        res.status(404).json({ success: false, message: 'Design not found.' });
        return;
      }

      res.status(200).json({ success: true, data: design, message: 'Design updated.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to update design.' });
    }
  }

  /**
   * Delete design and associated assets
   */
  static async delete(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role === 'Viewer') {
        res.status(403).json({ success: false, message: 'Viewers cannot delete designs.' });
        return;
      }

      if (req.user!.role === 'Designer' && !req.membership!.permissions.canDeleteDesign) {
        res.status(403).json({ success: false, message: 'Designer is not authorized to delete designs.' });
        return;
      }

      const { designId } = req.params;
      const design = await Design.findOne({
        _id: designId,
        companyId: req.user!.companyId,
      });

      if (!design) {
        res.status(404).json({ success: false, message: 'Design not found.' });
        return;
      }

      // Collect assets to delete
      const assetIdsToDelete = [design.originalAssetId, ...(design.processedAssetIds || [])];
      const assets = await Asset.find({ _id: { $in: assetIdsToDelete }, companyId: req.user!.companyId });

      for (const asset of assets) {
        await StorageService.deleteAsset(asset);
      }

      await Design.deleteOne({ _id: design._id });

      await ActivityLogger.log({
        companyId: req.user!.companyId,
        actorId: req.user!.userId,
        action: 'DESIGN_DELETED',
        resourceType: 'design',
        resourceId: designId,
        req,
      });

      res.status(200).json({ success: true, message: 'Design and assets removed successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to delete design.' });
    }
  }

  /**
   * Bulk delete multiple designs and their associated assets
   */
  static async bulkDelete(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role === 'Viewer') {
        res.status(403).json({ success: false, message: 'Viewers cannot delete designs.' });
        return;
      }

      if (req.user!.role === 'Designer' && !req.membership!.permissions.canDeleteDesign) {
        res.status(403).json({ success: false, message: 'Designer is not authorized to delete designs.' });
        return;
      }

      const { designIds } = req.body;
      if (!Array.isArray(designIds) || designIds.length === 0) {
        res.status(400).json({ success: false, message: 'Please provide an array of designIds to delete.' });
        return;
      }

      const designs = await Design.find({
        _id: { $in: designIds },
        companyId: req.user!.companyId,
      });

      if (designs.length === 0) {
        res.status(404).json({ success: false, message: 'No matching designs found.' });
        return;
      }

      // Collect all asset IDs for physical/Cloudinary removal
      const allAssetIds: any[] = [];
      for (const d of designs) {
        if (d.originalAssetId) allAssetIds.push(d.originalAssetId);
        if (d.processedAssetIds && d.processedAssetIds.length > 0) {
          allAssetIds.push(...d.processedAssetIds);
        }
      }

      const assets = await Asset.find({ _id: { $in: allAssetIds }, companyId: req.user!.companyId });
      for (const asset of assets) {
        try {
          await StorageService.deleteAsset(asset);
        } catch (storageErr) {
          console.error(`Failed to delete asset ${asset._id} from storage:`, storageErr);
        }
      }

      const foundIds = designs.map((d) => d._id);
      await Design.deleteMany({ _id: { $in: foundIds } });

      await ActivityLogger.log({
        companyId: req.user!.companyId,
        actorId: req.user!.userId,
        action: 'DESIGN_DELETED',
        resourceType: 'design',
        resourceId: foundIds.join(','),
        metadata: { count: foundIds.length },
        req,
      });

      res.status(200).json({
        success: true,
        message: `Successfully deleted ${foundIds.length} jewellery design(s).`,
        deletedCount: foundIds.length,
      });
    } catch (err: any) {
      console.error('Bulk delete error:', err);
      res.status(500).json({ success: false, message: 'Failed to bulk delete designs.' });
    }
  }

  /**
   * Apply watermark to a single design image directly & synchronously
   */
  static async applyWatermark(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role === 'Viewer') {
        res.status(403).json({ success: false, message: 'Viewers cannot process designs.' });
        return;
      }

      if (req.user!.role === 'Designer' && !req.membership!.permissions.canProcess) {
        res.status(403).json({ success: false, message: 'Designer is not authorized to process designs.' });
        return;
      }

      const { designId } = req.params;
      const { templateId, configuration: inlineConfig, outputSettings } = req.body;

      const design = await Design.findOne({
        _id: designId,
        companyId: req.user!.companyId,
      }).populate('originalAssetId');

      if (!design || !design.originalAssetId) {
        res.status(404).json({ success: false, message: 'Design or original image asset not found.' });
        return;
      }

      // Determine final watermark configuration
      let finalConfig = inlineConfig;
      if (!finalConfig && templateId) {
        const tmpl = await WatermarkTemplate.findOne({
          _id: templateId,
          companyId: req.user!.companyId,
        });
        if (tmpl) {
          finalConfig = tmpl.configuration;
        }
      }

      // Fall back to company default template or any available template
      if (!finalConfig) {
        const defTmpl =
          (await WatermarkTemplate.findOne({ companyId: req.user!.companyId, isDefault: true })) ||
          (await WatermarkTemplate.findOne({ companyId: req.user!.companyId }));
        if (defTmpl) {
          finalConfig = defTmpl.configuration;
        }
      }

      if (!finalConfig) {
        res.status(400).json({
          success: false,
          message: 'No watermark configuration or template found. Please choose or create a template.',
        });
        return;
      }

      // Resolve logo buffer if logo is enabled
      let logoBuffer: Buffer | undefined;
      if (finalConfig.logoConfig?.enabled && finalConfig.logoConfig.logoAssetId) {
        const logoAsset = await Asset.findOne({
          _id: finalConfig.logoConfig.logoAssetId,
          companyId: req.user!.companyId,
        });
        if (logoAsset) {
          const logoPath = StorageService.getAbsolutePath(logoAsset.storageKey);
          if (fs.existsSync(logoPath)) {
            logoBuffer = await fs.promises.readFile(logoPath);
          }
        }
      }

      // Read source media
      const sourceAsset = design.originalAssetId as any;
      const sourcePath = StorageService.getAbsolutePath(sourceAsset.storageKey);
      if (!fs.existsSync(sourcePath)) {
        res.status(404).json({ success: false, message: 'Source media file not found on disk.' });
        return;
      }

      // Output settings
      const finalOutputSettings = {
        format: outputSettings?.format || req.company?.settings.defaultOutputFormat || 'jpeg',
        quality: outputSettings?.quality || req.company?.settings.defaultQuality || 90,
        maxWidth: outputSettings?.maxWidth,
        maxHeight: outputSettings?.maxHeight,
        stripMetadata: outputSettings?.stripMetadata ?? req.company?.settings.sanitizeMetadata ?? true,
      };

      let outputAsset;
      const isVideo = design.mediaType === 'video' || sourceAsset.mimeType.startsWith('video/');

      if (isVideo) {
        // Video processing with FFmpeg overlay
        const videoResult = await VideoProcessorService.applyWatermark(
          sourcePath,
          finalConfig,
          finalOutputSettings,
          logoBuffer
        );

        const videoBuffer = await fs.promises.readFile(videoResult.outputPath);
        await fs.promises.unlink(videoResult.outputPath).catch(() => {});

        const origBaseName = sourceAsset.originalFilename
          ? sourceAsset.originalFilename.replace(/\.[^/.]+$/, '')
          : 'jewellery_video';
        const processedFilename = `${origBaseName}_watermarked.mp4`;

        outputAsset = await StorageService.saveUploadedBuffer({
          companyId: req.user!.companyId,
          buffer: videoBuffer,
          originalFilename: processedFilename,
          mimeType: 'video/mp4',
          assetType: 'processed',
        });
      } else {
        const sourceBuffer = await fs.promises.readFile(sourcePath);
        // Process image with Sharp
        const processedResult = await ImageProcessorService.processImage({
          inputBuffer: sourceBuffer,
          config: finalConfig,
          outputSettings: finalOutputSettings,
          logoBuffer,
        });

        // Save as processed asset
        const ext = finalOutputSettings.format === 'png' ? '.png' : finalOutputSettings.format === 'webp' ? '.webp' : '.jpg';
        const origBaseName = sourceAsset.originalFilename ? sourceAsset.originalFilename.replace(/\.[^/.]+$/, '') : 'jewellery';
        const processedFilename = `${origBaseName}_watermarked${ext}`;
        const mimeType = finalOutputSettings.format === 'png' ? 'image/png' : finalOutputSettings.format === 'webp' ? 'image/webp' : 'image/jpeg';

        // Embed invisible digital steganography fingerprint
        const [userRecord, companyRecord] = await Promise.all([
          User.findById(req.user!.userId).select('name email'),
          Company.findById(req.user!.companyId).select('name'),
        ]);
        const exporterName = userRecord ? `${userRecord.name} (${userRecord.email})` : `User #${req.user!.userId}`;
        const companyName = companyRecord?.name || 'AurumMark Workspace';

        const forensicBuffer = await SteganographyService.embedFingerprint(
          processedResult.outputBuffer,
          {
            companyId: req.user!.companyId.toString(),
            companyName,
            exportedBy: exporterName,
            actorId: req.user!.userId.toString(),
            designId: design._id.toString(),
            filename: design.filename,
            sku: design.sku,
            timestamp: Date.now(),
          }
        );

        outputAsset = await StorageService.saveUploadedBuffer({
          companyId: req.user!.companyId,
          buffer: forensicBuffer,
          originalFilename: processedFilename,
          mimeType,
          assetType: 'processed',
        });
      }

      // Update design
      design.activeProcessedAssetId = outputAsset._id;
      if (!design.processedAssetIds) {
        design.processedAssetIds = [];
      }
      design.processedAssetIds.push(outputAsset._id);
      design.processingStatus = 'processed';
      await design.save();

      await ActivityLogger.log({
        companyId: req.user!.companyId,
        actorId: req.user!.userId,
        action: 'DESIGN_WATERMARKED',
        resourceType: 'design',
        resourceId: design._id,
        metadata: { filename: design.filename, assetId: outputAsset._id },
        req,
      });

      const updatedDesign = await Design.findById(design._id)
        .populate('originalAssetId')
        .populate('thumbnailAssetId')
        .populate('activeProcessedAssetId')
        .populate('projectId');

      res.status(200).json({
        success: true,
        message: 'Watermark applied successfully.',
        data: updatedDesign,
      });
    } catch (err: any) {
      console.error('Failed to apply watermark:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to apply watermark.',
      });
    }
  }
}
