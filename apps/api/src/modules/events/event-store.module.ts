import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEvent } from './event.entity';
import { EventStoreService } from './event-store.service';
import { EventConsumerService } from './event-consumer.service';
import { LedgerEntry } from '../ledger/ledger-entry.entity';
import { KacchaChittha } from '../kaccha-chittha/entities/kaccha-chittha.entity';
import { DashboardModule } from '../dashboard/dashboard.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppEvent, LedgerEntry, KacchaChittha]),
    DashboardModule,
    NotificationModule,
  ],
  providers: [EventStoreService, EventConsumerService],
  exports: [EventStoreService, EventConsumerService],
})
export class EventStoreModule {}
