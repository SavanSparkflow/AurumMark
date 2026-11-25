import { Request, Response } from 'express';
import { SteganographyService } from '../services/steganographyService.js';
import { ActivityLogger } from '../services/activityLogger.js';
import { Design } from '../models/Design.js';

export class ForensicController {
  /**
   * Scans an uploaded file (image or screenshot) for hidden forensic steganography markers
   */
  static async detectLeak(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file || !req.file.buffer) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded for forensic analysis. Please upload an image or screenshot.',
        });
        return;
      }

      const fileBuffer = req.file.buffer;
      const report = await SteganographyService.extractFingerprint(fileBuffer);

      // If matching design ID is in payload, fetch additional design details
      let designRecord = null;
      if (report.detected && report.designFilename) {
        designRecord = await Design.findOne({
          companyId: req.user!.companyId,
          filename: report.designFilename,
        }).select('filename sku metadata createdAt');
      }

      // Log forensic audit activity
      await ActivityLogger.log({
        companyId: req.user!.companyId,
        actorId: req.user!.userId,
        action: 'FORENSIC_LEAK_SCANNED',
        resourceType: 'design',
        metadata: {
          detected: report.detected,
          status: report.status,
          leakedBy: report.leakedBy,
          designFilename: report.designFilename,
        },
        req,
      });

      res.status(200).json({
        success: true,
        data: {
          report,
          design: designRecord,
          analyzedFileSize: req.file.size,
          analyzedMimeType: req.file.mimetype,
          scannedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      console.error('Forensic leak detection error:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Forensic leak analysis failed.',
      });
    }
  }

  /**
   * Tests or generates a forensic demo fingerprint verification
   */
  static async getForensicStatus(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: {
          engine: 'AurumMark Digital Steganography Engine v1.0',
          encryption: 'HMAC-SHA256 Authenticated Fingerprinting',
          status: 'ACTIVE',
          features: [
            'Invisible Pixel-Level Fingerprinting',
            'Tamper-Evident Cryptographic Signature',
            'User & Workspace Attribution',
            'Screenshot & Leak Tracking',
          ],
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
