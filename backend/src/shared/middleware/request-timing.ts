import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const SLOW_MS = 500;

/**
 * Logs requests that exceed SLOW_MS. Skips health checks.
 */
export function requestTiming(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health') {
    next();
    return;
  }

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    if (elapsedMs >= SLOW_MS) {
      logger.warn(
        { method: req.method, path: req.originalUrl, status: res.statusCode, durationMs: Math.round(elapsedMs) },
        'Slow request',
      );
    }
  });

  next();
}
