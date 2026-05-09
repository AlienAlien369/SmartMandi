import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';

const UUID_MSG = { message: '$property must be a UUID' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  @Matches(UUID_RE, UUID_MSG)
  source_id: string;

  @ApiProperty()
  @Matches(UUID_RE, UUID_MSG)
  entry_group_id: string;

  @ApiProperty({ required: false })
  @Matches(UUID_RE, UUID_MSG)
  @IsOptional()
  customer_id?: string;

  @ApiProperty({ required: false })
  @Matches(UUID_RE, UUID_MSG)
  @IsOptional()
  truck_id?: string;

  @ApiProperty({ required: false })
  @Matches(UUID_RE, UUID_MSG)
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
