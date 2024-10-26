// src/services/BungeeService.ts

import axios, { AxiosInstance } from 'axios';
import { 
  QuoteRequest, 
  QuoteResponse, 
  SupportedChain, 
  TokenInfo 
} from '../types';

export class BungeeService {
  private readonly api: AxiosInstance;
  private readonly BUNGEE_BASE_URL = 'https://api.socket.tech/v2';

  constructor() {
    if (!process.env.BUNGEE_API_KEY) {
      throw new Error('BUNGEE_API_KEY environment variable is required');
    }

    this.api = axios.create({
      baseURL: this.BUNGEE_BASE_URL,
      headers: {
        'API-KEY': process.env.BUNGEE_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      response => response,
      error => {
        console.error('Bungee API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    );
  }

  /**
   * Get supported chains
   */
  async getSupportedChains(): Promise<SupportedChain[]> {
    try {
      console.log('Fetching supported chains...');
      const response = await this.api.get('/supported/chains');
      console.log('Supported chains response:', response.data);
      return response.data.result;
    } catch (error) {
      console.error('Error fetching supported chains:', error);
      throw error;
    }
  }

  /**
   * Get user's token balance
   */
  async getBalance(chainId: number, userAddress: string, tokenAddress: string) {
    try {
      console.log(`Fetching balance for chain ${chainId}, user ${userAddress}, token ${tokenAddress}`);
      const response = await this.api.get(`/balances/${userAddress}`, {
        params: {
          chainId,
          tokenAddress
        }
      });
      console.log('Balance response:', response.data);
      return response.data.result;
    } catch (error) {
      console.error(`Error fetching balance for chain ${chainId}:`, error);
      throw error;
    }
  }

  /**
   * Get bridge quote
   */
  async getQuote(params: QuoteRequest): Promise<QuoteResponse> {
    try {
      console.log('Fetching quote with params:', params);
      const response = await this.api.get('/quote', {
        params: {
          fromChainId: params.fromChainId,
          toChainId: params.toChainId,
          fromTokenAddress: params.fromTokenAddress,
          toTokenAddress: params.toTokenAddress,
          fromAmount: params.fromAmount,
          userAddress: params.userAddress,
          singleTxOnly: true,
          sort: 'output'
        }
      });
      console.log('Quote response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching quote:', error);
      throw error;
    }
  }

  /**
   * Get supported tokens for a chain (source)
   */
  async getFromTokenList(chainId: number): Promise<TokenInfo[]> {
    try {
      console.log(`Fetching from-token list for chain ${chainId}`);
      const response = await this.api.get('/token-lists/from-token-list', {
        params: {
          chainId,
          singleTxOnly: true
        }
      });
      console.log('From token list response:', response.data);
      return response.data.result;
    } catch (error) {
      console.error(`Error fetching from-token list for chain ${chainId}:`, error);
      throw error;
    }
  }

  /**
   * Get supported tokens for a chain (destination)
   */
  async getToTokenList(chainId: number): Promise<TokenInfo[]> {
    try {
      console.log(`Fetching to-token list for chain ${chainId}`);
      const response = await this.api.get('/token-lists/to-token-list', {
        params: {
          chainId,
          singleTxOnly: true
        }
      });
      console.log('To token list response:', response.data);
      return response.data.result;
    } catch (error) {
      console.error(`Error fetching to-token list for chain ${chainId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a route exists between chains for a token
   */
  async checkRouteExists(
    fromChainId: number,
    toChainId: number,
    tokenAddress: string
  ): Promise<boolean> {
    try {
      console.log(`Checking route existence: ${fromChainId} -> ${toChainId} for token ${tokenAddress}`);
      const fromTokens = await this.getFromTokenList(fromChainId);
      const toTokens = await this.getToTokenList(toChainId);

      const isTokenSupported = fromTokens.some(t => 
        t.address.toLowerCase() === tokenAddress.toLowerCase()
      ) && toTokens.some(t => 
        t.address.toLowerCase() === tokenAddress.toLowerCase()
      );

      console.log(`Route exists: ${isTokenSupported}`);
      return isTokenSupported;
    } catch (error) {
      console.error('Error checking route existence:', error);
      return false;
    }
  }
}