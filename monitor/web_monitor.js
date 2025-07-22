const express = require('express');
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 8080;

// Configuration
const LOCAL_RPC_URL = process.env.LOCAL_RPC_URL || 'http://node:3001/evm';
const EXTERNAL_RPC_URL =
  process.env.EXTERNAL_RPC_URL || 'https://rpc.hyperliquid.xyz';
const NODE_CONTAINER_NAME = process.env.NODE_CONTAINER_NAME || 'hl-node-node-1';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to execute shell commands
async function executeCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
    return { success: true, output: stdout, error: stderr };
  } catch (error) {
    return { success: false, output: null, error: error.message };
  }
}

// Get container health status
async function getContainerStatus() {
  try {
    const result = await executeCommand(
      `docker inspect --format='{{.State.Status}}' ${NODE_CONTAINER_NAME}`
    );
    if (result.success) {
      const status = result.output.trim().replace(/'/g, '');
      return {
        status: status,
        running: status === 'running',
      };
    }
    return { status: 'not_found', running: false };
  } catch (error) {
    return { status: 'error', running: false, error: error.message };
  }
}

// Get latest block number from RPC
async function getBlockNumber(rpcUrl, rpcName) {
  try {
    const response = await axios.post(
      rpcUrl,
      {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );

    if (response.data && response.data.result) {
      const blockHex = response.data.result;
      const blockDecimal = parseInt(blockHex, 16);
      return {
        success: true,
        block: blockDecimal,
        hex: blockHex,
      };
    }

    return { success: false, error: `Failed to get block from ${rpcName}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get disk usage information
async function getDiskUsage() {
  try {
    const result = await executeCommand(
      `docker exec ${NODE_CONTAINER_NAME} df -h /home/hluser/hl`
    );
    if (result.success) {
      const lines = result.output.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        if (parts.length >= 5) {
          return {
            success: true,
            total: parts[1],
            used: parts[2],
            available: parts[3],
            usage_percent: parts[4].replace('%', ''),
          };
        }
      }
    }
    return { success: false, error: 'Could not get disk usage' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get recent container logs
async function getRecentLogs() {
  try {
    const result = await executeCommand(
      `docker logs --tail 20 ${NODE_CONTAINER_NAME}`
    );
    if (result.success) {
      return {
        success: true,
        logs: result.output.trim().split('\n'),
      };
    }
    return { success: false, error: 'Could not get logs' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api/status', async (req, res) => {
  try {
    const containerStatus = await getContainerStatus();
    const localBlock = await getBlockNumber(LOCAL_RPC_URL, 'Local RPC');
    const externalBlock = await getBlockNumber(
      EXTERNAL_RPC_URL,
      'External RPC'
    );
    const diskUsage = await getDiskUsage();

    // Calculate block difference
    let blockDifference = null;
    if (localBlock.success && externalBlock.success) {
      blockDifference = externalBlock.block - localBlock.block;
    }

    res.json({
      timestamp: new Date().toISOString(),
      container: containerStatus,
      blocks: {
        local: localBlock,
        external: externalBlock,
        difference: blockDifference,
      },
      disk: diskUsage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const logs = await getRecentLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HyperLiquid Node Monitor running on port ${PORT}`);
  console.log(`📡 Local RPC: ${LOCAL_RPC_URL}`);
  console.log(`🌐 External RPC: ${EXTERNAL_RPC_URL}`);
  console.log(`📦 Container: ${NODE_CONTAINER_NAME}`);
});
