import fs from 'fs';
import { Request, Response } from 'express';
import { Design } from '../models/Design.js';
import { Asset, IAsset } from '../models/Asset.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { StorageService } from '../services/storage.js';
import { VideoProcessorService } from '../services/videoProcessor.js';
import { ResizerService, ResizerPresetKey, RESIZER_PRESETS } from '../services/resizerService.js';
import { ActivityLogger } from '../services/activityLogger.js';

export class ResizerController {
  /**
   * Helper to retrieve raw buffer for an asset
   */
  private static async getAssetBuffer(asset: IAsset): Promise<Buffer> {
    const filePath = StorageService.getAbsolutePath(asset.storageKey);
    if (fs.existsSync(filePath)) {
      return await fs.promises.readFile(filePath);
    }
    if (asset.url) {
      const resp = await fetch(asset.url);
      if (!resp.ok) {
        throw new Error(`Failed to fetch asset from CDN: ${asset.url}`);
      }
      const arrayBuf = await resp.arrayBuffer();
      return Buffer.from(arrayBuf);
    }
    throw new Error('Asset file could not be located on storage or CDN.');
  }

  /**
   * Helper to build forensic payload for the active user & company
   */
  private static async buildForensicPayload(req: Request, design: any) {
    try {
      const [userRecord, companyRecord] = await Promise.all([
        User.findById(req.user!.userId).select('name email'),
        Company.findById(req.user!.companyId).select('name'),
      ]);
      const exporterName = userRecord
        ? `${userRecord.name} (${userRecord.email})`
        : `User #${req.user!.userId}`;
      const companyName = companyRecord?.name || 'AurumMark Workspace';

      return {
        companyId: req.user!.companyId.toString(),
        companyName,
        exportedBy: exporterName,
        actorId: req.user!.userId.toString(),
        designId: design._id.toString(),
        filename: design.filename,
        sku: design.sku,
        timestamp: Date.now(),
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Helper to retrieve a valid image buffer for any design.
   * If design or asset is a video, seamlessly extracts a high-res jewellery video frame using FFmpeg.
   */
  private static async getDesignImageBuffer(
    design: any,
    useOriginal: boolean
  ): Promise<{ buffer: Buffer; isVideoFrame: boolean }> {
    const isVideo =
      design.mediaType === 'video' ||
      design.filename?.toLowerCase().endsWith('.mp4') ||
      design.filename?.toLowerCase().endsWith('.mov');

    const assetId =
      !useOriginal && design.activeProcessedAssetId
        ? design.activeProcessedAssetId
        : design.originalAssetId;

    const asset = await Asset.findById(assetId);
    if (!asset) {
      throw new Error(`Asset not found for design ${design._id}`);
    }

    const isAssetVideo =
      isVideo ||
      asset.mimeType?.startsWith('video/') ||
      asset.originalFilename?.toLowerCase().endsWith('.mp4') ||
      asset.originalFilename?.toLowerCase().endsWith('.mov');

    if (isAssetVideo) {
      // 1. Try extracting high-resolution video frame directly from local video file
      const videoPath = StorageService.getAbsolutePath(asset.storageKey);
      if (fs.existsSync(videoPath)) {
        try {
          const frameBuffer = await VideoProcessorService.extractThumbnail(videoPath, 0.5);
          return { buffer: frameBuffer, isVideoFrame: true };
        } catch {
          try {
            const frameBuffer = await VideoProcessorService.extractThumbnail(videoPath, 0);
            return { buffer: frameBuffer, isVideoFrame: true };
          } catch (e) {
            console.warn(`[Resizer] Could not extract frame from ${videoPath}:`, e);
          }
        }
      }

      // 2. If local video file not available or failed, try design's thumbnailAssetId
      if (design.thumbnailAssetId) {
        const thumbAsset = await Asset.findById(design.thumbnailAssetId);
        if (thumbAsset) {
          const thumbBuffer = await ResizerController.getAssetBuffer(thumbAsset);
          return { buffer: thumbBuffer, isVideoFrame: true };
        }
      }
    }

    // 3. Static image asset
    const rawBuffer = await ResizerController.getAssetBuffer(asset);
    return { buffer: rawBuffer, isVideoFrame: false };
  }

  /**
   * GET /api/resizer/presets
   * List all available social media and e-commerce presets
   */
  static async getPresets(req: Request, res: Response): Promise<void> {
    try {
      const presets = ResizerService.getPresets();
      res.status(200).json({
        success: true,
        data: presets,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to fetch presets',
      });
    }
  }

  /**
   * POST /api/resizer/export-single
   * Resizes a single design to one specific platform preset and streams the image
   */
  static async exportSingle(req: Request, res: Response): Promise<void> {
    try {
      const {
        designId,
        presetKey,
        useOriginal = false,
        backgroundPreference = 'white',
      } = req.body;

      if (!designId || !presetKey) {
        res.status(400).json({
          success: false,
          message: 'designId and presetKey are required.',
        });
        return;
      }

      if (!RESIZER_PRESETS[presetKey as ResizerPresetKey]) {
        res.status(400).json({
          success: false,
          message: `Invalid presetKey. Available: ${Object.keys(RESIZER_PRESETS).join(', ')}`,
        });
        return;
      }

      const design = await Design.findOne({
        _id: designId,
        companyId: req.user!.companyId,
      });

      if (!design) {
        res.status(404).json({ success: false, message: 'Design not found.' });
        return;
      }

      const { buffer: inputBuffer } = await ResizerController.getDesignImageBuffer(design, useOriginal);
      const forensicPayload = await ResizerController.buildForensicPayload(req, design);

      const variant = await ResizerService.resizeImage({
        inputBuffer,
        presetKey: presetKey as ResizerPresetKey,
        baseFilename: design.sku ? `${design.sku}_${design.filename}` : design.filename,
        backgroundPreference,
        forensicPayload,
      });

      // Log export activity
      await ActivityLogger.log({
        companyId: req.user!.companyId,
        actorId: req.user!.userId,
        action: 'PLATFORM_RESIZED_EXPORT',
        resourceType: 'design',
        resourceId: design._id,
        metadata: {
          presetKey,
          filename: variant.filename,
          dimensions: `${variant.width}x${variant.height}`,
          fileSize: variant.fileSize,
        },
        req,
      });

      res.setHeader('Content-Type', variant.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${variant.filename}"`);
      res.setHeader('Content-Length', variant.buffer.length);
      res.send(variant.buffer);
    } catch (err: any) {
      console.error('Single resize export failed:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Image resize export failed.',
      });
    }
  }

  /**
   * POST /api/resizer/export-bundle
   * Resizes a single design to multiple selected presets and streams a ZIP bundle
   */
  static async exportBundle(req: Request, res: Response): Promise<void> {
    try {
      const {
        designId,
        presetKeys,
        useOriginal = false,
        backgroundPreference = 'white',
      } = req.body;

      if (!designId || !Array.isArray(presetKeys) || presetKeys.length === 0) {
        res.status(400).json({
          success: false,
          message: 'designId and an array of presetKeys are required.',
        });
        return;
      }

      const design = await Design.findOne({
        _id: designId,
        companyId: req.user!.companyId,
      });

      if (!design) {
        res.status(404).json({ success: false, message: 'Design not found.' });
        return;
      }

      const { buffer: inputBuffer } = await ResizerController.getDesignImageBuffer(design, useOriginal);
      const forensicPayload = await ResizerController.buildForensicPayload(req, design);

      const variants = await ResizerService.resizeMultiple({
        inputBuffer,
        presetKeys: presetKeys as ResizerPresetKey[],
        baseFilename: design.sku ? `${design.sku}_${design.filename}` : design.filename,
        backgroundPreference,
        forensicPayload,
      });

      const zipComment = `AurumMark Platform Pack for ${design.sku || design.filename}`;
      const zipBuffer = await ResizerService.createBundleZip({
        variants: variants.map((v) => ({ filename: v.filename, buffer: v.buffer })),
        zipComment,
      });

      const cleanSku = (design.sku || design.filename).replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const zipFilename = `${cleanSku}_social_pack_${Date.now()}.zip`;

      await ActivityLogger.log({
        companyId: req.user!.companyId,
        actorId: req.user!.userId,
        action: 'PLATFORM_BUNDLE_EXPORT',
        resourceType: 'design',
        resourceId: design._id,
        metadata: {
          presetsCount: variants.length,
          zipFilename,
          zipSize: zipBuffer.length,
        },
        req,
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('Bundle resize export failed:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Platform bundle generation failed.',
      });
    }
  }

  /**
   * POST /api/resizer/export-batch-bundle
   * Batch resizes multiple selected designs across selected presets into a single master ZIP
   */
  static async exportBatchBundle(req: Request, res: Response): Promise<void> {
    try {
      const {
        designIds,
        presetKeys,
        useOriginal = false,
        backgroundPreference = 'white',
      } = req.body;

      if (!Array.isArray(designIds) || designIds.length === 0 || !Array.isArray(presetKeys) || presetKeys.length === 0) {
        res.status(400).json({
          success: false,
          message: 'designIds array and presetKeys array are required.',
        });
        return;
      }

      // Limit to 50 designs per batch export
      const limitedIds = designIds.slice(0, 50);

      const designs = await Design.find({
        _id: { $in: limitedIds },
        companyId: req.user!.companyId,
      });

      if (designs.length === 0) {
        res.status(404).json({ success: false, message: 'No valid designs found.' });
        return;
      }

      const allVariants: Array<{ filename: string; buffer: Buffer }> = [];

      for (const design of designs) {
        try {
          const { buffer: inputBuffer } = await ResizerController.getDesignImageBuffer(design, useOriginal);
          const forensicPayload = await ResizerController.buildForensicPayload(req, design);

          const designPrefix = design.sku
            ? `${design.sku}_${design.filename}`
            : design.filename;

          const variants = await ResizerService.resizeMultiple({
            inputBuffer,
            presetKeys: presetKeys as ResizerPresetKey[],
            baseFilename: designPrefix,
            backgroundPreference,
            forensicPayload,
          });

          for (const v of variants) {
            allVariants.push({
              filename: v.filename,
              buffer: v.buffer,
            });
          }
        } catch (innerErr) {
          console.warn(`Skipping design ${design._id} during batch resize:`, innerErr);
        }
      }

      if (allVariants.length === 0) {
        res.status(500).json({
          success: false,
          message: 'Could not generate resized variants for the selected designs.',
        });
        return;
      }

      const zipBuffer = await ResizerService.createBundleZip({
        variants: allVariants,
        zipComment: `AurumMark Batch Platform Pack (${allVariants.length} items)`,
      });

      const zipFilename = `aurummark_batch_platform_pack_${Date.now()}.zip`;

      await ActivityLogger.log({
        companyId: req.user!.companyId,
        actorId: req.user!.userId,
        action: 'PLATFORM_BATCH_EXPORT',
        resourceType: 'export',
        metadata: {
          designsCount: designs.length,
          totalVariants: allVariants.length,
          zipFilename,
          zipSize: zipBuffer.length,
        },
        req,
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('Batch bundle export failed:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Batch platform export failed.',
      });
    }
  }
}

