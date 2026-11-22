/**
 * =============================================================================
 * Image Upload Middleware (shared multer config)
 * =============================================================================
 * In-memory storage so the buffer goes straight to storage.uploadImage, which
 * performs the authoritative check on the file's actual bytes. The mimetype
 * allow-list here is only an early, cheap rejection — clients control it.
 * =============================================================================
 */

import multer from 'multer';
import { AppError } from '../utils/app-error';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Raster formats only. SVG is excluded: it can carry script. */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export const UNSUPPORTED_IMAGE_MESSAGE = 'Only JPEG, PNG, GIF or WebP images are allowed';

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(UNSUPPORTED_IMAGE_MESSAGE, 400));
    }
  },
});
