'use client';

import { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Check, MessageCircle, PencilLine, Upload, UserRound, X } from 'lucide-react';
import { tasksApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import { resolveProofUrl } from '@/lib/proofUrl';
import { cn } from '@/lib/utils';
import type { ChoreThreadCycle, TaskCommentNode } from '@/types';

interface Props {
  cycle: ChoreThreadCycle;
  assignedAt?: string;
  maxAttempts: number;
  onChanged: () => void;
}

const when = (iso: string) => format(new Date(iso), 'EEE d MMM · h:mm a');
const byTime = <T extends { createdAt: string }>(a: T, b: T) => +new Date(a.createdAt) - +new Date(b.createdAt);

function Event({ icon, tone = 'neutral', children }: { icon: React.ReactNode; tone?: 'neutral' | 'success' | 'warning'; children: React.ReactNode }) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-600',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-800',
  };
  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      <span aria-hidden className="absolute bottom-0 left-4 top-9 w-px bg-neutral-200 [li:last-child>&]:hidden" />
      <span className={cn('z-10 flex size-8 shrink-0 items-center justify-center rounded-full', tones[tone])}>{icon}</span>
      <div className="min-w-0 flex-1 pt-1">{children}</div>
    </li>
  );
}

type TimelineItem =
  | { kind: 'proof'; at: string; sub: ChoreThreadCycle['submissions'][number] }
  | { kind: 'vote'; at: string; sub: ChoreThreadCycle['submissions'][number]; vote: ChoreThreadCycle['submissions'][number]['votes'][number] };

