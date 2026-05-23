'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { tasksApi } from '@/lib/endpoints';
import { resolveProofUrl } from '@/lib/proofUrl';
import type { TaskFeed, TaskFeedItem, TaskCommentNode } from '@/types';
import toast from 'react-hot-toast';

interface Props {
  taskId: string;
  feed: TaskFeed | null;
  loading: boolean;
  currentUserId?: string;
  isAdmin?: boolean;
  onRefresh: () => void;
}

function activityLabel(item: TaskFeedItem): string {
  const type = item.data.type as string;
  const actor = (item.data.actorName as string) || 'Someone';
  const payload = item.data.payload as Record<string, unknown> | undefined;

  switch (type) {
    case 'assigned':
      return `${actor} assigned this chore`;
    case 'rotated':
      return `Next rotation: ${(payload?.assigneeName as string) || 'new assignee'}`;
    case 'swapped':
      return `${actor} accepted a task swap`;
    case 'submitted':
      return `${actor} submitted proof (attempt ${payload?.attemptNumber ?? '?'})`;
    case 'vote':
      return `${actor} voted ${payload?.vote}${payload?.reason ? `: "${payload.reason}"` : ''}`;
    case 'admin_edit':
      return `${actor} updated this chore`;
    case 'completed':
      return 'Chore completed';
    case 'expired':
      return 'Chore expired';
    default:
      return type;
  }
}

function ReplyForm({
  taskId,
  parentId,
  onDone,
  onCancel,
}: {
  taskId: string;
  parentId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('body', text.trim());
      fd.append('parentId', parentId);
      await tasksApi.addComment(taskId, fd);
      onDone();
    } catch {
      toast.error('Failed to reply');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-2 flex gap-2">
      <input
        className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm"
        placeholder="Write a reply…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" disabled={saving} className="text-xs font-semibold text-black">
        {saving ? '…' : 'Reply'}
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-neutral-500">
        Cancel
      </button>
    </form>
  );
}

function CommentThread({
  comments,
  depth,
  currentUserId,
  isAdmin,
  taskId,
  onRefresh,
}: {
  comments: TaskCommentNode[];
  depth: number;
  currentUserId?: string;
  isAdmin?: boolean;
  taskId: string;
  onRefresh: () => void;
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null);

  if (depth > 5) return null;

  return (
    <div className={depth > 0 ? 'ml-4 mt-2 border-l-2 border-neutral-200 pl-3' : 'mt-2 space-y-2'}>
      {comments.map((c) => {
        const img = resolveProofUrl(c.imageUrl);
        const canDelete = c.userId === currentUserId || isAdmin;

        return (
          <div key={c.id} className="rounded-lg bg-neutral-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-neutral-800">{c.user.name}</span>
              <span className="text-xs text-neutral-500">
                {format(new Date(c.createdAt), 'MMM d, h:mm a')}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-neutral-700">{c.body}</p>
            {img && (
              <img src={img} alt="" className="mt-2 max-h-40 rounded-lg border object-cover" />
            )}
            <div className="mt-1 flex gap-3">
              {depth < 5 && (
                <button
                  type="button"
                  className="text-xs font-semibold text-neutral-600 hover:underline"
                  onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                >
                  Reply
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={async () => {
                    try {
                      await tasksApi.deleteComment(taskId, c.id);
                      onRefresh();
                    } catch {
                      toast.error('Failed to delete comment');
                    }
                  }}
                >
                  Delete
                </button>
              )}
            </div>
            {replyTo === c.id && (
              <ReplyForm
                taskId={taskId}
                parentId={c.id}
                onCancel={() => setReplyTo(null)}
                onDone={() => {
                  setReplyTo(null);
                  onRefresh();
                }}
              />
            )}
            {c.replies?.length > 0 && (
              <CommentThread
                comments={c.replies}
                depth={depth + 1}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                taskId={taskId}
                onRefresh={onRefresh}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ChoreFeed({
  taskId,
  feed,
  loading,
  currentUserId,
  isAdmin,
  onRefresh,
}: Props) {
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('body', body.trim());
      if (image) fd.append('image', image);
      await tasksApi.addComment(taskId, fd);
      setBody('');
      setImage(null);
      onRefresh();
      toast.success('Comment posted');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return <div className="h-32 animate-pulse rounded-lg bg-neutral-100" />;
  }

  if (!feed) {
    return <p className="text-sm text-neutral-500">Could not load activity feed.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handlePost} className="rounded-lg border border-neutral-200 p-3">
        <textarea
          className="w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          rows={2}
          placeholder="Add a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept="image/*"
            className="text-xs"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="ml-auto rounded-lg bg-black px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {posting ? 'Posting…' : 'Comment'}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {feed.items.length === 0 && feed.comments.length === 0 && (
          <p className="text-sm text-neutral-500">No activity yet.</p>
        )}

        {feed.items.map((item) => {
          const date = format(new Date(item.createdAt), 'MMM d, yyyy · h:mm a');

          if (item.kind === 'submission') {
            const img = resolveProofUrl(item.data.imageUrl as string | undefined);
            const votes = (item.data.votes as { userName: string; vote: string; reason?: string }[]) ?? [];
            return (
              <div key={item.id} className="rounded-lg border border-neutral-200 p-4">
                <p className="text-xs font-semibold uppercase text-neutral-500">
                  Proof · attempt {String(item.data.attemptNumber)} · {date}
                </p>
                {item.data.clarification ? (
                  <p className="mt-2 text-sm text-neutral-700">{String(item.data.clarification)}</p>
                ) : null}
                {img && (
                  <img src={img} alt="Proof" className="mt-2 max-h-48 w-full rounded-lg object-cover" />
                )}
                {votes.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-neutral-600">
                    {votes.map((v, i) => (
                      <li key={i}>
                        <span className="font-medium">{v.userName}</span> — {v.vote}
                        {v.reason ? `: ${v.reason}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }

          if (item.kind === 'activity') {
            return (
              <div key={item.id} className="flex gap-2 text-sm text-neutral-600">
                <span className="shrink-0 text-xs text-neutral-400">{date}</span>
                <span>{activityLabel(item)}</span>
              </div>
            );
          }

          return null;
        })}
      </div>

      {feed.comments.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-neutral-800">Discussion</p>
          <CommentThread
            comments={feed.comments}
            depth={0}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            taskId={taskId}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </div>
  );
}
