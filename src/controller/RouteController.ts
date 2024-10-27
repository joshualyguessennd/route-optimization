// src/controllers/RouteController.ts

import { Elysia, t } from 'elysia';
import { BungeeService } from '../services/BungeeService';
import { BalanceService } from '../services/BalanceService';
import { RouteOptimizer } from '../services/RouteOptimizer';
import { CacheService } from '../services/CacheService';

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

    // Bind methods to maintain correct 'this' context
    this.findRoutes = this.findRoutes.bind(this);
    this.setup = this.setup.bind(this);
  }

  async findRoutes(params: {
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
        throw new Error(`Unsupported target chain: ${params.targetChain}`);
      }

      // Get optimal routes
      const routes = await this.routeOptimizer.findOptimalRoutes(
        params.targetChain,
        params.amount,
        params.userAddress
      );

      return {
        status: 'success',
        data: routes
      };

    } catch (error) {
      console.error('Error processing route request:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  setup(app: Elysia): Elysia {
    return app
      .post(
        '/api/route',
        async ({ body }) => this.findRoutes(body),
        {
          body: t.Object({
            targetChain: t.String(),
            amount: t.String(),
            tokenAddress: t.String(),
            userAddress: t.String()
          })
        }
      )
      .get('/health', () => ({
        status: 'success',
        timestamp: Date.now()
      }));
  }

  private async validateRequest(params: {
    targetChain: string;
    amount: string;
    tokenAddress: string;
    userAddress: string;
  }) {
    // Validate chain ID format
    if (!/^\d+$/.test(params.targetChain)) {
      throw new Error('Invalid chain ID format');
    }

    // Validate amount format and value
    try {
      const amount = parseFloat(params.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
      }
    } catch {
      throw new Error('Invalid amount format');
    }

    // Validate addresses
    if (!/^0x[a-fA-F0-9]{40}$/.test(params.tokenAddress)) {
      throw new Error('Invalid token address format');
    }
    
    if (!/^0x[a-fA-F0-9]{40}$/.test(params.userAddress)) {
      throw new Error('Invalid user address format');
    }
  }
}