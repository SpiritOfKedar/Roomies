/**
 * Security questions repository — database access for user recovery questions.
 */

import { prisma } from '../../shared/db/prisma';
import { hashPassword, comparePassword } from '../../shared/utils/hash';
import { normalizeSecurityAnswer } from '../../shared/constants/security-questions';

export interface SecurityQuestionInput {
  questionId: string;
  answer: string;
}

export interface SecurityQuestionPrompt {
  questionId: string;
  text: string;
}

const REQUIRED_QUESTION_COUNT = 3;

export async function getUserSecurityQuestionCount(userId: string): Promise<number> {
  return prisma.userSecurityQuestion.count({ where: { userId } });
}

export async function hasFullSecurityQuestions(userId: string): Promise<boolean> {
  const count = await getUserSecurityQuestionCount(userId);
  return count === REQUIRED_QUESTION_COUNT;
}

export async function getUserSecurityQuestionPrompts(
  userId: string,
): Promise<SecurityQuestionPrompt[]> {
  const rows = await prisma.userSecurityQuestion.findMany({
    where: { userId },
    select: { questionId: true },
    orderBy: { createdAt: 'asc' },
  });

  const { getSecurityQuestionText } = await import('../../shared/constants/security-questions');

  return rows
    .map((row) => ({
      questionId: row.questionId,
      text: getSecurityQuestionText(row.questionId) ?? row.questionId,
    }))
    .filter((q) => q.text);
}

export async function setUserSecurityQuestions(
  userId: string,
  questions: SecurityQuestionInput[],
): Promise<void> {
  const data = await Promise.all(
    questions.map(async (q) => ({
      questionId: q.questionId,
      answerHash: await hashPassword(normalizeSecurityAnswer(q.answer)),
    })),
  );

  await prisma.$transaction([
    prisma.userSecurityQuestion.deleteMany({ where: { userId } }),
    prisma.userSecurityQuestion.createMany({
      data: data.map((d) => ({ userId, ...d })),
    }),
  ]);
}

export async function deleteUserSecurityQuestions(userId: string): Promise<void> {
  await prisma.userSecurityQuestion.deleteMany({ where: { userId } });
}

export async function verifyUserSecurityAnswers(
  userId: string,
  answers: SecurityQuestionInput[],
): Promise<boolean> {
  const stored = await prisma.userSecurityQuestion.findMany({ where: { userId } });
  if (stored.length !== REQUIRED_QUESTION_COUNT) return false;
  if (answers.length !== REQUIRED_QUESTION_COUNT) return false;

  for (const answer of answers) {
    const row = stored.find((s) => s.questionId === answer.questionId);
    if (!row) return false;
    const valid = await comparePassword(normalizeSecurityAnswer(answer.answer), row.answerHash);
    if (!valid) return false;
  }

  return true;
}

export { REQUIRED_QUESTION_COUNT };
