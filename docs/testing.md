# Testing Guide

This document describes the comprehensive testing suite for the ONNISLU Price Tracker application.

## Overview

The testing suite includes:
- **Unit Tests**: Testing individual components, services, and utilities
- **Integration Tests**: Testing API endpoints and database operations
- **Performance Tests**: Testing system performance with large datasets
- **Coverage Reporting**: Tracking test coverage metrics

## Test Structure

```
src/
├── server/
│   └── __tests__/
│       ├── setup.ts                          # Jest setup for server tests
│       ├── api-integration.test.ts           # API endpoint integration tests
│       ├── database.test.ts                  # Database unit tests
│       ├── database-integration.test.ts      # Database integration tests
│       ├── middleware.test.ts                # Middleware tests
│       ├── migrations.test.ts                # Migration tests
│       ├── services/
│       │   ├── DataService.test.ts           # Data service tests
│       │   └── AlertService.test.ts          # Alert service tests
│       ├── parsers/
│       │   └── floorPlanParser.test.ts       # Parser tests
│       └── performance/
│           └── database-performance.test.ts  # Performance tests
└── client/
    └── src/
        ├── setupTests.ts                     # Jest setup for client tests
        ├── components/
        │   └── __tests__/
        │       ├── AlertPanel.test.tsx       # Alert panel component tests
        │       ├── FilterPanel.test.tsx      # Filter panel component tests
        │       └── ErrorBoundary.test.tsx    # Error boundary tests
        ├── hooks/
        │   └── __tests__/
        │       └── useFilters.test.ts        # Custom hook tests
        └── utils/
            └── __tests__/
                └── filterUtils.test.ts       # Utility function tests
```

## Running Tests

### Server Tests

```bash
# Run all server tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- database.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="Building Operations"
```

### Client Tests

```bash
# Navigate to client directory
cd src/client

# Run all client tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- AlertPanel.test.tsx
```

### All Tests

```bash
# Run both server and client tests
npm test && cd src/client && npm test
```

## Test Coverage

### Coverage Thresholds

**Server Tests:**
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

**Client Tests:**
- Branches: 60%
- Functions: 60%
- Lines: 60%
- Statements: 60%

### Viewing Coverage Reports

After running tests with `--coverage`, open the HTML report:

```bash
# Server coverage
open coverage/index.html

# Client coverage
cd src/client && open coverage/index.html
```

## Test Categories

### 1. Unit Tests

Test individual functions, components, and classes in isolation.

**Example: Testing a utility function**
```typescript
describe('filterUtils', () => {
  it('should filter by search term', () => {
    const result = applyFilters(mockData, { searchTerm: 'Studio' });
    expect(result).toHaveLength(1);
  });
});
```

### 2. Integration Tests

Test how multiple components work together.

**Example: Testing API endpoints**
```typescript
describe('API Integration Tests', () => {
  it('should get all floor plans', async () => {
    const response = await request(app)
      .get('/api/floorplans')
      .expect(200);
    
    expect(response.body.success).toBe(true);
  });
});
```

### 3. Component Tests

Test React components with user interactions.

**Example: Testing a React component**
```typescript
describe('AlertPanel', () => {
  it('should render alerts after successful fetch', async () => {
    render(<AlertPanel />);
    
    await waitFor(() => {
      expect(screen.getByText('Price Alerts')).toBeInTheDocument();
    });
  });
});
```

### 4. Performance Tests

Test system performance with large datasets.

**Example: Testing bulk operations**
```typescript
describe('Database Performance Tests', () => {
  it('should handle bulk inserts efficiently', async () => {
    const startTime = Date.now();
    
    // Insert 100 records
    for (let i = 0; i < 100; i++) {
      await db.insert(data);
    }
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000);
  });
});
```

## Writing Tests

### Best Practices

1. **Descriptive Test Names**: Use clear, descriptive names that explain what is being tested
   ```typescript
   it('should filter floor plans by bedrooms and building')
   ```

2. **Arrange-Act-Assert Pattern**: Structure tests clearly
   ```typescript
   // Arrange
   const filters = { bedrooms: [1] };
   
   // Act
   const result = applyFilters(data, filters);
   
   // Assert
   expect(result).toHaveLength(2);
   ```

3. **Test One Thing**: Each test should verify one specific behavior

4. **Use Mocks Appropriately**: Mock external dependencies but test real logic
   ```typescript
   global.fetch = jest.fn().mockResolvedValue({
     json: async () => ({ success: true, data: mockData })
   });
   ```

5. **Clean Up**: Reset state between tests
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
   });
   ```

### Testing React Components

Use React Testing Library for component tests:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('MyComponent', () => {
  it('should handle user interaction', async () => {
    render(<MyComponent />);
    
    const button = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });
});
```

### Testing Async Operations

Handle asynchronous code properly:

```typescript
it('should fetch data successfully', async () => {
  const promise = fetchData();
  
  await expect(promise).resolves.toEqual(expectedData);
});

// Or with waitFor
it('should update UI after fetch', async () => {
  render(<Component />);
  
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

### Testing Error Handling

Test both success and failure cases:

```typescript
it('should handle fetch errors', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
  
  render(<Component />);
  
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run server tests
        run: npm test -- --coverage
      
      - name: Run client tests
        run: cd src/client && npm ci && npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
        with:
          files: ./coverage/lcov.info,./src/client/coverage/lcov.info
```

## Debugging Tests

### Running Tests in Debug Mode

```bash
# Node.js debugging
node --inspect-brk node_modules/.bin/jest --runInBand

# VS Code launch configuration
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal"
}
```

### Common Issues

1. **Tests timing out**: Increase timeout with `jest.setTimeout(10000)`
2. **Async issues**: Use `await waitFor()` for async updates
3. **Mock not working**: Ensure mocks are cleared between tests
4. **Coverage not accurate**: Check `collectCoverageFrom` patterns

## Performance Testing

Performance tests verify the system handles large datasets efficiently:

- **Bulk Operations**: Test inserting/querying large amounts of data
- **Concurrent Operations**: Test multiple simultaneous operations
- **Memory Usage**: Monitor memory consumption during operations
- **Query Performance**: Ensure database queries are optimized

### Performance Benchmarks

- Bulk inserts (100 records): < 5 seconds
- Bulk inserts (365 records): < 10 seconds
- Complex queries: < 200ms
- Concurrent reads (50 queries): < 2 seconds
- Statistics calculation: < 300ms

## Test Data

### Mock Data

Use realistic mock data that represents actual use cases:

```typescript
const mockFloorPlan = {
  id: 1,
  building_name: 'Fairview',
  name: 'Studio A',
  bedrooms: 0,
  bathrooms: 1,
  has_den: false,
  square_footage: 500,
  current_price: 2000,
  is_available: true
};
```

### Test Database

Server tests use in-memory SQLite database (`:memory:`) for fast, isolated tests.

## Maintenance

### Updating Tests

When adding new features:
1. Write tests first (TDD approach)
2. Ensure tests cover happy path and error cases
3. Update coverage thresholds if needed
4. Document any new testing patterns

### Reviewing Test Coverage

Regularly review coverage reports to identify:
- Untested code paths
- Missing error handling tests
- Areas needing integration tests
- Performance bottlenecks

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [TypeScript Jest](https://kulshekhar.github.io/ts-jest/)
