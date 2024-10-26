// src/services/RouteOptimizer.ts

import { formatUnits, parseUnits } from 'ethers';
import { 
  TokenBalance, 
  RouteOptimization, 
  OptimizedRoute,
  RouteStep,
} from '../types';
export class RouteOptimizer {
    private readonly MAX_SPLITS = 3;
    private readonly MAX_ROUTES = 3;
    private readonly USDC_DECIMALS = 6;
  
    constructor(
      private bungeeService: any,
      private balanceService: any    ) {}
  
    async findOptimalRoutes(
      targetChain: string,
      requiredAmount: string,
      tokenAddress: string,
      userAddress: string
    ): Promise<RouteOptimization> {
      try {
        console.log('\n🔍 Starting route optimization...');
        
        // Get all balances first
        const balances = await this.balanceService.getAllBalances(userAddress);
        console.log('Available balances:', balances);
  
        const targetChainId = parseInt(targetChain);
        const requiredAmountNum = parseFloat(requiredAmount);
  
        // Find target chain balance
        const targetBalance = balances.balances.find(b => b.chainId === targetChainId);
        const targetBalanceNum = targetBalance ? parseFloat(targetBalance.formatted) : 0;
  
        console.log('Balance check:', {
          required: requiredAmountNum,
          targetChainBalance: targetBalanceNum
        });
  
        // Check if we already have enough balance
        if (targetBalanceNum >= requiredAmountNum) {
          return {
            success: true,
            routes: [],
            targetChain,
            requestedAmount: requiredAmount,
            timestamp: Date.now()
          };
        }
  
        // Calculate how much more we need
        const neededAmount = requiredAmountNum - targetBalanceNum;
        console.log('Need to source:', neededAmount);
  
        // Check if we have enough total balance
        const totalBalance = balances.balances.reduce(
          (sum: number, b: TokenBalance) => sum + parseFloat(b.formatted),
          0
        );
  
        if (totalBalance < requiredAmountNum) {
          throw new Error(
            `Insufficient total balance. Have: ${totalBalance}, Need: ${requiredAmountNum}`
          );
        }
  
        // Get all possible routes
        const routes = await this.findRoutes(
          targetChainId,
          neededAmount.toString(),
          tokenAddress,
          userAddress,
          balances.balances
        );
  
        return {
          success: true,
          routes: routes.slice(0, this.MAX_ROUTES),
          targetChain,
          requestedAmount: requiredAmount,
          timestamp: Date.now()
        };
  
      } catch (error) {
        console.error('Error in findOptimalRoutes:', error);
        throw error;
      }
    }
  
    private async findRoutes(
      targetChainId: number,
      amount: string,
      tokenAddress: string,
      userAddress: string,
      balances: TokenBalance[]
    ): Promise<OptimizedRoute[]> {
      const routes: OptimizedRoute[] = [];
      const amountNum = parseFloat(amount);
  
      // Get usable source chains (excluding target chain)
      const sourceChains = balances.filter(
        b => b.chainId !== targetChainId && parseFloat(b.formatted) > 0
      );
  
      console.log('Available source chains:', 
        sourceChains.map(c => `${c.chainName}: ${c.formatted}`)
      );
  
      // Try single-chain routes first
      await this.findSingleChainRoutes(
        routes,
        sourceChains,
        targetChainId,
        amount,
        tokenAddress,
        userAddress
      );
  
      // If we need more routes, try multi-chain
      if (routes.length < this.MAX_ROUTES) {
        await this.findMultiChainRoutes(
          routes,
          sourceChains,
          targetChainId,
          amount,
          tokenAddress,
          userAddress
        );
      }
  
      // Sort routes by efficiency (fee + time)
      return this.sortRoutes(routes);
    }
  
    private async findSingleChainRoutes(
      routes: OptimizedRoute[],
      sourceChains: TokenBalance[],
      targetChainId: number,
      amount: string,
      tokenAddress: string,
      userAddress: string
    ): Promise<void> {
      const amountNum = parseFloat(amount);
  
      for (const source of sourceChains) {
        if (parseFloat(source.formatted) >= amountNum) {
          try {
            const amountInWei = parseUnits(amount, this.USDC_DECIMALS).toString();
            
            const quote = await this.bungeeService.getQuote({
              fromChainId: source.chainId,
              toChainId: targetChainId,
              fromTokenAddress: tokenAddress,
              toTokenAddress: tokenAddress,
              fromAmount: amountInWei,
              userAddress
            });
  
            if (quote.success && quote.result.routes.length > 0) {
              const bestRoute = quote.result.routes[0];
              
              routes.push({
                steps: [{
                  fromChain: source.chainName,
                  toChain: targetChainId.toString(),
                  amount: amount,
                  fee: formatUnits(bestRoute.totalGasFeesInUsd, this.USDC_DECIMALS),
                  estimatedTime: bestRoute.estimatedTimeInSeconds,
                  protocol: bestRoute.userTxs[0]?.steps?.[0]?.protocol || 'unknown'
                }],
                totalFee: formatUnits(bestRoute.totalGasFeesInUsd, this.USDC_DECIMALS),
                totalTime: bestRoute.estimatedTimeInSeconds,
                totalAmount: amount,
                sourceChains: [source.chainName]
              });
            }
          } catch (error) {
            console.error(`Error getting quote from ${source.chainName}:`, error);
          }
        }
      }
    }
  
