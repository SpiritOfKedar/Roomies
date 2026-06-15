export const SECURITY_QUESTIONS = [
  { questionId: 'childhood_pet', text: 'What was the name of your first pet?' },
  { questionId: 'birth_city', text: 'In what city were you born?' },
  { questionId: 'mother_maiden', text: "What is your mother's maiden name?" },
  { questionId: 'first_school', text: 'What was the name of your first school?' },
  { questionId: 'favorite_teacher', text: "What was your favorite teacher's last name?" },
  { questionId: 'childhood_friend', text: "What was your childhood best friend's first name?" },
] as const;

export type SecurityQuestionId = (typeof SECURITY_QUESTIONS)[number]['questionId'];

export const SECURITY_QUESTION_IDS = SECURITY_QUESTIONS.map((q) => q.questionId);

export function getSecurityQuestionText(questionId: string): string | undefined {
  return SECURITY_QUESTIONS.find((q) => q.questionId === questionId)?.text;
}

export function isValidSecurityQuestionId(questionId: string): questionId is SecurityQuestionId {
  return SECURITY_QUESTION_IDS.includes(questionId as SecurityQuestionId);
}

export function normalizeSecurityAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}
