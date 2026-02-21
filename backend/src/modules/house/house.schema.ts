/**
 * =============================================================================
 * House Validation Schemas — Zod
 * =============================================================================
 * Input validation for house-related endpoints.
 * =============================================================================
 */

import { z } from 'zod';

// ---- Create House ----

export const createHouseSchema = z.object({
  name: z
    .string()
    .min(2, 'House name must be at least 2 characters')
    .max(100, 'House name must be at most 100 characters')
    .trim(),
});

export type CreateHouseInput = z.infer<typeof createHouseSchema>;

// ---- Join House ----

export const joinHouseParamsSchema = z.object({
  id: z.string().uuid('Invalid house ID'),
});

export type JoinHouseParams = z.infer<typeof joinHouseParamsSchema>;

// ---- House ID Param (reusable) ----

export const houseIdParamsSchema = z.object({
  id: z.string().uuid('Invalid house ID'),
});

export type HouseIdParams = z.infer<typeof houseIdParamsSchema>;

// ---- Member Status Update ----

export const updateMemberStatusBodySchema = z.object({
  status: z.enum(['active', 'on_leave', 'inactive']),
});

export type UpdateMemberStatusInput = z.infer<typeof updateMemberStatusBodySchema>;

export const memberParamsSchema = z.object({
  id: z.string().uuid('Invalid house ID'),
  userId: z.string().uuid('Invalid user ID'),
});

export type MemberParams = z.infer<typeof memberParamsSchema>;
