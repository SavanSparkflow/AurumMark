import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { IWatermarkConfiguration } from '../models/WatermarkTemplate.js';
import { IBatchOutputSettings } from '../models/ProcessingBatch.js';

// Resolve directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fontsDir = path.resolve(__dirname, '../assets/fonts');

// Base64 font loader cache
let fontFaceCss = '';
try {
  const fontDefinitions = [
    { file: 'Outfit-Variable.ttf', family: 'Outfit', weight: '100 900' },
    { file: 'Poppins-Regular.ttf', family: 'Poppins', weight: '400' },
    { file: 'Poppins-SemiBold.ttf', family: 'Poppins', weight: '600' },
    { file: 'Cinzel-SemiBold.ttf', family: 'Cinzel', weight: '400 800' },
    { file: 'PlayfairDisplay-SemiBold.ttf', family: 'Playfair Display', weight: '400 800' },
    { file: 'Montserrat-SemiBold.ttf', family: 'Montserrat', weight: '400 800' },
    { file: 'CormorantGaramond-SemiBold.ttf', family: 'Cormorant Garamond', weight: '400 800' },
    { file: 'GreatVibes-Regular.ttf', family: 'Great Vibes', weight: '400' },
  ];

  fontFaceCss = fontDefinitions
    .map((def) => {
      const filePath = path.join(fontsDir, def.file);
      if (!fs.existsSync(filePath)) return '';
      const b64 = fs.readFileSync(filePath).toString('base64');
      return `
        @font-face {
          font-family: '${def.family}';
          src: url(data:font/truetype;charset=utf-8;base64,${b64}) format('truetype');
          font-weight: ${def.weight};
        }
      `;
    })
    .join('\n');
} catch (err) {
  console.warn('Could not pre-load font files for SVG font-face embedding:', err);
}

const ALLOWED_FONTS = [
  'Outfit',
  'Poppins',
  'Cinzel',
  'Playfair Display',
  'Montserrat',
  'Cormorant Garamond',
  'Great Vibes',
];

function getSafeFontFamily(font?: string): string {
  if (font && ALLOWED_FONTS.includes(font)) {
    return font;
  }
  return 'Outfit';
}

function getFontFallback(font: string): string {
  if (['Cinzel', 'Playfair Display', 'Cormorant Garamond'].includes(font)) return 'serif';
  if (font === 'Great Vibes') return 'cursive';
  return 'sans-serif';
}

function parseColorAndOpacity(colorStr?: string, defaultOpacity = 0.75): { hex: string; opacity: number } {
  if (!colorStr) return { hex: '#000000', opacity: defaultOpacity };
  const trimmed = colorStr.trim();
  const rgbaMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgbaMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbaMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbaMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbaMatch[3], 10)));
    const a = rgbaMatch[4] !== undefined ? Math.min(1, Math.max(0, parseFloat(rgbaMatch[4]))) : defaultOpacity;
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    return { hex, opacity: a };
  }
  if (trimmed.startsWith('#')) {
    if (trimmed.length === 9) {
      const hex = trimmed.slice(0, 7);
      const a = parseInt(trimmed.slice(7, 9), 16) / 255;
      return { hex, opacity: Number(a.toFixed(2)) };
    }
    return { hex: trimmed, opacity: defaultOpacity };
  }
  return { hex: '#000000', opacity: defaultOpacity };
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export interface ProcessImageOptions {
  inputBuffer: Buffer;
  config: IWatermarkConfiguration;
  outputSettings: IBatchOutputSettings;
  logoBuffer?: Buffer;
}

export interface ProcessImageResult {
  outputBuffer: Buffer;
  width: number;
  height: number;
  format: string;
  fileSize: number;
}

