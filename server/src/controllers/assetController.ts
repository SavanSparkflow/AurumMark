import fs from 'fs';
import { Request, Response } from 'express';
import { Asset } from '../models/Asset.js';
import { User } from '../models/User.js';
import { Company } from '../models/Company.js';
import { StorageService } from '../services/storage.js';
import { SteganographyService } from '../services/steganographyService.js';
import { ActivityLogger } from '../services/activityLogger.js';

export class AssetController {
  /**
   * Securely stream asset for in-app viewing (preview / editor / thumbnails)
   */
  static async viewAsset(req: Request, res: Response): Promise<void> {
    try {
      const { assetId } = req.params;
      const query: any = { _id: assetId };
      if (req.user?.companyId) {
        query.companyId = req.user.companyId;
      }

      const asset = await Asset.findOne(query);

      if (!asset) {
        res.status(404).json({ success: false, message: 'Asset not found or unauthorized.' });
        return;
      }

      // If Cloudinary URL is available and local stream not requested, redirect directly to CDN
      if (asset.url && !req.query.local) {
        res.redirect(asset.url);
        return;
      }

      const filePath = StorageService.getAbsolutePath(asset.storageKey);
      if (!fs.existsSync(filePath)) {
        if (asset.url) {
          res.redirect(asset.url);
          return;
        }
        res.status(404).json({ success: false, message: 'File not found on storage.' });
        return;
      }

      // Range support for smooth video streaming & seeking
      if (asset.mimeType && asset.mimeType.startsWith('video/')) {
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = end - start + 1;
          const file = fs.createReadStream(filePath, { start, end });
          const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': asset.mimeType,
          };
          res.writeHead(206, head);
          file.pipe(res);
          return;
        } else {
          const head = {
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
            'Content-Type': asset.mimeType,
          };
          res.writeHead(200, head);
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }

      res.setHeader('Content-Type', asset.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=86400'); // 1 day client cache
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to stream asset.' });
    }
  }

  /**
   * Download individual image
   */
  static async downloadAsset(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role === 'Viewer') {
        if (!req.company?.settings.allowViewerDownload) {
          res.status(403).json({
            success: false,
            message: 'Company policy does not permit Viewers to download individual images.',
          });
          return;
        }
      }

      const { assetId } = req.params;
      const asset = await Asset.findOne({
        _id: assetId,
        companyId: req.user!.companyId,
      });

      if (!asset) {
        res.status(404).json({ success: false, message: 'Asset not found or unauthorized.' });
        return;
      }

      const filePath = StorageService.getAbsolutePath(asset.storageKey);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ success: false, message: 'File missing on storage.' });
        return;
      }

      const safeFilename = asset.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
      res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

      await ActivityLogger.log({
        companyId: req.user!.companyId,
        actorId: req.user!.userId,
        action: 'IMAGE_DOWNLOADED',
        resourceType: 'design',
        resourceId: asset._id,
        metadata: { filename: asset.originalFilename },
        req,
      });

      // Embed invisible forensic watermark on image download to trace future leaks
      if (asset.mimeType?.startsWith('image/')) {
        try {
          const rawBuffer = await fs.promises.readFile(filePath);
          const [userRecord, companyRecord] = await Promise.all([
            User.findById(req.user!.userId).select('name email'),
            Company.findById(req.user!.companyId).select('name'),
          ]);
          const exporterName = userRecord ? `${userRecord.name} (${userRecord.email})` : `User #${req.user!.userId}`;
          const companyName = companyRecord?.name || 'AurumMark Workspace';

          const signedBuffer = await SteganographyService.embedFingerprint(rawBuffer, {
            companyId: req.user!.companyId.toString(),
            companyName,
            exportedBy: exporterName,
            actorId: req.user!.userId.toString(),
            filename: asset.originalFilename,
            timestamp: Date.now(),
          });
          res.send(signedBuffer);
          return;
        } catch {
          // Fallback to streaming original file
        }
      }

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (err) {
      res.status(500).json({ success: false, message: 'Download failed.' });
    }
  }
}
