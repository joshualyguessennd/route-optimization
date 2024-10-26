// src/config/constants.ts

export const CHAIN_IDS = {
  POLYGON: 137,
  ARBITRUM: 42161,
  BASE: 8453,
  GNOSIS: 100,
  BLAST: 81457
} as const;

export type ChainId = typeof CHAIN_IDS[keyof typeof CHAIN_IDS];

export const CHAIN_CONFIG = {
  [CHAIN_IDS.POLYGON]: {
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'
  },
  [CHAIN_IDS.ARBITRUM]: {
    name: 'Arbitrum',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
  },
  [CHAIN_IDS.BASE]: {
    name: 'Base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  },
  [CHAIN_IDS.GNOSIS]: {
    name: 'Gnosis',
    rpcUrl: process.env.GNOSIS_RPC_URL || 'https://rpc.xdaichain.com',
    usdc: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83'
  },
  [CHAIN_IDS.BLAST]: {
    name: 'Blast',
    rpcUrl: process.env.BLAST_RPC_URL || 'https://rpc.blast.io',
    usdc: '0x4300000000000000000000000000000000000003'
  }
} as const;

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
] as const;