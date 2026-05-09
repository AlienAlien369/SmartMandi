import {
  IsString, IsNotEmpty, IsOptional, IsDateString, IsNumberString, MaxLength, IsEnum, Matches,
  ValidateIf,
} from 'class-validator';

const UUID_MSG = { message: '$property must be a UUID' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FreightType } from '../../../common/enums';

/** SALARY type requires user_id. INAM/KIRAYA/PARCHI require truck_id. */
export class CreateSalaryEntryDto {
  @ApiPropertyOptional({ description: 'User ID of employee being paid (required for SALARY)' })
  @ValidateIf(o => o.freight_type === FreightType.SALARY || !o.freight_type)
  @Matches(UUID_RE, UUID_MSG) @IsNotEmpty()
  user_id?: string;

  @ApiPropertyOptional({ description: 'Truck ID for driver payment (required for INAM/KIRAYA/PARCHI)' })
  @ValidateIf(o => o.freight_type && o.freight_type !== FreightType.SALARY)
  @Matches(UUID_RE, UUID_MSG) @IsNotEmpty()
  truck_id?: string;

  @ApiProperty({ example: '2025-01-15' })
  @IsDateString()
  salary_date: string;

  @ApiProperty({ example: '15000.00' })
  @IsNumberString()
  amount: string;

  @ApiPropertyOptional({ enum: FreightType, default: FreightType.SALARY })
  @IsOptional() @IsEnum(FreightType)
  freight_type?: FreightType;

  @ApiPropertyOptional({ description: 'Notes or description for this freight entry' })
  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}
