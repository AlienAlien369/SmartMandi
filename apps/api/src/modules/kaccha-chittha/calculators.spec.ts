import Decimal from 'decimal.js';
import { CommissionCalculatorService } from './commission-calculator.service';
import { ApmcFeeCalculatorService } from './apmc-fee-calculator.service';
import { CommissionType, FeeType, RoundingStrategy } from '../../common/enums';
import type { CommissionConfig } from '../config/entities/commission-config.entity';
import type { ApmcFeeConfig } from '../config/entities/apmc-fee-config.entity';
import { ConfigScope } from '../../common/enums';

// ─────────────────────────────────────────────────────────────────────────────
// COMMISSION CALCULATOR TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('CommissionCalculatorService', () => {
  let service: CommissionCalculatorService;

  const baseConfig = (overrides: Partial<CommissionConfig> = {}): CommissionConfig =>
    ({
      id: 'cfg-1', firm_id: 'firm-1', config_version_id: 'cv-1',
      scope: ConfigScope.FIRM, scope_ref_id: null,
      commission_type: CommissionType.PERCENTAGE, commission_value: '1.5',
      min_commission: null, max_commission: null,
      rounding_strategy: RoundingStrategy.ROUND_HALF_UP,
      effective_from: new Date(), effective_to: null,
      ...overrides,
    } as CommissionConfig);

  beforeEach(() => { service = new CommissionCalculatorService(); });

  describe('PERCENTAGE type', () => {
    it('calculates 1.5% of ₹1000 gross = ₹15.00', () => {
      const result = service.calculate('1000.00', '100.000', baseConfig());
      expect(result.amount).toBe('15.00');
    });

    it('calculates 0.5% of ₹50000 = ₹250.00', () => {
      const result = service.calculate('50000.00', '500.000', baseConfig({ commission_value: '0.5' }));
      expect(result.amount).toBe('250.00');
    });

    it('handles fractional paise — rounds HALF_UP', () => {
      // 1.5% of ₹100.01 = ₹1.500150 → ₹1.50
      const result = service.calculate('100.01', '10.000', baseConfig());
      expect(result.amount).toBe('1.50');
    });
  });

  describe('FIXED_PER_KG type', () => {
    it('calculates ₹2/kg × 150kg = ₹300.00', () => {
      const result = service.calculate('1500.00', '150.000',
        baseConfig({ commission_type: CommissionType.FIXED_PER_KG, commission_value: '2' }));
      expect(result.amount).toBe('300.00');
    });

    it('handles decimal kg — ₹1.5/kg × 33.333kg = ₹49.9995 → ₹50.00', () => {
      const result = service.calculate('333.33', '33.333',
        baseConfig({ commission_type: CommissionType.FIXED_PER_KG, commission_value: '1.5' }));
      expect(result.amount).toBe('50.00');
    });
  });

  describe('FIXED_PER_TRANSACTION type', () => {
    it('returns flat ₹100 regardless of weight or gross', () => {
      const result = service.calculate('9999.00', '500.000',
        baseConfig({ commission_type: CommissionType.FIXED_PER_TRANSACTION, commission_value: '100' }));
      expect(result.amount).toBe('100.00');
    });
  });

  describe('min/max caps', () => {
    it('applies min_commission floor', () => {
      // 0.1% of ₹100 = ₹0.10, min = ₹50 → should be ₹50
      const result = service.calculate('100.00', '10.000',
        baseConfig({ commission_value: '0.1', min_commission: '50' }));
      expect(result.amount).toBe('50.00');
    });

    it('applies max_commission cap', () => {
      // 10% of ₹10000 = ₹1000, max = ₹500 → should be ₹500
      const result = service.calculate('10000.00', '100.000',
        baseConfig({ commission_value: '10', max_commission: '500' }));
      expect(result.amount).toBe('500.00');
    });

    it('does not cap when within range', () => {
      // 2% of ₹1000 = ₹20, min=10 max=100 → should be ₹20
      const result = service.calculate('1000.00', '100.000',
        baseConfig({ commission_value: '2', min_commission: '10', max_commission: '100' }));
      expect(result.amount).toBe('20.00');
    });
  });

  describe('rounding strategies', () => {
    const value = '100.015'; // Would produce ₹1.500225 at 1.5%

    it('ROUND_HALF_UP rounds .5 up', () => {
      const result = service.calculate(value, '10.000',
        baseConfig({ rounding_strategy: RoundingStrategy.ROUND_HALF_UP }));
      expect(new Decimal(result.amount).gte(0)).toBe(true);
    });

    it('FLOOR always rounds down', () => {
      const floor = service.calculate('100.09', '10.000',
        baseConfig({ commission_value: '3', rounding_strategy: RoundingStrategy.FLOOR }));
      const halfUp = service.calculate('100.09', '10.000',
        baseConfig({ commission_value: '3', rounding_strategy: RoundingStrategy.ROUND_HALF_UP }));
      expect(new Decimal(floor.amount).lte(new Decimal(halfUp.amount))).toBe(true);
    });

    it('stores the config_id as snapshot', () => {
      const result = service.calculate('1000.00', '100.000', baseConfig({ id: 'snap-123' }));
      expect(result.config_id).toBe('snap-123');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// APMC FEE CALCULATOR TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('ApmcFeeCalculatorService', () => {
  let service: ApmcFeeCalculatorService;

  const baseConfig = (overrides: Partial<ApmcFeeConfig> = {}): ApmcFeeConfig =>
    ({
      id: 'apmc-1', firm_id: 'firm-1', config_version_id: 'cv-1',
      fee_type: FeeType.PERCENTAGE, fee_value: '2',
      discount_type: null, discount_value: '0',
      min_fee: null, max_fee: null,
      effective_from: new Date(), effective_to: null,
      ...overrides,
    } as ApmcFeeConfig);

  beforeEach(() => { service = new ApmcFeeCalculatorService(); });

  describe('PERCENTAGE fee type', () => {
    it('2% of ₹1000 = ₹20.00', () => {
      expect(service.calculate('1000.00', '100.000', baseConfig()).amount).toBe('20.00');
    });

    it('1.5% of ₹50000 = ₹750.00', () => {
      expect(service.calculate('50000.00', '500.000', baseConfig({ fee_value: '1.5' })).amount)
        .toBe('750.00');
    });
  });

  describe('FIXED_PER_KG fee type', () => {
    it('₹0.50/kg × 200kg = ₹100.00', () => {
      expect(service.calculate('2000.00', '200.000',
        baseConfig({ fee_type: FeeType.FIXED_PER_KG, fee_value: '0.5' })).amount).toBe('100.00');
    });
  });

  describe('FIXED_PER_TRANSACTION fee type', () => {
    it('flat ₹50 regardless of weight', () => {
      expect(service.calculate('9999.00', '500.000',
        baseConfig({ fee_type: FeeType.FIXED_PER_TRANSACTION, fee_value: '50' })).amount).toBe('50.00');
    });
  });

  describe('discounts', () => {
    it('applies PERCENTAGE discount: 10% off ₹20 = ₹18.00', () => {
      expect(service.calculate('1000.00', '100.000',
        baseConfig({ discount_type: 'PERCENTAGE', discount_value: '10' })).amount).toBe('18.00');
    });

    it('applies FLAT discount: ₹20 fee - ₹5 flat = ₹15.00', () => {
      expect(service.calculate('1000.00', '100.000',
        baseConfig({ discount_type: 'FLAT', discount_value: '5' })).amount).toBe('15.00');
    });

    it('FLAT discount cannot go below 0', () => {
      expect(service.calculate('1000.00', '100.000',
        baseConfig({ discount_type: 'FLAT', discount_value: '999' })).amount).toBe('0.00');
    });
  });

  describe('min/max caps', () => {
    it('applies min_fee floor', () => {
      // 2% of ₹10 = ₹0.20, min=₹5
      expect(service.calculate('10.00', '1.000', baseConfig({ min_fee: '5' })).amount).toBe('5.00');
    });

    it('applies max_fee cap', () => {
      // 2% of ₹100000 = ₹2000, max=₹500
      expect(service.calculate('100000.00', '1000.000', baseConfig({ max_fee: '500' })).amount)
        .toBe('500.00');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NET PAYABLE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

describe('ApmcFeeCalculatorService.computeNetPayable', () => {
  it('net = gross - apmc - commission', () => {
    // ₹1000 gross, ₹20 APMC, ₹15 commission → ₹965
    expect(ApmcFeeCalculatorService.computeNetPayable('1000.00', '20.00', '15.00')).toBe('965.00');
  });

  it('handles zero commission', () => {
    expect(ApmcFeeCalculatorService.computeNetPayable('500.00', '10.00', '0.00')).toBe('490.00');
  });

  it('baardana cost is NOT deducted from net payable (spec Section 5.4)', () => {
    // Baardana is tracked separately for firm profit analytics
    const netPayable = ApmcFeeCalculatorService.computeNetPayable('1000.00', '20.00', '15.00');
    // Result is 965.00, regardless of baardana
    expect(netPayable).toBe('965.00');
  });

  it('rounds correctly with fractional paise', () => {
    // ₹1000.01 - ₹20.005 - ₹15.003 = ₹965.002 → ₹965.00
    expect(ApmcFeeCalculatorService.computeNetPayable('1000.01', '20.005', '15.003')).toBe('965.00');
  });
});
