import sharp from 'sharp';
import archiver from 'archiver';
import stream from 'stream';
import { SteganographyService, IForensicPayload } from './steganographyService.js';

export type ResizerPresetKey =
  | 'instagram_post'
  | 'instagram_story'
  | 'shopify_amazon'
  | 'whatsapp_optimized';

export interface IResizerPresetConfig {
  key: ResizerPresetKey;
  label: string;
  description: string;
  aspectRatio: string;
  targetWidth: number;
  targetHeight?: number;
  fit: 'contain' | 'inside' | 'cover';
  defaultBackground: 'white' | 'dark' | 'transparent';
  quality: number;
  suffix: string;
}

export const RESIZER_PRESETS: Record<ResizerPresetKey, IResizerPresetConfig> = {
  instagram_post: {
    key: 'instagram_post',
    label: 'Instagram Post',
    description: '1:1 Square (1080 × 1080) - Ideal for feed posts, carousels, and square showcases.',
    aspectRatio: '1:1',
    targetWidth: 1080,
    targetHeight: 1080,
    fit: 'contain',
    defaultBackground: 'white',
    quality: 90,
    suffix: 'instagram_post_1080x1080',
  },
  instagram_story: {
    key: 'instagram_story',
    label: 'Instagram Story / Reels / WhatsApp Status',
    description: '9:16 Fullscreen Vertical (1080 × 1920) - Perfectly framed for Stories and mobile viewing.',
    aspectRatio: '9:16',
    targetWidth: 1080,
    targetHeight: 1920,
    fit: 'contain',
    defaultBackground: 'white',
    quality: 90,
    suffix: 'story_vertical_1080x1920',
  },
  shopify_amazon: {
    key: 'shopify_amazon',
    label: 'Shopify / Amazon / Website',
    description: '2000 × 2000 Studio Canvas - Pure white background (#FFFFFF) compliant with Amazon & e-commerce guidelines.',
    aspectRatio: '1:1',
    targetWidth: 2000,
    targetHeight: 2000,
    fit: 'contain',
    defaultBackground: 'white',
    quality: 92,
    suffix: 'ecommerce_studio_2000x2000',
  },
  whatsapp_optimized: {
    key: 'whatsapp_optimized',
    label: 'WhatsApp Fast Share',
    description: 'Lightweight compressed (Max 1200px, <300KB) - Rapid sending on cellular data without blur.',
    aspectRatio: 'Original',
    targetWidth: 1200,
    targetHeight: 1200,
    fit: 'inside',
    defaultBackground: 'white',
    quality: 72,
    suffix: 'whatsapp_fast_1200px',
  },
};

export interface ProcessedVariant {
  presetKey: ResizerPresetKey;
  label: string;
  filename: string;
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  aspectRatio: string;
}

export class ResizerService {
  /**
   * Returns metadata and specs of all available social & e-commerce presets
   */
  static getPresets(): IResizerPresetConfig[] {
    return Object.values(RESIZER_PRESETS);
  }

  /**
   * Resizes an input image buffer to a single platform preset
   */
  static async resizeImage(params: {
    inputBuffer: Buffer;
    presetKey: ResizerPresetKey;
    baseFilename: string;
    backgroundPreference?: 'white' | 'dark' | 'transparent';
    forensicPayload?: IForensicPayload;
  }): Promise<ProcessedVariant> {
    const { inputBuffer, presetKey, baseFilename, backgroundPreference, forensicPayload } = params;
    const preset = RESIZER_PRESETS[presetKey];

    if (!preset) {
      throw new Error(`Invalid preset key: ${presetKey}`);
    }

    const bgChoice = backgroundPreference || preset.defaultBackground;
    const bgRgb =
      bgChoice === 'dark'
        ? { r: 15, g: 23, b: 42, alpha: 1 }
        : { r: 255, g: 255, b: 255, alpha: 1 };

    // Inspect input
    const inputMeta = await sharp(inputBuffer).metadata();

    let pipeline = sharp(inputBuffer);

    // Flatten alpha channels to chosen background to prevent black outlines
    if (inputMeta.hasAlpha) {
      pipeline = pipeline.flatten({ background: bgRgb });
    }

    if (preset.fit === 'inside') {
      // WhatsApp Fast Share: inside bounding box preserving exact original aspect ratio
      pipeline = pipeline.resize(preset.targetWidth, preset.targetHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    } else {
      // Contain within exact canvas dimensions with uniform padding
      pipeline = pipeline.resize(preset.targetWidth, preset.targetHeight, {
        fit: 'contain',
        background: bgRgb,
      });
    }

    // Colorspace normalization and MozJPEG encoding
    pipeline = pipeline.toColorspace('srgb').jpeg({
      quality: preset.quality,
      mozjpeg: true,
      chromaSubsampling: '4:4:4',
    });

    let outputBuffer = await pipeline.toBuffer();

    // Optionally embed forensic steganography into the resized variant
    if (forensicPayload) {
      try {
        outputBuffer = await SteganographyService.embedFingerprint(outputBuffer, forensicPayload);
      } catch {
        // Fall back to clean outputBuffer if steganography embedding fails
      }
    }

    const outMeta = await sharp(outputBuffer).metadata();
    const cleanBase = baseFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const outFilename = `${cleanBase}_${preset.suffix}.jpg`;

    return {
      presetKey,
      label: preset.label,
      filename: outFilename,
      buffer: outputBuffer,
      mimeType: 'image/jpeg',
      width: outMeta.width || preset.targetWidth,
      height: outMeta.height || preset.targetHeight || preset.targetWidth,
      fileSize: outputBuffer.length,
      aspectRatio: preset.aspectRatio,
    };
  }

  /**
   * Resizes an input image to multiple selected presets
   */
  static async resizeMultiple(params: {
    inputBuffer: Buffer;
    presetKeys: ResizerPresetKey[];
    baseFilename: string;
    backgroundPreference?: 'white' | 'dark' | 'transparent';
    forensicPayload?: IForensicPayload;
  }): Promise<ProcessedVariant[]> {
    const { inputBuffer, presetKeys, baseFilename, backgroundPreference, forensicPayload } = params;

    const variants: ProcessedVariant[] = [];
    for (const key of presetKeys) {
      const variant = await this.resizeImage({
        inputBuffer,
        presetKey: key,
        baseFilename,
        backgroundPreference,
        forensicPayload,
      });
      variants.push(variant);
    }

    return variants;
  }

  /**
   * Creates a streaming ZIP archive containing all resized platform variants
   */
  static async createBundleZip(params: {
    variants: Array<{ filename: string; buffer: Buffer }>;
    zipComment?: string;
  }): Promise<Buffer> {
    const { variants, zipComment } = params;

    return new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', {
        zlib: { level: 6 },
        comment: zipComment || 'Generated by AurumMark Multi-Platform Auto-Resizer',
      });

      const chunks: Buffer[] = [];
      const passThrough = new stream.PassThrough();

      passThrough.on('data', (chunk) => chunks.push(chunk));
      passThrough.on('end', () => resolve(Buffer.concat(chunks)));
      passThrough.on('error', (err) => reject(err));

      archive.on('error', (err) => reject(err));
      archive.pipe(passThrough);

      for (const item of variants) {
        archive.append(item.buffer, { name: item.filename });
      }

      archive.finalize();
    });
  }
}

