/**
 * =============================================================================
 * API Response Envelope
 * =============================================================================
 * All API responses follow a strict envelope format:
 *   { success: boolean, data: T | null, error: string | null }
 *
 * This ensures consistent client-side parsing and error handling.
 * =============================================================================
 */

import { Response } from 'express';
import { signUploadUrls } from './upload-urls';

/**
 * Standard API response shape.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: string | null;
}

/**
 * Send a success response with data.
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const body: ApiResponse<T> = {
    success: true,
    // Local upload URLs leave the API signed + expiring (see upload-urls.ts)
    data: signUploadUrls(data),
    error: null,
  };
  res.status(statusCode).json(body);
}

/**
 * Send an error response.
 */
export function sendError(res: Response, error: string, statusCode = 400): void {
  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error,
  };
  res.status(statusCode).json(body);
}

/**
 * Send a paginated success response.
 * Includes cursor/offset metadata for client pagination.
 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export function sendPaginated<T>(
  res: Response,
  items: T[],
  total: number,
  limit: number,
  offset: number,
): void {
  const body: ApiResponse<PaginatedData<T>> = {
    success: true,
    data: {
      items: signUploadUrls(items),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
    error: null,
  };
  res.status(200).json(body);
}
