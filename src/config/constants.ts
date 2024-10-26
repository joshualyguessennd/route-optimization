// src/config/constants.ts

import { ChainConfig } from '../types';

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    contracts: {
      usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'  // Polygon USDC
    }
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    contracts: {
      usdc: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'  // Arbitrum USDC
    }
  },
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    contracts: {
      usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'  // Base USDC
    }
  },
  gnosis: {
    chainId: 100,
    name: 'Gnosis',
    rpcUrl: process.env.GNOSIS_RPC_URL || 'https://rpc.gnosischain.com',
    contracts: {
      usdc: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83'  // Gnosis USDC
    }
  }
};

// ABI for ERC20 token (minimal for balance checking)
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];