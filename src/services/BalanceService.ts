// src/services/BalanceService.ts

import { CHAIN_CONFIG, ChainId } from '../config/constants';
import axios, { AxiosInstance } from 'axios';
import { formatUnits } from 'ethers';
import { BalanceResponse, TokenBalance } from '../types';

export class BalanceService {
    private readonly api: AxiosInstance;

    constructor(private cacheService: any) {
        if (!process.env.BUNGEE_API_KEY) {
            throw new Error('BUNGEE_API_KEY environment variable is required');
        }

        this.api = axios.create({
            baseURL: 'https://api.socket.tech/v2',
            headers: {
                'API-KEY': process.env.BUNGEE_API_KEY,
                'Content-Type': 'application/json',
            }
        });
    }

    async getBalanceForChain(
        chainId: ChainId,
        userAddress: string,
        tokenAddress: string
    ): Promise<string> {
        try {
            const chainConfig = CHAIN_CONFIG[chainId];
            const { data } = await this.api.get('/balances/token', {
                params: {
                    chainId,
                    tokenAddress,
                    userAddress
                }
            });

            const balance = data.result?.amount || '0';
            console.log(`${chainConfig.name} balance:`,
                formatUnits(balance, 6), 'USDC');

            return balance;
        } catch (error) {
            console.error(`Error fetching ${CHAIN_CONFIG[chainId].name} balance:`, error);
            return '0';
        }
    }

    // async getAllBalances(userAddress: string): Promise<BalanceResponse> {
    //     console.log('Getting balances for:', userAddress);
    
    //     const balances: TokenBalance[] = [];
    
    //     // Iterate over numeric keys, cast to ChainId
    //     for (const chainIdKey of Object.keys(CHAIN_CONFIG)) {
    //         const chainId = Number(chainIdKey) as ChainId;
    //         const chain = CHAIN_CONFIG[chainId];
    
    //         // Fetch balance
    //         const balance = await this.getBalanceForChain(chainId, userAddress, chain.usdc);
    
    //         balances.push({
    //             chainId,
    //             chainName: chain.name,
    //             balance: balance,         // Modify as needed for actual balance values
    //             formatted: balance, // Modify as needed for formatted balance
    //         });
    //     }
    
    //     return {
    //         success: true,
    //         balances,
    //         timestamp: Date.now(),
    //     };
    // }
    
    

    // // For now, return mock data for testing route optimization
    async getAllBalances(userAddress: string): Promise<BalanceResponse> {
        console.log('Getting balances for:', userAddress);

        // Mock balances matching our test scenario
        const mockBalances: TokenBalance[] = [
            {
                chainId: 137, // Polygon
                chainName: CHAIN_CONFIG[137].name,
                balance: '50000000', // 50 USDC
                formatted: '50'
            },
            {
                chainId: 42161, // Arbitrum
                chainName: CHAIN_CONFIG[42161].name,
                balance: '100000000', // 100 USDC
                formatted: '100'
            },
            {
                chainId: 8453, // Base
                chainName: CHAIN_CONFIG[8453].name,
                balance: '80000000', // 80 USDC
                formatted: '80'
            },
            {
                chainId: 100, // Gnosis
                chainName: CHAIN_CONFIG[100].name,
                balance: '25000000', // 25 USDC
                formatted: '25'
            },
            {
                chainId: 81457, // Blast
                chainName: CHAIN_CONFIG[81457].name,
                balance: '30000000', // 30 USDC
                formatted: '30'
            }
        ];

        // Log available balances
        console.log('\nAvailable balances:');
        mockBalances.forEach(b => {
            console.log(`${b.chainName}: ${b.formatted} USDC`);
        });

        return {
            success: true,
            balances: mockBalances,
            timestamp: Date.now()
        };
    }

    async getBridgeFee(
        fromChainId: ChainId,
        toChainId: ChainId,
        amount: string,
        userAddress: string
    ): Promise<{ fee: string; estimatedTime: number }> {
        try {
            const fromChain = CHAIN_CONFIG[fromChainId];
            const toChain = CHAIN_CONFIG[toChainId];
            
            console.log(`Getting bridge fee from ${fromChain.name} to ${toChain.name}`);

            const { data: quote } = await this.api.get('/quote', {
                params: {
                    fromChainId,
                    toChainId,
                    fromTokenAddress: fromChain.usdc,
                    toTokenAddress: toChain.usdc,
                    fromAmount: amount,
                    userAddress,
                    singleTxOnly: true,
                    sort: 'output'
                }
            });

            if (quote.success && quote.result.routes.length > 0) {
                const bestRoute = quote.result.routes[0];
                return {
                    fee: formatUnits(bestRoute.totalGasFeesInUsd, 6),
                    estimatedTime: bestRoute.estimatedTimeInSeconds
                };
            }

            throw new Error('No routes found');
        } catch (error) {
            console.error('Error getting bridge fee:', error);
            throw error;
        }
    }

    getSupportedChains(): ChainId[] {
        return Object.keys(CHAIN_CONFIG).map(id => parseInt(id) as ChainId);
    }

    isChainSupported(chainId: number): chainId is ChainId {
        return chainId in CHAIN_CONFIG;
    }

    getChainName(chainId: ChainId): string {
        return CHAIN_CONFIG[chainId].name;
    }

    getTokenAddress(chainId: ChainId): string {
        return CHAIN_CONFIG[chainId].usdc;
    }
}