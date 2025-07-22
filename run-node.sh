#!/bin/bash

# HyperLiquid Node Runner Script
# Usage: ./run-node.sh [mainnet|testnet] [start|stop|logs|restart] [prune_hours]

set -e

# Default values
CHAIN=${1:-mainnet}
ACTION=${2:-start}
PRUNE_HOURS=${3:-48}

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
echo "Prune Hours: $PRUNE_HOURS"
echo ""

case $ACTION in
    start)
        echo "Starting $CHAIN node..."
        CHAIN=$DOCKER_CHAIN PRUNE_HOURS=$PRUNE_HOURS docker compose up -d
        echo "Node started! Use './run-node.sh $CHAIN logs' to view logs"
        ;;
    stop)
        echo "Stopping $CHAIN node..."
        CHAIN=$DOCKER_CHAIN docker compose down
        echo "Node stopped!"
        ;;
    restart)
        echo "Restarting $CHAIN node..."
        CHAIN=$DOCKER_CHAIN docker compose down
        CHAIN=$DOCKER_CHAIN PRUNE_HOURS=$PRUNE_HOURS docker compose up -d
        echo "Node restarted!"
        ;;
    logs)
        echo "Showing logs for $CHAIN node..."
        CHAIN=$DOCKER_CHAIN docker compose logs -f node
        ;;
    pruner-logs)
        echo "Showing pruner logs for $CHAIN..."
        CHAIN=$DOCKER_CHAIN docker compose logs -f pruner
        ;;
    test-rpc)
        echo "Testing RPC connectivity for $CHAIN..."
        echo "Testing local RPC (from host):"
        curl -s -X POST -H "Content-Type: application/json" \
            -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
            http://localhost:3001/evm | jq . 2>/dev/null || echo "Failed to connect to local RPC"
        echo ""
        echo "Testing external RPC:"
        curl -s -X POST -H "Content-Type: application/json" \
            -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
            https://rpc.hyperliquid.xyz | jq . 2>/dev/null || echo "Failed to connect to external RPC"
        ;;
    monitor-logs)
        echo "Showing monitor logs for $CHAIN..."
        echo "Note: Use 'docker compose logs -f monitor' directly for real-time logs"
        CHAIN=$DOCKER_CHAIN docker compose logs monitor
        ;;
    monitor-logs-follow)
        echo "Showing real-time monitor logs for $CHAIN..."
        CHAIN=$DOCKER_CHAIN docker compose logs -f monitor
        ;;
    status)
        echo "Status of $CHAIN node:"
        CHAIN=$DOCKER_CHAIN docker compose ps
        ;;
    rebuild)
        echo "Rebuilding and starting $CHAIN node..."
        CHAIN=$DOCKER_CHAIN docker compose down
        CHAIN=$DOCKER_CHAIN PRUNE_HOURS=$PRUNE_HOURS docker compose up -d --build
        echo "Node rebuilt and started!"
        ;;
    monitor)
        echo "Opening monitoring dashboard..."
        echo "🌐 Monitor URL: http://localhost:8080"
        echo "📊 Health check: http://localhost:8080/health"
        echo "Press Ctrl+C to stop monitoring"
        ;;
    config)
        echo "Current configuration:"
        echo "  Chain: $DOCKER_CHAIN"
        echo "  Prune Hours: $PRUNE_HOURS"
        echo "  Environment variables:"
        echo "    CHAIN=$DOCKER_CHAIN"
        echo "    PRUNE_HOURS=$PRUNE_HOURS"
        ;;
    *)
        echo "Error: Unknown action '$ACTION'"
        echo "Available actions: start, stop, restart, logs, pruner-logs, monitor-logs, monitor-logs-follow, status, rebuild, monitor, config, test-rpc"
        echo "Usage: $0 [mainnet|testnet] [start|stop|logs|restart|monitor|config|test-rpc]"
        exit 1
        ;;
esac 