import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { appConfig, databaseConfig, redisConfig, awsConfig, jwtConfig } from './config/app.config';
import { AuthModule } from './modules/auth/auth.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { EventStoreModule } from './modules/events/event-store.module';
import { AuditModule } from './modules/audit/audit.module';
import { RedisModule } from './config/redis.module';
import { PermissionsGuard } from './common/guards/permissions.guard';
// Phase 2
import { ConfiguratorModule } from './modules/config/configurator.module';
import { CustomersModule } from './modules/customers/customers.module';
import { KacchaChitthaModule } from './modules/kaccha-chittha/kaccha-chittha.module';
// Phase 3
import { TrucksModule } from './modules/trucks/trucks.module';
// Phase 4
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
// Phase 5
import { SalaryModule } from './modules/salary/salary.module';
import { UsersModule } from './modules/users/users.module';
// Phase 6 — RBAC
import { RbacModule } from './modules/rbac/rbac.module';

@Module({
  imports: [
    // Configuration — validates env vars at startup
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, awsConfig, jwtConfig],
      validationOptions: { allowUnknown: false, abortEarly: true },
    }),

    // Database connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.user'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        ssl: configService.get('database.ssl') ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        synchronize: false, // NEVER true in production — use migrations
        poolSize: configService.get('database.poolMax'),
        logging: configService.get('app.nodeEnv') === 'development',
      }),
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get('app.throttleTtl') ?? 60000,
          limit: configService.get('app.throttleLimit') ?? 100,
        },
      ],
      inject: [ConfigService],
    }),

    // Cron jobs
    ScheduleModule.forRoot(),

    // Shared modules
    RedisModule,

    // Feature modules — Phase 1
    AuthModule,
    LedgerModule,
    EventStoreModule,
    AuditModule,
    // Feature modules — Phase 2
    ConfiguratorModule,
    CustomersModule,
    KacchaChitthaModule,
    // Feature modules — Phase 3
    TrucksModule,
    // Feature modules — Phase 4
    DashboardModule,
    ReportsModule,
    // Feature modules — Phase 5
    SalaryModule,
    UsersModule,
    // Feature modules — Phase 6 — RBAC
    RbacModule,
  ],
  providers: [
    // Global rate limiting
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Dynamic RBAC — checks role_module_permissions table per endpoint
    PermissionsGuard,
  ],
})
export class AppModule {}
