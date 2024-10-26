// src/services/BalanceService.ts

import { ethers } from 'ethers';
import { SUPPORTED_CHAINS, ERC20_ABI } from '../config/constants';
import { ChainConfig, TokenBalance, BalanceResponse } from '../types';
import { CacheService } from './CacheService';

export class BalanceService {
  private providers: Map<number, ethers.Provider>;
  private readonly cacheService: CacheService;
  private readonly CACHE_TTL = 30; // 30 seconds cache

  constructor(cacheService: CacheService) {
    this.cacheService = cacheService;
    this.providers = new Map();
    
    // Initialize providers for all supported chains
    Object.values(SUPPORTED_CHAINS).forEach(chain => {
      this.providers.set(
        chain.chainId,
        new ethers.JsonRpcProvider(chain.rpcUrl)
      );
    });
  }

  /**
   * Get USDC balance for a specific chain
   */
  private async getChainBalance(
    userAddress: string,
    chain: ChainConfig
  ): Promise<TokenBalance> {
    try {
      const provider = this.providers.get(chain.chainId);
      if (!provider) {
        throw new Error(`No provider found for chain ${chain.name}`);
      }

      const tokenContract = new ethers.Contract(
        chain.contracts.usdc,
        ERC20_ABI,
        provider
      );

      const [balance, decimals] = await Promise.all([
        tokenContract.balanceOf(userAddress),
        tokenContract.decimals()
      ]);

      return {
        chainId: chain.chainId,
        chainName: chain.name,
        balance: balance.toString(),
        formatted: ethers.formatUnits(balance, decimals)
      };
    } catch (error) {
      console.error(`Error fetching balance for ${chain.name}:`, error);
      return {
        chainId: chain.chainId,
        chainName: chain.name,
        balance: '0',
        formatted: '0'
      };
    }
  }

  /**
   * Get USDC balances across all supported chains
   */
  async getAllBalances(userAddress: string): Promise<BalanceResponse> {
    const cacheKey = `balances:${userAddress}`;
    
    // Try to get from cache first
    const cachedBalances = await this.cacheService.get<BalanceResponse>(cacheKey);
    if (cachedBalances) {
      return cachedBalances;
    }

    try {
      // Fetch balances in parallel
      const balancePromises = Object.values(SUPPORTED_CHAINS).map(chain =>
        this.getChainBalance(userAddress, chain)
      );

      const balances = await Promise.all(balancePromises);

      const response: BalanceResponse = {
        success: true,
        balances: balances.filter(balance => 
          !balance.balance.startsWith('0')  // Only include non-zero balances
        ),
        timestamp: Date.now()
      };

      // Cache the response
      await this.cacheService.set(cacheKey, response, this.CACHE_TTL);

      return response;
    } catch (error) {
      console.error('Error fetching balances:', error);
      throw new Error('Failed to fetch balances across chains');
    }
  }

  /**
   * Get total USDC balance across all chains
   */
  async getTotalBalance(userAddress: string): Promise<string> {
    const { balances } = await this.getAllBalances(userAddress);
    
    const total = balances.reduce(
      (sum, balance) => sum + parseFloat(balance.formatted),
      0
    );
    
    return total.toString();
  }

  /**
   * Check if user has sufficient USDC balance across all chains
   */
  async hasSufficientBalance(
    userAddress: string,
    requiredAmount: string
  ): Promise<boolean> {
    const totalBalance = await this.getTotalBalance(userAddress);
    return parseFloat(totalBalance) >= parseFloat(requiredAmount);
  }

  /**
   * Get balances sorted by amount (highest to lowest)
   */
  async getSortedBalances(userAddress: string): Promise<TokenBalance[]> {
    const { balances } = await this.getAllBalances(userAddress);
    
    return balances.sort((a, b) => 
      parseFloat(b.formatted) - parseFloat(a.formatted)
    );
  }
}