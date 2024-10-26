// src/services/CacheService.ts
import { createClient, RedisClientType } from 'redis';

export class CacheService {
  private client: RedisClientType;
  private readonly defaultTTL: number;

  constructor() {
    this.defaultTTL = parseInt(process.env.CACHE_TTL || '30', 10);
    this.client = createClient({
      url: process.env.REDIS_URL
    });

    this.client.on('error', err => console.error('Redis Client Error', err));
    this.connect();
  }

  private async connect() {
    try {
      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      await this.client.setEx(key, ttl, stringValue);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  createKey(...parts: string[]): string {
    return parts.join(':');
  }
}