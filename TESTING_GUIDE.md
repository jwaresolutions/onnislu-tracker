# Testing Guide

## Quick Start

### Run All Tests
```bash
npm run test:ci
```

### Run Specific Test Suite
```bash
npm test -- --testPathPattern="database.test"
npm test -- --testPathPattern="DataService.test"
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run with Coverage
```bash
npm run test:coverage
```

## Test Structure

### Server Tests (`src/server/__tests__/`)
- `database.test.ts` - Database operations and queries
- `database-integration.test.ts` - Database integration scenarios
- `migrations.test.ts` - Schema migration tests
- `api-integration.test.ts` - API endpoint tests
- `final-integration.test.ts` - End-to-end integration tests
- `middleware.test.ts` - Express middleware tests
- `services/DataService.test.ts` - Data service unit tests
- `services/AlertService.test.ts` - Alert service unit tests
- `parsers/floorPlanParser.test.ts` - HTML parser tests
- `performance/database-performance.test.ts` - Performance benchmarks

### Client Tests (`src/client/src/`)
- `components/__tests__/` - React component tests
- `hooks/__tests__/` - Custom hook tests
- `utils/__tests__/` - Utility function tests

## Writing Tests

### Database Tests
```typescript
import { DatabaseConnection } from '../database/connection';

describe('My Test Suite', () => {
  let db: DatabaseConnection;

  beforeEach(async () => {
    db = new DatabaseConnection(':memory:');
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
  });

  test('should do something', async () => {
    const result = await db.executeQuery('SELECT 1');
    expect(result.success).toBe(true);
  });
});
```

### Important: SQLite Boolean Handling
SQLite stores booleans as 0/1. Always coerce to boolean in tests:
```typescript
// ❌ Wrong
expect(row.is_available).toBe(true);

// ✅ Correct
expect(!!row.is_available).toBe(true);
```

### Service Tests
```typescript
import { DataService } from '../services/DataService';

describe('DataService', () => {
  let dataService: DataService;
  let db: DatabaseConnection;

  beforeEach(async () => {
    db = new DatabaseConnection(':memory:');
    await db.initialize();
    dataService = new DataService(db);
    await dataService.init();
  });

  afterEach(async () => {
    await db.close();
  });

  test('should upsert building', async () => {
    const result = await dataService.upsertBuilding({
      name: 'Test Building',
      url: 'https://test.com'
    });
    expect(result.id).toBeGreaterThan(0);
  });
});
```

### API Tests
```typescript
import request from 'supertest';
import express from 'express';

describe('API Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  test('should return status', async () => {
    const response = await request(app)
      .get('/api/status')
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: expect.any(Object)
    });
  });
});
```

## Test Configuration

### Jest Config (`jest.config.js`)
- Uses `ts-jest` for TypeScript support
- Test environment: `node`
- Coverage thresholds: 50% (branches, functions, lines, statements)
- Test timeout: 10 seconds
- Setup file: `src/server/__tests__/setup.ts`

### Client Jest Config (`src/client/jest.config.js`)
- Uses `ts-jest` for TypeScript support
- Test environment: `jsdom` (for React components)
- Module name mapper for CSS and path aliases
- Setup file: `src/client/src/setupTests.ts`

## CI/CD Integration

### GitHub Actions
Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

Three separate jobs:
1. **Server Tests** - Backend unit and integration tests
2. **Client Tests** - Frontend component and utility tests
3. **Lint** - ESLint checks

### Coverage Reports
Coverage reports are uploaded to Codecov:
- Server coverage: `./coverage/lcov.info`
- Client coverage: `./src/client/coverage/lcov.info`

## Troubleshooting

### Tests Hanging
If tests hang, use `--forceExit`:
```bash
npm test -- --forceExit
```

### Detect Open Handles
To find async operations that aren't closing:
```bash
npm test -- --detectOpenHandles
```

### Memory Issues
Run tests with limited workers:
```bash
npm test -- --maxWorkers=2
```

### Specific Test File
```bash
npm test -- --testPathPattern="database.test"
```

### Specific Test Name
```bash
npm test -- --testNamePattern="should insert building"
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Best Practices

1. **Use in-memory databases** for unit tests (`:memory:`)
2. **Clean up resources** in `afterEach` or `afterAll`
3. **Mock external dependencies** (Puppeteer, APIs)
4. **Test one thing at a time** - keep tests focused
5. **Use descriptive test names** - explain what's being tested
6. **Avoid test interdependence** - each test should be independent
7. **Use transactions** for database tests when possible
8. **Check for open handles** if tests hang
9. **Set appropriate timeouts** for async operations
10. **Use `forceExit`** in CI to prevent hanging

## Coverage Goals

Current thresholds (50%):
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

Target thresholds (after stabilization):
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## Common Patterns

### Testing Async Operations
```typescript
test('should handle async operation', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

### Testing Error Handling
```typescript
test('should handle errors', async () => {
  await expect(
    functionThatThrows()
  ).rejects.toThrow('Expected error message');
});
```

### Testing Transactions
```typescript
test('should rollback on error', async () => {
  const result = await db.executeTransaction(async (database) => {
    await database.run('INSERT INTO table VALUES (?)' [1]);
    throw new Error('Rollback');
  });
  
  expect(result.success).toBe(false);
  // Verify data was rolled back
});
```

## Performance Testing

Performance tests are in `src/server/__tests__/performance/`:
- Bulk insert operations
- Query performance
- Concurrent operations
- Memory usage
- Transaction performance

Run performance tests separately:
```bash
npm test -- --testPathPattern="performance"
```
