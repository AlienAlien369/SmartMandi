import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  throttleTtl: parseInt(process.env.THROTTLE_TTL ?? '60', 10) * 1000,
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
}));

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  name: process.env.DB_NAME ?? 'smart_mandi',
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  ssl: process.env.DB_SSL === 'true',
  poolMin: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
  poolMax: parseInt(process.env.DB_POOL_MAX ?? '20', 10),
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD ?? undefined,
  db: parseInt(process.env.REDIS_DB ?? '0', 10),
  idempotencyTtl: parseInt(process.env.REDIS_IDEMPOTENCY_TTL ?? '86400', 10),
}));

export const awsConfig = registerAs('aws', () => ({
  region: process.env.AWS_REGION ?? 'ap-south-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  sqsQueueUrl: process.env.SQS_QUEUE_URL ?? '',
  sqsDlqUrl: process.env.SQS_DLQ_URL ?? '',
  sqsMaxReceiveCount: parseInt(process.env.SQS_MAX_RECEIVE_COUNT ?? '5', 10),
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '1h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
}));
