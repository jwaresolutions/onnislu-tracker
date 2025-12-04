# Deployment Fix Summary

## Issues Found

1. **CSP blocking inline scripts** - Helmet's default CSP was too strict for React app
2. **Client build path incorrect** - Server looking for client at wrong location
3. **Client build not copied to Docker image** - Missing in COPY commands

## Changes Made

### 1. `src/server/index.ts`
- Configured Helmet CSP to allow inline scripts/styles needed by React
- Fixed client build path from `../client` to `../../src/client/dist`
- Added existence checks and better error logging

### 2. `Dockerfile` and `Dockerfile.dev`
- Added `COPY --from=builder /app/src/client/dist ./src/client/dist` to copy React build

## Rebuild & Redeploy Steps

```bash
# 1. Rebuild the Docker image
docker-compose -f docker-compose.dev.yml build --no-cache

# 2. Stop and remove old container
docker-compose -f docker-compose.dev.yml down

# 3. Start new container
docker-compose -f docker-compose.dev.yml up -d

# 4. Check logs for errors
docker-compose -f docker-compose.dev.yml logs -f app

# 5. Verify database initialized
docker-compose -f docker-compose.dev.yml exec app ls -la /app/data
```

## What to Check

1. **API endpoints should return 200** - Check browser network tab
2. **No CSP errors** - Check browser console
3. **Page loads with content** - Should see apartment listings
4. **Database file exists** - `/app/data/onnislu.db` in container

## If Still Having Issues

Check these in order:

1. **Database not initialized?**
   ```bash
   docker-compose -f docker-compose.dev.yml exec app node dist/server/scripts/migrate.js
   ```

2. **Missing environment variables?**
   - Ensure `.env` file exists on server
   - Check `CORS_ORIGIN` matches your domain

3. **Build artifacts missing?**
   ```bash
   docker-compose -f docker-compose.dev.yml exec app ls -la dist/server
   docker-compose -f docker-compose.dev.yml exec app ls -la src/client/dist
   ```

4. **Check server logs for specific errors:**
   ```bash
   docker-compose -f docker-compose.dev.yml logs app | grep -i error
   ```
