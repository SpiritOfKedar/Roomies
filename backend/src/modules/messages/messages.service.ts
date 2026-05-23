import * as houseService from '../house/house.service';
import * as messagesRepo from './messages.repository';

export async function getHouseMessages(
  userId: string,
  houseId: string,
  limit: number,
  before?: string,
) {
  await houseService.verifyMembership(houseId, userId);

  const beforeDate = before ? new Date(before) : undefined;
  const messages = await messagesRepo.listMessages(houseId, limit, beforeDate);

  return messages.reverse();
}

export async function postHouseMessage(
  userId: string,
  houseId: string,
  body: string,
  imageUrl?: string,
) {
  await houseService.verifyMembership(houseId, userId);

  return messagesRepo.createMessage({
    houseId,
    userId,
    body,
    imageUrl,
  });
}
