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

async function uploadToCloudinary(buffer: Buffer, mimetype: string): Promise<string> {
  initCloudinary();

  const ext = mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const folder = env.CLOUDINARY_FOLDER;

  const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: folder || undefined,
        format: ext === 'bin' ? undefined : ext,
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

async function uploadToLocal(buffer: Buffer, mimetype: string): Promise<string> {
  await ensureUploadDir();

  const ext = mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
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
export async function uploadImage(buffer: Buffer, mimetype: string): Promise<string> {
  if (isCloudinaryConfigured()) {
    return uploadToCloudinary(buffer, mimetype);
  }
  return uploadToLocal(buffer, mimetype);
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
