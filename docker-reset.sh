# Stop and remove containers
docker compose down

# Remove the image to force a complete rebuild
docker rmi onnislu-app -f

# Optional: Clean up all unused Docker resources
docker system prune -f

# Then rebuild from scratch
docker compose up -d --build
