# Bridge Route Optimizer

This application finds the most efficient routes for bridging tokens (USDC) across different chains, optimizing for gas fees and bridging costs.

## Features

- Finds optimal bridging routes based on fees and time
- Supports multiple source chains (Polygon, Arbitrum, Base, Gnosis, Blast)
- Takes into account local balances on target chain
- Provides multiple route options sorted by efficiency
- Caches responses for better performance

## Prerequisites

- [Redis](https://redis.io/) server running
- [Socket/Bungee API Key](https://docs.socket.tech/)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd bridge-route-optimizer
```

2. Install dependencies:
```bash
npx bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Server Configuration
PORT=3001

# Bungee/Socket API Configuration
BUNGEE_API_KEY=your_api_key_here

# Redis Configuration
REDIS_URL=redis://localhost:6379
CACHE_TTL=30
```

## Running the Application

1. Start Redis server:
```bash
# Using Docker
docker run --name redis -p 6379:6379 -d redis

# Or if you have Redis installed locally
redis-server
```

2. Run the application:
```bash
# Development mode with hot reload
npx bun dev

# Production mode
npx bun start
```

The server will start at `http://localhost:3001` (or the port specified in your .env file).

## API Endpoints

### GET /health
Health check endpoint

### POST /api/route
Find optimal bridging routes

Request body:
```json
{
  "targetChain": "137",
  "amount": "100",
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "userAddress": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
}
```

Response:
```json
{
  "status": "success",
  "data": {
    "success": true,
    "routes": [
      {
        "steps": [
          {
            "fromChain": "137",
            "toChain": "137",
            "amount": "50",
            "fee": "0",
            "protocol": "local"
          },
          {
            "fromChain": "Gnosis",
            "toChain": "137",
            "amount": "25",
            "fee": "0.1",
            "protocol": "socket"
          }
        ],
        "totalFee": "0.3",
        "totalAmount": "100",
        "isOptimal": true,
        "explanation": "Best route using local balance + bridging"
      }
    ],
    "targetChain": "137",
    "requestedAmount": "100"
  }
}
```

## Testing

Run the test scenarios:
```bash
bun run tests/scenarios.ts
```

Note: Currently using mock balances for testing purposes. To implement real balance fetching:
1. Update `BalanceService.getAllBalances()` to use actual RPC calls or indexers
2. Remove the mock data in `getAllBalances()`
3. Implement proper balance fetching for each chain

## Project Structure

```
bridge-route-optimizer/
├── src/
│   ├── config/
│   │   └── constants.ts      # Chain configurations
│   ├── services/
│   │   ├── BalanceService.ts # Balance fetching (currently mocked)
│   │   ├── BungeeService.ts  # Socket/Bungee API integration
│   │   ├── CacheService.ts   # Redis caching
│   │   └── RouteOptimizer.ts # Route optimization logic
│   ├── controllers/
│   │   └── RouteController.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── tests/
│   └── scenarios.ts
├── .env
└── package.json
```

## TODO

- [ ] Implement real balance fetching across chains
- [ ] Add more test scenarios
- [ ] Add route success probability
- [ ] Add gas estimates
- [ ] Add monitoring and metrics
- [ ] Add rate limiting
- [ ] Add API documentation (Swagger)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE)
