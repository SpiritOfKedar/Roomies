import { z } from 'zod';
import { SECURITY_QUESTION_IDS } from '../../shared/constants/security-questions';

export const recoveryEmailSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
});

export const verifyQuestionsSchema = z.object({
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  answers: z
    .array(
      z.object({
        questionId: z.enum(SECURITY_QUESTION_IDS as [string, ...string[]]),
        answer: z.string().min(3, 'Answer must be at least 3 characters').max(200),
      }),
    )
    .length(3, 'Exactly 3 answers are required'),
});

export const verifyTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  type: z.enum(['email', 'recovery']),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  type: z.enum(['email', 'recovery']),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const setSecurityQuestionsSchema = z.object({
  currentPassword: z.string().optional(),
  questions: z
    .array(
      z.object({
        questionId: z.enum(SECURITY_QUESTION_IDS as [string, ...string[]]),
        answer: z.string().min(3, 'Answer must be at least 3 characters').max(200),
      }),
    )
    .length(3, 'Exactly 3 security questions are required')
    .refine(
      (questions) => new Set(questions.map((q) => q.questionId)).size === 3,
      'Each security question must be unique',
    ),
});

export const deleteSecurityQuestionsSchema = z.object({
  currentPassword: z.string().optional(),
});

export const deleteAccountSchema = z.object({
  currentPassword: z.string().optional(),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type RecoveryEmailInput = z.infer<typeof recoveryEmailSchema>;
export type VerifyQuestionsInput = z.infer<typeof verifyQuestionsSchema>;
export type VerifyTokenInput = z.infer<typeof verifyTokenSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SetSecurityQuestionsInput = z.infer<typeof setSecurityQuestionsSchema>;
export type DeleteSecurityQuestionsInput = z.infer<typeof deleteSecurityQuestionsSchema>;
