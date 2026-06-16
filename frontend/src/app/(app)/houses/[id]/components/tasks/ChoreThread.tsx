'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { tasksApi } from '@/lib/endpoints';
import { resolveProofUrl, isLegacyProofUrl } from '@/lib/proofUrl';
import type { ChoreThread, ChoreThreadCycle, TaskCommentNode } from '@/types';
import toast from 'react-hot-toast';
import VoteProgressBar from './VoteProgressBar';
import type { TaskVoteStatus } from '@/types';

interface Props {
  thread: ChoreThread | null;
  loading?: boolean;
  taskId: string;
  currentUserId?: string;
  isAdmin?: boolean;
  voteStatus?: TaskVoteStatus | null;
  onRefresh: () => void;
}

const OUTCOME_STYLES: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  disputed: 'bg-amber-50 text-amber-800 ring-amber-500/30',
  rejected: 'bg-red-50 text-red-700 ring-red-600/10',
  tie: 'bg-orange-50 text-orange-700 ring-orange-500/30',
  voting: 'bg-blue-50 text-blue-700 ring-blue-500/30',
};

function CommentThread({
  comments,
  depth,
  taskId,
  submissionId,
  currentUserId,
  isAdmin,
  onRefresh,
}: {
  comments: TaskCommentNode[];
  depth: number;
  taskId: string;
  submissionId: string;
  currentUserId?: string;
  isAdmin?: boolean;
  onRefresh: () => void;
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null);

  if (depth > 5) return null;

  return (
    <div className={depth > 0 ? 'ml-4 border-l-2 border-neutral-200 pl-3' : ''}>
      {comments.map((c) => (
        <div key={c.id} className="mt-3">
          <div className="rounded-lg bg-neutral-50 px-3 py-2 text-sm">
            <p className="font-semibold text-neutral-800">{c.user.name}</p>
            <p className="mt-0.5 text-neutral-700">{c.body}</p>
            <p className="mt-1 text-xs text-neutral-400">
              {format(new Date(c.createdAt), 'MMM d · h:mm a')}
            </p>
            <button
              type="button"
              onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
              className="mt-1 text-xs font-semibold text-neutral-600 hover:text-black"
            >
              Reply
            </button>
          </div>
          {replyTo === c.id && (
            <CommentForm
              taskId={taskId}
              submissionId={submissionId}
              parentId={c.id}
              onDone={() => {
                setReplyTo(null);
                onRefresh();
              }}
              onCancel={() => setReplyTo(null)}
            />
          )}
          {c.replies.length > 0 && (
            <CommentThread
              comments={c.replies}
              depth={depth + 1}
              taskId={taskId}
              submissionId={submissionId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onRefresh={onRefresh}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CommentForm({
  taskId,
  submissionId,
  parentId,
  onDone,
  onCancel,
}: {
  taskId: string;
  submissionId: string;
  parentId?: string;
  onDone: () => void;
  onCancel?: () => void;
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
      fd.append('submissionId', submissionId);
      if (parentId) fd.append('parentId', parentId);
      await tasksApi.addComment(taskId, fd);
      setText('');
      onDone();
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-2 flex gap-2">
      <input
        className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        placeholder="Add a comment…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {saving ? '…' : 'Post'}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-xs text-neutral-500">
          Cancel
        </button>
      )}
    </form>
  );
}

function CycleCard({
  cycle,
  isCurrent,
  taskId,
  currentUserId,
  isAdmin,
  voteStatus,
  onRefresh,
}: {
  cycle: ChoreThreadCycle;
  isCurrent: boolean;
  taskId: string;
  currentUserId?: string;
  isAdmin?: boolean;
  voteStatus?: TaskVoteStatus | null;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(isCurrent);

  return (
    <article className={`rounded-xl border ${isCurrent ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-white'}`}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <h4 className="text-sm font-semibold text-neutral-900">
          Cycle {cycle.cycleNumber}
        </h4>
        <span className="text-xs text-neutral-500">· {cycle.assigneeName}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
            OUTCOME_STYLES[cycle.status] ?? 'bg-neutral-100 text-neutral-600'
          }`}
        >
          {cycle.status}
        </span>
        {isCurrent && (
          <span className="text-xs font-medium text-neutral-500">Current</span>
        )}
        <span className="ml-auto text-xs text-neutral-400">
          {format(new Date(cycle.deadline), 'MMM d, yyyy')}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-neutral-200 px-4 pb-4 pt-3">
          {cycle.submissions.length === 0 ? (
            <p className="text-sm text-neutral-500">No submissions yet for this cycle.</p>
          ) : (
            cycle.submissions.map((round) => {
              const proofUrl = resolveProofUrl(round.imageUrl);
              const legacy = isLegacyProofUrl(round.imageUrl);
              const instanceTaskId = cycle.instanceId;

              return (
                <div
                  key={round.submissionId}
                  className={`rounded-lg border p-4 ${round.isCurrent ? 'border-blue-200 bg-blue-50/30' : 'border-neutral-200'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">Attempt {round.attemptNumber}</span>
                    {round.outcome && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${
                          OUTCOME_STYLES[round.outcome] ?? 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {round.outcome}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-neutral-400">
                      {format(new Date(round.submittedAt), 'MMM d · h:mm a')}
                    </span>
                  </div>

                  {round.clarification && (
                    <p className="mt-2 text-sm text-neutral-700">{round.clarification}</p>
                  )}

                  <div className="mt-3">
                    {proofUrl ? (
                      <img
                        src={proofUrl}
                        alt={`Proof attempt ${round.attemptNumber}`}
                        className="max-h-48 w-full rounded-lg border border-neutral-200 object-cover"
                      />
                    ) : legacy ? (
                      <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-500">
                        Proof unavailable (legacy upload)
                      </p>
                    ) : null}
                  </div>

                  {round.isCurrent && cycle.status === 'submitted' && voteStatus && (
                    <div className="mt-3">
                      <VoteProgressBar voteStatus={voteStatus} />
                    </div>
                  )}

                  {round.votes.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {round.votes.map((v) => (
                        <li key={`${v.userId}-${v.createdAt}`} className="text-sm">
                          <span className="font-medium">{v.userName}</span>
                          <span
                            className={`ml-2 capitalize ${
                              v.vote === 'approve' ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {v.vote}
                          </span>
                          {v.reason && (
                            <span className="ml-1 text-neutral-600">— &quot;{v.reason}&quot;</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 border-t border-neutral-100 pt-3">
                    <CommentThread
                      comments={round.comments}
                      depth={0}
                      taskId={instanceTaskId}
                      submissionId={round.submissionId}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      onRefresh={onRefresh}
                    />
                    <CommentForm
                      taskId={instanceTaskId}
                      submissionId={round.submissionId}
                      onDone={onRefresh}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </article>
  );
}

export default function ChoreThreadView({
  thread,
  loading,
  taskId,
  currentUserId,
  isAdmin,
  voteStatus,
  onRefresh,
}: Props) {
  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />;
  }

  if (!thread || thread.cycles.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-500">
        No history yet. Submit proof to start the thread.
      </p>
    );
  }

  const activeCycleNumber = thread.activeInstance?.cycleNumber;

  return (
    <div className="space-y-3">
      {[...thread.cycles].reverse().map((cycle) => (
        <CycleCard
          key={cycle.instanceId}
          cycle={cycle}
          isCurrent={cycle.cycleNumber === activeCycleNumber}
          taskId={taskId}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          voteStatus={cycle.instanceId === taskId ? voteStatus : null}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
