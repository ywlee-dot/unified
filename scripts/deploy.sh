#!/bin/bash
# 수동 배포 스크립트 (서버에서 직접 실행할 때 사용)
set -e

cd ~/unified

echo ">>> Pulling latest code..."
git pull origin production

echo ">>> Building and deploying..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans

echo ">>> Cleaning up old images..."
docker image prune -f

echo ">>> Checking service status..."
docker compose ps

echo ">>> Deploy complete!"
