// src/controllers/RouteController.ts

import { Elysia, t } from 'elysia';
import { BungeeService } from '../services/BungeeService';
import { BalanceService } from '../services/BalanceService';
import { RouteOptimizer } from '../services/RouteOptimizer';
import { CacheService } from '../services/CacheService';
import { SUPPORTED_CHAINS } from '../config/constants';

// Custom error class for validation errors
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RouteController {
  private bungeeService: BungeeService;
  private balanceService: BalanceService;
  private routeOptimizer: RouteOptimizer;
  private cacheService: CacheService;

  constructor() {
    this.cacheService = new CacheService();
    this.bungeeService = new BungeeService();
    this.balanceService = new BalanceService(this.cacheService);
    this.routeOptimizer = new RouteOptimizer(
      this.bungeeService,
      this.balanceService,
      this.cacheService
    );
  }

  /**
   * Setup routes for the Elysia app
   */
  setup(app: Elysia): Elysia {
    return app
      .onError(({ code, error, set }) => {
        console.error(`Error in route controller: ${error.message}`);
        
        switch (code) {
          case 'VALIDATION':
            set.status = 400;
            return {
              status: 'error',
              error: 'Invalid request parameters',
              details: error.message
            };
          
          case 'NOT_FOUND':
            set.status = 404;
            return {
              status: 'error',
              error: 'Resource not found'
            };
          
          default:
            set.status = error instanceof ValidationError ? 400 : 500;
            return {
              status: 'error',
              error: error instanceof ValidationError ? 
                error.message : 
                'Internal server error'
            };
        }
      })
      .get('/health', () => ({
        status: 'success',
        timestamp: Date.now()
      }))
      .post(
        '/api/route',
        async ({ body }) => this.findRoutes(body),
        {
          body: t.Object({
            targetChain: t.String(),
            amount: t.String(), // Amount in decimal format
            tokenAddress: t.String(),
            userAddress: t.String()
          }),
          response: t.Object({
            status: t.String(),
            data: t.Optional(t.Object({
              routes: t.Array(t.Object({
                steps: t.Array(t.Object({
                  fromChain: t.String(),
                  toChain: t.String(),
                  amount: t.String(),
                  fee: t.String(),
                  estimatedTime: t.Number(),
                  protocol: t.String()
                })),
                totalFee: t.String(),
                totalTime: t.Number(),
                totalAmount: t.String(),
                sourceChains: t.Array(t.String())
              })),
              timestamp: t.Number()
            })),
            error: t.Optional(t.String())
          })
        }
      );
  }

  /**
   * Main route finding logic
   */
  private async findRoutes(params: {
    targetChain: string;
    amount: string;
    tokenAddress: string;
    userAddress: string;
  }) {
    try {
      // Validate parameters
      await this.validateRequest(params);

      // Check if target chain is supported
      const supportedChains = await this.bungeeService.getSupportedChains();
      const targetChainId = parseInt(params.targetChain);
      
      if (!supportedChains.some(chain => chain.chainId === targetChainId)) {
        throw new ValidationError(`Unsupported target chain: ${params.targetChain}`);
      }

      // Check if token is supported on target chain
      const supportedTokens = await this.bungeeService.getToTokenList(targetChainId);
      
      if (!supportedTokens.some(token => 
        token.address.toLowerCase() === params.tokenAddress.toLowerCase()
      )) {
        throw new ValidationError(
          `Token ${params.tokenAddress} not supported on chain ${params.targetChain}`
        );
      }

      // Get optimal routes
      const routes = await this.routeOptimizer.findOptimalRoutes(
        params.targetChain,
        params.amount,
        params.tokenAddress,
        params.userAddress
      );

      return {
        status: 'success',
        data: routes
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      console.error('Error processing route request:', error);
      
      throw new Error(
        error instanceof Error ? 
          error.message : 
          'Error processing request'
      );
    }
  }

  /**
   * Validate request parameters
   */
  private async validateRequest(params: {
    targetChain: string;
    amount: string;
    tokenAddress: string;
    userAddress: string;
  }) {
    // Validate chain ID format
    if (!/^\d+$/.test(params.targetChain)) {
      throw new ValidationError('Invalid chain ID format');
    }

    // Validate amount format and value
    try {
      const amount = parseFloat(params.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new ValidationError('Invalid amount');
      }
    } catch {
      throw new ValidationError('Invalid amount format');
    }

    // Validate addresses
    if (!/^0x[a-fA-F0-9]{40}$/.test(params.tokenAddress)) {
      throw new ValidationError('Invalid token address format');
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(params.userAddress)) {
      throw new ValidationError('Invalid user address format');
    }

    // Check if user has any balance
    const balances = await this.balanceService.getAllBalances(params.userAddress);
    if (!balances.balances.length) {
      throw new ValidationError('No token balances found for user');
    }

    // Validate total available balance
    const totalBalance = balances.balances.reduce(
      (sum, b) => sum + parseFloat(b.formatted),
      0
    );
    
    const requestedAmount = parseFloat(params.amount);
    if (totalBalance < requestedAmount) {
      throw new ValidationError(
        `Insufficient total balance. Available: ${totalBalance}, Requested: ${requestedAmount}`
      );
    }
  }
}