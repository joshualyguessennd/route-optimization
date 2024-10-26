// src/services/RouteOptimizer.ts

import { formatUnits, parseUnits } from 'ethers';
import { 
  TokenBalance, 
  RouteOptimization, 
  OptimizedRoute,
  RouteStep,
  FeeEstimate 
} from '../types';
import { BungeeService } from './BungeeService';
import { BalanceService } from './BalanceService';
import { CacheService } from './CacheService';

export class RouteOptimizer {
  private readonly MAX_SPLITS = 3; // Maximum number of chains to source from
  private readonly MAX_ROUTES = 3; // Maximum number of alternative routes to return
  private readonly USDC_DECIMALS = 6; // USDC has 6 decimals

  constructor(
    private bungeeService: BungeeService,
    private balanceService: BalanceService,
    private cacheService: CacheService
  ) {}

  /**
   * Find optimal routes to source tokens
   */
  async findOptimalRoutes(
    targetChain: string,
    requiredAmount: string,
    tokenAddress: string,
    userAddress: string
  ): Promise<RouteOptimization> {
    // Try cache first
    const cacheKey = `route:${targetChain}:${requiredAmount}:${userAddress}`;
    const cachedRoute = await this.cacheService.get<RouteOptimization>(cacheKey);
    if (cachedRoute) {
      return cachedRoute;
    }

    // Get user's balances across chains
    const balances = await this.balanceService.getAllBalances(userAddress);
    
    // Check if target chain has enough balance
    const targetBalance = balances.balances.find(b => 
      b.chainId === parseInt(targetChain)
    );
    
    const targetAmountFormatted = parseFloat(formatUnits(requiredAmount, this.USDC_DECIMALS));
    const currentBalanceFormatted = targetBalance ? 
      parseFloat(targetBalance.formatted) : 
      0;

    // If target chain has enough balance, no bridging needed
    if (currentBalanceFormatted >= targetAmountFormatted) {
      return {
        success: true,
        routes: [],
        targetChain,
        requestedAmount: requiredAmount,
        timestamp: Date.now()
      };
    }

    // Calculate how much more we need
    const remainingAmount = (targetAmountFormatted - currentBalanceFormatted).toString();
    
    // Get all possible routes
    const routes = await this.calculateAllRoutes(
      targetChain,
      remainingAmount,
      balances.balances,
      tokenAddress,
      userAddress
    );

    const result: RouteOptimization = {
      success: true,
      routes: routes.slice(0, this.MAX_ROUTES), // Return top routes only
      targetChain,
      requestedAmount: requiredAmount,
      timestamp: Date.now()
    };

    // Cache the result
    await this.cacheService.set(cacheKey, result);

    return result;
  }

  /**
   * Calculate all possible routes to source the tokens
   */
  private async calculateAllRoutes(
    targetChain: string,
    requiredAmount: string,
    balances: TokenBalance[],
    tokenAddress: string,
    userAddress: string
  ): Promise<OptimizedRoute[]> {
    const routes: OptimizedRoute[] = [];
    const sourceBalances = balances.filter(b => {
      if (b.chainId === parseInt(targetChain)) return false;
      const balance = parseFloat(b.formatted);
      return balance > 0;
    });

    // Try single-chain routes first
    await this.addSingleChainRoutes(
      routes,
      sourceBalances,
      targetChain,
      requiredAmount,
      tokenAddress,
      userAddress
    );

    // Try multi-chain routes if needed
    if (routes.length < this.MAX_ROUTES) {
      await this.addMultiChainRoutes(
        routes,
        sourceBalances,
        targetChain,
        requiredAmount,
        tokenAddress,
        userAddress
      );
    }

    // Sort routes by total cost (fee + time factor)
    return this.sortRoutes(routes);
  }

  /**
   * Add single-chain bridging routes
   */
  private async addSingleChainRoutes(
    routes: OptimizedRoute[],
    sourceBalances: TokenBalance[],
    targetChain: string,
    requiredAmount: string,
    tokenAddress: string,
    userAddress: string
  ): Promise<void> {
    const requiredAmountNum = parseFloat(requiredAmount);

    for (const balance of sourceBalances) {
      const balanceNum = parseFloat(balance.formatted);
      
      if (balanceNum >= requiredAmountNum) {
        try {
          // Convert to USDC decimals for the API
          const amountInWei = parseUnits(requiredAmount, this.USDC_DECIMALS).toString();
          
          const quote = await this.bungeeService.getQuote({
            fromChainId: balance.chainId,
            toChainId: parseInt(targetChain),
            fromTokenAddress: tokenAddress,
            toTokenAddress: tokenAddress,
            fromAmount: amountInWei,
            userAddress
          });

          if (quote.success && quote.result.routes.length > 0) {
            const bestRoute = quote.result.routes[0];
            
            routes.push({
              steps: [{
                fromChain: balance.chainName,
                toChain: targetChain,
                amount: requiredAmount,
                fee: formatUnits(bestRoute.totalGasFeesInUsd, this.USDC_DECIMALS),
                estimatedTime: bestRoute.estimatedTimeInSeconds,
                protocol: bestRoute.userTxs[0]?.steps?.[0]?.protocol || 'unknown'
              }],
              totalFee: formatUnits(bestRoute.totalGasFeesInUsd, this.USDC_DECIMALS),
              totalTime: bestRoute.estimatedTimeInSeconds,
              totalAmount: requiredAmount,
              sourceChains: [balance.chainName]
            });
          }
        } catch (error) {
          console.error(`Error getting quote for ${balance.chainName}:`, error);
        }
      }
    }
  }

