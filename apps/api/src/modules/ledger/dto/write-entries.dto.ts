import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { LedgerType, EntryType, SourceType } from '../../../common/enums';

export class LedgerEntryDto {
  @ApiProperty({ enum: LedgerType })
  @IsEnum(LedgerType)
  ledger_type: LedgerType;

  @ApiProperty({ enum: EntryType })
  @IsEnum(EntryType)
  entry_type: EntryType;

  /** Amount in rupees as string (use Decimal.js — no floats) */
  @ApiProperty({ example: '1250.50' })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({ enum: SourceType })
  @IsEnum(SourceType)
  source_type: SourceType;

  @ApiProperty()
  @IsUUID()
  source_id: string;

  @ApiProperty()
  @IsUUID()
  entry_group_id: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  customer_id?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  truck_id?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  user_id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idempotency_key: string;
}

export class WriteEntriesDto {
  @ApiProperty({ type: [LedgerEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(2)
  @Type(() => LedgerEntryDto)
  entries: LedgerEntryDto[];
}
