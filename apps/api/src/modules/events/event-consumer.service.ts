import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import { LedgerEntry } from '../ledger/ledger-entry.entity';
import { KacchaChittha } from '../kaccha-chittha/entities/kaccha-chittha.entity';
import { DashboardService } from '../dashboard/dashboard.service';
import { LedgerType, EntryType, SourceType, KCStatus } from '../../common/enums';

/**
 * EventConsumerService handles all domain event side-effects.
 *
 * Rules:
 *  - KC_AUTHORIZED: dashboard metric update
 *  - KC_CANCELLED (was AUTHORIZED): write reversal ledger entries
 *  - TRUCK_CLOSED: write inam ledger entry, update dashboard
 *
 * In local dev (no SQS), these are called inline by the event-store mock.
 * In production, triggered by SQS message polling.
 */
@Injectable()
export class EventConsumerService {
  private readonly logger = new Logger(EventConsumerService.name);

  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(KacchaChittha)
    private readonly kcRepo: Repository<KacchaChittha>,
    private readonly dataSource: DataSource,
    private readonly dashboardService: DashboardService,
  ) {}

  async handleKcAuthorized(payload: {
    kc_id: string;
    firm_id: string;
    sale_date: string;
  }): Promise<void> {
    this.logger.log(`KC_AUTHORIZED consumer: ${payload.kc_id}`);
    // Recompute dashboard metrics for the sale date
    await this.dashboardService.computeAndSave(payload.firm_id, payload.sale_date);
  }

  async handleKcCancelled(payload: {
    kc_id: string;
    firm_id: string;
    sale_date: string;
    gross_amount: string;
    commission_amount: string;
    apmc_fee_amount: string;
    net_payable: string;
    customer_id: string;
    cancelled_by: string;
  }): Promise<void> {
    this.logger.log(`KC_CANCELLED consumer — writing reversals for KC ${payload.kc_id}`);

    const kc = await this.kcRepo.findOne({
      where: { id: payload.kc_id, firm_id: payload.firm_id },
    });

    if (!kc || kc.status !== KCStatus.CANCELLED) {
      this.logger.warn(`KC ${payload.kc_id} not found or not CANCELLED — skipping reversal`);
      return;
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await qr.query(`SET LOCAL app.current_firm_id = '${payload.firm_id}'`);

      const groupId = uuidv4();
      const base = `reversal-${payload.kc_id}`;

      const reversals: Partial<LedgerEntry>[] = [
        // Reverse CUSTOMER CREDIT → CUSTOMER DEBIT
        {
          firm_id: payload.firm_id,
          ledger_type: LedgerType.CUSTOMER,
          entry_type: EntryType.DEBIT,
          amount: new Decimal(payload.gross_amount).toFixed(2),
          balance_after: '0.00',
          source_type: SourceType.REVERSAL,
          entry_group_id: groupId,
          description: `Reversal for cancelled KC ${payload.kc_id}`,
          idempotency_key: `${base}-customer-reversal`,
          created_by: payload.cancelled_by,
          customer_id: payload.customer_id,
        },
        // Reverse FIRM_CASH CREDIT (commission) → FIRM_CASH DEBIT
        {
          firm_id: payload.firm_id,
          ledger_type: LedgerType.FIRM_CASH,
          entry_type: EntryType.DEBIT,
          amount: new Decimal(payload.commission_amount).toFixed(2),
          balance_after: '0.00',
          source_type: SourceType.REVERSAL,
          entry_group_id: groupId,
          description: `Commission reversal for cancelled KC ${payload.kc_id}`,
          idempotency_key: `${base}-commission-reversal`,
          created_by: payload.cancelled_by,
        },
        // Reverse FIRM_CASH DEBIT (APMC) → FIRM_CASH CREDIT
        {
          firm_id: payload.firm_id,
          ledger_type: LedgerType.FIRM_CASH,
          entry_type: EntryType.CREDIT,
          amount: new Decimal(payload.apmc_fee_amount).toFixed(2),
          balance_after: '0.00',
          source_type: SourceType.REVERSAL,
          entry_group_id: groupId,
          description: `APMC fee reversal for cancelled KC ${payload.kc_id}`,
          idempotency_key: `${base}-apmc-reversal`,
          created_by: payload.cancelled_by,
        },
      ];

      for (const reversal of reversals) {
        // Idempotency check
        const existing = await qr.manager.findOne(LedgerEntry, {
          where: { idempotency_key: reversal.idempotency_key },
        });
        if (!existing) {
          await qr.manager.save(LedgerEntry, qr.manager.create(LedgerEntry, reversal));
        }
      }

      await qr.commitTransaction();
      this.logger.log(`Reversal entries written for KC ${payload.kc_id}`);

      // Update dashboard
      await this.dashboardService.computeAndSave(payload.firm_id, payload.sale_date);
    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error(`Reversal failed for KC ${payload.kc_id}`, err);
      throw err;
    } finally {
      await qr.release();
    }
  }

  async handleTruckClosed(payload: {
    truck_id: string;
    firm_id: string;
    sale_date: string;
    inam_amount: string;
    closed_by: string;
    gross_amount: string;
  }): Promise<void> {
    this.logger.log(`TRUCK_CLOSED consumer: ${payload.truck_id}`);

    const inam = new Decimal(payload.inam_amount);
    if (inam.gt(0)) {
      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();

      try {
        await qr.query(`SET LOCAL app.current_firm_id = '${payload.firm_id}'`);

        const idempotencyKey = `inam-${payload.truck_id}`;
        const existing = await qr.manager.findOne(LedgerEntry, {
          where: { idempotency_key: idempotencyKey },
        });

        if (!existing) {
          await qr.manager.save(
            LedgerEntry,
            qr.manager.create(LedgerEntry, {
              firm_id: payload.firm_id,
              ledger_type: LedgerType.FIRM_CASH,
              entry_type: EntryType.DEBIT,
              amount: inam.toFixed(2),
              balance_after: '0.00',
              source_type: SourceType.INAM_PAID,
              entry_group_id: uuidv4(),
              description: `Inam paid on truck close ${payload.truck_id}`,
              idempotency_key: idempotencyKey,
              created_by: payload.closed_by,
              truck_id: payload.truck_id,
            }),
          );
        }

        await qr.commitTransaction();
        this.logger.log(`Inam ledger entry written for truck ${payload.truck_id}`);
      } catch (err) {
        await qr.rollbackTransaction();
        this.logger.error(`Inam write failed for truck ${payload.truck_id}`, err);
        throw err;
      } finally {
        await qr.release();
      }
    }

    // Update dashboard
    await this.dashboardService.computeAndSave(payload.firm_id, payload.sale_date);
  }
}
