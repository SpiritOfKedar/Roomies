import { z } from 'zod';

// ---- Cast Vote ----

export const castVoteSchema = z
  .object({
    vote: z.enum(['approve', 'reject']),
    reason: z.string().max(500).optional(),
  })
  // "Request changes" must tell the assignee what to fix — a bare rejection gives
  // them nothing to act on before their next attempt.
  .refine((data) => data.vote !== 'reject' || (data.reason?.trim().length ?? 0) >= 3, {
    message: 'Say what needs fixing (at least 3 characters)',
    path: ['reason'],
  });

export type CastVoteInput = z.infer<typeof castVoteSchema>;

// ---- Task ID Param ----

export const taskIdParamsSchema = z.object({
  id: z.string().uuid('Invalid task ID'),
});

export type TaskIdParams = z.infer<typeof taskIdParamsSchema>;
