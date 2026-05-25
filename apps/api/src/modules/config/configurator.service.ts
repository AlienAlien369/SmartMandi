import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull, Or } from 'typeorm';
import { ConfigVersion } from './entities/config-version.entity';
import { GradeConfig } from './entities/grade-config.entity';
import { ApmcFeeConfig } from './entities/apmc-fee-config.entity';
import { CommissionConfig } from './entities/commission-config.entity';
import { BaardanaConfig } from './entities/baardana-config.entity';
import { PaymentModeConfig } from './entities/payment-mode-config.entity';
import { ProduceConfig } from './entities/produce-config.entity';
import { ConfigScope } from '../../common/enums';

@Injectable()
export class ConfiguratorService {
  private readonly logger = new Logger(ConfiguratorService.name);

  constructor(
    @InjectRepository(ConfigVersion) private readonly configVersionRepo: Repository<ConfigVersion>,
    @InjectRepository(GradeConfig) private readonly gradeRepo: Repository<GradeConfig>,
    @InjectRepository(ApmcFeeConfig) private readonly apmcRepo: Repository<ApmcFeeConfig>,
    @InjectRepository(CommissionConfig) private readonly commissionRepo: Repository<CommissionConfig>,
    @InjectRepository(BaardanaConfig) private readonly baardanaRepo: Repository<BaardanaConfig>,
    @InjectRepository(PaymentModeConfig) private readonly paymentModeRepo: Repository<PaymentModeConfig>,
    @InjectRepository(ProduceConfig) private readonly produceRepo: Repository<ProduceConfig>,
  ) {}

