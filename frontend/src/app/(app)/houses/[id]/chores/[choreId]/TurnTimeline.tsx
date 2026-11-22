'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Check, MessageCircle, PencilLine, Upload, UserRound } from 'lucide-react';
import { tasksApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import { resolveProofUrl } from '@/lib/proofUrl';
import { cn } from '@/lib/utils';
import type { ChoreThreadCycle, ChoreThreadSubmission, TaskCommentNode } from '@/types';

interface Props {
  cycle: ChoreThreadCycle;
  assignedAt?: string;
  maxAttempts: number;
  onChanged: () => void;
}

const when = (iso: string) => format(new Date(iso), 'EEE d MMM · h:mm a');

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

function CommentForm({ taskId, submissionId, parentId, onDone }: { taskId: string; submissionId: string; parentId?: string; onDone: () => void }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('body', text.trim());
      fd.append('submissionId', submissionId);
      if (parentId) fd.append('parentId', parentId);
      await tasksApi.addComment(taskId, fd);
      setText('');
      onDone();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not post comment'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="mt-2 flex gap-2">
      <input
        className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
        placeholder={parentId ? 'Write a reply…' : 'Add a comment…'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={5000}
      />
      <button type="submit" disabled={saving || !text.trim()} className="rounded-lg bg-neutral-900 px-3 text-xs font-semibold text-white disabled:opacity-40">
        {saving ? '…' : 'Post'}
      </button>
    </form>
  );
}

function Comments({ comments, taskId, submissionId, onChanged, depth = 0 }: { comments: TaskCommentNode[]; taskId: string; submissionId: string; onChanged: () => void; depth?: number }) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  if (depth > 4) return null;
  return (
    <ul className={cn('flex flex-col gap-2', depth > 0 && 'ml-4 mt-2 border-l-2 border-neutral-200 pl-3')}>
      {comments.map((c) => (
        <li key={c.id}>
          <div className="rounded-lg bg-neutral-50 px-3 py-2 text-sm">
            <span className="font-semibold text-neutral-900">{c.user.name}</span>
            <span className="ml-2 text-xs text-neutral-400">{when(c.createdAt)}</span>
            <p className="mt-0.5 whitespace-pre-wrap text-neutral-700">{c.body}</p>
            <button type="button" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="mt-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900">
              Reply
            </button>
          </div>
          {replyTo === c.id && (
            <CommentForm taskId={taskId} submissionId={submissionId} parentId={c.id} onDone={() => { setReplyTo(null); onChanged(); }} />
          )}
          {c.replies.length > 0 && (
            <Comments comments={c.replies} taskId={taskId} submissionId={submissionId} onChanged={onChanged} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

function SubmissionEvents({ sub, cycle, maxAttempts, onChanged }: { sub: ChoreThreadSubmission; cycle: ChoreThreadCycle; maxAttempts: number; onChanged: () => void }) {
  const url = resolveProofUrl(sub.imageUrl);
  return (
    <>
      <Event icon={<Upload className="size-4" />}>
        <p className="text-sm text-neutral-900">
          <span className="font-semibold">{cycle.assigneeName}</span> {sub.attemptNumber > 1 ? 'resubmitted' : 'handed in'} proof
          <span className="ml-2 text-xs text-neutral-400">
            {when(sub.submittedAt)} · attempt {sub.attemptNumber} of {maxAttempts}
          </span>
        </p>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Proof, attempt ${sub.attemptNumber}`} className="max-h-56 rounded-xl border border-neutral-200 object-cover" />
          </a>
        )}
        {sub.clarification && <p className="mt-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">“{sub.clarification}”</p>}
        <div className="mt-3">
          {sub.comments.length > 0 && <Comments comments={sub.comments} taskId={cycle.instanceId} submissionId={sub.submissionId} onChanged={onChanged} />}
          <CommentForm taskId={cycle.instanceId} submissionId={sub.submissionId} onDone={onChanged} />
        </div>
      </Event>
      {sub.votes.map((v) => (
        <Event
          key={`${sub.submissionId}-${v.userId}`}
          tone={v.vote === 'approve' ? 'success' : 'warning'}
          icon={v.vote === 'approve' ? <Check className="size-4" /> : <PencilLine className="size-4" />}
        >
          <p className="text-sm text-neutral-900">
            <span className="font-semibold">{v.userName}</span> {v.vote === 'approve' ? 'approved' : 'asked for changes'}
            <span className="ml-2 text-xs text-neutral-400">{when(v.createdAt)}</span>
          </p>
          {v.reason && <p className="mt-1 text-sm text-neutral-700">“{v.reason}”</p>}
        </Event>
      ))}
    </>
  );
}

/** Everything that happened in one turn, oldest first, as a single conversation. */
export default function TurnTimeline({ cycle, assignedAt, maxAttempts, onChanged }: Props) {
  return (
    <ol className="flex flex-col">
      <Event icon={<UserRound className="size-4" />}>
        <p className="text-sm text-neutral-900">
          Turn {cycle.cycleNumber} assigned to <span className="font-semibold">{cycle.assigneeName}</span>
          {assignedAt && <span className="ml-2 text-xs text-neutral-400">{when(assignedAt)}</span>}
        </p>
      </Event>
      {cycle.submissions.length === 0 ? (
        <Event icon={<MessageCircle className="size-4" />}>
          <p className="text-sm text-neutral-500">No proof handed in yet.</p>
        </Event>
      ) : (
        cycle.submissions.map((sub) => (
          <SubmissionEvents key={sub.submissionId} sub={sub} cycle={cycle} maxAttempts={maxAttempts} onChanged={onChanged} />
        ))
      )}
    </ol>
  );
}
