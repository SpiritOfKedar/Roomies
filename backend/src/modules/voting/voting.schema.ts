import { z } from 'zod';

// ---- Cast Vote ----

export const castVoteSchema = z.object({
  vote: z.enum(['approve', 'reject']),
});

export type CastVoteInput = z.infer<typeof castVoteSchema>;

// ---- Task ID Param ----

export const taskIdParamsSchema = z.object({
  id: z.string().uuid('Invalid task ID'),
});

export type TaskIdParams = z.infer<typeof taskIdParamsSchema>;