export class ImageProcessorService {
  /**
   * Applies the watermark configuration to an image buffer and returns the processed buffer
   */
  static async processImage(options: ProcessImageOptions): Promise<ProcessImageResult> {
    const { inputBuffer, config, outputSettings, logoBuffer } = options;

    // 1. Load image and auto-orient EXIF
    let pipeline = sharp(inputBuffer).rotate();
    const metadata = await pipeline.metadata();
    const origWidth = metadata.width || 1200;
    const origHeight = metadata.height || 1200;

    let targetWidth = origWidth;
    let targetHeight = origHeight;

    // Optional resizing if configured in output settings
    if (outputSettings.maxWidth && outputSettings.maxWidth < targetWidth) {
      targetHeight = Math.round((outputSettings.maxWidth / targetWidth) * targetHeight);
      targetWidth = outputSettings.maxWidth;
      pipeline = pipeline.resize(targetWidth, targetHeight);
    }

    const composites: sharp.OverlayOptions[] = [];

    // Safe margin
    const marginRatio = typeof config.marginPercent === 'number' ? config.marginPercent : 0.04;
    const safeMarginX = Math.round(targetWidth * marginRatio);
    const safeMarginY = Math.round(targetHeight * marginRatio);

    // 2. Process Logo Watermark if enabled and buffer provided
    if (config.logoConfig?.enabled && logoBuffer) {
      try {
        const logoScaleRatio = config.logoConfig.scaleRatio || 0.15;
        const logoTargetWidth = Math.max(30, Math.round(targetWidth * logoScaleRatio));
        
        let logoPipeline = sharp(logoBuffer)
          .resize(logoTargetWidth, null, { fit: 'inside' });

        if (config.logoConfig.rotation) {
          logoPipeline = logoPipeline.rotate(config.logoConfig.rotation, {
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          });
        }

        let processedLogo = await logoPipeline.toBuffer();
        const logoMeta = await sharp(processedLogo).metadata();
        const lw = logoMeta.width || logoTargetWidth;
        const lh = logoMeta.height || logoTargetWidth;

        // Apply opacity via linear channel or buffer compositing
        const opacity = typeof config.logoConfig.opacity === 'number' ? config.logoConfig.opacity : 0.85;
        if (opacity < 1.0) {
          // Multiply alpha channel
          const alphaAdjusted = await sharp(processedLogo)
            .composite([
              {
                input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
                raw: { width: 1, height: 1, channels: 4 },
                tile: true,
                blend: 'dest-in',
              },
            ])
            .toBuffer();
          processedLogo = alphaAdjusted;
        }

        // Calculate positions from normalized coordinates
        let posX = Math.round(targetWidth * (config.logoConfig.normalizedX ?? 0.85));
        let posY = Math.round(targetHeight * (config.logoConfig.normalizedY ?? 0.85));

        // Center anchor adjustment
        posX = Math.round(posX - lw / 2);
        posY = Math.round(posY - lh / 2);

        // Clamp inside safe margin
        posX = Math.max(safeMarginX, Math.min(targetWidth - lw - safeMarginX, posX));
        posY = Math.max(safeMarginY, Math.min(targetHeight - lh - safeMarginY, posY));

        composites.push({
          input: processedLogo,
          left: Math.round(posX),
          top: Math.round(posY),
        });
      } catch (err) {
        console.error('Failed to composite logo watermark:', err);
      }
    }

    // 3. Process Text Watermark if enabled
    if (config.textConfig?.enabled && config.textConfig.text) {
      const text = escapeXml(config.textConfig.text.trim());
      const fontFamily = getSafeFontFamily(config.textConfig.fontFamily);
      const fontFallback = getFontFallback(fontFamily);
      const fontSize = Math.max(
        12,
        Math.round(Math.min(targetWidth, targetHeight) * (config.textConfig.fontSizeRatio || 0.045))
      );
      const fontWeight = config.textConfig.fontWeight || '600';
      const color = config.textConfig.color || '#FFFFFF';
      const opacity = typeof config.textConfig.opacity === 'number' ? config.textConfig.opacity : 0.8;
      const rotation = config.textConfig.rotation || 0;
      const scaleFactor = Math.min(targetWidth, targetHeight) / 600;
      const rawLetterSpacing = typeof config.textConfig.letterSpacing === 'number' ? config.textConfig.letterSpacing : 2;
      const letterSpacing = Math.round(rawLetterSpacing * scaleFactor);
      const alignment = config.textConfig.alignment || 'center';

      // Normalized coordinates
      const normX = config.textConfig.normalizedX ?? 0.85;
      const normY = config.textConfig.normalizedY ?? 0.9;
      const textX = Math.round(targetWidth * normX);
      const textY = Math.round(targetHeight * normY);

      // SVG text anchor
      let textAnchor = 'middle';
      if (alignment === 'left') textAnchor = 'start';
      if (alignment === 'right') textAnchor = 'end';

      // Shadow filter with proportional resolution scaling & SVG compliant flood attributes
      let shadowSvg = '';
      let filterAttr = '';

      if (config.textConfig.shadow) {
        const shadowScale = Math.max(1, fontSize / 28);
        const rawDx = typeof config.textConfig.shadow.offsetX === 'number' ? config.textConfig.shadow.offsetX : 2;
        const rawDy = typeof config.textConfig.shadow.offsetY === 'number' ? config.textConfig.shadow.offsetY : 2;
        const rawBlur = typeof config.textConfig.shadow.blur === 'number' ? config.textConfig.shadow.blur : 4;

        const shadowDx = Math.round(rawDx * shadowScale);
        const shadowDy = Math.round(rawDy * shadowScale);
        const shadowStdDev = Math.max(0.5, Number(((rawBlur * shadowScale) / 2).toFixed(1)));

        const { hex: shadowHex, opacity: shadowOpacity } = parseColorAndOpacity(config.textConfig.shadow.color, 0.75);

        shadowSvg = `
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="${shadowDx}" dy="${shadowDy}" stdDeviation="${shadowStdDev}" flood-color="${shadowHex}" flood-opacity="${shadowOpacity}" />
          </filter>
        `;
        filterAttr = 'filter="url(#shadow)"';
      }

      // Stroke style
      const strokeAttr = config.textConfig.stroke && config.textConfig.stroke.width > 0
        ? `stroke="${config.textConfig.stroke.color}" stroke-width="${config.textConfig.stroke.width}" paint-order="stroke fill"`
        : '';

      const svgOverlay = `
        <svg width="${targetWidth}" height="${targetHeight}" viewBox="0 0 ${targetWidth} ${targetHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <style>
              ${fontFaceCss}
              .wm-text {
                font-family: '${fontFamily}', ${fontFallback};
                font-size: ${fontSize}px;
                font-weight: ${fontWeight};
                letter-spacing: ${letterSpacing}px;
                fill: ${color};
                fill-opacity: ${opacity};
              }
            </style>
            ${shadowSvg}
          </defs>
          <g transform="rotate(${rotation}, ${textX}, ${textY})" ${filterAttr}>
            <text x="${textX}" y="${textY}" text-anchor="${textAnchor}" dominant-baseline="middle" dy="0.35em" class="wm-text" ${strokeAttr}>
              ${text}
            </text>
          </g>
        </svg>
      `;

      composites.push({
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      });
    }

    // 4. Process Tiled Watermark if enabled
    if (config.tiledConfig?.enabled && config.tiledConfig.text) {
      const tileText = escapeXml(config.tiledConfig.text.trim());
      const tileFont = getSafeFontFamily(config.tiledConfig.fontFamily);
      const tileFontFallback = getFontFallback(tileFont);
      const tileFontSize = Math.max(
        10,
        Math.round(Math.min(targetWidth, targetHeight) * (config.tiledConfig.fontSizeRatio || 0.03))
      );
      const tileAngle = config.tiledConfig.angle || -30;
      const tileOpacity = typeof config.tiledConfig.opacity === 'number' ? config.tiledConfig.opacity : 0.18;
      const tileSpacingX = config.tiledConfig.spacingX || 160;
      const tileSpacingY = config.tiledConfig.spacingY || 120;
      const tileColor = config.tiledConfig.color || '#FFFFFF';

      let textElements = '';
      for (let y = -targetHeight * 0.3; y < targetHeight * 1.5; y += tileSpacingY) {
        for (let x = -targetWidth * 0.3; x < targetWidth * 1.5; x += tileSpacingX) {
          textElements += `<text x="${Math.round(x)}" y="${Math.round(y)}" text-anchor="middle" dominant-baseline="middle">${tileText}</text>\n`;
        }
      }

      const tiledSvg = `
        <svg width="${targetWidth}" height="${targetHeight}" viewBox="0 0 ${targetWidth} ${targetHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <style>
              ${fontFaceCss}
              .tile-text {
                font-family: '${tileFont}', ${tileFontFallback};
                font-size: ${tileFontSize}px;
                font-weight: 500;
                letter-spacing: 2px;
                fill: ${tileColor};
                fill-opacity: ${tileOpacity};
              }
            </style>
          </defs>
          <g transform="rotate(${tileAngle}, ${targetWidth / 2}, ${targetHeight / 2})" class="tile-text">
            ${textElements}
          </g>
        </svg>
      `;

      composites.push({
        input: Buffer.from(tiledSvg),
        top: 0,
        left: 0,
      });
    }

    // Apply overlays
    if (composites.length > 0) {
      pipeline = pipeline.composite(composites);
    }

    // Configure output format, quality, and metadata
    const format = outputSettings.format || 'jpeg';
    const quality = Math.min(100, Math.max(10, outputSettings.quality || 90));

    // Configure EXIF metadata stripping or preservation
    if (outputSettings.stripMetadata) {
      // Production privacy mode:
      // Sharp strips EXIF, GPS coordinates, camera model, date/time, and software tags by default.
      // Normalize to sRGB to ensure accurate, consistent jewelry colors across all web browsers and devices.
      pipeline = pipeline.toColorspace('srgb');
    } else {
      // Production privacy disabled:
      // Preserve original camera EXIF tags, color profile, and creation metadata.
      pipeline = pipeline.withMetadata();
    }

    let finalPipeline: sharp.Sharp;
    if (format === 'png') {
      finalPipeline = pipeline.png({ compressionLevel: 8 });
    } else if (format === 'webp') {
      finalPipeline = pipeline.webp({ quality });
    } else {
      // For JPEG format, convert transparent areas to pure white so jewelry PNG cutouts do not get black backgrounds
      if (metadata.hasAlpha) {
        pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });
      }
      finalPipeline = pipeline.jpeg({ quality, mozjpeg: true });
    }

    const outputBuffer = await finalPipeline.toBuffer();
    const finalMeta = await sharp(outputBuffer).metadata();

    return {
      outputBuffer,
      width: finalMeta.width || targetWidth,
      height: finalMeta.height || targetHeight,
      format,
      fileSize: outputBuffer.length,
    };
  }

  /**
   * Generates a transparent PNG overlay buffer containing the exact watermark layers
   * (Text, Logo, Tiled, Drop Shadow) sized perfectly for a video or canvas.
   */
  static async generateWatermarkOverlayBuffer(
    targetWidth: number,
    targetHeight: number,
    config: IWatermarkConfiguration,
    logoBuffer?: Buffer
  ): Promise<Buffer> {
    const transparentCanvas = await sharp({
      create: {
        width: Math.max(10, Math.round(targetWidth)),
        height: Math.max(10, Math.round(targetHeight)),
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const result = await this.processImage({
      inputBuffer: transparentCanvas,
      config,
      outputSettings: {
        format: 'png',
        quality: 100,
        stripMetadata: true,
      },
      logoBuffer,
    });

    return result.outputBuffer;
  }
}
