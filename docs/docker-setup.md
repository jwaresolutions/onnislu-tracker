# Docker Setup Guide

This project has three Docker configurations optimized for different use cases.

## Configuration Files

### Dockerfile.dev (Development Build)
- **Purpose**: Debugging and testing
- **Features**:
  - No code minification
  - Source maps enabled
  - Easier error stack traces
  - Larger bundle size
- **Use when**: Debugging issues, testing features, development deployment

### Dockerfile.prod (Production Build)
- **Purpose**: Production deployment
- **Features**:
  - Code minification enabled
  - Optimized bundle size
  - Production dependencies only
  - Multi-stage build for smaller image
- **Use when**: Final production deployment

### Dockerfile (Legacy)
- Original production Dockerfile
- Kept for backward compatibility
- Consider using Dockerfile.prod instead

## Docker Compose Files

### docker-compose.yml (Default - Development)
- Uses `Dockerfile.dev`
- Unminified build with source maps
- Good for staging and debugging
- Command: `docker-compose up -d --build`

### docker-compose.prod.yml (Production)
- Uses `Dockerfile.prod`
- Minified and optimized
- Smallest image size
- Command: `docker-compose -f docker-compose.prod.yml up -d --build`

### docker-compose.dev.yml (Live Development)
- Mounts source code as volumes
- Hot reload enabled
- Runs `npm run dev`
- Command: `docker-compose -f docker-compose.dev.yml up`

## Quick Commands

```bash
# Development deployment (unminified, easier debugging)
docker-compose up -d --build

# Production deployment (minified, optimized)
docker-compose -f docker-compose.prod.yml up -d --build

# Live development (hot reload)
docker-compose -f docker-compose.dev.yml up

# View logs
docker-compose logs -f

# Stop and remove
docker-compose down

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Build Comparison

| Feature | Dockerfile.dev | Dockerfile.prod |
|---------|---------------|-----------------|
| Minification | No | Yes |
| Source Maps | Yes | No |
| Bundle Size | ~427 KB | ~427 KB |
| Map File | ~2 MB | None |
| Build Time | Faster | Slower |
| Debug Friendly | ✅ | ❌ |
| Production Ready | ⚠️ | ✅ |

## Troubleshooting

### Console errors are minified
- You're using production build
- Switch to development: `docker-compose up -d --build`
- Or rebuild client locally: `npm run build:client`

### Changes not reflecting
- Using wrong compose file
- Try live development: `docker-compose -f docker-compose.dev.yml up`
- Or rebuild: `docker-compose up -d --build`

### Image size too large
- Development builds include source maps
- Use production build: `docker-compose -f docker-compose.prod.yml up -d --build`

## Recommendations

1. **During Development**: Use `docker-compose.yml` (default) for easier debugging
2. **For Testing**: Use `docker-compose.yml` to catch issues before production
3. **For Production**: Use `docker-compose.prod.yml` for optimal performance
4. **For Active Development**: Use `docker-compose.dev.yml` for hot reload

## Environment Variables

All configurations support the same environment variables:
- `NODE_ENV`: Set automatically by compose file
- `PORT`: API port (default: 3001)
- `CORS_ORIGIN`: Frontend origin
- `DATABASE_PATH`: SQLite database location
- `SECURECAFE_URL`: Scraping target URL
- `DEFAULT_WINGS`: Building wings to track (e.g., D,E)

See `.env.example` for full list.
