export default {
  displayName: 'shell',
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$'
      }
    ]
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  moduleNameMapper: {
    '^@task-ai/ui-chat$': '<rootDir>/../../libs/ui/chat/src/index.ts'
  },
  moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],
  coverageDirectory: '../../coverage/apps/shell'
};
