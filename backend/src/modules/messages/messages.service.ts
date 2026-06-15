import * as houseService from '../house/house.service';
import * as messagesRepo from './messages.repository';
import {
  cached,
  houseMessagesKey,
  invalidateHouseCache,
  pushMessageToFeed,
  getMessageFeedFromCache,
} from '../../shared/cache/redis-cache';

export async function getHouseMessages(
  userId: string,
  houseId: string,
  limit: number,
  before?: string,
  after?: string,
) {
  await houseService.verifyMembership(houseId, userId);

  if (after) {
    const newMessages = await messagesRepo.listMessagesAfter(houseId, limit, after);
    return newMessages;
  }

  const beforeDate = before ? new Date(before) : undefined;
  const cacheKey = houseMessagesKey(houseId, limit, undefined, before);

  const messages = await cached(cacheKey, 5, async () => {
    const feed = await getMessageFeedFromCache(houseId, limit);
    if (feed && feed.length > 0 && !beforeDate) {
      return feed;
    }
    const rows = await messagesRepo.listMessages(houseId, limit, beforeDate);
    return rows.reverse();
  });

  return messages;
}

export async function postHouseMessage(
  userId: string,
  houseId: string,
  body: string,
  imageUrl?: string,
) {
  await houseService.verifyMembership(houseId, userId);

  const message = await messagesRepo.createMessage({
    houseId,
    userId,
    body,
    imageUrl,
  });

  await pushMessageToFeed(houseId, message);
  await invalidateHouseCache(houseId);

  return message;
}
