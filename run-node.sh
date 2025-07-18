#!/bin/bash

# HyperLiquid Node Runner Script
# Usage: ./run-node.sh [mainnet|testnet] [start|stop|logs|restart]

set -e

# Default values
CHAIN=${1:-mainnet}
ACTION=${2:-start}

# Validate inputs
if [[ "$CHAIN" != "mainnet" && "$CHAIN" != "testnet" ]]; then
    echo "Error: Chain must be 'mainnet' or 'testnet'"
    echo "Usage: $0 [mainnet|testnet] [start|stop|logs|restart]"
    exit 1
fi

# Convert to proper case for Docker
if [[ "$CHAIN" == "mainnet" ]]; then
    DOCKER_CHAIN="Mainnet"
else
    DOCKER_CHAIN="Testnet"
fi

echo "HyperLiquid Node Runner"
echo "Chain: $CHAIN ($DOCKER_CHAIN)"
echo "Action: $ACTION"
echo ""

case $ACTION in
    start)
        echo "Starting $CHAIN node..."
        CHAIN=$DOCKER_CHAIN docker-compose up -d
        echo "Node started! Use './run-node.sh $CHAIN logs' to view logs"
        ;;
    stop)
        echo "Stopping $CHAIN node..."
        CHAIN=$DOCKER_CHAIN docker-compose down
        echo "Node stopped!"
        ;;
    restart)
        echo "Restarting $CHAIN node..."
        CHAIN=$DOCKER_CHAIN docker-compose down
        CHAIN=$DOCKER_CHAIN docker-compose up -d
        echo "Node restarted!"
        ;;
    logs)
        echo "Showing logs for $CHAIN node..."
        CHAIN=$DOCKER_CHAIN docker-compose logs -f node
        ;;
    status)
        echo "Status of $CHAIN node:"
        CHAIN=$DOCKER_CHAIN docker-compose ps
        ;;
    rebuild)
        echo "Rebuilding and starting $CHAIN node..."
        CHAIN=$DOCKER_CHAIN docker-compose down
        CHAIN=$DOCKER_CHAIN docker-compose up -d --build
        echo "Node rebuilt and started!"
        ;;
    *)
        echo "Error: Unknown action '$ACTION'"
        echo "Available actions: start, stop, restart, logs, status, rebuild"
        echo "Usage: $0 [mainnet|testnet] [start|stop|logs|restart]"
        exit 1
        ;;
esac 