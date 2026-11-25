import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { IWatermarkConfiguration } from '../models/WatermarkTemplate.js';
import { IBatchOutputSettings } from '../models/ProcessingBatch.js';
import { ImageProcessorService } from './imageProcessor.js';

// Configure binary paths
if (ffmpegInstaller.path) {
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}
if (ffprobeInstaller.path) {
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
}

export interface IVideoProbeResult {
  width: number;
  height: number;
  duration: number; // in seconds
  fps: number;
  format: string;
  size: number;
  hasAudio: boolean;
}

export interface IVideoProcessingResult {
  outputPath: string;
  width: number;
  height: number;
  duration: number;
  fps: number;
  fileSize: number;
  format: string;
}

export class VideoProcessorService {
  /**
   * Probes video metadata (dimensions, duration, fps, format)
   */
  static async probeVideo(videoPath: string): Promise<IVideoProbeResult> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) return reject(new Error(`FFprobe error: ${err.message}`));
        if (!metadata || !metadata.streams) {
          return reject(new Error('No streams detected in video file.'));
        }

        const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
        if (!videoStream || !videoStream.width || !videoStream.height) {
          return reject(new Error('No valid video stream with resolution detected.'));
        }

        const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');
        const duration = Number(metadata.format?.duration || videoStream.duration || 0);

        let fps = 30;
        if (videoStream.r_frame_rate) {
          const parts = videoStream.r_frame_rate.split('/');
          if (parts.length === 2 && Number(parts[1]) > 0) {
            fps = Math.round(Number(parts[0]) / Number(parts[1]));
          } else {
            fps = Number(videoStream.r_frame_rate) || 30;
          }
        }

        resolve({
          width: videoStream.width,
          height: videoStream.height,
          duration: Math.max(0, duration),
          fps: Math.max(1, fps),
          format: metadata.format?.format_name || 'mp4',
          size: Number(metadata.format?.size || 0),
          hasAudio: !!audioStream,
        });
      });
    });
  }

  /**
   * Extracts a video frame at a given timestamp as a JPEG thumbnail buffer
   */
  static async extractThumbnail(videoPath: string, timestampSec: number = 0.5): Promise<Buffer> {
    const tempDir = os.tmpdir();
    const tempThumbName = `thumb_${crypto.randomBytes(8).toString('hex')}.jpg`;
    const tempThumbPath = path.join(tempDir, tempThumbName);

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestampSec],
          filename: tempThumbName,
          folder: tempDir,
        })
        .on('end', async () => {
          try {
            if (fs.existsSync(tempThumbPath)) {
              const buffer = await fs.promises.readFile(tempThumbPath);
              await fs.promises.unlink(tempThumbPath).catch(() => {});
              resolve(buffer);
            } else {
              // Try fallback to timestamp 0 if screenshot file wasn't created
              if (timestampSec > 0) {
                const retryBuffer = await VideoProcessorService.extractThumbnail(videoPath, 0);
                resolve(retryBuffer);
              } else {
                reject(new Error('Screenshot file was not generated.'));
              }
            }
          } catch (e: any) {
            reject(e);
          }
        })
        .on('error', (err) => {
          if (timestampSec > 0) {
            VideoProcessorService.extractThumbnail(videoPath, 0)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error(`Failed to extract video thumbnail: ${err.message}`));
          }
        });
    });
  }

  /**
   * Applies watermark configuration to a video file using FFmpeg overlay filter
   */
  static async applyWatermark(
    videoPath: string,
    config: IWatermarkConfiguration,
    outputSettings: Partial<IBatchOutputSettings> = {},
    logoBuffer?: Buffer,
    onProgress?: (percent: number) => void
  ): Promise<IVideoProcessingResult> {
    const probe = await this.probeVideo(videoPath);
    let targetWidth = probe.width;
    let targetHeight = probe.height;

    // Optional max resolution scaling
    if (outputSettings.maxWidth && outputSettings.maxWidth < targetWidth) {
      targetHeight = Math.round((outputSettings.maxWidth / targetWidth) * targetHeight);
      targetWidth = outputSettings.maxWidth;
      // Ensure dimensions are even numbers (required by H.264)
      if (targetWidth % 2 !== 0) targetWidth -= 1;
      if (targetHeight % 2 !== 0) targetHeight -= 1;
    }

    // 1. Generate transparent PNG watermark overlay matching target resolution
    const overlayBuffer = await ImageProcessorService.generateWatermarkOverlayBuffer(
      targetWidth,
      targetHeight,
      config,
      logoBuffer
    );

    const tempDir = os.tmpdir();
    const overlayPath = path.join(tempDir, `overlay_${crypto.randomBytes(8).toString('hex')}.png`);
    const outputPath = path.join(tempDir, `watermarked_${crypto.randomBytes(8).toString('hex')}.mp4`);

    await fs.promises.writeFile(overlayPath, overlayBuffer);

    return new Promise((resolve, reject) => {
      let command = ffmpeg(videoPath).input(overlayPath);

      // Construct filter chain: scale video first if needed, then overlay
      const filters: string[] = [];
      if (targetWidth !== probe.width || targetHeight !== probe.height) {
        filters.push(`[0:v]scale=${targetWidth}:${targetHeight}[scaled]`);
        filters.push(`[scaled][1:v]overlay=0:0[outv]`);
      } else {
        filters.push(`[0:v][1:v]overlay=0:0[outv]`);
      }

      command = command
        .complexFilter(filters)
        .outputOptions([
          '-map', '[outv]',
          '-map', '0:a?', // Preserve audio stream if present, ignore if silent
          '-c:v', 'libx264',
          '-pix_fmt', 'yuv420p', // Universal browser playback compatibility
          '-preset', 'veryfast',
          '-crf', '22', // High visual quality
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart', // Web streaming optimization
        ])
        .output(outputPath);

      if (onProgress && probe.duration > 0) {
        command.on('progress', (progress) => {
          if (progress.timemark) {
            const parts = progress.timemark.split(':');
            if (parts.length === 3) {
              const seconds =
                parseFloat(parts[0]) * 3600 +
                parseFloat(parts[1]) * 60 +
                parseFloat(parts[2]);
              const percent = Math.min(99, Math.round((seconds / probe.duration) * 100));
              onProgress(percent);
            }
          } else if (progress.percent) {
            onProgress(Math.min(99, Math.round(progress.percent)));
          }
        });
      }

      command
        .on('end', async () => {
          // Cleanup overlay PNG
          await fs.promises.unlink(overlayPath).catch(() => {});

          try {
            const stats = await fs.promises.stat(outputPath);
            resolve({
              outputPath,
              width: targetWidth,
              height: targetHeight,
              duration: probe.duration,
              fps: probe.fps,
              fileSize: stats.size,
              format: 'mp4',
            });
          } catch (statErr) {
            reject(statErr);
          }
        })
        .on('error', async (err) => {
          await fs.promises.unlink(overlayPath).catch(() => {});
          await fs.promises.unlink(outputPath).catch(() => {});
          reject(new Error(`FFmpeg video watermark failed: ${err.message}`));
        });

      command.run();
    });
  }
}
