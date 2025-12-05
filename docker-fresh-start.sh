#!/bin/bash
# Complete fresh start - removes ALL data including database

echo "WARNING: This will delete all data including the database!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

# Stop and remove containers
docker compose down

# Remove the image
docker rmi onnislu-app -f

# Remove volumes (THIS DELETES THE DATABASE)
docker volume rm onnislu_data 2>/dev/null || true

# Clean up all unused Docker resources
docker system prune -f

# Rebuild from scratch with no cache
docker compose build --no-cache

# Start the containers
docker compose up -d

echo "Fresh start complete. All data has been reset."
