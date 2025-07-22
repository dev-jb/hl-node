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
const ARCHIVE_LOCAL_RPC_URL =
  process.env.ARCHIVE_LOCAL_RPC_URL || 'http://archive-node-1:8545';

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
    console.log(`🔍 Checking container status for: ${NODE_CONTAINER_NAME}`);

    // First, let's list all containers to see what's available
    const listResult = await executeCommand(
      'docker ps -a --format "table {{.Names}}\t{{.Status}}"'
    );
    console.log('📋 Available containers:', listResult);

    // Try to find the container by name in the list
    if (listResult.success && listResult.output) {
      const lines = listResult.output.trim().split('\n');
      console.log('📋 Container list lines:', lines);

      const containerLine = lines.find((line) =>
        line.includes(NODE_CONTAINER_NAME)
      );
      if (containerLine) {
        console.log(`✅ Found container in list: ${containerLine}`);
        const parts = containerLine.split(/\s+/);
        const status = parts[1] || 'unknown';
        const isRunning = status.includes('Up');
        console.log(
          `✅ Container status from list: ${status}, running: ${isRunning}`
        );
        return {
          status: status,
          running: isRunning,
        };
      }
    }

    // Fallback to docker inspect
    const result = await executeCommand(
      `docker inspect --format='{{.State.Status}}' ${NODE_CONTAINER_NAME}`
    );
    console.log(`📦 Container inspect result:`, result);

    if (result.success) {
      const status = result.output.trim().replace(/'/g, '');
      console.log(`✅ Container status: ${status}`);
      return {
        status: status,
        running: status === 'running',
      };
    }
    console.log(`❌ Container not found or inspect failed`);
    return { status: 'not_found', running: false };
  } catch (error) {
    console.log(`💥 Container status error:`, error);
    return { status: 'error', running: false, error: error.message };
  }
}

// Get latest block number from RPC
async function getBlockNumber(rpcUrl, rpcName) {
  try {
    console.log(`🔗 Attempting to get block from ${rpcName}: ${rpcUrl}`);

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

    console.log(`📡 ${rpcName} response:`, response.data);

    if (response.data && response.data.result) {
      const blockHex = response.data.result;
      const blockDecimal = parseInt(blockHex, 16);
      console.log(`✅ ${rpcName} block: ${blockDecimal} (${blockHex})`);
      return {
        success: true,
        block: blockDecimal,
        hex: blockHex,
      };
    }

    console.log(`❌ ${rpcName} failed: No result in response`);
    return { success: false, error: `Failed to get block from ${rpcName}` };
  } catch (error) {
    console.log(`💥 ${rpcName} error:`, error.message);
    return { success: false, error: error.message };
  }
}

// Get disk usage information
async function getDiskUsage() {
  try {
    console.log(
      `💾 Attempting to get disk usage for container: ${NODE_CONTAINER_NAME}`
    );

    const result = await executeCommand(
      `docker exec ${NODE_CONTAINER_NAME} df -h /home/hluser/hl`
    );
    console.log(`💾 Disk usage result:`, result);

    if (result.success) {
      const lines = result.output.trim().split('\n');
      console.log(`💾 Disk usage lines:`, lines);

      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        console.log(`💾 Disk usage parts:`, parts);

        if (parts.length >= 5) {
          const diskInfo = {
            success: true,
            total: parts[1],
            used: parts[2],
            available: parts[3],
            usage_percent: parts[4].replace('%', ''),
          };
          console.log(`✅ Disk usage:`, diskInfo);
          return diskInfo;
        }
      }
    }
    console.log(`❌ Could not get disk usage`);
    return { success: false, error: 'Could not get disk usage' };
  } catch (error) {
    console.log(`💥 Disk usage error:`, error);
    return { success: false, error: error.message };
  }
}

