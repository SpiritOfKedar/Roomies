/** Legacy mock CDN URLs never resolve — treat as missing. */
export function isLegacyProofUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname === 'cdn.roomies.app';
  } catch {
    return false;
  }
}

function isAllowedImageHost(hostname: string): boolean {
  if (hostname === 'cdn.roomies.app') return false;
  if (hostname === 'res.cloudinary.com') return true;
  if (hostname.endsWith('.cloudinary.com')) return true;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  return true;
}

export function resolveProofUrl(url?: string | null): string | null {
  if (!url || isLegacyProofUrl(url)) return null;
  try {
    const { hostname } = new URL(url);
    if (!isAllowedImageHost(hostname)) return null;
  } catch {
    return null;
  }
  return url;
}

/** Resolve proof image from submission record or task-level fallback. */
export function resolveTaskProofUrl(task?: {
  imageUrl?: string | null;
  currentSubmission?: { imageUrl?: string | null } | null;
} | null): { url: string | null; rawUrl?: string | null; legacy: boolean } {
  if (!task) return { url: null, legacy: false };
  const rawUrl = task.currentSubmission?.imageUrl ?? task.imageUrl ?? null;
  const legacy = isLegacyProofUrl(rawUrl);
  return { url: resolveProofUrl(rawUrl), rawUrl, legacy };
}
