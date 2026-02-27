/**
 * =============================================================================
 * Task Swap Controller — HTTP Handler Layer
 * =============================================================================
 * Thin controller for swap-related endpoints.
 * Delegates all business logic to swap.service.ts.
 * =============================================================================
 */

import { Request, Response } from 'express';
import { sendSuccess } from '../../shared/utils/api-response';
import * as swapService from './swap.service';
import type { HouseIdParams, SwapParams, ProposeSwapInput, ResolveSwapInput } from './swap.schema';

/**
 * POST /api/houses/:id/swaps
 *
 * Propose a peer-to-peer task swap.
 * Requester must own the offeredTask; receiver must own the requestedTask.
 */
export async function proposeSwap(req: Request, res: Response): Promise<void> {
  const requesterId = req.user!.userId;
  const { id: houseId } = req.params as unknown as HouseIdParams;
  const { receiverId, offeredTaskId, requestedTaskId } = req.body as ProposeSwapInput;

  const swap = await swapService.proposeSwap(
    requesterId,
    houseId,
    receiverId,
    offeredTaskId,
    requestedTaskId,
  );

  sendSuccess(res, swap, 201);
}

/**
 * POST /api/houses/:id/swaps/:swapId/resolve
 *
 * Accept or reject a pending swap.
 * Only the designated receiver may call this endpoint.
 */
export async function resolveSwap(req: Request, res: Response): Promise<void> {
  const receiverId = req.user!.userId;
  const { id: houseId, swapId } = req.params as unknown as SwapParams;
  const { action } = req.body as ResolveSwapInput;

  const swap = await swapService.resolveSwap(receiverId, houseId, swapId, action);

  sendSuccess(res, swap);
}