// Get recent container logs
async function getRecentLogs() {
  try {
    console.log(
      `📋 Attempting to get logs for container: ${NODE_CONTAINER_NAME}`
    );

    const result = await executeCommand(
      `docker logs --tail 20 ${NODE_CONTAINER_NAME}`
    );
    console.log(`📋 Logs result:`, result);

    if (result.success) {
      const logs = result.output.trim().split('\n');
      console.log(`✅ Got ${logs.length} log lines`);
      return {
        success: true,
        logs: logs,
      };
    }
    console.log(`❌ Could not get logs`);
    return { success: false, error: 'Could not get logs' };
  } catch (error) {
    console.log(`💥 Logs error:`, error);
    return { success: false, error: error.message };
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api/status', async (req, res) => {
  try {
    console.log('🔄 API Status request received');

    const containerStatus = await getContainerStatus();
    console.log('📦 Container status completed');

    const localBlock = await getBlockNumber(LOCAL_RPC_URL, 'Local RPC');
    console.log('🔗 Local block check completed');

    const externalBlock = await getBlockNumber(
      EXTERNAL_RPC_URL,
      'External RPC'
    );
    console.log('🌐 External block check completed');

    const archiveLocalBlock = await getBlockNumber(
      ARCHIVE_LOCAL_RPC_URL,
      'Archive Local'
    );
    console.log('🗄️ Archive Local block check completed');

    const diskUsage = await getDiskUsage();
    console.log('💾 Disk usage check completed');

    // Calculate block differences
    let blockDifference = null;
    if (localBlock.success && externalBlock.success) {
      blockDifference = externalBlock.block - localBlock.block;
      console.log(`📊 Block difference calculated: ${blockDifference}`);
    }
    let archiveDifference = null;
    if (localBlock.success && archiveLocalBlock.success) {
      archiveDifference = archiveLocalBlock.block - localBlock.block;
      console.log(
        `📊 Archive block difference calculated: ${archiveDifference}`
      );
    }

    const response = {
      timestamp: new Date().toISOString(),
      container: containerStatus,
      blocks: {
        local: localBlock,
        external: externalBlock,
        difference: blockDifference,
        archiveLocal: archiveLocalBlock,
        archiveDifference: archiveDifference,
      },
      disk: diskUsage,
    };

    console.log('✅ API Status response prepared');
    res.json(response);
  } catch (error) {
    console.log('💥 API Status error:', error);
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

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    environment: {
      LOCAL_RPC_URL,
      EXTERNAL_RPC_URL,
      ARCHIVE_LOCAL_RPC_URL,
      NODE_CONTAINER_NAME,
      PORT: process.env.PORT || 8080,
    },
    configuration: {
      localRpcUrl: LOCAL_RPC_URL,
      externalRpcUrl: EXTERNAL_RPC_URL,
      archiveLocalRpcUrl: ARCHIVE_LOCAL_RPC_URL,
      nodeContainerName: NODE_CONTAINER_NAME,
    },
  });
});

// Docker test endpoint
app.get('/docker-test', async (req, res) => {
  try {
    console.log('🔧 Docker test endpoint called');

    // Test basic Docker access
    const versionResult = await executeCommand(
      'docker version --format "{{.Server.Version}}"'
    );
    console.log('🔧 Docker version result:', versionResult);

    // Test container listing
    const psResult = await executeCommand('docker ps --format "{{.Names}}"');
    console.log('🔧 Docker ps result:', psResult);

    // Test specific container
    const inspectResult = await executeCommand(
      `docker inspect --format='{{.State.Status}}' ${NODE_CONTAINER_NAME}`
    );
    console.log('🔧 Docker inspect result:', inspectResult);

    res.json({
      timestamp: new Date().toISOString(),
      dockerVersion: versionResult,
      containerList: psResult,
      containerInspect: inspectResult,
      targetContainer: NODE_CONTAINER_NAME,
    });
  } catch (error) {
    console.log('💥 Docker test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test Docker socket access on startup
async function testDockerAccess() {
  try {
    console.log('🔧 Testing Docker socket access...');
    const testResult = await executeCommand(
      'docker version --format "{{.Server.Version}}"'
    );
    if (testResult.success) {
      console.log(`✅ Docker access OK, version: ${testResult.output.trim()}`);
    } else {
      console.log(`❌ Docker access failed: ${testResult.error}`);
    }
  } catch (error) {
    console.log(`💥 Docker test error: ${error.message}`);
  }
}

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 HyperLiquid Node Monitor running on port ${PORT}`);
  console.log(`📡 Local RPC: ${LOCAL_RPC_URL}`);
  console.log(`🌐 External RPC: ${EXTERNAL_RPC_URL}`);
  console.log(`📦 Container: ${NODE_CONTAINER_NAME}`);

  // Test Docker access on startup
  await testDockerAccess();
});
