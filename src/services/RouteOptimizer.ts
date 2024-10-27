// src/services/RouteOptimizer.ts
import {
    TokenBalance,
    RouteOptimization,
    OptimizedRoute,
} from '../types';
export class RouteOptimizer {
    private readonly MAX_SPLITS = 3;
    private readonly MAX_ROUTES = 3;
    private readonly USDC_DECIMALS = 6;

    constructor(
        private bungeeService: any,
        private balanceService: any,
        private cacheService: any) { }

    // src/services/RouteOptimizer.ts

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

            // Get target chain balance
            const targetBalance = balances.balances.find(b => b.chainId === targetChainId);
            const targetBalanceNum = targetBalance ? parseFloat(targetBalance.formatted) : 0;

            console.log('Balance analysis:', {
                required: requiredAmountNum,
                availableOnTarget: targetBalanceNum,
                needToBridge: Math.max(0, requiredAmountNum - targetBalanceNum)
            });

            // No need to bridge if target chain has enough balance
            const needToBridge = Math.max(0, requiredAmountNum - targetBalanceNum);
            if (needToBridge === 0) {
                return {
                    success: true,
                    routes: [{
                        steps: [{
                            fromChain: targetBalance?.chainName || targetChain,
                            toChain: targetChain,
                            amount: requiredAmount,
                            fee: "0",
                            estimatedTime: 0,
                            protocol: "local"
                        }],
                        totalFee: "0",
                        totalTime: 0,
                        totalAmount: requiredAmount,
                        sourceChains: [targetBalance?.chainName || targetChain]
                    }],
                    targetChain,
                    requestedAmount: requiredAmount,
                    timestamp: Date.now()
                };
            }

            // Get all possible routes
            const routes = await this.findRoutes(
                targetChainId,
                needToBridge.toString(),
                tokenAddress,
                userAddress,
                balances.balances
            );

            console.log(`Found ${routes.length} possible routes for bridging ${needToBridge} USDC`);

            return {
                success: true,
                routes: routes.slice(0, this.MAX_ROUTES),
                targetChain,
                requestedAmount: requiredAmount,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('Route optimization failed:', error);
            throw error;
        }
    }

    private readonly BRIDGE_FEES: Record<number, number> = {
        42161: 1.0,  // Arbitrum => Polygon: 1 USDC
        8453: 0.5,   // Base => Polygon: 0.5 USDC
        100: 0.1,    // Gnosis => Polygon: 0.1 USDC
        81457: 0.2   // Blast => Polygon: 0.2 USDC
    };

    private async findRoutes(
        targetChainId: number,
        amount: string,
        tokenAddress: string,
        userAddress: string,
        balances: TokenBalance[]
    ): Promise<OptimizedRoute[]> {
        console.log('\n📊 Finding routes for', amount, 'USDC');
        const routes: OptimizedRoute[] = [];
        const amountNeeded = parseFloat(amount);

        // Get valid source chains
        const sourceChains = balances.filter(
            b => b.chainId !== targetChainId && parseFloat(b.formatted) > 0
        );
        console.log('Available source chains:',
            sourceChains.map(c => `${c.chainName}: ${c.formatted} USDC`)
        );

        // Step 1: Try most efficient single chain route
        const baseRoute = await this.findBestSingleChainRoute(
            sourceChains,
            targetChainId,
            amountNeeded
        );
        if (baseRoute) {
            console.log('Found single chain route:', {
                chain: baseRoute.sourceChains[0],
                fee: baseRoute.totalFee
            });
            routes.push(baseRoute);
        }

        // Step 2: Try to find a more efficient multi-chain route
        const multiChainRoute = await this.findOptimalMultiChainRoute(
            sourceChains,
            targetChainId,
            amountNeeded
        );
        if (multiChainRoute && parseFloat(multiChainRoute.totalFee) < parseFloat(baseRoute?.totalFee || '999')) {
            console.log('Found better multi-chain route:', {
                chains: multiChainRoute.sourceChains,
                fee: multiChainRoute.totalFee
            });
            routes.unshift(multiChainRoute); // Put better route first
        }

        return routes;
    }

    private async findBestSingleChainRoute(
        sourceChains: TokenBalance[],
        targetChainId: number,
        amount: number
    ): Promise<OptimizedRoute | null> {
        let bestRoute: OptimizedRoute | null = null;
        let lowestFee = 999;

        for (const chain of sourceChains) {
            if (parseFloat(chain.formatted) >= amount) {
                const fee = this.BRIDGE_FEES[chain.chainId] || 999;
                if (fee < lowestFee) {
                    bestRoute = {
                        steps: [{
                            fromChain: chain.chainName,
                            toChain: targetChainId.toString(),
                            amount: amount.toString(),
                            fee: fee.toString(),
                            estimatedTime: 300,
                            protocol: 'socket'
                        }],
                        totalFee: fee.toString(),
                        totalTime: 300,
                        totalAmount: amount.toString(),
                        sourceChains: [chain.chainName]
                    };
                    lowestFee = fee;
                }
            }
        }

        return bestRoute;
    }

    private async findOptimalMultiChainRoute(
        sourceChains: TokenBalance[],
        targetChainId: number,
        totalAmount: number
    ): Promise<OptimizedRoute | null> {
        // Sort chains by fee (cheapest first)
        const sortedChains = [...sourceChains].sort(
            (a, b) => (this.BRIDGE_FEES[a.chainId] || 999) - (this.BRIDGE_FEES[b.chainId] || 999)
        );

        let bestRoute: OptimizedRoute | null = null;
        let lowestTotalFee = 999;

        // Try combinations of the cheapest chains
        for (let i = 0; i < sortedChains.length - 1; i++) {
            for (let j = i + 1; j < sortedChains.length; j++) {
                const chain1 = sortedChains[i];
                const chain2 = sortedChains[j];

                const amount1 = Math.min(parseFloat(chain1.formatted), totalAmount);
                const remainingNeeded = totalAmount - amount1;

                if (remainingNeeded <= parseFloat(chain2.formatted)) {
                    const totalFee =
                        this.BRIDGE_FEES[chain1.chainId] +
                        this.BRIDGE_FEES[chain2.chainId];

                    if (totalFee < lowestTotalFee) {
                        bestRoute = {
                            steps: [
                                {
                                    fromChain: chain1.chainName,
                                    toChain: targetChainId.toString(),
                                    amount: amount1.toString(),
                                    fee: this.BRIDGE_FEES[chain1.chainId].toString(),
                                    estimatedTime: 300,
                                    protocol: 'socket'
                                },
                                {
                                    fromChain: chain2.chainName,
                                    toChain: targetChainId.toString(),
                                    amount: remainingNeeded.toString(),
                                    fee: this.BRIDGE_FEES[chain2.chainId].toString(),
                                    estimatedTime: 300,
                                    protocol: 'socket'
                                }
                            ],
                            totalFee: totalFee.toString(),
                            totalTime: 300,
                            totalAmount: totalAmount.toString(),
                            sourceChains: [chain1.chainName, chain2.chainName]
                        };
                        lowestTotalFee = totalFee;
                    }
                }
            }
        }

        return bestRoute;
    }
}
