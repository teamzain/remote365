#!/bin/bash
set -e

REPO_URL="https://github.com/teamzain/RemoteLink-Desktop.git"
INSTALL_DIR="$HOME/RemoteLink-Desktop"
ENVIRONMENT="${1:-}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

if [ "$ENVIRONMENT" != "prod" ] && [ "$ENVIRONMENT" != "preprod" ]; then
    echo "Usage: ./deploy.sh <prod|preprod>"
    exit 1
fi

ENV_FILE="$HOME/.env.production"
if [ "$ENVIRONMENT" = "preprod" ]; then
    ENV_FILE="$HOME/.env.preprod"
fi

echo "Starting $ENVIRONMENT deployment for RemoteLink Backend..."

if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Updating existing installation..."
    cd "$INSTALL_DIR"
    docker compose -f docker-compose.prod.yml down --remove-orphans || true
    git fetch origin "$DEPLOY_BRANCH"
    git checkout -B "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"
    git reset --hard "origin/$DEPLOY_BRANCH"
    echo "Code updated to latest $DEPLOY_BRANCH."
else
    echo "First-time setup: cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    git fetch origin "$DEPLOY_BRANCH"
    git checkout -B "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"
fi

echo "Setting up environment variables..."
if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" .env
    sed -i 's/\r//' .env
    echo "Environment variables copied from $ENV_FILE."
else
    echo "Error: $ENV_FILE not found. Create it first."
    exit 1
fi

echo "Checking dependencies..."
for cmd in docker git curl; do
    if ! command -v "$cmd" &> /dev/null; then
        if [ "$cmd" = "docker" ]; then
            echo "Installing Docker..."
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
            rm get-docker.sh
        else
            echo "Error: $cmd is not installed."
            exit 1
        fi
    fi
done

echo "Building and launching services..."
docker compose -f docker-compose.prod.yml up -d --build --pull always --remove-orphans

echo "Running database migrations and seeding..."
docker compose -f docker-compose.prod.yml exec -T auth-service npx prisma db push --schema=./packages/shared/prisma/schema.prisma --accept-data-loss
docker compose -f docker-compose.prod.yml exec -T auth-service npm run seed -w @remotelink/shared
echo "Database schema and seed data updated."

echo "Setting up desktop download directories..."
sudo mkdir -p /var/www/downloads/desktop
sudo chown -R "$USER:$USER" /var/www/downloads
sudo chmod -R 755 /var/www/downloads
echo "Download directory ready at /var/www/downloads/desktop"

echo "Cleaning up unused Docker resources..."
docker image prune -f
docker builder prune -f --filter "until=24h"

echo "Deployment complete."
echo "------------------------------------------------"
echo "Services status:"
docker compose -f docker-compose.prod.yml ps
echo "------------------------------------------------"
echo "Health check:"
curl -s http://localhost/health || echo "Wait a few seconds for services to start..."
