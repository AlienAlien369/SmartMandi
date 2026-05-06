import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService): Redis => {
        const client = new Redis({
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password') || undefined,
          db: configService.get('redis.db'),
          retryStrategy: (times: number) => Math.min(times * 50, 2000),
          maxRetriesPerRequest: 3,
          lazyConnect: false,
          enableOfflineQueue: true,
        });

        client.on('connect', () => console.log('Redis connected'));
        client.on('error', (err) => console.error('Redis error:', err));

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
