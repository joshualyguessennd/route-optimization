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

    private readonly BRIDGE_FEES = {
        'scenario1': {
            42161: 1.0,  // Arbitrum => Polygon: 1.0 USDC
            8453: 0.5,   // Base => Polygon: 0.5 USDC
        },
        'scenario2': {
            42161: 1.0,  // Arbitrum => Polygon: 1.0 USDC
            8453: 0.5,   // Base => Polygon: 0.5 USDC
            100: 0.1,    // Gnosis => Polygon: 0.1 USDC
            81457: 0.2   // Blast => Polygon: 0.2 USDC
        }
    };

    constructor(
        private bungeeService: any,
        private balanceService: any,
        private cacheService: any,
        private scenario: 'scenario1' | 'scenario2' = 'scenario1'
    ) { }

    private getBridgeFee(chainId: number): number {
        return (this.BRIDGE_FEES[this.scenario] as { [key: number]: number })[chainId] || 999;
    }

    private filterAvailableChains(chains: TokenBalance[]): TokenBalance[] {
        // For scenario1, only include Arbitrum and Base
        if (this.scenario === 'scenario1') {
            return chains.filter(chain =>
                chain.chainId === 42161 || // Arbitrum
                chain.chainId === 8453     // Base
            );
        }
        return chains;
    }

    async findOptimalRoutes(
        targetChain: string,
        requiredAmount: string,
        userAddress: string
    ): Promise<RouteOptimization> {
        try {
            console.log('\n🔍 Starting route optimization...');

            const balances = await this.balanceService.getAllBalances(userAddress);
            const targetChainId = parseInt(targetChain);
            const requiredAmountNum = parseFloat(requiredAmount);
            const targetBalance = balances.balances.find((b: TokenBalance) => b.chainId === targetChainId);
            const targetBalanceNum = targetBalance ? parseFloat(targetBalance.formatted) : 0;

            console.log('Balance analysis:', {
                required: requiredAmountNum,
                availableOnTarget: targetBalanceNum,
                needToBridge: Math.max(0, requiredAmountNum - targetBalanceNum)
            });

            const needToBridge = Math.max(0, requiredAmountNum - targetBalanceNum);

            // If we have exact amount needed locally
            if (needToBridge === 0) {
                return {
                    success: true,
                    routes: [{
                        steps: [{
                            fromChain: targetChain,
                            toChain: targetChain,
                            amount: requiredAmount,
                            fee: "0",
                            estimatedTime: 0,
                            protocol: "local"
                        }],
                        totalFee: "0",
                        totalTime: 0,
                        totalAmount: requiredAmount,
                        sourceChains: [targetChain]
                    }],
                    targetChain,
                    requestedAmount: requiredAmount,
                    timestamp: Date.now()
                };
            }

            // Get routes for the amount we need to bridge
            const bridgeRoutes = await this.findRoutes(
                targetChainId,
                needToBridge.toString(),
                balances.balances
            );

            // Add local balance step to each route if we have local balance
            const combinedRoutes = bridgeRoutes.map(route => ({
                steps: [
                    ...(targetBalanceNum > 0 ? [{
                        fromChain: targetChain,
                        toChain: targetChain,
                        amount: targetBalanceNum.toString(),
                        fee: "0",
                        estimatedTime: 0,
                        protocol: "local"
                    }] : []),
                    ...route.steps
                ],
                totalFee: route.totalFee,
                totalTime: route.totalTime,
                totalAmount: requiredAmount,
                sourceChains: [
                    ...(targetBalanceNum > 0 ? [targetChain] : []),
                    ...route.sourceChains
                ],
                isOptimal: false,
                explanation: ""
            }));

            // Sort routes by total fee and mark the optimal one
            const sortedRoutes = combinedRoutes
                .sort((a, b) => parseFloat(a.totalFee) - parseFloat(b.totalFee))
                .map((route, index) => ({
                    ...route,
                    isOptimal: index === 0,
                    explanation: this.generateRouteExplanation(route)
                }));

            console.log('\n📊 Route Summary:');
            sortedRoutes.forEach((route, index) => {
                console.log(`\n${index === 0 ? '🏆 BEST ROUTE' : 'Alternative Route'} (Total Fee: ${route.totalFee} USDC):`);
                console.log(route.explanation);
                console.log('Steps:', route.steps.map(step =>
                    `${step.protocol === 'local' ? '📍' : '🌉'} ${step.fromChain} -> ${step.toChain}: ${step.amount} USDC ${step.fee === '0' ? '(no fee)' : `(fee: ${step.fee} USDC)`}`
                ));
            });

            return {
                success: true,
                routes: sortedRoutes.slice(0, this.MAX_ROUTES),
                targetChain,
                requestedAmount: requiredAmount,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('Route optimization failed:', error);
            throw error;
        }
    }

    private generateRouteExplanation(route: OptimizedRoute): string {
        const localStep = route.steps.find(s => s.protocol === 'local');
        const bridgeSteps = route.steps.filter(s => s.protocol !== 'local');

        let explanation = '';

        if (localStep) {
            explanation += `Using ${localStep.amount} USDC already available on ${localStep.toChain}. `;
        }

        if (bridgeSteps.length === 1) {
            explanation += `Bridging remaining ${bridgeSteps[0].amount} USDC from ${bridgeSteps[0].fromChain} with a fee of ${bridgeSteps[0].fee} USDC. `;
        } else if (bridgeSteps.length > 1) {
            explanation += `Split bridging: ${bridgeSteps.map(step =>
                `${step.amount} USDC from ${step.fromChain} (fee: ${step.fee} USDC)`
            ).join(' + ')}. `;
        }

        explanation += `Total fee: ${route.totalFee} USDC`;
        return explanation;
    }

    private async findRoutes(
        targetChainId: number,
        amount: string,
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
            routes.unshift(multiChainRoute);
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

        const availableChains = this.filterAvailableChains(sourceChains);

        for (const chain of availableChains) {
            if (parseFloat(chain.formatted) >= amount) {
                const fee = this.getBridgeFee(chain.chainId);
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

        const availableChains = this.filterAvailableChains(sourceChains);
        // Sort chains by fee (cheapest first)
        const sortedChains = [...availableChains].sort(
            (a, b) => this.getBridgeFee(a.chainId) - this.getBridgeFee(b.chainId)
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
                        this.getBridgeFee(chain1.chainId) +
                        this.getBridgeFee(chain2.chainId);

                    if (totalFee < lowestTotalFee) {
                        bestRoute = {
                            steps: [
                                {
                                    fromChain: chain1.chainName,
                                    toChain: targetChainId.toString(),
                                    amount: amount1.toString(),
                                    fee: this.getBridgeFee(chain1.chainId).toString(),
                                    estimatedTime: 300,
                                    protocol: 'socket'
                                },
                                {
                                    fromChain: chain2.chainName,
                                    toChain: targetChainId.toString(),
                                    amount: remainingNeeded.toString(),
                                    fee: this.getBridgeFee(chain2.chainId).toString(),
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
