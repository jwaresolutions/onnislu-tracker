# Stop and remove containers (preserves volumes/data)
docker compose down

# Remove the image to force a complete rebuild
docker rmi onnislu-app -f

# Optional: Clean up all unused Docker resources (but not volumes)
docker system prune -f

# Then rebuild from scratch with no cache
docker compose build --no-cache

# Start the containers (migrations will run automatically on startup)
docker compose up -d

echo "Rebuild complete. Database and data preserved. Migrations will run automatically."
