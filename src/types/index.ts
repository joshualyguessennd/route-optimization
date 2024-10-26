// src/types/index.ts

/**
 * Input parameters for the route finding API
 */
export interface RouteRequest {
    targetChain: string;    // The chain the funds will be sourced into
    amount: number;         // The funds needed on the targetChain
    tokenAddress: string;   // The token required (USDC in our case)
    userAddress: string;    // Address to fetch balances for
  }
  
  /**
   * Response structure for the route finding API
   */
  export interface RouteResponse {
    status: 'success' | 'error';
    data?: {
      routes: BridgeQuote[];
      timestamp: number;
    };
    error?: string;
  }
  
  /**
   * Structure representing a quote from Bungee/Socket API
   * Based on the /quote endpoint response
   */
  export interface BridgeQuote {
    route: {
      userTxs: UserTransaction[];
      toAmount: string;
      fromAmount: string;
      totalGasFeesInUsd: string;
      estimatedTimeInSeconds?: number;
    };
  }
  
  /**
   * Structure for user transactions within a route
   * Based on Bungee documentation
   */
  export interface UserTransaction {
    userTxType: 'fund-movr' | 'approve' | 'claim' | 'dex-swap' | 'sign';
    steps?: Array<{
      type: string;
      protocol: string;
      fromChain: string;
      toChain: string;
      fromToken: string;
      toToken: string;
      fromAmount: string;
      toAmount: string;
      gasFees: string;
    }>;
    approvalData?: {
      minimumApprovalAmount: string;
      spender: string;
      token: string;
    } | null;
  }

  export interface QuoteRequest {
    fromChainId: number;
    toChainId: number;
    fromTokenAddress: string;
    toTokenAddress: string;
    fromAmount: string;
    userAddress: string;
    singleTxOnly?: boolean;
  }

  export interface SupportedChain {
    chainId: number;
    name: string;
    icon: string;
    currency: string;
  }

  export interface TokenInfo {
    address: string;
    symbol: string;
    decimals: number;
    chainId: number;
    name: string;
    icon: string;
  }

  export interface QuoteResponse {
    success: boolean;
    result: {
      routes: Array<{
        userTxs: UserTransaction[];
        toAmount: string;
        fromAmount: string;
        totalGasFeesInUsd: string;
        estimatedTimeInSeconds: number;
      }>;
    };
  }

  export class BungeeApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public code?: string
    ) {
      super(message);
      this.name = 'BungeeApiError';
    }
  }

  export interface ChainConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    contracts: {
      usdc: string;
    };
  }
  
  export interface TokenBalance {
    chainId: number;
    chainName: string;
    balance: string;    
    formatted: string;
  }
  
  export interface BalanceResponse {
    success: boolean;
    balances: TokenBalance[];
    timestamp: number;
  }

  export interface RouteOptimization {
    success: boolean;
    routes: OptimizedRoute[];
    targetChain: string;
    requestedAmount: string;
    timestamp: number;
  }

  export interface RouteStep {
    fromChain: string;
    toChain: string;
    amount: string;
    fee: string;
    estimatedTime: number;
    protocol: string;
  }

  export interface OptimizedRoute {
    steps: RouteStep[];
    totalFee: string;
    totalTime: number;
    totalAmount: string;
    sourceChains: string[];  // Chains we're sourcing from
  }

  export interface FeeEstimate {
    fee: string;
    estimatedTime: number;
    protocol: string;
  }
  
  export interface ChainPair {
    fromChain: string;
    toChain: string;
  }


  