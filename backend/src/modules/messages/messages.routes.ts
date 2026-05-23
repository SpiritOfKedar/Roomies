import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../shared/middleware/require-auth';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as messagesController from './messages.controller';
import {
  houseIdParamsSchema,
  listMessagesQuerySchema,
  createMessageSchema,
} from './messages.schema';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

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