  async getActiveProduces(firmId: string): Promise<ProduceConfig[]> {
    return this.produceRepo.find({
      where: { firm_id: firmId, is_active: true },
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async getAllProducesForFirm(firmId: string): Promise<ProduceConfig[]> {
    return this.produceRepo.find({
      where: { firm_id: firmId },
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async createProduceForFirm(firmId: string, dto: { name: string; sort_order?: number }): Promise<ProduceConfig> {
    const existing = await this.produceRepo.findOne({ where: { firm_id: firmId, name: dto.name.trim() } });
    if (existing) {
      // Re-activate if it was disabled
      existing.is_active = true;
      return this.produceRepo.save(existing);
    }
    const produce = this.produceRepo.create({
      firm_id: firmId,
      name: dto.name.trim(),
      sort_order: dto.sort_order ?? 0,
      is_active: true,
    });
    return this.produceRepo.save(produce);
  }

  async toggleProduceForFirm(firmId: string, produceId: string): Promise<ProduceConfig> {
    const produce = await this.produceRepo.findOne({ where: { id: produceId, firm_id: firmId } });
    if (!produce) throw new NotFoundException('Produce not found');
    produce.is_active = !produce.is_active;
    return this.produceRepo.save(produce);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIG VERSION RESOLUTION
  // Rule: always use config active AT the given date (effective_from <= date <= effective_to)
  // ─────────────────────────────────────────────────────────────────────────────

  async getActiveConfigVersion(firmId: string): Promise<ConfigVersion> {
    const version = await this.configVersionRepo.findOne({
      where: { firm_id: firmId, is_active: true },
      order: { effective_from: 'DESC' },
    });
    if (!version) throw new NotFoundException(`No active config version for firm ${firmId}`);
    return version;
  }

  /**
   * Resolve the APMC fee config active at a specific date.
   * Used at KC authorization time — config must match sale_date, not current date.
   */
  async resolveApmcFeeConfig(firmId: string, atDate: Date): Promise<ApmcFeeConfig> {
    const config = await this.apmcRepo
      .createQueryBuilder('a')
      .where('a.firm_id = :firmId', { firmId })
      .andWhere('a.effective_from <= :atDate', { atDate })
      .andWhere('(a.effective_to IS NULL OR a.effective_to >= :atDate)', { atDate })
      .orderBy('a.effective_from', 'DESC')
      .getOne();

    if (!config) {
      throw new NotFoundException(
        `No APMC fee config found for firm ${firmId} on ${atDate.toISOString().slice(0, 10)}`,
      );
    }
    return config;
  }

  /**
   * Resolve the commission config at a date.
   * Priority: truck-level override → firm-level.
   */
  async resolveCommissionConfig(
    firmId: string,
    atDate: Date,
    truckCommissionConfigId?: string | null,
  ): Promise<CommissionConfig> {
    // Priority 1: truck-level override (looked up by ID directly)
    if (truckCommissionConfigId) {
      const truckConfig = await this.commissionRepo.findOne({
        where: { id: truckCommissionConfigId, firm_id: firmId },
      });
      if (truckConfig) return truckConfig;
    }

    // Priority 2: firm-level config active at sale_date
    const firmConfig = await this.commissionRepo
      .createQueryBuilder('c')
      .where('c.firm_id = :firmId', { firmId })
      .andWhere('c.scope = :scope', { scope: ConfigScope.FIRM })
      .andWhere('c.effective_from <= :atDate', { atDate })
      .andWhere('(c.effective_to IS NULL OR c.effective_to >= :atDate)', { atDate })
      .orderBy('c.effective_from', 'DESC')
      .getOne();

    if (!firmConfig) {
      throw new NotFoundException(
        `No commission config found for firm ${firmId} on ${atDate.toISOString().slice(0, 10)}`,
      );
    }
    return firmConfig;
  }

  async resolveBaardanaConfig(firmId: string, atDate: Date): Promise<BaardanaConfig | null> {
    return this.baardanaRepo
      .createQueryBuilder('b')
      .where('b.firm_id = :firmId', { firmId })
      .andWhere('b.effective_from <= :atDate', { atDate })
      .andWhere('(b.effective_to IS NULL OR b.effective_to >= :atDate)', { atDate })
      .orderBy('b.effective_from', 'DESC')
      .getOne();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GRADE CONFIGS
  // ─────────────────────────────────────────────────────────────────────────────

  async getActiveGrades(firmId: string): Promise<GradeConfig[]> {
    const cv = await this.getActiveConfigVersion(firmId);
    return this.gradeRepo.find({
      where: { firm_id: firmId, config_version_id: cv.id, is_active: true },
      order: { sort_order: 'ASC' },
    });
  }

  async getGradeById(gradeId: string, firmId: string): Promise<GradeConfig> {
    const grade = await this.gradeRepo.findOne({ where: { id: gradeId, firm_id: firmId } });
    if (!grade) throw new NotFoundException(`Grade ${gradeId} not found`);
    return grade;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GRADE CONFIG (SUPER ADMIN CRUD)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Get or auto-create the active config version for a firm (for SA grade ops). */
  private async getOrCreateConfigVersion(firmId: string): Promise<ConfigVersion> {
    const existing = await this.configVersionRepo.findOne({
      where: { firm_id: firmId, is_active: true },
      order: { effective_from: 'DESC' },
    });
    if (existing) return existing;

    const last = await this.configVersionRepo.findOne({
      where: { firm_id: firmId },
      order: { version: 'DESC' },
    });
    const cv = this.configVersionRepo.create({
      firm_id: firmId,
      version: (last?.version ?? 0) + 1,
      effective_from: new Date(),
      effective_to: null,
      is_active: true,
      created_by: null,
    });
    return this.configVersionRepo.save(cv);
  }

  /** SA: List all grades for a firm (active + inactive), ordered by sort_order. */
  async getAllGradesForFirm(firmId: string): Promise<GradeConfig[]> {
    return this.gradeRepo.find({
      where: { firm_id: firmId },
      order: { sort_order: 'ASC' },
    });
  }

  /** SA: Create a new grade for a firm under its active config version. */
  async createGradeForFirm(
    firmId: string,
    dto: { grade_code: string; grade_label: string; sort_order?: number },
  ): Promise<GradeConfig> {
    const cv = await this.getOrCreateConfigVersion(firmId);
    const code = dto.grade_code.trim().toUpperCase();

    const duplicate = await this.gradeRepo.findOne({ where: { firm_id: firmId, grade_code: code } });
    if (duplicate) throw new BadRequestException(`Grade code "${code}" already exists for this firm`);

    // Auto-assign sort_order as max + 1 if not provided
    let sortOrder = dto.sort_order;
    if (sortOrder == null) {
      const grades = await this.gradeRepo.find({ where: { firm_id: firmId }, order: { sort_order: 'DESC' }, take: 1 });
      sortOrder = (grades[0]?.sort_order ?? 0) + 1;
    }

    const grade = this.gradeRepo.create({
      firm_id: firmId,
      config_version_id: cv.id,
      grade_code: code,
      grade_label: dto.grade_label.trim(),
      description: null,
      sort_order: sortOrder,
      is_active: true,
    });
    return this.gradeRepo.save(grade);
  }

  /** SA: Update an existing grade's code, label, or sort_order. */
  async updateGradeForFirm(
    firmId: string,
    gradeId: string,
    dto: { grade_code?: string; grade_label?: string; sort_order?: number },
  ): Promise<GradeConfig> {
    const grade = await this.gradeRepo.findOne({ where: { id: gradeId, firm_id: firmId } });
    if (!grade) throw new NotFoundException(`Grade ${gradeId} not found`);

    if (dto.grade_code !== undefined) {
      const code = dto.grade_code.trim().toUpperCase();
      if (code !== grade.grade_code) {
        const dup = await this.gradeRepo.findOne({ where: { firm_id: firmId, grade_code: code } });
        if (dup) throw new BadRequestException(`Grade code "${code}" already exists`);
      }
      grade.grade_code = code;
    }
    if (dto.grade_label !== undefined) grade.grade_label = dto.grade_label.trim();
    if (dto.sort_order !== undefined) grade.sort_order = dto.sort_order;

    return this.gradeRepo.save(grade);
  }

  /** SA: Toggle a grade active/inactive (soft delete). */
  async toggleGradeActive(firmId: string, gradeId: string): Promise<GradeConfig> {
    const grade = await this.gradeRepo.findOne({ where: { id: gradeId, firm_id: firmId } });
    if (!grade) throw new NotFoundException(`Grade ${gradeId} not found`);
    grade.is_active = !grade.is_active;
    return this.gradeRepo.save(grade);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAYMENT MODES
  // ─────────────────────────────────────────────────────────────────────────────

  async getActivePaymentModes(firmId: string): Promise<PaymentModeConfig[]> {
    return this.paymentModeRepo.find({
      where: { firm_id: firmId, is_active: true },
    });
  }

  async getPaymentModeById(modeId: string, firmId: string): Promise<PaymentModeConfig> {
    const mode = await this.paymentModeRepo.findOne({ where: { id: modeId, firm_id: firmId } });
    if (!mode) throw new NotFoundException(`Payment mode ${modeId} not found`);
    return mode;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIG VERSION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  async createNewVersion(firmId: string, createdBy: string): Promise<ConfigVersion> {
    // Close current active version
    await this.configVersionRepo.update(
      { firm_id: firmId, is_active: true },
      { effective_to: new Date(), is_active: false },
    );

    const lastVersion = await this.configVersionRepo.findOne({
      where: { firm_id: firmId },
      order: { version: 'DESC' },
    });

    const newVersion = this.configVersionRepo.create({
      firm_id: firmId,
      version: (lastVersion?.version ?? 0) + 1,
      effective_from: new Date(),
      effective_to: null,
      is_active: true,
      created_by: createdBy,
    });

    return this.configVersionRepo.save(newVersion);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUPER ADMIN — APMC FEE CONFIG MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  async getApmcFeeConfigForFirm(firmId: string): Promise<ApmcFeeConfig | null> {
    return this.apmcRepo
      .createQueryBuilder('a')
      .where('a.firm_id = :firmId', { firmId })
      .andWhere('a.effective_to IS NULL')
      .orderBy('a.effective_from', 'DESC')
      .getOne();
  }

  async upsertApmcFeeConfig(
    firmId: string,
    dto: { fee_type: string; fee_value: number; min_fee?: number | null; max_fee?: number | null },
    saId: string,
  ): Promise<ApmcFeeConfig> {
    // Ensure a config version exists
    let cv = await this.configVersionRepo.findOne({ where: { firm_id: firmId, is_active: true } });
    if (!cv) {
      cv = await this.configVersionRepo.save(
        this.configVersionRepo.create({ firm_id: firmId, version: 1, effective_from: new Date(), effective_to: null, is_active: true, created_by: saId }),
      );
    }

    // Close all open configs for this firm
    await this.apmcRepo
      .createQueryBuilder()
      .update(ApmcFeeConfig)
      .set({ effective_to: new Date() })
      .where('firm_id = :firmId AND effective_to IS NULL', { firmId })
      .execute();

    const newConfig = this.apmcRepo.create({
      firm_id: firmId,
      config_version_id: cv.id,
      fee_type: dto.fee_type as any,
      fee_value: dto.fee_value.toString(),
      discount_type: null,
      discount_value: '0',
      min_fee: dto.min_fee != null ? dto.min_fee.toString() : null,
      max_fee: dto.max_fee != null ? dto.max_fee.toString() : null,
      effective_from: new Date(),
      effective_to: null,
    });

    return this.apmcRepo.save(newConfig);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUPER ADMIN — BAARDANA CONFIG MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  async getBaardanaConfigForFirm(firmId: string): Promise<BaardanaConfig | null> {
    return this.baardanaRepo
      .createQueryBuilder('b')
      .where('b.firm_id = :firmId', { firmId })
      .andWhere('b.effective_to IS NULL')
      .orderBy('b.effective_from', 'DESC')
      .getOne();
  }

  async upsertBaardanaConfig(
    firmId: string,
    dto: {
      cost_per_unit: number;
      unit_label?: string;
      baardana_provider: 'FIRM' | 'CUSTOMER';
      default_bags: number;
      rate_mode?: 'PER_KG' | 'PER_NAG';
    },
    saId: string,
  ): Promise<BaardanaConfig> {
    let cv = await this.configVersionRepo.findOne({ where: { firm_id: firmId, is_active: true } });
    if (!cv) {
      cv = await this.configVersionRepo.save(
        this.configVersionRepo.create({ firm_id: firmId, version: 1, effective_from: new Date(), effective_to: null, is_active: true, created_by: saId }),
      );
    }

    // Close all open baardana configs for this firm
    await this.baardanaRepo
      .createQueryBuilder()
      .update(BaardanaConfig)
      .set({ effective_to: new Date() })
      .where('firm_id = :firmId AND effective_to IS NULL', { firmId })
      .execute();

    const newConfig = this.baardanaRepo.create({
      firm_id: firmId,
      config_version_id: cv.id,
      cost_per_unit: dto.cost_per_unit.toString(),
      unit_label: dto.unit_label ?? 'bag',
      baardana_provider: dto.baardana_provider,
      default_bags: dto.default_bags,
      rate_mode: dto.rate_mode ?? 'PER_KG',
      effective_from: new Date(),
      effective_to: null,
    });

    return this.baardanaRepo.save(newConfig);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUPER ADMIN — COMMISSION CONFIG MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  async getCommissionConfigForFirm(firmId: string): Promise<CommissionConfig | null> {
    return this.commissionRepo
      .createQueryBuilder('c')
      .where('c.firm_id = :firmId', { firmId })
      .andWhere('c.scope = :scope', { scope: ConfigScope.FIRM })
      .andWhere('c.effective_to IS NULL')
      .orderBy('c.effective_from', 'DESC')
      .getOne();
  }

  async upsertCommissionConfig(
    firmId: string,
    dto: {
      commission_type: string;
      commission_value: number;
      rounding_strategy?: string;
      min_commission?: number | null;
      max_commission?: number | null;
    },
    saId: string,
  ): Promise<CommissionConfig> {
    // Ensure a config version exists
    let cv = await this.configVersionRepo.findOne({ where: { firm_id: firmId, is_active: true } });
    if (!cv) {
      cv = await this.configVersionRepo.save(
        this.configVersionRepo.create({ firm_id: firmId, version: 1, effective_from: new Date(), effective_to: null, is_active: true, created_by: saId }),
      );
    }

    // Close all open FIRM-scope commission configs
    await this.commissionRepo
      .createQueryBuilder()
      .update(CommissionConfig)
      .set({ effective_to: new Date() })
      .where("firm_id = :firmId AND scope = 'FIRM' AND effective_to IS NULL", { firmId })
      .execute();

    const newConfig = this.commissionRepo.create({
      firm_id: firmId,
      config_version_id: cv.id,
      scope: ConfigScope.FIRM,
      scope_ref_id: null,
      commission_type: dto.commission_type as any,
      commission_value: dto.commission_value.toString(),
      rounding_strategy: (dto.rounding_strategy ?? 'ROUND_HALF_UP') as any,
      min_commission: dto.min_commission != null ? dto.min_commission.toString() : null,
      max_commission: dto.max_commission != null ? dto.max_commission.toString() : null,
      effective_from: new Date(),
      effective_to: null,
    });

    return this.commissionRepo.save(newConfig);
  }
}
