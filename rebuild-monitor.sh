#!/bin/bash
# rebuild-monitor.sh
# Rebuild and restart only the monitor service

set -e

echo "Rebuilding monitor service..."
docker compose build monitor

echo "Restarting monitor service..."
docker compose up -d monitor

echo "Monitor service rebuilt and restarted!" 