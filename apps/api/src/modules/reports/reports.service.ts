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

    // Fetch ALL entries for this ledger type (no date filter here — date filter applies to page window only)
    const allQb = this.ledgerRepo
      .createQueryBuilder('le')
      .where('le.firm_id = :firmId', { firmId })
      .andWhere('le.ledger_type = :type', { type: options.ledger_type })
      .orderBy('le.created_at', 'ASC');

    if (options.customer_id) allQb.andWhere('le.customer_id = :cid', { cid: options.customer_id });
    if (options.truck_id) allQb.andWhere('le.truck_id = :tid', { tid: options.truck_id });
    if (options.user_id) allQb.andWhere('le.user_id = :uid', { uid: options.user_id });

    // For date filter: fetch all entries without date range first (to compute correct running balance),
    // then apply date filter to determine the page window
    const allEntries = await allQb.getMany();

    // Build a map of computed running balance for every entry
    let running = new Decimal(0);
    const balanceMap = new Map<string, string>();
    for (const e of allEntries) {
      running = e.entry_type === EntryType.CREDIT
        ? running.plus(new Decimal(e.amount))
        : running.minus(new Decimal(e.amount));
      balanceMap.set(e.id, running.toFixed(2));
    }

    // Apply date filter — compare date strings (YYYY-MM-DD) to avoid timezone edge cases
    let filteredEntries = allEntries;
    if (options.from || options.to) {
      filteredEntries = allEntries.filter(e => {
        const d = new Date(e.created_at).toISOString().slice(0, 10);
        if (options.from && d < options.from) return false;
        if (options.to && d > options.to) return false;
        return true;
      });
    }

    const total = filteredEntries.length;
    const start = (page - 1) * limit;
    const pageEntries = filteredEntries.slice(start, start + limit);

    // Opening balance = balance just before first entry on this page
    const firstOnPage = pageEntries[0];
    let openingBalance = new Decimal(0);
    if (firstOnPage) {
      const idxInAll = allEntries.findIndex(e => e.id === firstOnPage.id);
      if (idxInAll > 0) {
        openingBalance = new Decimal(balanceMap.get(allEntries[idxInAll - 1].id) ?? '0');
      }
    }

    let totalCredits = new Decimal(0);
    let totalDebits = new Decimal(0);

    // Inject computed balance_after into each page entry (overrides stored 0.00)
    const enriched = pageEntries.map(e => {
      const computed = balanceMap.get(e.id) ?? '0.00';
      if (e.entry_type === EntryType.CREDIT) totalCredits = totalCredits.plus(new Decimal(e.amount));
      else totalDebits = totalDebits.plus(new Decimal(e.amount));
      return { ...e, balance_after: computed };
    });

    const closingBalance = enriched.length > 0
      ? new Decimal(enriched[enriched.length - 1].balance_after)
      : openingBalance;

    return {
      entries: enriched as any,
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

  /** Generate CSV for KC list — supports single date or date range */
  async exportKcsCsv(firmId: string, dateFrom: string, dateTo: string): Promise<string> {
    const dateCondition = dateFrom === dateTo
      ? `kc.sale_date = '${dateFrom}'`
      : `kc.sale_date BETWEEN '${dateFrom}' AND '${dateTo}'`;

    const kcs = await this.kcRepo
      .createQueryBuilder('kc')
      .leftJoinAndSelect('kc.line_items', 'li')
      .where('kc.firm_id = :firmId', { firmId })
      .andWhere('kc.status = :status', { status: KCStatus.AUTHORIZED })
      .andWhere(dateCondition)
      .orderBy('kc.sale_date', 'ASC')
      .addOrderBy('kc.kc_number', 'ASC')
      .getMany();

    // Fetch customer and truck names in bulk to avoid N+1
    const customerIds = [...new Set(kcs.map(k => k.customer_id).filter(Boolean))];
    const truckIds    = [...new Set(kcs.map(k => k.truck_id).filter(Boolean))];

    const customerMap = new Map<string, string>();
    const truckMap    = new Map<string, string>();

    if (customerIds.length > 0) {
      const rows: Array<{ id: string; name: string }> = await this.kcRepo.manager.query(
        `SELECT id, name FROM customers WHERE id = ANY($1::uuid[])`,
        [customerIds],
      );
      rows.forEach(r => customerMap.set(r.id, r.name));
    }

    if (truckIds.length > 0) {
      const rows: Array<{ id: string; truck_number: string }> = await this.kcRepo.manager.query(
        `SELECT id, truck_number FROM trucks WHERE id = ANY($1::uuid[])`,
        [truckIds],
      );
      rows.forEach(r => truckMap.set(r.id, r.truck_number));
    }

    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const header = 'KC Number,Sale Date,Customer Name,Truck Number,Gross Amount,Commission,APMC Fee,Baardana,Net Payable';
    const rows = kcs.map(kc => [
      kc.kc_number,
      kc.sale_date,
      customerMap.get(kc.customer_id) ?? kc.customer_id,
      truckMap.get(kc.truck_id ?? '') ?? kc.truck_id ?? '',
      kc.total_gross_amount,
      kc.total_commission,
      kc.total_apmc_fee,
      kc.total_baardana_cost,
      kc.total_net_payable,
    ].map(escape).join(','));

    return [header, ...rows].join('\n');
  }

  async exportTrucksCsv(firmId: string, dateFrom: string, dateTo: string): Promise<string> {
    const dateCondition = dateFrom === dateTo
      ? `t.sale_date = '${dateFrom}'`
      : `t.sale_date BETWEEN '${dateFrom}' AND '${dateTo}'`;

    const trucks = await this.truckRepo
      .createQueryBuilder('t')
      .where('t.firm_id = :firmId', { firmId })
      .andWhere(dateCondition)
      .orderBy('t.sale_date', 'ASC')
      .addOrderBy('t.created_at', 'ASC')
      .getMany();

    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const header = 'Truck Number,Driver,Produce,Status,Est. Weight (kg),Arrived Weight (kg),Actual Weight (kg),Variance (kg),Inam,Sale Date';
    const rows = trucks.map(t => [
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
    ].map(escape).join(','));

    return [header, ...rows].join('\n');
  }
}
