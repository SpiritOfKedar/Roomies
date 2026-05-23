/**
 * Unified chore feed — submissions, votes, activity events, and threaded comments.
 */

import { prisma } from '../../shared/db/prisma';
import * as submissionsRepo from './task-submissions.repository';
import * as commentsRepo from './task-comments.repository';
import { getTaskLineageIds } from './task-activity.service';

export type FeedItemKind =
  | 'activity'
  | 'submission'
  | 'comment';

export interface FeedItem {
  id: string;
  kind: FeedItemKind;
  createdAt: Date;
  taskId: string;
  data: Record<string, unknown>;
}

function buildCommentTree(
  comments: Awaited<ReturnType<typeof commentsRepo.getCommentsForTasks>>,
) {
  const byId = new Map(comments.map((c) => [c.id, { ...c, replies: [] as typeof comments }]));
  const roots: (typeof comments[0] & { replies: unknown[] })[] = [];

  for (const c of comments) {
    const node = byId.get(c.id)!;
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function buildTaskFeed(taskId: string): Promise<{
  taskIds: string[];
  items: FeedItem[];
  comments: ReturnType<typeof buildCommentTree>;
}> {
  const taskIds = await getTaskLineageIds(taskId);
  const items: FeedItem[] = [];

  const [events, allSubmissions, comments] = await Promise.all([
    commentsRepo.getActivityEventsForTasks(taskIds),
    Promise.all(
      taskIds.map(async (tid) => {
        const subs = await submissionsRepo.getSubmissionsWithVotes(tid);
        return subs.map((s) => ({ ...s, taskId: tid }));
      }),
    ),
    commentsRepo.getCommentsForTasks(taskIds),
  ]);

  for (const ev of events) {
    items.push({
      id: `activity-${ev.id}`,
      kind: 'activity',
      createdAt: ev.createdAt,
      taskId: ev.taskId,
      data: {
        type: ev.type,
        actorId: ev.actorId,
        actorName: ev.actor?.name ?? null,
        payload: ev.payload,
      },
    });
  }

  for (const subs of allSubmissions) {
    for (const sub of subs) {
      items.push({
        id: `submission-${sub.id}`,
        kind: 'submission',
        createdAt: sub.createdAt,
        taskId: sub.taskId,
        data: {
          submissionId: sub.id,
          attemptNumber: sub.attemptNumber,
          imageUrl: sub.imageUrl,
          clarification: sub.clarification,
          votes: sub.votes.map((v) => ({
            userId: v.userId,
            userName: v.user.name,
            vote: v.vote,
            reason: v.reason,
            createdAt: v.createdAt,
          })),
        },
      });

      for (const vote of sub.votes) {
        if (vote.reason) {
          items.push({
            id: `vote-${vote.id}`,
            kind: 'activity',
            createdAt: vote.createdAt,
            taskId: sub.taskId,
            data: {
              type: 'vote',
              actorId: vote.userId,
              actorName: vote.user.name,
              payload: {
                vote: vote.vote,
                reason: vote.reason,
                submissionId: sub.id,
                attemptNumber: sub.attemptNumber,
              },
            },
          });
        }
      }
    }
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    taskIds,
    items,
    comments: buildCommentTree(comments),
  };
}
