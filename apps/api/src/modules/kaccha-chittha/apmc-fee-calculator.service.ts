import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { ApmcFeeConfig } from '../config/entities/apmc-fee-config.entity';
import { FeeType } from '../../common/enums';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface ApmcFeeResult {
  amount: string;    // Computed fee in rupees
  config_id: string; // snapshot ID stored on KC
}

@Injectable()
export class ApmcFeeCalculatorService {
  /**
   * Calculate APMC fee for a KC.
   * Stored at authorization time — never recomputed after.
   */
  calculate(
    grossAmount: string,
    totalWeightKg: string,
    config: ApmcFeeConfig,
  ): ApmcFeeResult {
    const gross = new Decimal(grossAmount);
    const weight = new Decimal(totalWeightKg);
    const feeValue = new Decimal(config.fee_value);

    let raw: Decimal;

    switch (config.fee_type) {
      case FeeType.PERCENTAGE:
        raw = gross.mul(feeValue).div(100);
        break;
      case FeeType.FIXED_PER_KG:
        raw = weight.mul(feeValue);
        break;
      case FeeType.FIXED_PER_TRANSACTION:
        raw = feeValue;
        break;
    }

    // Apply discount
    if (config.discount_type && config.discount_type !== 'NONE') {
      const discountValue = new Decimal(config.discount_value);
      if (config.discount_type === 'PERCENTAGE') {
        raw = raw.mul(new Decimal(1).minus(discountValue.div(100)));
      } else if (config.discount_type === 'FLAT') {
        raw = raw.minus(discountValue);
        if (raw.lt(0)) raw = new Decimal(0);
      }
    }

    // Apply min cap
    if (config.min_fee) {
      const min = new Decimal(config.min_fee);
      if (raw.lt(min)) raw = min;
    }

    // Apply max cap
    if (config.max_fee) {
      const max = new Decimal(config.max_fee);
      if (raw.gt(max)) raw = max;
    }

    return {
      amount: raw.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
      config_id: config.id,
    };
  }

  /**
   * Net payable formula (Section 5.4):
   * net_payable = gross - apmc_fee - commission
   * Baardana cost is tracked separately (firm profit analytics), NOT deducted from customer payable.
   */
  static computeNetPayable(
    grossAmount: string,
    apmcFee: string,
    commission: string,
  ): string {
    return new Decimal(grossAmount)
      .minus(new Decimal(apmcFee))
      .minus(new Decimal(commission))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toFixed(2);
  }
}
