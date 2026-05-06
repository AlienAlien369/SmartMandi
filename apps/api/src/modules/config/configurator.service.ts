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
  ) {}

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
}
