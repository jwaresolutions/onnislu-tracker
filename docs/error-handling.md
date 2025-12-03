# Error Handling Improvements

## Recent Changes

### 1. Error Boundary Component
Added a React Error Boundary to catch and display errors gracefully instead of showing a blank page.

**Location**: `src/client/src/components/ErrorBoundary.tsx`

**Features**:
- Catches React component errors
- Displays user-friendly error message
- Shows error details in development
- Provides reload button
- Prevents entire app from crashing

**Usage**: Wraps the entire App component in `main.tsx`

### 2. Null Safety Improvements

#### FloorPlanCard Component
Fixed potential null/undefined access in percentage change calculations:

**Before**:
```typescript
const last = Number(historyPoints[historyPoints.length - 1].price);
const prev = Number(historyPoints[historyPoints.length - 1 - window].price);
```

**After**:
```typescript
const lastPoint = historyPoints[historyPoints.length - 1];
const prevPoint = historyPoints[historyPoints.length - 1 - window];
if (!lastPoint || !prevPoint) return NaN;
const last = Number(lastPoint.price);
const prev = Number(prevPoint.price);
if (!prev || isNaN(last) || isNaN(prev)) return NaN;
```

**Why**: Prevents errors when history data is incomplete or missing

#### Image Candidate Generation
Added null checks for regex match results:

**Before**:
```typescript
if (m) {
  const code = `${m[1].toLowerCase()}${parseInt(m[2], 10)}`;
```

**After**:
```typescript
if (m && m[1] && m[2]) {
  const code = `${m[1].toLowerCase()}${parseInt(m[2], 10)}`;
```

**Why**: Prevents errors when floor plan names don't match expected pattern

### 3. Development Build Configuration

#### Vite Configuration
Updated to support unminified builds with source maps:

```typescript
build: {
  outDir: '../../dist/client',
  emptyOutDir: true,
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
}
```

**Benefits**:
- Readable error stack traces
- Easier debugging in browser DevTools
- Source maps for production debugging
- Conditional minification based on environment

#### Docker Configurations
Created separate Dockerfiles for development and production:

- **Dockerfile.dev**: Unminified build with source maps
- **Dockerfile.prod**: Minified production build
- **docker-compose.yml**: Uses dev build by default
- **docker-compose.prod.yml**: Uses production build

## Common Error Patterns

### 1. Minified React Error
**Symptom**: Generic "Error" in console with minified stack trace

**Cause**: Production build minifies code, making errors hard to read

**Solution**: Use development build or enable source maps

### 2. Cannot Read Property of Undefined
**Symptom**: `TypeError: Cannot read property 'X' of undefined`

**Cause**: Accessing nested properties without null checks

**Solution**: Add optional chaining or explicit null checks

**Example**:
```typescript
// Bad
const price = data.floorPlan.price;

// Good
const price = data?.floorPlan?.price ?? null;
```

### 3. Array Index Out of Bounds
**Symptom**: Accessing array element that doesn't exist

**Cause**: Not checking array length before access

**Solution**: Validate array length first

**Example**:
```typescript
// Bad
const last = arr[arr.length - 1];

// Good
const last = arr.length > 0 ? arr[arr.length - 1] : null;
```

## Debugging Tips

### 1. Use Development Build
```bash
# Local development
npm run dev

# Docker development
docker-compose up -d --build
```

### 2. Check Browser Console
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed API calls
- Use React DevTools extension

### 3. Enable Source Maps
Source maps are now enabled by default in development builds. They allow you to:
- See original source code in DevTools
- Set breakpoints in TypeScript files
- Get readable stack traces

### 4. Use Error Boundary
The ErrorBoundary component will catch and display:
- Component rendering errors
- Lifecycle method errors
- Constructor errors

It will NOT catch:
- Event handler errors (use try-catch)
- Async code errors (use try-catch)
- Server-side errors (handle in API layer)

### 5. Add Logging
For complex issues, add console.log statements:

```typescript
console.log('Data received:', data);
console.log('Processing floor plan:', floorPlan);
```

Remove or comment out before committing to production.

## Best Practices

### 1. Always Validate Data
```typescript
// Check API responses
if (!response.success || !response.data) {
  throw new Error(response.error || 'Request failed');
}

// Check array access
if (array.length > index) {
  const item = array[index];
}

// Check object properties
if (obj && obj.property) {
  const value = obj.property;
}
```

### 2. Use TypeScript Strictly
```typescript
// Enable strict mode in tsconfig.json
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"noFallthroughCasesInSwitch": true
```

### 3. Handle Async Errors
```typescript
try {
  const response = await fetch('/api/data');
  const data = await response.json();
  // Process data
} catch (error) {
  console.error('Failed to fetch:', error);
  setError(error.message);
}
```

### 4. Provide Fallbacks
```typescript
// Default values
const price = floorPlan.current_price ?? 0;

// Fallback UI
{loading ? <Spinner /> : error ? <ErrorMessage /> : <Content />}
```

## Testing Error Scenarios

### 1. Test with Missing Data
```typescript
// Simulate empty response
setFloorPlans([]);

// Simulate null values
setFloorPlans([{ ...plan, current_price: null }]);
```

### 2. Test Network Failures
```typescript
// Simulate API error
fetch.mockRejectedValue(new Error('Network error'));
```

### 3. Test Edge Cases
- Empty arrays
- Null/undefined values
- Invalid data types
- Out of range values

## Monitoring in Production

Even with error handling, monitor production for issues:

1. **Browser Console**: Check for client-side errors
2. **Server Logs**: Check Winston logs for API errors
3. **Health Endpoint**: Monitor `/api/status` for system health
4. **User Reports**: Listen to user feedback about issues

## Future Improvements

Consider adding:
- Error tracking service (Sentry, Rollbar)
- User feedback mechanism
- Automatic error reporting
- Performance monitoring
- A/B testing for error recovery strategies
