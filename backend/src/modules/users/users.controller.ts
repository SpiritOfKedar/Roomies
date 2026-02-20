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