/** One reply level is enough in a chore thread; deeper replies flatten under their root. */
function CommentList({
  comments,
  onReply,
  replyingTo,
}: {
  comments: TaskCommentNode[];
  onReply: (c: TaskCommentNode) => void;
  replyingTo?: string;
}) {
  const flatten = (nodes: TaskCommentNode[]): TaskCommentNode[] => nodes.flatMap((n) => [n, ...flatten(n.replies)]);
  return (
    <ul className="flex flex-col gap-3">
      {comments.map((c) => {
        const replies = flatten(c.replies).sort(byTime);
        return (
          <li key={c.id}>
            <Comment comment={c} onReply={onReply} active={replyingTo === c.id} />
            {replies.length > 0 && (
              <ul className="ml-4 mt-2 flex flex-col gap-2 border-l-2 border-neutral-200 pl-3">
                {replies.map((r) => (
                  <li key={r.id}>
                    <Comment comment={r} onReply={() => onReply(c)} active={false} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Comment({ comment, onReply, active }: { comment: TaskCommentNode; onReply: (c: TaskCommentNode) => void; active: boolean }) {
  return (
    <div className={cn('rounded-xl px-3 py-2 text-sm', active ? 'bg-neutral-100 ring-1 ring-neutral-300' : 'bg-neutral-50')}>
      <span className="font-semibold text-neutral-900">{comment.user.name}</span>
      <span className="ml-2 text-xs text-neutral-400">{when(comment.createdAt)}</span>
      <p className="mt-0.5 whitespace-pre-wrap text-neutral-700">{comment.body}</p>
      <button type="button" onClick={() => onReply(comment)} className="mt-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900">
        Reply
      </button>
    </div>
  );
}

/**
 * Everything that happened in one turn, as two parts:
 *  1. the timeline — assigned, proof, approvals/changes — strictly in time order;
 *  2. one comment thread for the turn, with a single composer. "Reply" points
 *     that same composer at a comment instead of opening a second box.
 */
export default function TurnTimeline({ cycle, assignedAt, maxAttempts, onChanged }: Props) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<TaskCommentNode | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const events = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    for (const sub of cycle.submissions) {
      items.push({ kind: 'proof', at: sub.submittedAt, sub });
      for (const vote of sub.votes) items.push({ kind: 'vote', at: vote.createdAt, sub, vote });
    }
    return items.sort((a, b) => +new Date(a.at) - +new Date(b.at));
  }, [cycle.submissions]);

  // Comments are stored per submission; the turn shows them as one thread.
  const comments = useMemo(
    () => cycle.submissions.flatMap((s) => s.comments).sort(byTime),
    [cycle.submissions],
  );
  const latest = cycle.submissions[cycle.submissions.length - 1];

  const startReply = (c: TaskCommentNode) => {
    setReplyTo(c);
    inputRef.current?.focus();
  };

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !latest) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('body', text.trim());
      // A reply stays on its parent's submission; a new comment goes on the latest one.
      fd.append('submissionId', replyTo?.submissionId ?? latest.submissionId);
      if (replyTo) fd.append('parentId', replyTo.id);
      await tasksApi.addComment(cycle.instanceId, fd);
      setText('');
      setReplyTo(null);
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not post comment'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <ol className="flex flex-col">
        <Event icon={<UserRound className="size-4" />}>
          <p className="text-sm text-neutral-900">
            Turn {cycle.cycleNumber} assigned to <span className="font-semibold">{cycle.assigneeName}</span>
            {assignedAt && <span className="ml-2 text-xs text-neutral-400">{when(assignedAt)}</span>}
          </p>
        </Event>
        {events.length === 0 ? (
          <Event icon={<MessageCircle className="size-4" />}>
            <p className="text-sm text-neutral-500">No proof handed in yet.</p>
          </Event>
        ) : (
          events.map((item) =>
            item.kind === 'proof' ? (
              <Event key={`p-${item.sub.submissionId}`} icon={<Upload className="size-4" />}>
                <p className="text-sm text-neutral-900">
                  <span className="font-semibold">{cycle.assigneeName}</span> {item.sub.attemptNumber > 1 ? 'resubmitted' : 'handed in'} proof
                  <span className="ml-2 text-xs text-neutral-400">
                    {when(item.sub.submittedAt)} · attempt {item.sub.attemptNumber} of {maxAttempts}
                  </span>
                </p>
                {resolveProofUrl(item.sub.imageUrl) && (
                  <a href={resolveProofUrl(item.sub.imageUrl)!} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveProofUrl(item.sub.imageUrl)!}
                      alt={`Proof, attempt ${item.sub.attemptNumber}`}
                      className="max-h-56 rounded-xl border border-neutral-200 object-cover"
                    />
                  </a>
                )}
                {item.sub.clarification && (
                  <p className="mt-2 w-fit max-w-full rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700">“{item.sub.clarification}”</p>
                )}
              </Event>
            ) : (
              <Event
                key={`v-${item.sub.submissionId}-${item.vote.userId}`}
                tone={item.vote.vote === 'approve' ? 'success' : 'warning'}
                icon={item.vote.vote === 'approve' ? <Check className="size-4" /> : <PencilLine className="size-4" />}
              >
                <p className="text-sm text-neutral-900">
                  <span className="font-semibold">{item.vote.userName}</span>{' '}
                  {item.vote.vote === 'approve' ? 'approved' : 'asked for changes'}
                  <span className="ml-2 text-xs text-neutral-400">{when(item.vote.createdAt)}</span>
                </p>
                {item.vote.reason && <p className="mt-1 text-sm text-neutral-700">“{item.vote.reason}”</p>}
              </Event>
            ),
          )
        )}
      </ol>

      {latest && (
        <section className="flex flex-col gap-3 border-t border-neutral-100 pt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Comments {comments.length > 0 && <span className="text-neutral-400">{comments.length}</span>}
          </h3>
          {comments.length > 0 && <CommentList comments={comments} onReply={startReply} replyingTo={replyTo?.id} />}

          <form onSubmit={post} className="flex flex-col gap-1.5">
            {replyTo && (
              <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                Replying to <span className="font-semibold text-neutral-800">{replyTo.user.name}</span>
                <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="rounded p-0.5 hover:bg-neutral-100">
                  <X className="size-3.5" />
                </button>
              </p>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
                placeholder={replyTo ? `Reply to ${replyTo.user.name.split(' ')[0]}…` : 'Add a comment…'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setReplyTo(null)}
                maxLength={5000}
              />
              <button
                type="submit"
                disabled={saving || !text.trim()}
                className="rounded-lg bg-neutral-900 px-4 text-xs font-semibold text-white disabled:opacity-40"
              >
                {saving ? '…' : replyTo ? 'Reply' : 'Post'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
