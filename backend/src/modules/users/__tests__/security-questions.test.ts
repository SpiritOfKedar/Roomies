import {
  normalizeSecurityAnswer,
  isValidSecurityQuestionId,
  SECURITY_QUESTIONS,
} from '../../../shared/constants/security-questions';

describe('security-questions constants', () => {
  it('normalizes answers to lowercase trimmed', () => {
    expect(normalizeSecurityAnswer('  Fluffy  ')).toBe('fluffy');
  });

  it('validates known question ids', () => {
    expect(isValidSecurityQuestionId('childhood_pet')).toBe(true);
    expect(isValidSecurityQuestionId('invalid')).toBe(false);
  });

  it('exposes six predefined questions', () => {
    expect(SECURITY_QUESTIONS).toHaveLength(6);
  });
});
