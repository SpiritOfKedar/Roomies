/**
 * =============================================================================
 * Users Controller
 * =============================================================================
 * Handles HTTP request/response for user-related endpoints.
 * Delegates all business logic to the users service.
 * =============================================================================
 */

import { Request, Response } from 'express';
import { sendSuccess } from '../../shared/utils/api-response';
import * as usersService from './users.service';
import * as recoveryService from '../auth/recovery.service';
import type {
  SetSecurityQuestionsInput,
  DeleteSecurityQuestionsInput,
  DeleteAccountInput,
} from '../auth/recovery.schema';

/**
 * GET /users/me
 * Returns the authenticated user's profile.
 * Requires the `requireAuth` middleware to populate `req.user`.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const user = await usersService.getUserProfile(userId);
  sendSuccess(res, user);
}

export async function getRecoveryStatus(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const status = await recoveryService.getUserRecoveryStatus(userId);
  sendSuccess(res, status);
}

export async function setSecurityQuestions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { currentPassword, questions } = req.body as SetSecurityQuestionsInput;
  await recoveryService.setSecurityQuestions(userId, currentPassword, questions);
  sendSuccess(res, { message: 'Security questions saved' });
}

export async function deleteSecurityQuestions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { currentPassword } = req.body as DeleteSecurityQuestionsInput;
  await recoveryService.deleteSecurityQuestions(userId, currentPassword);
  sendSuccess(res, { message: 'Security questions removed' });
}

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { currentPassword } = req.body as DeleteAccountInput;
  await usersService.deleteAccount(userId, currentPassword);
  sendSuccess(res, { message: 'Account deleted' });
}
