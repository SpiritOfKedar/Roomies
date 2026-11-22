import { getRecoveryOptions, verifySecurityQuestions } from '../recovery.service';
import * as usersRepo from '../../users/users.repository';
import * as securityQuestionsRepo from '../../users/security-questions.repository';

jest.mock('../../../shared/db/prisma', () => ({
  prisma: {
    passwordResetToken: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    accountRecoverySession: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../shared/cache/ephemeral-store', () => ({
  incrementCounter: jest.fn().mockResolvedValue(1),
  getCounter: jest.fn().mockResolvedValue(0),
  deleteKeys: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../users/users.repository');
jest.mock('../../users/security-questions.repository');
jest.mock('../../../shared/mail/mailer', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

const mockedUsersRepo = usersRepo as jest.Mocked<typeof usersRepo>;
const mockedSecurityRepo = securityQuestionsRepo as jest.Mocked<typeof securityQuestionsRepo>;

describe('recovery.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecoveryOptions', () => {
    it('returns empty methods when user is not found (anti-enumeration)', async () => {
      mockedUsersRepo.findUserByEmail.mockResolvedValue(null);

      const result = await getRecoveryOptions({ email: 'missing@example.com' });

      expect(result).toEqual({ methods: [], questions: [] });
    });

    it('includes email and security_questions when available', async () => {
      mockedUsersRepo.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        passwordHash: 'hash',
        googleId: null,
        avatarUrl: null,
        createdAt: new Date(),
        status: 'active',
      });
      mockedSecurityRepo.hasFullSecurityQuestions.mockResolvedValue(true);
      mockedSecurityRepo.getUserSecurityQuestionPrompts.mockResolvedValue([
        { questionId: 'childhood_pet', text: 'What was the name of your first pet?' },
        { questionId: 'birth_city', text: 'In what city were you born?' },
        { questionId: 'first_school', text: 'What was the name of your first school?' },
      ]);

      const result = await getRecoveryOptions({ email: 'test@example.com' });

      expect(result.methods).toEqual(['email', 'security_questions']);
      expect(result.questions).toHaveLength(3);
    });
  });

  describe('verifySecurityQuestions', () => {
    it('throws when answers are incorrect', async () => {
      mockedUsersRepo.findUserByEmail.mockResolvedValue({
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        passwordHash: 'hash',
        googleId: null,
        avatarUrl: null,
        createdAt: new Date(),
        status: 'active',
      });
      mockedSecurityRepo.hasFullSecurityQuestions.mockResolvedValue(true);
      mockedSecurityRepo.verifyUserSecurityAnswers.mockResolvedValue(false);

      await expect(
        verifySecurityQuestions({
          email: 'test@example.com',
          answers: [
            { questionId: 'childhood_pet', answer: 'wrong' },
            { questionId: 'birth_city', answer: 'wrong' },
            { questionId: 'first_school', answer: 'wrong' },
          ],
        }),
      ).rejects.toThrow('Incorrect answers');
    });
  });
});
