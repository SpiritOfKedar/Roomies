import { Request, Response } from 'express';
import { sendSuccess } from '../../shared/utils/api-response';
import { uploadImage } from '../../shared/utils/storage';
import * as messagesService from './messages.service';
import type { CreateMessageInput } from './messages.schema';
import type { z } from 'zod';
import type { houseIdParamsSchema, listMessagesQuerySchema } from './messages.schema';

type HouseIdParams = z.infer<typeof houseIdParamsSchema>;
type ListQuery = z.infer<typeof listMessagesQuerySchema>;

export async function listMessages(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId } = req.params as unknown as HouseIdParams;
  const { limit, before } = req.query as unknown as ListQuery;

  const messages = await messagesService.getHouseMessages(userId, houseId, limit, before);

  sendSuccess(res, messages);
}

export async function createMessage(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId } = req.params as unknown as HouseIdParams;
  const { body } = req.body as CreateMessageInput;

  let imageUrl: string | undefined;
  if (req.file) {
    imageUrl = await uploadImage(req.file.buffer, req.file.mimetype);
  }

  const message = await messagesService.postHouseMessage(userId, houseId, body, imageUrl);

  sendSuccess(res, message, 201);
}
