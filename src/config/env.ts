import "dotenv/config"

const getPositiveInt = (name: string, defaultValue: number): number => {
  const value = process.env[name];

  if (value === undefined) return defaultValue;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, Received: ${value}`);
  }

  return parsed;
};

export const config = {
  env: {
    nodeEnv: process.env.NODE_ENV ?? "development",
    logLevel: process.env.LOG_LEVEL ?? "info",
  },
  api: {
    port: getPositiveInt("PORT", 3000),
  },

  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  },

  worker: {
    concurrency: getPositiveInt("MAX_CONCURRENCY", 3),

    maxAttempts: getPositiveInt("MAX_ATTEMPTS", 3),

    baseRetryDelay: getPositiveInt("BASE_RETRY_DELAY", 1000),

    maxRetryDelay: getPositiveInt("MAX_RETRY_DELAY", 60 * 1000),

    leaseDuration: getPositiveInt("LEASE_DURATION", 10_000),

    heartbeatInterval: getPositiveInt("HEARTBEAT_INTERVAL", 5000),

    metricsPort: getPositiveInt("WORKER_METRICS_PORT", 3001),
  },
};
