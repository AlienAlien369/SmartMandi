import {
  Injectable, Logger, NotFoundException,
  BadRequestException, ConflictException, InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { Truck } from './truck.entity';
import { PurchaseEntry } from './purchase-entry.entity';
import { CreateTruckDto, MarkArrivedDto, CloseTruckDto, TruckFiltersDto } from './dto/truck.dto';
import { TruckStatus, LedgerType, EntryType, SourceType, AuditAction, EntityType } from '../../common/enums';
import { EventStoreService } from '../events/event-store.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TrucksService {
  private readonly logger = new Logger(TrucksService.name);

  constructor(
    @InjectRepository(Truck)
    private readonly truckRepo: Repository<Truck>,
    @InjectRepository(PurchaseEntry)
    private readonly purchaseRepo: Repository<PurchaseEntry>,
    private readonly dataSource: DataSource,
    private readonly eventStore: EventStoreService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateTruckDto, firmId: string, userId: string): Promise<Truck> {
    const truck = this.truckRepo.create({
      ...dto,
      firm_id: firmId,
      status: TruckStatus.SCHEDULED,
      created_by: userId,
    });
    const saved = await this.truckRepo.save(truck);

    await this.auditService.log({
      firm_id: firmId,
      entity: EntityType.TRUCK,
      entity_id: saved.id,
      action: AuditAction.CREATE,
      new_value: saved as unknown as Record<string, unknown>,
      changed_by: userId,
    });

    await this.eventStore.publish({
      event_type: 'TRUCK_SCHEDULED',
      aggregate_type: 'TRUCK',
      firm_id: firmId,
      aggregate_id: saved.id,
      payload: { truck_number: saved.truck_number, sale_date: saved.sale_date },
    });

    this.logger.log(`Truck ${saved.truck_number} scheduled (${saved.id})`);
    return saved;
  }

  async findAll(firmId: string, filters: TruckFiltersDto = {}): Promise<{ data: Truck[]; meta: object }> {
    const page = Number(filters.page ?? 1);
    const limit = Math.min(Number(filters.limit ?? 20), 100);

    const qb = this.truckRepo.createQueryBuilder('t')
      .where('t.firm_id = :firmId', { firmId })
      .orderBy('t.sale_date', 'DESC')
      .addOrderBy('t.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.status) qb.andWhere('t.status = :status', { status: filters.status });

    // Exact date takes priority over date range
    if (filters.date) {
      qb.andWhere('t.sale_date = :date', { date: filters.date });
    } else {
      if (filters.date_from) qb.andWhere('t.sale_date >= :date_from', { date_from: filters.date_from });
      if (filters.date_to)   qb.andWhere('t.sale_date <= :date_to',   { date_to:   filters.date_to   });
    }

    if (filters.search) {
      const term = `%${filters.search.trim()}%`;
      qb.andWhere(
        '(t.truck_number ILIKE :term OR t.driver_name ILIKE :term OR t.driver_phone ILIKE :term OR t.produce_name ILIKE :term)',
        { term },
      );
    }

    if (filters.customer_id) qb.andWhere('t.customer_id = :cid', { cid: filters.customer_id });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, firmId: string): Promise<Truck & { purchase_entries?: PurchaseEntry[] }> {
    const truck = await this.truckRepo.findOne({ where: { id, firm_id: firmId } });
    if (!truck) throw new NotFoundException(`Truck ${id} not found`);

    const purchase_entries = await this.purchaseRepo.find({ where: { truck_id: id, firm_id: firmId } });
    return { ...truck, purchase_entries };
  }

  /**
   * SCHEDULED → ARRIVED
   * Auto-creates an estimated PurchaseEntry on arrival.
   */
  async markArrived(id: string, dto: MarkArrivedDto, firmId: string, userId: string): Promise<Truck> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await qr.query(`SET LOCAL app.current_firm_id = '${firmId}'`);

      const truck = await qr.manager.findOne(Truck, {
        where: { id, firm_id: firmId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!truck) throw new NotFoundException(`Truck ${id} not found`);
      if (truck.status !== TruckStatus.SCHEDULED) {
        throw new BadRequestException(`Truck must be SCHEDULED to mark as ARRIVED (current: ${truck.status})`);
      }

      truck.status = TruckStatus.ARRIVED;
      truck.arrived_weight_kg = dto.arrived_weight_kg;
      truck.arrived_at = new Date();

      await qr.manager.save(Truck, truck);

      // Auto-create estimated purchase entry (rate=0, will be set at CLOSED)
      const estimated = qr.manager.create(PurchaseEntry, {
        firm_id: firmId,
        truck_id: id,
        purchase_date: truck.sale_date,
        weight_kg: dto.arrived_weight_kg,
        rate_per_kg: '0.0000',
        total_amount: '0.00',
        is_estimated: true,
        created_by: userId,
        idempotency_key: `arrive-${id}`,
      });
      await qr.manager.save(PurchaseEntry, estimated);

      await qr.commitTransaction();

      await this.auditService.log({
        firm_id: firmId,
        entity: EntityType.TRUCK,
        entity_id: id,
        action: AuditAction.UPDATE,
        new_value: { status: 'ARRIVED', arrived_weight_kg: dto.arrived_weight_kg },
        changed_by: userId,
      });

      await this.eventStore.publish({
        event_type: 'TRUCK_ARRIVED',
        aggregate_type: 'TRUCK',
        firm_id: firmId,
        aggregate_id: id,
        payload: { arrived_weight_kg: dto.arrived_weight_kg, sale_date: truck.sale_date },
      });

      this.logger.log(`Truck ${id} marked ARRIVED`);
      return truck;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /**
   * ARRIVED → CLOSED
   * Finalizes actual weight, computes variance, writes inam ledger entry.
   */
  async closeTruck(id: string, dto: CloseTruckDto, firmId: string, userId: string): Promise<Truck> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction('SERIALIZABLE');

    try {
      await qr.query(`SET LOCAL app.current_firm_id = '${firmId}'`);

      const truck = await qr.manager.findOne(Truck, {
        where: { id, firm_id: firmId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!truck) throw new NotFoundException(`Truck ${id} not found`);
      if (truck.status !== TruckStatus.ARRIVED) {
        throw new BadRequestException(`Truck must be ARRIVED to close (current: ${truck.status})`);
      }

      const actualWeight = new Decimal(dto.actual_weight_kg);
      const arrivedWeight = new Decimal(truck.arrived_weight_kg ?? '0');
      const variance = arrivedWeight.minus(actualWeight);
      const grossAmount = actualWeight.times(new Decimal(dto.rate_per_kg));
      const inamAmount = new Decimal(dto.inam_amount ?? '0');

      truck.status = TruckStatus.CLOSED;
      truck.actual_weight_kg = actualWeight.toFixed(3);
      truck.inam_amount = inamAmount.toFixed(2);
      truck.closed_at = new Date();
      truck.closed_by = userId;

      await qr.manager.save(Truck, truck);

      // Update the estimated purchase entry to actual
      const estimatedEntry = await qr.manager.findOne(PurchaseEntry, {
        where: { truck_id: id, is_estimated: true, firm_id: firmId },
      });

      if (estimatedEntry) {
        estimatedEntry.weight_kg = actualWeight.toFixed(3);
        estimatedEntry.rate_per_kg = new Decimal(dto.rate_per_kg).toFixed(4);
        estimatedEntry.total_amount = grossAmount.toFixed(2);
        estimatedEntry.is_estimated = false;
        await qr.manager.save(PurchaseEntry, estimatedEntry);
      } else {
        // Create new entry if not found
        const entry = qr.manager.create(PurchaseEntry, {
          firm_id: firmId,
          truck_id: id,
          purchase_date: truck.sale_date,
          weight_kg: actualWeight.toFixed(3),
          rate_per_kg: new Decimal(dto.rate_per_kg).toFixed(4),
          total_amount: grossAmount.toFixed(2),
          is_estimated: false,
          created_by: userId,
          idempotency_key: `close-${id}`,
        });
        await qr.manager.save(PurchaseEntry, entry);
      }

      await qr.commitTransaction();

      // Publish TRUCK_CLOSED event — inam ledger entry written by event consumer
      await this.eventStore.publish({
        event_type: 'TRUCK_CLOSED',
        aggregate_type: 'TRUCK',
        firm_id: firmId,
        aggregate_id: id,
        payload: {
          actual_weight_kg: actualWeight.toFixed(3),
          weight_variance_kg: variance.toFixed(3),
          gross_amount: grossAmount.toFixed(2),
          inam_amount: inamAmount.toFixed(2),
          rate_per_kg: dto.rate_per_kg,
          sale_date: truck.sale_date,
          closed_by: userId,
        },
      });

      await this.auditService.log({
        firm_id: firmId,
        entity: EntityType.TRUCK,
        entity_id: id,
        action: AuditAction.AUTHORIZE,
        new_value: { status: 'CLOSED', actual_weight_kg: dto.actual_weight_kg, inam_amount: dto.inam_amount },
        changed_by: userId,
      });

      this.logger.log(`Truck ${id} CLOSED. Variance: ${variance.toFixed(3)} kg`);
      return truck;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  /** Delete a SCHEDULED truck (no financial records yet). */
  async delete(id: string, firmId: string, userId: string): Promise<void> {
    const truck = await this.truckRepo.findOne({ where: { id, firm_id: firmId } });
    if (!truck) throw new NotFoundException(`Truck ${id} not found`);
    if (truck.status !== TruckStatus.SCHEDULED) {
      throw new BadRequestException(`Only SCHEDULED trucks can be deleted (current: ${truck.status})`);
    }

    await this.truckRepo.delete({ id, firm_id: firmId });

    await this.auditService.log({
      firm_id: firmId,
      entity: EntityType.TRUCK,
      entity_id: id,
      action: AuditAction.DELETE,
      old_value: truck as unknown as Record<string, unknown>,
      changed_by: userId,
    });

    this.logger.log(`Truck ${id} deleted by ${userId}`);
  }
}
