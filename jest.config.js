/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/apps', '<rootDir>/libs'],
  testPathIgnorePatterns: ['<rootDir>/apps/shell/'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]
  },
  moduleNameMapper: {
    '^@ai-task-manager/ai/embeddings$': '<rootDir>/libs/ai/embeddings/src/index.ts',
    '^@ai-task-manager/ai/rag$': '<rootDir>/libs/ai/rag/src/index.ts',
    '^@ai-task-manager/ai/guardrails$': '<rootDir>/libs/ai/guardrails/src/index.ts',
    '^@ai-task-manager/ai/intents$': '<rootDir>/libs/ai/intents/src/index.ts',
    '^@ai-task-manager/ui/chat$': '<rootDir>/libs/ui/chat/src/index.ts',
    '^@task-ai/ui-chat$': '<rootDir>/libs/ui/chat/src/index.ts'
  }
};
