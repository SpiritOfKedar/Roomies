'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { BellRing, Check, PencilLine } from 'lucide-react';
import SubmitProofForm from '@/components/turns/SubmitProofForm';
import SubmitButton from '@/components/ui/SubmitButton';
import { useActionStatus } from '@/hooks/useActionStatus';
import { messagesApi, tasksApi } from '@/lib/endpoints';
import { getApiErrorMessage } from '@/lib/api-error';
import { resolveProofUrl } from '@/lib/proofUrl';
import { dueSummary, formatDue } from '@/lib/deadline';
import { firstName, listNames, memberName, pendingVoters } from '@/lib/turn-status';
import { cn } from '@/lib/utils';
import type { ChoreThreadCycle, ChoreThreadSubmission, HouseMember, Task, TaskVoteStatus } from '@/types';

interface Props {
  houseId: string;
  choreTitle: string;
  task: Task;
  cycle?: ChoreThreadCycle;
  vote?: TaskVoteStatus;
  members: HouseMember[];
  viewerId?: string;
  maxResubmissions: number;
  onChanged: () => void;
}

const QUICK_REASONS = ['Not finished', 'Photo is unclear', 'Wrong chore', 'Needs another go'];

function Panel({ tone = 'neutral', title, children }: { tone?: 'neutral' | 'info' | 'warning' | 'success' | 'danger'; title: string; children?: React.ReactNode }) {
  const tones = {
    neutral: 'border-neutral-200 bg-neutral-50',
    info: 'border-blue-200 bg-blue-50/60',
    warning: 'border-amber-200 bg-amber-50/70',
    success: 'border-emerald-200 bg-emerald-50/70',
    danger: 'border-red-200 bg-red-50/70',
  };
  return (
    <section aria-label="Next step" className={cn('rounded-2xl border p-5 sm:p-6', tones[tone])}>
      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Next step</p>
      <h2 className="mt-1 text-lg font-bold text-neutral-900">{title}</h2>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

function NudgeButton({ houseId, message, who }: { houseId: string; message: string; who: string }) {
  const [sent, setSent] = useState(false);
  const { status, run } = useActionStatus();
  const nudge = async () => {
    try {
      const fd = new FormData();
      fd.append('body', message);
      await run(() => messagesApi.send(houseId, fd));
      setSent(true);
      toast.success(`Reminder posted in house chat for ${who}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not send reminder'));
    }
  };
  return (
    <SubmitButton
      type="button"
      tone="light"
      status={status}
      onClick={nudge}
      disabled={sent}
      labels={{ running: 'Posting…', done: 'Reminder posted', failed: 'Try again' }}
    >
      <BellRing className="size-4" />
      {sent ? 'Reminder sent' : `Nudge ${who}`}
    </SubmitButton>
  );
}

function Proof({ submission }: { submission?: ChoreThreadSubmission }) {
  const url = resolveProofUrl(submission?.imageUrl);
  if (!submission) return null;
  return (
    <div className="flex flex-col gap-3">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Proof photo" className="max-h-80 w-full rounded-xl border border-neutral-200 bg-white object-contain" />
      ) : (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500">
          No photo was added. Judge from the note and the chore itself.
        </p>
      )}
      {submission.clarification && (
        <blockquote className="rounded-xl bg-white p-3 text-sm text-neutral-700 ring-1 ring-neutral-200">
          “{submission.clarification}”
        </blockquote>
      )}
    </div>
  );
}

function ReviewForm({ task, submission, onChanged }: { task: Task; submission?: ChoreThreadSubmission; onChanged: () => void }) {
  const [mode, setMode] = useState<'choose' | 'changes'>('choose');
  const [reason, setReason] = useState('');
  const approveAction = useActionStatus();
  const feedbackAction = useActionStatus();
  const saving = approveAction.status !== 'idle' || feedbackAction.status !== 'idle';

  const cast = async (vote: 'approve' | 'reject') => {
    if (vote === 'reject' && reason.trim().length < 3) {
      toast.error('Say what needs fixing');
      return;
    }
    const action = vote === 'approve' ? approveAction : feedbackAction;
    try {
      const { data } = await action.run(() =>
        tasksApi.vote(task.houseId, task.id, vote, vote === 'reject' ? reason.trim() : undefined),
      );
      const result = data.data;
      if (result.finalStatus === 'completed') {
        toast.success(
          result.rotation?.assigneeName ? `Approved. Next turn goes to ${result.rotation.assigneeName}` : 'Approved. Chore done',
        );
      } else if (result.finalStatus === 'disputed') toast.success('Changes requested');
      else toast.success(vote === 'approve' ? 'Approval recorded' : 'Feedback recorded');
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not record your vote'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Proof submission={submission} />
      {mode === 'choose' ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <SubmitButton
            type="button"
            status={approveAction.status}
            className="flex-1 !bg-emerald-600 hover:!bg-emerald-700"
            disabled={saving && approveAction.status === 'idle'}
            onClick={() => cast('approve')}
            labels={{ running: 'Approving…', done: 'Approved', failed: 'Try again' }}
          >
            <Check className="size-4" />
            Approve
          </SubmitButton>
          <button type="button" className="btn-secondary flex-1" disabled={saving} onClick={() => setMode('changes')}>
            <PencilLine className="size-4" />
            Request changes
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-neutral-900">What needs fixing?</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  reason === r ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white hover:border-neutral-900',
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            className="input h-auto min-h-[84px] resize-none py-3"
            placeholder="Be specific so they can fix it in one go"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            autoFocus
          />
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setMode('choose')} disabled={saving}>
              Back
            </button>
            <SubmitButton
              type="button"
              status={feedbackAction.status}
              className="flex-1"
              onClick={() => cast('reject')}
              disabled={reason.trim().length < 3}
              labels={{ running: 'Sending…', done: 'Feedback sent', failed: 'Try again' }}
            >
              Send feedback
            </SubmitButton>
          </div>
        </div>
      )}
    </div>
  );
}

/** The one thing this viewer should do about the current turn. */
export default function NextStep({ houseId, choreTitle, task, cycle, vote, members, viewerId, maxResubmissions, onChanged }: Props) {
  const isMine = task.assignedTo === viewerId;
  const assignee = memberName(members, task.assignedTo);
  const viewerActive = members.some((m) => m.userId === viewerId && m.status === 'active');
  const submissions = cycle?.submissions ?? [];
  const latest = submissions.find((s) => s.isCurrent) ?? submissions[submissions.length - 1];
  const waitingOn = pendingVoters(task, members, vote);
  const waitingNames = listNames(waitingOn.map((m) => firstName(m.user?.name)));

  switch (task.status) {
    case 'pending':
      return isMine ? (
        <Panel title={`Your turn, ${dueSummary(task.deadline)}`}>
          <SubmitProofForm houseId={houseId} taskId={task.id} onDone={onChanged} submitLabel="Mark done & send for review" />
        </Panel>
      ) : (
        <Panel title={`${firstName(assignee)}'s turn, ${dueSummary(task.deadline)}`}>
          <p className="text-sm text-neutral-600">Nothing for you to do yet. You&apos;ll review the proof once it&apos;s handed in.</p>
          {viewerActive && (
            <div className="mt-4">
              <NudgeButton
                houseId={houseId}
                who={firstName(assignee)}
                message={`👋 Hey ${firstName(assignee)}, "${choreTitle}" is ${dueSummary(task.deadline)} (${formatDue(task.deadline)}).`}
              />
            </div>
          )}
        </Panel>
      );

    case 'submitted': {
      const approved = vote?.tallies.approved ?? 0;
      const required = vote?.tallies.required ?? 0;
      const progress = required ? `${approved} of ${required} approvals` : 'Votes coming in';
      if (!isMine && viewerActive && !vote?.userVote) {
        return (
          <Panel tone="info" title={`Review ${firstName(assignee)}'s proof`}>
            <ReviewForm task={task} submission={latest} onChanged={onChanged} />
          </Panel>
        );
      }
      const yourVote = vote?.userVote
        ? vote.userVote.vote === 'approve' ? 'You approved. ' : 'You asked for changes. '
        : '';
      return (
        <Panel tone="info" title={isMine ? 'Waiting for your housemates' : 'In review'}>
          <p className="text-sm text-neutral-700">
            {yourVote}
            {progress}
            {waitingNames ? ` · waiting on ${waitingNames}` : ''}
          </p>
          {waitingOn.length > 0 && viewerActive && (
            <div className="mt-4">
              <NudgeButton
                houseId={houseId}
                who={waitingOn.length === 1 ? firstName(waitingOn[0].user?.name) : 'reviewers'}
                message={`👋 ${waitingNames}: "${choreTitle}" by ${firstName(assignee)} is waiting for your review.`}
              />
            </div>
          )}
        </Panel>
      );
    }

    case 'disputed': {
      const feedback = (latest?.votes ?? []).filter((v) => v.vote === 'reject' && v.reason);
      const used = Math.max(0, (latest?.attemptNumber ?? 1) - 1);
      const retriesLeft = Math.max(0, maxResubmissions - used);
      const reasons = (
        <ul className="flex flex-col gap-2">
          {feedback.map((v) => (
            <li key={v.userId} className="rounded-xl bg-white p-3 text-sm ring-1 ring-amber-200">
              <span className="font-semibold text-neutral-900">{v.userName}:</span>{' '}
              <span className="text-neutral-700">{v.reason}</span>
            </li>
          ))}
        </ul>
      );
      return isMine ? (
        <Panel tone="warning" title="Your housemates asked for changes">
          {feedback.length > 0 && reasons}
          <p className="mt-3 text-sm text-amber-900">
            {retriesLeft} {retriesLeft === 1 ? 'retry' : 'retries'} left · {dueSummary(task.deadline)}
          </p>
          <div className="mt-4">
            {retriesLeft > 0 ? (
              <SubmitProofForm houseId={houseId} taskId={task.id} isResubmit onDone={onChanged} />
            ) : (
              <p className="text-sm text-neutral-600">No retries left. Ask an admin if this needs another look.</p>
            )}
          </div>
        </Panel>
      ) : (
        <Panel tone="warning" title={`${firstName(assignee)} is fixing it`}>
          {feedback.length > 0 ? reasons : <p className="text-sm text-neutral-600">Changes were requested on the last proof.</p>}
        </Panel>
      );
    }

    case 'completed': {
      const approvers = (latest?.votes ?? []).filter((v) => v.vote === 'approve').map((v) => firstName(v.userName));
      return (
        <Panel tone="success" title={isMine ? 'Done, nice work' : `Done by ${firstName(assignee)}`}>
          <p className="text-sm text-neutral-700">
            {approvers.length ? `Approved by ${listNames(approvers)}.` : 'Completed.'}
          </p>
        </Panel>
      );
    }
    case 'expired':
      return (
        <Panel tone="danger" title={isMine ? 'You missed this one' : `${firstName(assignee)} missed this turn`}>
          <p className="text-sm text-neutral-700">The deadline ({formatDue(task.deadline)}) passed before it was finished, so a penalty was added.</p>
        </Panel>
      );
    case 'rejected':
      return (
        <Panel tone="danger" title="Failed review">
          <p className="text-sm text-neutral-700">The proof was turned down after every retry was used, so a penalty was added.</p>
        </Panel>
      );
    default:
      return null;
  }
}
