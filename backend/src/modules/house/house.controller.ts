/**
 * =============================================================================
 * House Controller — HTTP Handler Layer
 * =============================================================================
 * Thin controller for house-related endpoints.
 * Delegates all logic to house.service.ts.
 * =============================================================================
 */

import { Request, Response } from 'express';
import { sendSuccess } from '../../shared/utils/api-response';
import * as houseService from './house.service';
import type { CreateHouseInput, HouseIdParams } from './house.schema';

/**
 * POST /api/houses
 * Creates a new house. The authenticated user becomes the admin.
 */
export async function createHouse(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { name } = req.body as CreateHouseInput;

  const house = await houseService.createHouse(userId, name);

  sendSuccess(res, house, 201);
}

/**
 * POST /api/houses/:id/join
 * Adds the authenticated user to the house.
 */
export async function joinHouse(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId } = req.params as unknown as HouseIdParams;

  const house = await houseService.joinHouse(userId, houseId);

  sendSuccess(res, house);
}

/**
 * GET /api/houses/:id
 * Returns the house with its members. Requires membership.
 */
export async function getHouse(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId } = req.params as unknown as HouseIdParams;

  const house = await houseService.getHouse(userId, houseId);

  sendSuccess(res, house);
}

/**
 * GET /api/houses
 * Returns all houses the authenticated user belongs to.
 */
export async function getUserHouses(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const houses = await houseService.getUserHouses(userId);

  sendSuccess(res, houses);
}
