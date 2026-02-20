/**
 * =============================================================================
 * Logger — Centralized Pino Instance
 * =============================================================================
 * Uses Pino for structured, high-performance logging.
 * - Development: Pretty-printed output for readability.
 * - Production: JSON output for log aggregation systems.
 * =============================================================================
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
});
