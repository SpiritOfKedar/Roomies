/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // setupFiles: loaded BEFORE the test framework — used to inject env vars from
  // .env.test so that env.ts (Zod-validated) reads the correct DATABASE_URL etc.
  setupFiles: ['<rootDir>/src/__tests__/jest-env.ts'],
  // setupFilesAfterEnv: loaded AFTER the framework — registers mocks & teardown.
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^uuid$': '<rootDir>/uuidMock.js'
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  verbose: true
};
