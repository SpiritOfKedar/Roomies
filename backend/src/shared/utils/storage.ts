/**
 * =============================================================================
 * Storage Utility — Image Upload
 * =============================================================================
 * Persists uploaded images to local disk and returns a public URL.
 * In Docker, mount UPLOAD_DIR as a volume and serve via express.static.
 * =============================================================================
 */

import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { env } from './env';
import { logger } from './logger';

let uploadDirReady = false;

async function ensureUploadDir(): Promise<void> {
  if (uploadDirReady) return;
  await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
  uploadDirReady = true;
}

/**
 * Upload an image buffer to storage and return its public URL.
 */
export async function uploadImage(buffer: Buffer, mimetype: string): Promise<string> {
  await ensureUploadDir();

  const ext = mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const filename = `${randomUUID()}.${ext}`;
  const filePath = path.join(env.UPLOAD_DIR, filename);

  await fs.writeFile(filePath, buffer);

  const publicUrl = `${env.UPLOAD_PUBLIC_URL.replace(/\/$/, '')}/${filename}`;
  logger.debug({ filePath, publicUrl }, 'Image uploaded');
  return publicUrl;
}

/** Ensure upload directory exists at startup. */
export async function initStorage(): Promise<void> {
  await ensureUploadDir();
  logger.info({ uploadDir: env.UPLOAD_DIR }, 'Upload storage initialized');
}
