/**
 * =============================================================================
 * Environment Configuration — Validated with Zod
 * =============================================================================
 * All environment variables are validated at startup. If any required variable
 * is missing or malformed, the process exits immediately with a clear error.
 * This prevents runtime crashes from misconfiguration.
 * =============================================================================
 */

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Schema for all required environment variables.
 * Add new variables here as the system grows.
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  // Bcrypt
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Task / voting
  TASK_MAX_RESUBMISSIONS: z.coerce.number().int().positive().default(3),
  TASK_MAX_OPEN_PER_USER: z.coerce.number().int().positive().default(2),
  ROTATION_DEFAULT_DEADLINE_DAYS: z.coerce.number().int().positive().default(7),

  // File uploads (local fallback when Cloudinary is not configured)
  UPLOAD_DIR: z.string().default('/app/uploads'),
  UPLOAD_PUBLIC_URL: z.string().default('http://localhost:3005/uploads'),

  // Cloudinary (optional — when all three are set, uploads go to Cloudinary)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('roomies'),
});

/**
 * Parse and validate environment variables.
 * On failure, log the specific issues and exit the process.
 */
function validateEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }

  return result.data;
}

/**
 * Validated, typed environment configuration.
 * Import this instead of reading `process.env` directly.
 */
export const env = validateEnv();
