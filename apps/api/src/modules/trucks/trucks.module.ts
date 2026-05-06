import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Truck } from './truck.entity';
import { PurchaseEntry } from './purchase-entry.entity';
import { TrucksService } from './trucks.service';
import { TrucksController } from './trucks.controller';
import { EventStoreModule } from '../events/event-store.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Truck, PurchaseEntry]),
    EventStoreModule,
    AuditModule,
  ],
  controllers: [TrucksController],
  providers: [TrucksService],
  exports: [TrucksService],
})
export class TrucksModule {}
