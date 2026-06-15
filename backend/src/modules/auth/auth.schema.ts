/**
 * =============================================================================
 * Auth Validation Schemas — Zod
 * =============================================================================
 * Input validation schemas for all auth endpoints.
 * Used with the `validate()` middleware to sanitize and type-check
 * request bodies before they reach the controller.
 * =============================================================================
 */

import { z } from 'zod';

// ---- Register ----

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be at most 255 characters')
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ---- Login ----

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ---- Refresh Token ----

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshInput = z.infer<typeof refreshSchema>;

// ---- Google OAuth ----

export const googleIdTokenSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});

export type GoogleIdTokenInput = z.infer<typeof googleIdTokenSchema>;

export const googleCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
});

export type GoogleCallbackInput = z.infer<typeof googleCallbackSchema>;
