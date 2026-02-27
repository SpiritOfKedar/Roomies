/**
 * =============================================================================
 * Task Swap Validation Schemas — Zod
 * =============================================================================
 * Input validation for peer-to-peer chore swap endpoints.
 * =============================================================================
 */

import { z } from 'zod';

// ---- House-scoped params (/:id) ----

export const houseIdParamsSchema = z.object({
  id: z.string().uuid('Invalid house ID'),
});

export type HouseIdParams = z.infer<typeof houseIdParamsSchema>;

// ---- Swap params (/api/houses/:id/swaps/:swapId) ----

export const swapParamsSchema = z.object({
  id: z.string().uuid('Invalid house ID'),
  swapId: z.string().uuid('Invalid swap ID'),
});

export type SwapParams = z.infer<typeof swapParamsSchema>;

// ---- Propose Swap body ----

export const proposeSwapSchema = z.object({
  receiverId: z.string().uuid('Receiver must be a valid user UUID'),
  offeredTaskId: z.string().uuid('Offered task must be a valid UUID'),
  requestedTaskId: z.string().uuid('Requested task must be a valid UUID'),
});

export type ProposeSwapInput = z.infer<typeof proposeSwapSchema>;

// ---- Resolve Swap body ----

export const resolveSwapSchema = z.object({
  action: z.enum(['accept', 'reject'] as const),
});

export type ResolveSwapInput = z.infer<typeof resolveSwapSchema>;
