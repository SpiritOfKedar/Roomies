import { prisma } from '../../shared/db/prisma';

const messageSelect = {
  id: true,
  houseId: true,
  userId: true,
  body: true,
  imageUrl: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
} as const;

export async function listMessages(houseId: string, limit: number, before?: Date) {
  return prisma.houseMessage.findMany({
    where: {
      houseId,
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: messageSelect,
  });
}

export async function listMessagesAfter(houseId: string, limit: number, afterMessageId: string) {
  const anchor = await prisma.houseMessage.findUnique({
    where: { id: afterMessageId },
    select: { createdAt: true, houseId: true },
  });
  if (!anchor || anchor.houseId !== houseId) return [];

  return prisma.houseMessage.findMany({
    where: { houseId, createdAt: { gt: anchor.createdAt } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: messageSelect,
  });
}

export async function createMessage(data: {
  houseId: string;
  userId: string;
  body: string;
  imageUrl?: string | null;
}) {
  return prisma.houseMessage.create({
    data: {
      houseId: data.houseId,
      userId: data.userId,
      body: data.body,
      imageUrl: data.imageUrl ?? null,
    },
    select: messageSelect,
  });
}