  /**
   * Add multi-chain bridging routes
   */
  private async addMultiChainRoutes(
    routes: OptimizedRoute[],
    sourceBalances: TokenBalance[],
    targetChain: string,
    requiredAmount: string,
    tokenAddress: string,
    userAddress: string
  ): Promise<void> {
    const requiredAmountNum = parseFloat(requiredAmount);

    // Try combinations of chains
    for (let i = 2; i <= this.MAX_SPLITS; i++) {
      const combinations = this.getCombinations(sourceBalances, i);
      
      for (const combo of combinations) {
        // Check if combination has enough total balance
        const totalBalance = combo.reduce(
          (sum, b) => sum + parseFloat(b.formatted),
          0
        );

        if (totalBalance >= requiredAmountNum) {
          const route = await this.calculateMultiChainRoute(
            combo,
            targetChain,
            requiredAmount,
            tokenAddress,
            userAddress
          );

          if (route) {
            routes.push(route);
          }
        }
      }
    }
  }

  /**
   * Calculate route using multiple source chains
   */
  private async calculateMultiChainRoute(
    sourceBalances: TokenBalance[],
    targetChain: string,
    requiredAmount: string,
    tokenAddress: string,
    userAddress: string
  ): Promise<OptimizedRoute | null> {
    try {
      const requiredAmountNum = parseFloat(requiredAmount);
      const steps: RouteStep[] = [];
      let remainingAmount = requiredAmountNum;
      let totalFee = 0;
      let maxTime = 0;

      // Distribute amount across chains
      for (const balance of sourceBalances) {
        if (remainingAmount <= 0) break;

        const balanceNum = parseFloat(balance.formatted);
        const amountFromChain = Math.min(balanceNum, remainingAmount);
        const amountInWei = parseUnits(amountFromChain.toString(), this.USDC_DECIMALS).toString();

        const quote = await this.bungeeService.getQuote({
          fromChainId: balance.chainId,
          toChainId: parseInt(targetChain),
          fromTokenAddress: tokenAddress,
          toTokenAddress: tokenAddress,
          fromAmount: amountInWei,
          userAddress
        });

        if (quote.success && quote.result.routes.length > 0) {
          const bestRoute = quote.result.routes[0];
          const feeFormatted = parseFloat(formatUnits(bestRoute.totalGasFeesInUsd, this.USDC_DECIMALS));
          
          steps.push({
            fromChain: balance.chainName,
            toChain: targetChain,
            amount: amountFromChain.toString(),
            fee: feeFormatted.toString(),
            estimatedTime: bestRoute.estimatedTimeInSeconds,
            protocol: bestRoute.userTxs[0]?.steps?.[0]?.protocol || 'unknown'
          });

          totalFee += feeFormatted;
          maxTime = Math.max(maxTime, bestRoute.estimatedTimeInSeconds);
          remainingAmount -= amountFromChain;
        }
      }

      if (remainingAmount > 0) {
        return null; // Couldn't source full amount
      }

      return {
        steps,
        totalFee: totalFee.toString(),
        totalTime: maxTime,
        totalAmount: requiredAmount,
        sourceChains: sourceBalances.map(b => b.chainName)
      };
    } catch (error) {
      console.error('Error calculating multi-chain route:', error);
      return null;
    }
  }

  /**
   * Sort routes by efficiency (considering fees and time)
   */
  private sortRoutes(routes: OptimizedRoute[]): OptimizedRoute[] {
    return routes.sort((a, b) => {
      const aScore = this.calculateRouteScore(a);
      const bScore = this.calculateRouteScore(b);
      return aScore - bScore;
    });
  }

  /**
   * Calculate efficiency score for a route
   */
  private calculateRouteScore(route: OptimizedRoute): number {
    const feeWeight = 0.7;  // 70% weight to fees
    const timeWeight = 0.3;  // 30% weight to time

    const feeScore = parseFloat(route.totalFee);
    const timeScore = route.totalTime / 60; // Convert to minutes

    return (feeScore * feeWeight) + (timeScore * timeWeight);
  }

  /**
   * Get combinations of n items from an array
   */
  private getCombinations<T>(arr: T[], n: number): T[][] {
    if (n === 1) return arr.map(v => [v]);
    
    const combinations: T[][] = [];
    
    for (let i = 0; i <= arr.length - n; i++) {
      const head = arr[i];
      const subcombinations = this.getCombinations(
        arr.slice(i + 1),
        n - 1
      );
      
      subcombinations.forEach(subcomb => {
        combinations.push([head, ...subcomb]);
      });
    }
    
    return combinations;
  }
}