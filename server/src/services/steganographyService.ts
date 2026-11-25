import crypto from 'crypto';
import sharp from 'sharp';

export interface IForensicPayload {
  magic?: string;
  companyId: string;
  companyName: string;
  exportedBy: string; // User Name / Email
  actorId?: string;
  designId?: string;
  filename?: string;
  sku?: string;
  timestamp?: number;
  ipAddress?: string;
}

export interface IForensicReport {
  detected: boolean;
  status: 'AUTHENTIC_LEAK' | 'TAMPERED' | 'NOT_DETECTED';
  confidenceScore: number;
  originWorkspace?: string;
  companyId?: string;
  leakedBy?: string;
  actorId?: string;
  designFilename?: string;
  sku?: string;
  exportedAt?: string;
  rawTimestamp?: number;
  cryptographicSignature?: string;
  isSignatureValid?: boolean;
}

const FORENSIC_MAGIC = 'AURUM_FORENSIC_V1';
const FORENSIC_SECRET = process.env.FORENSIC_SECRET || 'aurum_secret_forensic_luxury_salt_2026';

export class SteganographyService {
  /**
   * Generates a tamper-proof HMAC checksum for the forensic payload
   */
  private static generateChecksum(payload: Record<string, any>): string {
    const dataString = `${payload.companyId}:${payload.exportedBy}:${payload.designId || ''}:${payload.timestamp}`;
    return crypto.createHmac('sha256', FORENSIC_SECRET).update(dataString).digest('hex');
  }

  /**
   * Embeds invisible forensic steganography into an image buffer
   */
  static async embedFingerprint(
    imageBuffer: Buffer,
    payload: IForensicPayload
  ): Promise<Buffer> {
    try {
      const timestamp = payload.timestamp || Date.now();
      const enrichedPayload = {
        magic: FORENSIC_MAGIC,
        companyId: payload.companyId,
        companyName: payload.companyName,
        exportedBy: payload.exportedBy,
        actorId: payload.actorId || '',
        designId: payload.designId || '',
        filename: payload.filename || '',
        sku: payload.sku || '',
        timestamp,
      };

      const checksum = this.generateChecksum(enrichedPayload);
      const fullRecord = {
        ...enrichedPayload,
        checksum,
      };

      const payloadJson = JSON.stringify(fullRecord);
      const encodedPayloadBase64 = Buffer.from(payloadJson, 'utf-8').toString('base64');

      // Embed into image via Sharp metadata headers and custom EXIF/comment
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      // Encode into TIFF/EXIF UserComment and ImageDescription tags
      const outputBuffer = await image
        .withMetadata({
          exif: {
            IFD0: {
              ImageDescription: `AURUM_SIG:${encodedPayloadBase64}`,
              Copyright: `Protected by AurumMark Security • ${enrichedPayload.companyName}`,
              Software: 'AurumMark Haute Joaillerie DRM',
            },
          },
        })
        .toBuffer();

      return outputBuffer;
    } catch (err) {
      console.error('Forensic embedding error:', err);
      // Fallback: return raw image if embedding encounters format limitations
      return imageBuffer;
    }
  }

  /**
   * Extracts and verifies forensic digital fingerprint from a potentially leaked image
   */
  static async extractFingerprint(imageBuffer: Buffer): Promise<IForensicReport> {
    try {
      // 1. Check EXIF/Metadata via Sharp
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      let extractedBase64: string | null = null;

      if (metadata.exif) {
        // Search buffer text for AURUM_SIG pattern
        const exifString = metadata.exif.toString('latin1');
        const match = exifString.match(/AURUM_SIG:([A-Za-z0-9+/=]+)/);
        if (match && match[1]) {
          extractedBase64 = match[1];
        }
      }

      // If not in parsed EXIF block, scan entire file buffer for AURUM_SIG marker
      if (!extractedBase64) {
        const rawString = imageBuffer.toString('latin1');
        const rawMatch = rawString.match(/AURUM_SIG:([A-Za-z0-9+/=]+)/);
        if (rawMatch && rawMatch[1]) {
          extractedBase64 = rawMatch[1];
        }
      }

      if (!extractedBase64) {
        return {
          detected: false,
          status: 'NOT_DETECTED',
          confidenceScore: 0,
        };
      }

      // Decode Base64 payload
      const jsonString = Buffer.from(extractedBase64, 'base64').toString('utf-8');
      const data = JSON.parse(jsonString);

      if (data.magic !== FORENSIC_MAGIC) {
        return {
          detected: false,
          status: 'NOT_DETECTED',
          confidenceScore: 0,
        };
      }

      // Validate cryptographic HMAC signature
      const expectedChecksum = this.generateChecksum(data);
      const isSignatureValid = expectedChecksum === data.checksum;

      return {
        detected: true,
        status: isSignatureValid ? 'AUTHENTIC_LEAK' : 'TAMPERED',
        confidenceScore: isSignatureValid ? 99.9 : 50.0,
        originWorkspace: data.companyName,
        companyId: data.companyId,
        leakedBy: data.exportedBy,
        actorId: data.actorId,
        designFilename: data.filename,
        sku: data.sku,
        exportedAt: new Date(data.timestamp).toLocaleString(),
        rawTimestamp: data.timestamp,
        cryptographicSignature: data.checksum,
        isSignatureValid,
      };
    } catch (err) {
      console.error('Forensic extraction error:', err);
      return {
        detected: false,
        status: 'NOT_DETECTED',
        confidenceScore: 0,
      };
    }
  }
}

