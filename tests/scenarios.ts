// src/tests/scenarios.ts

import axios from 'axios';
import { config } from 'dotenv';
config();

const API_BASE_URL = 'http://localhost:3001';

// Chain IDs
const CHAINS = {
  POLYGON: 137,
  ARBITRUM: 42161,
  BASE: 8453
};

// USDC addresses
const USDC_ADDRESSES = {
  [CHAINS.POLYGON]: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',  // Polygon USDC
  [CHAINS.ARBITRUM]: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', // Arbitrum USDC
  [CHAINS.BASE]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'     // Base USDC
};

// Test wallet - this is just for testing, no real funds needed
const TEST_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";

async function testScenarios() {
  try {
    // Test health endpoint
    console.log('\n🏥 Testing Health Endpoint...');
    const health = await axios.get(`${API_BASE_URL}/health`);
    console.log('Health Status:', health.data);

    // Scenario 1: Simple route needed
    // Current balances:
    // - Polygon: 50 USDC
    // - Arbitrum: 100 USDC
    // - Base: 80 USDC
    // Need: 100 USDC on Polygon (need to bridge 50 more)
    console.log('\n🔄 Testing Scenario 1: Need 50 more USDC on Polygon');
    const scenario1 = await axios.post(`${API_BASE_URL}/api/route`, {
      targetChain: CHAINS.POLYGON.toString(),
      amount: "100",      // Need 100 total, have 50, should bridge 50
      tokenAddress: USDC_ADDRESSES[CHAINS.POLYGON],
      userAddress: TEST_WALLET
    });
    console.log('Scenario 1 Result:', JSON.stringify(scenario1.data, null, 2));

    // Scenario 2: Multi-chain route might be better
    // Current balances same as above, but need more USDC
    // Should consider combining from multiple chains if fees are better
    console.log('\n🔄 Testing Scenario 2: Complex routing scenario');
    const scenario2 = await axios.post(`${API_BASE_URL}/api/route`, {
      targetChain: CHAINS.POLYGON.toString(),
      amount: "150",      // Need 150 total, have 50, should bridge 100
      tokenAddress: USDC_ADDRESSES[CHAINS.POLYGON],
      userAddress: TEST_WALLET
    });
    console.log('Scenario 2 Result:', JSON.stringify(scenario2.data, null, 2));

    // Scenario 3: Insufficient funds scenario
    console.log('\n🔄 Testing Scenario 3: Insufficient funds scenario');
    const scenario3 = await axios.post(`${API_BASE_URL}/api/route`, {
      targetChain: CHAINS.POLYGON.toString(),
      amount: "300",      // Need 300 total (should fail - not enough funds)
      tokenAddress: USDC_ADDRESSES[CHAINS.POLYGON],
      userAddress: TEST_WALLET
    });
    console.log('Scenario 3 Result:', JSON.stringify(scenario3.data, null, 2));

    // Scenario 4: No bridging needed (has enough on target chain)
    console.log('\n🔄 Testing Scenario 4: No bridging needed');
    const scenario4 = await axios.post(`${API_BASE_URL}/api/route`, {
      targetChain: CHAINS.POLYGON.toString(),
      amount: "40",       // Only need 40 (already has 50 on Polygon)
      tokenAddress: USDC_ADDRESSES[CHAINS.POLYGON],
      userAddress: TEST_WALLET
    });
    console.log('Scenario 4 Result:', JSON.stringify(scenario4.data, null, 2));

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('API Error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
    } else {
      console.error('Error:', error);
    }
  }
}

// Add color to console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m"
};

console.log(`${colors.bright}${colors.blue}🚀 Starting API Tests...${colors.reset}`);
testScenarios().then(() => {
  console.log(`${colors.bright}${colors.green}\n✅ Tests completed${colors.reset}`);
}).catch((error) => {
  console.error(`${colors.bright}${colors.red}\n❌ Tests failed:${colors.reset}`, error);
});