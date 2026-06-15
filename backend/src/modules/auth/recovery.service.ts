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
const MAX_QUESTION_FAILURES = 5;
const QUESTION_FAILURE_WINDOW_MS = 60 * 60 * 1000;

const questionFailureTracker = new Map<string, { count: number; resetAt: number }>();

function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function trackQuestionFailure(email: string): void {
  const now = Date.now();
  const entry = questionFailureTracker.get(email);
  if (!entry || entry.resetAt < now) {
    questionFailureTracker.set(email, { count: 1, resetAt: now + QUESTION_FAILURE_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function isQuestionLocked(email: string): boolean {
  const entry = questionFailureTracker.get(email);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    questionFailureTracker.delete(email);
    return false;
  }
  return entry.count >= MAX_QUESTION_FAILURES;
}

function clearQuestionFailures(email: string): void {
  questionFailureTracker.delete(email);
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

  const rawToken = generateRawToken();
  const tokenHash = await hashPassword(rawToken);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}&type=email`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

/**
 * Verify security question answers and issue a short-lived recovery token.
 */
export async function verifySecurityQuestions(
  input: VerifyQuestionsInput,
): Promise<{ recoveryToken: string }> {
  if (isQuestionLocked(input.email)) {
    throw UnauthorizedError(
      'Too many failed attempts. Please try again in an hour or use email recovery.',
    );
  }

  const user = await usersRepo.findUserByEmail(input.email);
  if (!user || user.status !== 'active') {
    throw UnauthorizedError('Incorrect answers. Please try again.');
  }

  const hasQuestions = await securityQuestionsRepo.hasFullSecurityQuestions(user.id);
  if (!hasQuestions) {
    throw UnauthorizedError('Security questions are not configured for this account.');
  }

  const valid = await securityQuestionsRepo.verifyUserSecurityAnswers(user.id, input.answers);
  if (!valid) {
    trackQuestionFailure(input.email);
    throw UnauthorizedError('Incorrect answers. Please try again.');
  }

  clearQuestionFailures(input.email);

  const rawToken = generateRawToken();
  const tokenHash = await hashPassword(rawToken);

  await prisma.accountRecoverySession.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RECOVERY_SESSION_TTL_MS),
    },
  });

  return { recoveryToken: rawToken };
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

async function resolveTokenUserId(
  rawToken: string,
  type: 'email' | 'recovery',
): Promise<string | null> {
  const now = new Date();

  if (type === 'email') {
    const tokens = await prisma.passwordResetToken.findMany({
      where: { usedAt: null, expiresAt: { gt: now } },
    });
    for (const stored of tokens) {
      const match = await comparePassword(rawToken, stored.tokenHash);
      if (match) return stored.userId;
    }
    return null;
  }

  const sessions = await prisma.accountRecoverySession.findMany({
    where: { usedAt: null, expiresAt: { gt: now } },
  });
  for (const stored of sessions) {
    const match = await comparePassword(rawToken, stored.tokenHash);
    if (match) return stored.userId;
  }
  return null;
}

async function markTokenUsed(rawToken: string, type: 'email' | 'recovery'): Promise<string | null> {
  const now = new Date();

  if (type === 'email') {
    const tokens = await prisma.passwordResetToken.findMany({
      where: { usedAt: null, expiresAt: { gt: now } },
    });
    for (const stored of tokens) {
      const match = await comparePassword(rawToken, stored.tokenHash);
      if (match) {
        await prisma.passwordResetToken.update({
          where: { id: stored.id },
          data: { usedAt: now },
        });
        return stored.userId;
      }
    }
    return null;
  }

  const sessions = await prisma.accountRecoverySession.findMany({
    where: { usedAt: null, expiresAt: { gt: now } },
  });
  for (const stored of sessions) {
    const match = await comparePassword(rawToken, stored.tokenHash);
    if (match) {
      await prisma.accountRecoverySession.update({
        where: { id: stored.id },
        data: { usedAt: now },
      });
      return stored.userId;
    }
  }
  return null;
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
