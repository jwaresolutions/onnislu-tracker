module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/server/**/*.{ts,tsx}',
    '!src/server/**/*.d.ts',
    '!src/server/__tests__/**',
    '!src/server/scripts/**',
    '!src/server/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/server/__tests__/setup.ts'],
  testTimeout: 10000,
  verbose: true
};
