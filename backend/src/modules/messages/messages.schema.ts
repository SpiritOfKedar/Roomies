import { z } from 'zod';

export const houseIdParamsSchema = z.object({
  id: z.string().uuid('Invalid house ID'),
});

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
  after: z.string().uuid().optional(),
});

export const createMessageSchema = z.object({
  body: z.string().min(1).max(5000).trim(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
