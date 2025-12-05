module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/server/**/__tests__/**/*.+(ts|tsx|js)',
    '**/server/**/*.(test|spec).+(ts|tsx|js)'
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
      branches: 20,
      functions: 40,
      lines: 40,
      statements: 40
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/server/__tests__/setup.ts'],
  testTimeout: 10000,
  verbose: true
};
