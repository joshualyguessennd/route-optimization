// src/index.ts

import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { RouteController } from './controller/RouteController';

const app = new Elysia()
  .use(swagger({
    path: '/docs',
    documentation: {
      info: {
        title: 'Bridge Route Optimizer API',
        version: '1.0.0'
      }
    }
  }));

// Create and setup controller
const routeController = new RouteController();
routeController.setup(app);

// Start server
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📖 API Documentation available on http://localhost:${port}/docs`);
});