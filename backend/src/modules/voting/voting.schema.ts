import { z } from 'zod';

// ---- Cast Vote ----

export const castVoteSchema = z
  .object({
    vote: z.enum(['approve', 'reject']),
    reason: z.string().max(500).optional(),
  })
  .refine((data) => data.vote !== 'reject' || data.reason === undefined || data.reason.length > 0, {
    message: 'Reason cannot be empty when provided',
  });

export type CastVoteInput = z.infer<typeof castVoteSchema>;

// ---- Task ID Param ----

export const taskIdParamsSchema = z.object({
  id: z.string().uuid('Invalid task ID'),
});

export type TaskIdParams = z.infer<typeof taskIdParamsSchema>;
