import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString,
  IsUUID, IsNumberString, MinLength, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TruckStatus } from '../../../common/enums';

export class CreateTruckDto {
  @ApiProperty({ example: 'RJ14GB0001' })
  @IsString() @IsNotEmpty() @MinLength(4) @MaxLength(20)
  truck_number: string;

  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  driver_name: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional() @IsString() @MaxLength(15)
  driver_phone?: string;

  @ApiProperty({ example: 'Wheat' })
  @IsString() @IsNotEmpty() @MaxLength(100)
  produce_name: string;

  @ApiProperty({ example: '2025-01-15' })
  @IsDateString()
  sale_date: string;

  @ApiPropertyOptional({ example: '15000.000' })
  @IsOptional() @IsNumberString()
  estimated_weight_kg?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  customer_id?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  commission_config_id?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class MarkArrivedDto {
  @ApiProperty({ example: '14850.000', description: 'Weight measured at entry gate' })
  @IsNumberString()
  arrived_weight_kg: string;
}

export class CloseTruckDto {
  @ApiProperty({ example: '14720.500', description: 'Final actual weighed amount' })
  @IsNumberString()
  actual_weight_kg: string;

  @ApiProperty({ example: '450.00', description: 'Rate per kg for this truck' })
  @IsNumberString()
  rate_per_kg: string;

  @ApiPropertyOptional({ example: '500.00', description: 'Inam (incentive) to driver' })
  @IsOptional() @IsNumberString()
  inam_amount?: string;
}

export class TruckFiltersDto {
  @ApiPropertyOptional({ enum: TruckStatus })
  @IsOptional() @IsEnum(TruckStatus)
  status?: TruckStatus;

  /** Exact date (legacy — still supported) */
  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  date?: string;

  /** Date range start (YYYY-MM-DD) */
  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  date_from?: string;

  /** Date range end (YYYY-MM-DD) */
  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  date_to?: string;

  /** Search across truck_number, driver_name, driver_phone, produce_name */
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  customer_id?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: '20' })
  @IsOptional()
  limit?: number;
}
