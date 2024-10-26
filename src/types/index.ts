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