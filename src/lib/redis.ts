import { Redis } from '@upstash/redis'

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined
}

function createRedisClient(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Redis credentials not configured. Caching disabled.')
    return null
  }

  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

export const redis = globalForRedis.redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production' && redis) {
  globalForRedis.redis = redis
}

// Cache utility functions
export async function getFromCache<T>(key: string): Promise<T | null> {
  if (!redis) return null
  try {
    return await redis.get<T>(key)
  } catch (error) {
    console.error('Redis get error:', error)
    return null
  }
}

export async function setToCache<T>(
  key: string,
  value: T,
  expirationSeconds: number = 3600
): Promise<void> {
  if (!redis) return
  try {
    await redis.set(key, value, { ex: expirationSeconds })
  } catch (error) {
    console.error('Redis set error:', error)
  }
}

export async function deleteFromCache(key: string): Promise<void> {
  if (!redis) return
  try {
    await redis.del(key)
  } catch (error) {
    console.error('Redis delete error:', error)
  }
}

// Cache key builders
export const cacheKeys = {
  todayMatches: () => 'matches:today',
  matchStats: (matchId: string) => `match:${matchId}:stats`,
  matchAnalysis: (matchId: string) => `match:${matchId}:analysis`,
  teamStats: (teamId: string) => `team:${teamId}:stats`,
  leagueMatches: (leagueId: string, date: string) => `league:${leagueId}:matches:${date}`,
  dailyReport: (date: string) => `report:${date}`,
  news: (sportType: string) => `news:${sportType}:latest`,
}
