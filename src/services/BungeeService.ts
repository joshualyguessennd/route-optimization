// src/services/BungeeService.ts
import axios, { AxiosInstance } from 'axios';
import { 
  QuoteRequest, 
  QuoteResponse, 
  SupportedChain, 
  TokenInfo,
  BungeeApiError 
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
        if (error.response) {
          throw new BungeeApiError(
            error.response.data.message || 'Bungee API error',
            error.response.status,
            error.response.data.code
          );
        }
        throw error;
      }
    );
  }

  /**
   * Get list of supported chains
   */
  async getSupportedChains(): Promise<SupportedChain[]> {
    try {
      const response = await this.api.get('/supported/chains');
      return response.data.result;
    } catch (error) {
      console.error('Error fetching supported chains:', error);
      throw error;
    }
  }

  /**
   * Get list of supported tokens for source chain
   */
  async getFromTokenList(chainId: number): Promise<TokenInfo[]> {
    try {
      const response = await this.api.get('/token-lists/from-token-list', {
        params: {
          chainId,
          singleTxOnly: true
        }
      });
      return response.data.result;
    } catch (error) {
      console.error(`Error fetching from-token list for chain ${chainId}:`, error);
      throw error;
    }
  }

  /**
   * Get list of supported tokens for destination chain
   */
  async getToTokenList(chainId: number): Promise<TokenInfo[]> {
    try {
      const response = await this.api.get('/token-lists/to-token-list', {
        params: {
          chainId,
          singleTxOnly: true
        }
      });
      return response.data.result;
    } catch (error) {
      console.error(`Error fetching to-token list for chain ${chainId}:`, error);
      throw error;
    }
  }

  /**
   * Get quote for bridging tokens
   */
  async getQuote(params: QuoteRequest): Promise<QuoteResponse> {
    try {
      const response = await this.api.get('/quote', {
        params: {
          ...params,
          singleTxOnly: true
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching quote:', error);
      throw error;
    }
  }

  /**
   * Check token allowance
   */
  async checkAllowance(
    chainId: number,
    tokenAddress: string,
    userAddress: string,
    spender: string
  ): Promise<string> {
    try {
      const response = await this.api.get('/approval/check-allowance', {
        params: {
          chainId,
          tokenAddress,
          userAddress,
          spender
        }
      });
      return response.data.result.allowance;
    } catch (error) {
      console.error('Error checking allowance:', error);
      throw error;
    }
  }

  /**
   * Build approval transaction
   */
  async buildApprovalTx(
    chainId: number,
    tokenAddress: string,
    userAddress: string,
    spender: string
  ): Promise<any> {
    try {
      const response = await this.api.get('/approval/build-tx', {
        params: {
          chainId,
          tokenAddress,
          userAddress,
          spender
        }
      });
      return response.data.result;
    } catch (error) {
      console.error('Error building approval transaction:', error);
      throw error;
    }
  }
}