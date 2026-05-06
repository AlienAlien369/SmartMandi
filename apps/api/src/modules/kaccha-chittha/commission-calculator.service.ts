import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { CommissionConfig } from '../config/entities/commission-config.entity';
import { CommissionType, RoundingStrategy } from '../../common/enums';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface CommissionResult {
  amount: string;           // Computed commission in rupees (stored on KC)
  config_id: string;        // config snapshot ID (stored on KC — never recomputed)
  rounding_strategy: string;
}

@Injectable()
export class CommissionCalculatorService {
  /**
   * Calculate commission for a KC.
   * This value is STORED at authorization time and NEVER recomputed.
   *
   * Priority (resolved by ConfiguratorService before calling here):
   *   1. Truck-level commission config
   *   2. Firm-level commission config active at sale_date
   */
  calculate(
    grossAmount: string,
    totalWeightKg: string,
    config: CommissionConfig,
  ): CommissionResult {
    const gross = new Decimal(grossAmount);
    const weight = new Decimal(totalWeightKg);
    const rate = new Decimal(config.commission_value);

    let raw: Decimal;

    switch (config.commission_type) {
      case CommissionType.PERCENTAGE:
        raw = gross.mul(rate).div(100);
        break;
      case CommissionType.FIXED_PER_KG:
        raw = weight.mul(rate);
        break;
      case CommissionType.FIXED_PER_TRANSACTION:
        raw = rate;
        break;
    }

    // Apply min cap
    if (config.min_commission) {
      const min = new Decimal(config.min_commission);
      if (raw.lt(min)) raw = min;
    }

    // Apply max cap
    if (config.max_commission) {
      const max = new Decimal(config.max_commission);
      if (raw.gt(max)) raw = max;
    }

    // Apply rounding strategy
    const rounded = this.applyRounding(raw, config.rounding_strategy);

    return {
      amount: rounded.toFixed(2),
      config_id: config.id,
      rounding_strategy: config.rounding_strategy,
    };
  }

  private applyRounding(value: Decimal, strategy: RoundingStrategy): Decimal {
    switch (strategy) {
      case RoundingStrategy.ROUND_HALF_UP:
        return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      case RoundingStrategy.FLOOR:
        return value.toDecimalPlaces(2, Decimal.ROUND_FLOOR);
      case RoundingStrategy.CEIL:
        return value.toDecimalPlaces(2, Decimal.ROUND_CEIL);
      case RoundingStrategy.NONE:
        return value.toDecimalPlaces(2, Decimal.ROUND_DOWN);
    }
  }
}
