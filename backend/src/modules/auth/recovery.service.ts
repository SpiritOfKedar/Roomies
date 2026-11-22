/**
 * Password recovery service — email reset and security-question flows.
 */

import crypto from 'crypto';
import { prisma } from '../../shared/db/prisma';
import { hashPassword, comparePassword } from '../../shared/utils/hash';
import { UnauthorizedError, ValidationError } from '../../shared/utils/app-error';
import { env } from '../../shared/utils/env';
import { sendPasswordResetEmail } from '../../shared/mail/mailer';
import { SECURITY_QUESTIONS } from '../../shared/constants/security-questions';
import * as usersRepo from '../users/users.repository';
import * as securityQuestionsRepo from '../users/security-questions.repository';
import { incrementCounter, getCounter, deleteKeys } from '../../shared/cache/ephemeral-store';
import type {
  RecoveryEmailInput,
  VerifyQuestionsInput,
  VerifyTokenInput,
  ResetPasswordInput,
} from './recovery.schema';

export type RecoveryMethod = 'email' | 'security_questions';

export interface RecoveryOptions {
  methods: RecoveryMethod[];
  questions: { questionId: string; text: string }[];
}

const EMAIL_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RECOVERY_SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
/**
 * Security-question lockouts live in Redis so they are shared across instances
 * and survive restarts. Two tiers:
 *   - per (email, IP): a single attacker is stopped after a few guesses, but
 *     cannot lock the real owner out from a different network.
 *   - per email: a high ceiling that stops distributed guessing. It only locks
 *     the security-question method; email reset keeps working.
 */
const QUESTION_FAILURE_WINDOW_SEC = 60 * 60;
const MAX_FAILURES_PER_EMAIL_IP = 5;
const MAX_FAILURES_PER_EMAIL = 20;

const failKeyEmailIp = (email: string, ip: string) => `recovery:qfail:${email}:${ip}`;
const failKeyEmail = (email: string) => `recovery:qfail:${email}`;

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Tokens are "<rowId>.<secret>". The row id is a lookup selector, so verifying
 * is one indexed read plus one bcrypt compare instead of comparing against every
 * outstanding token in the table. Only the secret is hashed and stored.
 */
function buildToken(rowId: string, secret: string): string {
  return `${rowId}.${secret}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseToken(rawToken: string): { rowId: string; secret: string } | null {
  const dot = rawToken.indexOf('.');
  if (dot <= 0) return null;
  const rowId = rawToken.slice(0, dot);
  const secret = rawToken.slice(dot + 1);
  if (!UUID_RE.test(rowId) || !/^[0-9a-f]{64}$/.test(secret)) return null;
  return { rowId, secret };
}

async function isQuestionLocked(email: string, ip: string): Promise<boolean> {
  const [perIp, perEmail] = await Promise.all([
    getCounter(failKeyEmailIp(email, ip)),
    getCounter(failKeyEmail(email)),
  ]);
  return perIp >= MAX_FAILURES_PER_EMAIL_IP || perEmail >= MAX_FAILURES_PER_EMAIL;
}

async function trackQuestionFailure(email: string, ip: string): Promise<void> {
  await Promise.all([
    incrementCounter(failKeyEmailIp(email, ip), QUESTION_FAILURE_WINDOW_SEC),
    incrementCounter(failKeyEmail(email), QUESTION_FAILURE_WINDOW_SEC),
  ]);
}

async function clearQuestionFailures(email: string, ip: string): Promise<void> {
  await deleteKeys(failKeyEmailIp(email, ip), failKeyEmail(email));
}

async function buildRecoveryOptions(user: {
  id: string;
  passwordHash: string | null;
}): Promise<RecoveryOptions> {
  const methods: RecoveryMethod[] = [];
  const questions: { questionId: string; text: string }[] = [];

  if (user.passwordHash) {
    methods.push('email');
  }

  const hasQuestions = await securityQuestionsRepo.hasFullSecurityQuestions(user.id);
  if (hasQuestions) {
    methods.push('security_questions');
    const prompts = await securityQuestionsRepo.getUserSecurityQuestionPrompts(user.id);
    questions.push(...prompts);
  }

  return { methods, questions };
}

/**
 * Get available recovery methods for an email (anti-enumeration: empty if not found).
 */
export async function getRecoveryOptions(input: RecoveryEmailInput): Promise<RecoveryOptions> {
  const user = await usersRepo.findUserByEmail(input.email);
  if (!user || user.status !== 'active') {
    return { methods: [], questions: [] };
  }
  return buildRecoveryOptions(user);
}

/**
 * Send a password reset email. Always succeeds from caller perspective.
 */
export async function sendRecoveryEmail(input: RecoveryEmailInput): Promise<void> {
  const user = await usersRepo.findUserByEmail(input.email);
  if (!user || user.status !== 'active' || !user.passwordHash) {
    return;
  }

  const rowId = crypto.randomUUID();
  const secret = generateSecret();
  const tokenHash = await hashPassword(secret);

  await prisma.passwordResetToken.create({
    data: {
      id: rowId,
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
    },
  });

  const rawToken = buildToken(rowId, secret);
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}&type=email`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

/**
 * Verify security question answers and issue a short-lived recovery token.
 */
export async function verifySecurityQuestions(
  input: VerifyQuestionsInput,
  meta: { ipAddress?: string } = {},
): Promise<{ recoveryToken: string }> {
  const ip = meta.ipAddress ?? 'unknown';

  if (await isQuestionLocked(input.email, ip)) {
    throw UnauthorizedError(
      'Too many failed attempts. Please try again in an hour or use email recovery.',
    );
  }

  const user = await usersRepo.findUserByEmail(input.email);
  if (!user || user.status !== 'active') {
    await trackQuestionFailure(input.email, ip);
    throw UnauthorizedError('Incorrect answers. Please try again.');
  }

  const hasQuestions = await securityQuestionsRepo.hasFullSecurityQuestions(user.id);
  if (!hasQuestions) {
    throw UnauthorizedError('Security questions are not configured for this account.');
  }

  const valid = await securityQuestionsRepo.verifyUserSecurityAnswers(user.id, input.answers);
  if (!valid) {
    await trackQuestionFailure(input.email, ip);
    throw UnauthorizedError('Incorrect answers. Please try again.');
  }

  await clearQuestionFailures(input.email, ip);

  const rowId = crypto.randomUUID();
  const secret = generateSecret();
  const tokenHash = await hashPassword(secret);

  await prisma.accountRecoverySession.create({
    data: {
      id: rowId,
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RECOVERY_SESSION_TTL_MS),
    },
  });

  return { recoveryToken: buildToken(rowId, secret) };
}

