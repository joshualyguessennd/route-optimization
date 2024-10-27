// src/tests/scenarios.ts

import axios from 'axios';
import { config } from 'dotenv';
config();

const API_BASE_URL = 'http://localhost:3001';

// Chain IDs
const CHAINS = {
  POLYGON: 137,
  ARBITRUM: 42161,
  BASE: 8453,
  GNOSIS: 100,
  BLAST: 81457
};

// USDC addresses
const USDC_ADDRESSES = {
  [CHAINS.POLYGON]: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  [CHAINS.ARBITRUM]: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  [CHAINS.BASE]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  [CHAINS.GNOSIS]: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
  [CHAINS.BLAST]: '0x4300000000000000000000000000000000000003'
};

async function testScenarios() {
  try {
    // Test health endpoint
    console.log('\n🏥 Testing Health Endpoint...');
    const health = await axios.get(`${API_BASE_URL}/health`);
    console.log('Health Status:', health.data);

    // Scenario 1: Need 50 USDC (local: 50, need to bridge: 50)
    console.log('\n🔄 Testing Scenario 1: Bridge from Base to Polygon');
    console.log('Current balances:');
    console.log('- Polygon: 50 USDC (local)');
    console.log('- Arbitrum: 100 USDC (fee: 1.0 USDC)');
    console.log('- Base: 80 USDC (fee: 0.5 USDC)');
    console.log('Need: 100 USDC total (bridging 50)');

    const scenario1 = await axios.post(`${API_BASE_URL}/api/route`, {
      targetChain: CHAINS.POLYGON.toString(),
      amount: "100",  // Total amount needed
      tokenAddress: USDC_ADDRESSES[CHAINS.POLYGON],
      userAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    });
    console.log('Scenario 1 Result:', JSON.stringify(scenario1.data, null, 2));

    // Scenario 2: Complex multi-chain route
    console.log('\n🔄 Testing Scenario 2: Optimal multi-chain route');
    console.log('Current balances:');
    console.log('- Polygon: 50 USDC (local)');
    console.log('- Arbitrum: 100 USDC (fee: 1.0 USDC)');
    console.log('- Base: 80 USDC (fee: 0.5 USDC)');
    console.log('- Gnosis: 25 USDC (fee: 0.1 USDC)');
    console.log('- Blast: 30 USDC (fee: 0.2 USDC)');
    console.log('Need: 100 USDC total (bridging 50)');

    const scenario2 = await axios.post(`${API_BASE_URL}/api/route`, {
      targetChain: CHAINS.POLYGON.toString(),
      amount: "100",  // Total amount needed
      tokenAddress: USDC_ADDRESSES[CHAINS.POLYGON],
      userAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    });
    console.log('Scenario 2 Result:', JSON.stringify(scenario2.data, null, 2));

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

console.log('🚀 Starting API Tests...');
testScenarios().then(() => {
  console.log('\n✅ Tests completed');
}).catch((error) => {
  console.error('\n❌ Tests failed:', error);
});