/**
 * =============================================================================
 * Storage Utility — Image Upload
 * =============================================================================
 * Provides a mockable `uploadImage` function that accepts a raw file Buffer
 * and returns a public URL string.
 *
 * PRODUCTION SWAP:
 *   Replace the body of `uploadImage` with your actual S3 / Cloudinary logic.
 *   The function signature and Buffer-based contract must remain unchanged so
 *   that Multer-based callers never need updating.
 *
 *   Example S3 swap:
 *     import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
 *     const s3 = new S3Client({ region: process.env.AWS_REGION });
 *     await s3.send(new PutObjectCommand({
 *       Bucket: process.env.S3_BUCKET!,
 *       Key: filename,
 *       Body: buffer,
 *       ContentType: mimetype,
 *       ACL: 'public-read',
 *     }));
 *     return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${filename}`;
 * =============================================================================
 */

import { randomUUID } from 'crypto';

/**
 * Upload an image buffer to storage and return its public URL.
 *
 * @param buffer   - Raw file bytes from Multer's memoryStorage
 * @param mimetype - MIME type (e.g. 'image/jpeg', 'image/png')
 * @returns        - Public URL of the stored image
 */
export async function uploadImage(buffer: Buffer, mimetype: string): Promise<string> {
  // Derive a safe file extension from the MIME type
  const ext = mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';

  // Generate a collision-resistant filename
  const filename = `${randomUUID()}.${ext}`;

  // ── MOCK ──────────────────────────────────────────────────────────────────
  // The buffer IS available and could be piped to any cloud storage SDK.
  // The `void buffer` line is purely to satisfy the no-unused-vars linter rule
  // during the mock phase; remove it when wiring up a real SDK.
  void buffer;
  // ─────────────────────────────────────────────────────────────────────────

  const fakeUrl = `https://cdn.roomies.app/uploads/${filename}`;
  return fakeUrl;
}
