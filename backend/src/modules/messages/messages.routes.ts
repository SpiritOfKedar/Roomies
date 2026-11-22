import { Router } from 'express';
import { imageUpload } from '../../shared/middleware/image-upload';
import { requireAuth } from '../../shared/middleware/require-auth';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as messagesController from './messages.controller';
import {
  houseIdParamsSchema,
  listMessagesQuerySchema,
  createMessageSchema,
} from './messages.schema';

const upload = imageUpload;

export const messageRoutes = Router({ mergeParams: true });

messageRoutes.use(requireAuth);

messageRoutes.get(
  '/',
  validate({ params: houseIdParamsSchema, query: listMessagesQuerySchema }),
  asyncHandler(messagesController.listMessages),
);

messageRoutes.post(
  '/',
  upload.single('image'),
  validate({ params: houseIdParamsSchema, body: createMessageSchema }),
  asyncHandler(messagesController.createMessage),
);