/**
 * Verify that a reset/recovery token is valid and unused.
 */
export async function verifyRecoveryToken(input: VerifyTokenInput): Promise<{ valid: true }> {
  const userId = await resolveTokenUserId(input.token, input.type);
  if (!userId) {
    throw UnauthorizedError('This reset link is invalid or has expired.');
  }
  return { valid: true };
}

/** Find the live row a token points at and verify its secret. */
async function findLiveToken(
  rawToken: string,
  type: 'email' | 'recovery',
): Promise<{ id: string; userId: string } | null> {
  const parsed = parseToken(rawToken);
  if (!parsed) return null;

  const where = { id: parsed.rowId, usedAt: null, expiresAt: { gt: new Date() } };
  const stored =
    type === 'email'
      ? await prisma.passwordResetToken.findFirst({ where })
      : await prisma.accountRecoverySession.findFirst({ where });
  if (!stored) return null;

  const match = await comparePassword(parsed.secret, stored.tokenHash);
  return match ? { id: stored.id, userId: stored.userId } : null;
}

async function resolveTokenUserId(
  rawToken: string,
  type: 'email' | 'recovery',
): Promise<string | null> {
  return (await findLiveToken(rawToken, type))?.userId ?? null;
}

async function markTokenUsed(rawToken: string, type: 'email' | 'recovery'): Promise<string | null> {
  const stored = await findLiveToken(rawToken, type);
  if (!stored) return null;

  // Conditional update keeps the token single-use even under concurrent resets.
  const where = { id: stored.id, usedAt: null };
  const data = { usedAt: new Date() };
  const { count } =
    type === 'email'
      ? await prisma.passwordResetToken.updateMany({ where, data })
      : await prisma.accountRecoverySession.updateMany({ where, data });

  return count === 1 ? stored.userId : null;
}

/**
 * Reset password using email token or recovery session token.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const userId = await markTokenUsed(input.token, input.type);
  if (!userId) {
    throw UnauthorizedError('This reset link is invalid or has expired.');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'active') {
    throw UnauthorizedError('This reset link is invalid or has expired.');
  }

  const passwordHash = await hashPassword(input.newPassword);
  await usersRepo.updateUserPassword(userId, passwordHash);
  await usersRepo.revokeAllRefreshTokens(userId);
}

/**
 * Recovery status for authenticated user profile.
 */
export async function getUserRecoveryStatus(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ValidationError('User not found');
  }

  const questionCount = await securityQuestionsRepo.getUserSecurityQuestionCount(userId);

  return {
    hasSecurityQuestions: questionCount === securityQuestionsRepo.REQUIRED_QUESTION_COUNT,
    questionCount,
    hasPassword: Boolean(user.passwordHash),
    availableQuestions: SECURITY_QUESTIONS,
  };
}

/**
 * Set or update security questions (requires current password).
 */
export async function setSecurityQuestions(
  userId: string,
  currentPassword: string | undefined,
  questions: { questionId: string; answer: string }[],
): Promise<void> {
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser) {
    throw ValidationError('User not found');
  }

  const user = await usersRepo.findUserByEmail(dbUser.email);
  if (user?.passwordHash) {
    if (!currentPassword) {
      throw UnauthorizedError('Current password is required');
    }
    const passwordValid = await comparePassword(currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw UnauthorizedError('Incorrect password');
    }
  }

  await securityQuestionsRepo.setUserSecurityQuestions(userId, questions);
}

/**
 * Remove all security questions (requires current password).
 */
export async function deleteSecurityQuestions(
  userId: string,
  currentPassword: string | undefined,
): Promise<void> {
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser) {
    throw ValidationError('User not found');
  }

  const user = await usersRepo.findUserByEmail(dbUser.email);
  if (user?.passwordHash) {
    if (!currentPassword) {
      throw UnauthorizedError('Current password is required');
    }
    const passwordValid = await comparePassword(currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw UnauthorizedError('Incorrect password');
    }
  }

  await securityQuestionsRepo.deleteUserSecurityQuestions(userId);
}