    private async findMultiChainRoutes(
      routes: OptimizedRoute[],
      sourceChains: TokenBalance[],
      targetChainId: number,
      amount: string,
      tokenAddress: string,
      userAddress: string
    ): Promise<void> {
      const amountNum = parseFloat(amount);
  
      // Try different combinations of chains
      for (let i = 2; i <= this.MAX_SPLITS; i++) {
        const combinations = this.getCombinations(sourceChains, i);
  
        for (const combo of combinations) {
          const totalAvailable = combo.reduce(
            (sum, chain) => sum + parseFloat(chain.formatted),
            0
          );
  
          if (totalAvailable >= amountNum) {
            const route = await this.createMultiChainRoute(
              combo,
              targetChainId,
              amountNum,
              tokenAddress,
              userAddress
            );
  
            if (route) routes.push(route);
          }
        }
      }
    }
  
    private async createMultiChainRoute(
      sourceChains: TokenBalance[],
      targetChainId: number,
      totalAmount: number,
      tokenAddress: string,
      userAddress: string
    ): Promise<OptimizedRoute | null> {
      try {
        const steps: RouteStep[] = [];
        let remainingAmount = totalAmount;
        let totalFee = 0;
        let maxTime = 0;
  
        // Try to source from each chain
        for (const source of sourceChains) {
          if (remainingAmount <= 0) break;
  
          const amountFromChain = Math.min(
            parseFloat(source.formatted),
            remainingAmount
          );
  
          const amountInWei = parseUnits(
            amountFromChain.toString(),
            this.USDC_DECIMALS
          ).toString();
  
          try {
            const quote = await this.bungeeService.getQuote({
              fromChainId: source.chainId,
              toChainId: targetChainId,
              fromTokenAddress: tokenAddress,
              toTokenAddress: tokenAddress,
              fromAmount: amountInWei,
              userAddress
            });
  
            if (quote.success && quote.result.routes.length > 0) {
              const bestRoute = quote.result.routes[0];
              const fee = parseFloat(
                formatUnits(bestRoute.totalGasFeesInUsd, this.USDC_DECIMALS)
              );
  
              steps.push({
                fromChain: source.chainName,
                toChain: targetChainId.toString(),
                amount: amountFromChain.toString(),
                fee: fee.toString(),
                estimatedTime: bestRoute.estimatedTimeInSeconds,
                protocol: bestRoute.userTxs[0]?.steps?.[0]?.protocol || 'unknown'
              });
  
              totalFee += fee;
              maxTime = Math.max(maxTime, bestRoute.estimatedTimeInSeconds);
              remainingAmount -= amountFromChain;
            }
          } catch (error) {
            console.error(`Error getting quote from ${source.chainName}:`, error);
          }
        }
  
        if (steps.length > 0 && remainingAmount <= 0) {
          return {
            steps,
            totalFee: totalFee.toString(),
            totalTime: maxTime,
            totalAmount: totalAmount.toString(),
            sourceChains: sourceChains.map(s => s.chainName)
          };
        }
  
        return null;
      } catch (error) {
        console.error('Error creating multi-chain route:', error);
        return null;
      }
    }
  
    private getCombinations<T>(arr: T[], n: number): T[][] {
      if (n === 1) return arr.map(v => [v]);
      
      const combinations: T[][] = [];
      for (let i = 0; i <= arr.length - n; i++) {
        const head = arr[i];
        const subcombinations = this.getCombinations(arr.slice(i + 1), n - 1);
        subcombinations.forEach(subcomb => combinations.push([head, ...subcomb]));
      }
      
      return combinations;
    }
  
    private sortRoutes(routes: OptimizedRoute[]): OptimizedRoute[] {
      return [...routes].sort((a, b) => {
        const aScore = this.calculateRouteScore(a);
        const bScore = this.calculateRouteScore(b);
        return aScore - bScore;
      });
    }
  
    private calculateRouteScore(route: OptimizedRoute): number {
      const feeWeight = 0.7;
      const timeWeight = 0.3;
  
      const feeScore = parseFloat(route.totalFee);
      const timeScore = route.totalTime / 60; // Convert to minutes
  
      return (feeScore * feeWeight) + (timeScore * timeWeight);
    }
  }
  