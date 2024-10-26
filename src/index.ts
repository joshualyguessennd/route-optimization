// src/index.ts
import { Elysia } from 'elysia';
import { RouteRequest, RouteResponse } from './types';

const app = new Elysia()
  .post('/api/route', async ({ body }): Promise<RouteResponse> => {
    try {
      const request = body as RouteRequest;
      
      // TODO: Implement route finding logic
      
      return {
        status: 'success',
        data: {
          routes: [],
          timestamp: Date.now()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  })
  .listen(process.env.PORT || 3000);

console.log(`🚀 Server running at ${app.server?.hostname}:${app.server?.port}`);