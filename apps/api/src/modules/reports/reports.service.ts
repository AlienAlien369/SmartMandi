import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { LedgerEntry } from '../ledger/ledger-entry.entity';
import { KacchaChittha } from '../kaccha-chittha/entities/kaccha-chittha.entity';
import { Truck } from '../trucks/truck.entity';
import { LedgerType, EntryType, KCStatus } from '../../common/enums';

export interface LedgerReport {
  entries: LedgerEntry[];
  opening_balance: string;
  closing_balance: string;
  total_credits: string;
  total_debits: string;
  meta: { total: number; page: number; limit: number };
}

export interface CashFlowReport {
  date: string;
  inflow: string;
  outflow: string;
  net: string;
  items: Array<{ source: string; amount: string; type: 'inflow' | 'outflow' }>;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(KacchaChittha)
    private readonly kcRepo: Repository<KacchaChittha>,
    @InjectRepository(Truck)
    private readonly truckRepo: Repository<Truck>,
  ) {}

  async getLedgerReport(
    firmId: string,
    options: {
      ledger_type: LedgerType;
      customer_id?: string;
      truck_id?: string;
      user_id?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<LedgerReport> {
    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.min(Math.max(1, Number(options.limit || 50)), 200);

    const qb = this.ledgerRepo
      .createQueryBuilder('le')
      .where('le.firm_id = :firmId', { firmId })
      .andWhere('le.ledger_type = :type', { type: options.ledger_type })
      .orderBy('le.created_at', 'ASC');

    if (options.customer_id) qb.andWhere('le.customer_id = :cid', { cid: options.customer_id });
    if (options.truck_id) qb.andWhere('le.truck_id = :tid', { tid: options.truck_id });
    if (options.user_id) qb.andWhere('le.user_id = :uid', { uid: options.user_id });
    if (options.from) qb.andWhere('le.created_at >= :from', { from: options.from });
    if (options.to) qb.andWhere('le.created_at <= :to', { to: options.to });

    const allEntries = await qb.getMany();
    const total = allEntries.length;

    let totalCredits = new Decimal(0);
    let totalDebits = new Decimal(0);
    let openingBalance = new Decimal(0);

    // Compute opening balance before page window
    const start = (page - 1) * limit;
    for (let i = 0; i < start && i < allEntries.length; i++) {
      const e = allEntries[i];
      if (e.entry_type === EntryType.CREDIT) openingBalance = openingBalance.plus(new Decimal(e.amount));
      else openingBalance = openingBalance.minus(new Decimal(e.amount));
    }

    const pageEntries = allEntries.slice(start, start + limit);
    for (const e of pageEntries) {
      if (e.entry_type === EntryType.CREDIT) totalCredits = totalCredits.plus(new Decimal(e.amount));
      else totalDebits = totalDebits.plus(new Decimal(e.amount));
    }

    const closingBalance = openingBalance.plus(totalCredits).minus(totalDebits);

    return {
      entries: pageEntries,
      opening_balance: openingBalance.toFixed(2),
      closing_balance: closingBalance.toFixed(2),
      total_credits: totalCredits.toFixed(2),
      total_debits: totalDebits.toFixed(2),
      meta: { total, page, limit },
    };
  }

  async getCashFlowReport(firmId: string, from: string, to: string): Promise<CashFlowReport[]> {
    const entries = await this.ledgerRepo
      .createQueryBuilder('le')
      .where('le.firm_id = :firmId', { firmId })
      .andWhere('le.ledger_type = :type', { type: LedgerType.FIRM_CASH })
      .andWhere('le.created_at >= :from', { from })
      .andWhere('le.created_at <= :to', { to })
      .orderBy('le.created_at', 'ASC')
      .getMany();

    // Group by date
    const byDate = new Map<string, LedgerEntry[]>();
    for (const e of entries) {
      const d = e.created_at.toISOString().slice(0, 10);
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(e);
    }

    return Array.from(byDate.entries()).map(([date, dayEntries]) => {
      let inflow = new Decimal(0);
      let outflow = new Decimal(0);
      const items: CashFlowReport['items'] = [];

      for (const e of dayEntries) {
        if (e.entry_type === EntryType.CREDIT) {
          inflow = inflow.plus(new Decimal(e.amount));
          items.push({ source: e.source_type, amount: e.amount, type: 'inflow' });
        } else {
          outflow = outflow.plus(new Decimal(e.amount));
          items.push({ source: e.source_type, amount: e.amount, type: 'outflow' });
        }
      }

      return {
        date,
        inflow: inflow.toFixed(2),
        outflow: outflow.toFixed(2),
        net: inflow.minus(outflow).toFixed(2),
        items,
      };
    });
  }

  /** Generate CSV for KC list */
  async exportKcsCsv(firmId: string, date: string): Promise<string> {
    const kcs = await this.kcRepo
      .createQueryBuilder('kc')
      .leftJoinAndSelect('kc.line_items', 'li')
      .where('kc.firm_id = :firmId', { firmId })
      .andWhere('kc.sale_date = :date', { date })
      .andWhere('kc.status = :status', { status: KCStatus.AUTHORIZED })
      .orderBy('kc.kc_number', 'ASC')
      .getMany();

    const header = 'KC Number,Customer,Truck,Gross,Commission,APMC Fee,Net Payable,Baardana,Date';
    const rows = kcs.map(kc =>
      [
        kc.kc_number,
        kc.customer_id,
        kc.truck_id ?? '',
        kc.total_gross_amount,
        kc.total_commission,
        kc.total_apmc_fee,
        kc.total_net_payable,
        kc.total_baardana_cost,
        kc.sale_date,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  async exportTrucksCsv(firmId: string, date: string): Promise<string> {
    const trucks = await this.truckRepo
      .createQueryBuilder('t')
      .where('t.firm_id = :firmId', { firmId })
      .andWhere('t.sale_date = :date', { date })
      .orderBy('t.created_at', 'ASC')
      .getMany();

    const header = 'Truck Number,Driver,Produce,Status,Estimated Weight,Arrived Weight,Actual Weight,Variance,Inam,Sale Date';
    const rows = trucks.map(t =>
      [
        t.truck_number,
        t.driver_name,
        t.produce_name,
        t.status,
        t.estimated_weight_kg ?? '',
        t.arrived_weight_kg ?? '',
        t.actual_weight_kg ?? '',
        t.weight_variance_kg ?? '',
        t.inam_amount,
        t.sale_date,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }
}
