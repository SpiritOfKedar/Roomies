/**
 * =============================================================================
 * Signed Upload URLs (local storage)
 * =============================================================================
 * Locally stored images are no longer world-readable. The DB keeps the plain
 * URL; every API response signs it on the way out with an HMAC and an expiry,
 * and GET /uploads/* rejects anything without a valid, unexpired signature.
 *
 * Only members can load the endpoints that return these URLs, so a link is a
 * time-limited capability: a removed member's copies stop working on expiry.
 *
 * Expiries are bucketed so the same image keeps the same URL for hours,
 * which keeps browser image caching effective. A signed URL is valid for
 * 12–24 hours.
 *
 * Cloudinary URLs are not affected (they are public CDN URLs).
 * =============================================================================
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from './env';

const BUCKET_SEC = 12 * 60 * 60;

/** Upload filenames are generated server-side: <uuid>.<ext>. */
const FILENAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/i;

/** Derived from the access secret so no new required env var is needed. */
const signingKey = crypto
  .createHmac('sha256', env.JWT_ACCESS_SECRET)
  .update('roomies:upload-url:v1')
  .digest();

const uploadPrefix = `${env.UPLOAD_PUBLIC_URL.replace(/\/$/, '')}/`;

function signature(filename: string, exp: number): string {
  return crypto.createHmac('sha256', signingKey).update(`${filename}:${exp}`).digest('base64url');
}

function currentExpiry(): number {
  const nowSec = Math.floor(Date.now() / 1000);
  return (Math.floor(nowSec / BUCKET_SEC) + 2) * BUCKET_SEC;
}

/** Sign one URL if it points at local upload storage; anything else is returned unchanged. */
export function signUploadUrl(url: string): string {
  if (!url.startsWith(uploadPrefix)) return url;

  // Strip any query a client echoed back (e.g. an old signed URL saved as-is).
  const filename = url.slice(uploadPrefix.length).split(/[?#]/)[0];
  if (!FILENAME_RE.test(filename)) return url;

  const exp = currentExpiry();
  return `${uploadPrefix}${filename}?exp=${exp}&sig=${signature(filename, exp)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * Deep-copy a response payload, signing every local upload URL found in it.
 * Only plain objects and arrays are walked; Dates, Prisma Decimals and other
 * class instances are passed through untouched.
 */
export function signUploadUrls<T>(value: T): T {
  if (typeof value === 'string') return signUploadUrl(value) as T;
  if (Array.isArray(value)) return value.map((v: unknown) => signUploadUrls(v)) as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = signUploadUrls(v);
    return out as T;
  }
  return value;
}

/** Express guard for GET /uploads/*: requires a valid, unexpired signature. */
export function requireSignedUpload(req: Request, res: Response, next: NextFunction): void {
  const filename = req.path.replace(/^\//, '');
  if (!FILENAME_RE.test(filename)) {
    res.status(404).end();
    return;
  }

  const exp = Number(req.query.exp);
  const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
  const nowSec = Math.floor(Date.now() / 1000);

  const expected = Buffer.from(signature(filename, exp));
  const given = Buffer.from(sig);
  const valid =
    Number.isInteger(exp) &&
    exp >= nowSec &&
    given.length === expected.length &&
    crypto.timingSafeEqual(given, expected);

  if (!valid) {
    res.status(403).end();
    return;
  }

  // The frontend runs on a different origin (and often a different site in
  // production), so helmet's default CORP "same-origin" would make browsers
  // refuse to render these images. Access is already gated by the signature.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  // Private: never let a shared proxy cache a member-only image.
  res.setHeader('Cache-Control', `private, max-age=${Math.min(exp - nowSec, 3600)}`);
  next();
}
