/** Legacy mock CDN URLs never resolve — treat as missing. */
export function isLegacyProofUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname === 'cdn.roomies.app';
  } catch {
    return false;
  }
}

export function resolveProofUrl(url?: string | null): string | null {
  if (!url || isLegacyProofUrl(url)) return null;
  return url;
}
