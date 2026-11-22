/**
 * =============================================================================
 * Storage Utility — Image Upload
 * =============================================================================
 * Uploads to Cloudinary when configured; otherwise local disk + static URL.
 * =============================================================================
 */

import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';
import { logger } from './logger';
import { AppError } from './app-error';

type ImageExt = 'jpg' | 'png' | 'gif' | 'webp';

/**
 * Identify an image by its magic bytes. The client-supplied mimetype is not
 * trusted: anything that is not a real JPEG/PNG/GIF/WebP (SVG, HTML, scripts
 * renamed to .png, …) is rejected.
 */
export function detectImageType(buf: Buffer): ImageExt | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return 'png';
  const head6 = buf.subarray(0, 6).toString('ascii');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'gif';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'webp';
  return null;
}

let uploadDirReady = false;

function isCloudinaryConfigured(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function initCloudinary(): void {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME!,
    api_key: env.CLOUDINARY_API_KEY!,
    api_secret: env.CLOUDINARY_API_SECRET!,
    secure: true,
  });
}

async function ensureUploadDir(): Promise<void> {
  if (uploadDirReady) return;
  await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
  uploadDirReady = true;
}

async function uploadToCloudinary(buffer: Buffer, ext: ImageExt): Promise<string> {
  initCloudinary();

  const folder = env.CLOUDINARY_FOLDER;

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: folder || undefined,
        format: ext,
      },
      (err, res) => {
        if (err || !res?.secure_url) {
          reject(err ?? new Error('Cloudinary upload failed'));
          return;
        }
        resolve({ secure_url: res.secure_url });
      },
    );
    stream.end(buffer);
  });

  logger.debug({ publicUrl: result.secure_url }, 'Image uploaded to Cloudinary');
  return result.secure_url;
}

async function uploadToLocal(buffer: Buffer, ext: ImageExt): Promise<string> {
  await ensureUploadDir();

  const filename = `${randomUUID()}.${ext}`;
  const filePath = path.join(env.UPLOAD_DIR, filename);

  await fs.writeFile(filePath, buffer);

  const publicUrl = `${env.UPLOAD_PUBLIC_URL.replace(/\/$/, '')}/${filename}`;
  logger.debug({ filePath, publicUrl }, 'Image uploaded locally');
  return publicUrl;
}

/**
 * Upload an image buffer to storage and return its public URL.
 */
export async function uploadImage(buffer: Buffer, _mimetype?: string): Promise<string> {
  const ext = detectImageType(buffer);
  if (!ext) {
    throw new AppError('Only JPEG, PNG, GIF or WebP images are allowed', 400);
  }
  if (isCloudinaryConfigured()) {
    return uploadToCloudinary(buffer, ext);
  }
  return uploadToLocal(buffer, ext);
}

/** Ensure upload directory exists at startup (local fallback). */
export async function initStorage(): Promise<void> {
  if (isCloudinaryConfigured()) {
    initCloudinary();
    logger.info({ folder: env.CLOUDINARY_FOLDER }, 'Cloudinary storage initialized');
    return;
  }
  await ensureUploadDir();
  logger.info({ uploadDir: env.UPLOAD_DIR }, 'Local upload storage initialized');
}
