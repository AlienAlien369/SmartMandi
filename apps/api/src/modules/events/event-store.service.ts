import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
import { AppEvent } from './event.entity';
import { EventStatus } from '../../common/enums';

export interface PublishEventDto {
  firm_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  idempotency_key?: string;
}

export interface EventConsumer {
  getEventTypes(): string[];
  handle(event: AppEvent): Promise<void>;
}

@Injectable()
export class EventStoreService {
  private readonly logger = new Logger(EventStoreService.name);
  private readonly sqsClient: SQSClient;
  private readonly consumers = new Map<string, EventConsumer[]>();

  constructor(
    @InjectRepository(AppEvent)
    private readonly eventRepo: Repository<AppEvent>,
    private readonly configService: ConfigService,
  ) {
    this.sqsClient = new SQSClient({
      region: this.configService.get('aws.region'),
      credentials: {
        accessKeyId: this.configService.get('aws.accessKeyId') ?? '',
        secretAccessKey: this.configService.get('aws.secretAccessKey') ?? '',
      },
    });
  }

  /** Register a consumer for specific event types */
  registerConsumer(consumer: EventConsumer): void {
    for (const eventType of consumer.getEventTypes()) {
      const existing = this.consumers.get(eventType) ?? [];
      existing.push(consumer);
      this.consumers.set(eventType, existing);
    }
  }

  /**
   * Publish an event to the event store + SQS.
   * Idempotent — duplicate idempotency_key returns original event.
   */
  async publish(dto: PublishEventDto): Promise<AppEvent> {
    const idempotencyKey = dto.idempotency_key ?? `${dto.event_type}:${dto.aggregate_id}:${Date.now()}`;

    const existing = await this.eventRepo.findOne({
      where: { idempotency_key: idempotencyKey },
    });
    if (existing) return existing;

    const event = this.eventRepo.create({
      ...dto,
      idempotency_key: idempotencyKey,
      status: EventStatus.PENDING,
    });

    const saved = await this.eventRepo.save(event);

    // Send to SQS for reliable at-least-once delivery
    await this.sendToSqs(saved);

    return saved;
  }

  /** Cron: retry FAILED events that are past their process_after time */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryFailed(): Promise<void> {
    const failedEvents = await this.eventRepo.find({
      where: {
        status: EventStatus.FAILED,
        process_after: LessThanOrEqual(new Date()),
      },
      take: 50,
    });

    for (const event of failedEvents) {
      if (event.retry_count >= event.max_retries) {
        await this.markDeadLetter(event, 'Max retries exceeded');
        continue;
      }

      await this.sendToSqs(event);
      this.logger.log(`Retrying event ${event.id} (attempt ${event.retry_count + 1})`);
    }
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.eventRepo.update(eventId, {
      status: EventStatus.PROCESSED,
      processed_at: new Date(),
    });
  }

  async markFailed(eventId: string, error: string): Promise<void> {
    const event = await this.eventRepo.findOneOrFail({ where: { id: eventId } });
    const retryCount = event.retry_count + 1;

    if (retryCount >= event.max_retries) {
      await this.markDeadLetter(event, error);
      return;
    }

    // Exponential backoff: 2^retryCount minutes
    const backoffMs = Math.pow(2, retryCount) * 60 * 1000;
    const processAfter = new Date(Date.now() + backoffMs);

    await this.eventRepo.update(eventId, {
      status: EventStatus.FAILED,
      retry_count: retryCount,
      error_message: error,
      process_after: processAfter,
    });
  }

  private async markDeadLetter(event: AppEvent, reason: string): Promise<void> {
    await this.eventRepo.update(event.id, {
      status: EventStatus.DEAD_LETTER,
      error_message: reason,
    });

    this.logger.error(
      `Event ${event.id} (${event.event_type}) moved to DEAD_LETTER: ${reason}`,
    );
    // TODO Phase 4: Send CloudWatch alarm + notify engineering team
  }

  private async sendToSqs(event: AppEvent): Promise<void> {
    const queueUrl = this.configService.get('aws.sqsQueueUrl');
    if (!queueUrl) {
      // Local development: process inline without SQS
      await this.processLocally(event);
      return;
    }

    try {
      await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({ event_id: event.id, event_type: event.event_type }),
          MessageGroupId: event.firm_id, // FIFO ordering per firm
          MessageDeduplicationId: event.idempotency_key,
        }),
      );
    } catch (error) {
      this.logger.warn(`SQS send failed, falling back to local processing: ${error}`);
      await this.processLocally(event);
    }
  }

  /** Local processing for development — processes consumers directly */
  private async processLocally(event: AppEvent): Promise<void> {
    const consumers = this.consumers.get(event.event_type) ?? [];

    if (consumers.length === 0) {
      await this.markProcessed(event.id);
      return;
    }

    for (const consumer of consumers) {
      try {
        await consumer.handle(event);
      } catch (error) {
        this.logger.error(`Consumer failed for event ${event.id}:`, error);
        await this.markFailed(event.id, String(error));
        return;
      }
    }

    await this.markProcessed(event.id);
  }
}
