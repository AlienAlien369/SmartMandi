import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEvent } from './event.entity';
import { EventStoreService } from './event-store.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppEvent])],
  providers: [EventStoreService],
  exports: [EventStoreService],
})
export class EventStoreModule {}
