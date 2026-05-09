import {
  IsString, IsNotEmpty, IsOptional, IsArray, Matches,
  ValidateNested, IsNumber, IsPositive, Min, IsEnum,
  IsDateString, IsBoolean, ArrayMinSize,
} from 'class-validator';

const UUID_MSG = { message: '$property must be a UUID' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BaardanaSource } from '../../../common/enums';

export class CreateLineItemDto {
  @ApiProperty() @Matches(UUID_RE, UUID_MSG) grade_config_id: string;
  @ApiProperty() @IsNumber() @Min(1) quantity_bags: number;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() weight_per_bag_kg?: number;
  @ApiProperty({ description: 'Total weight in kg (0 for PER_NAG mode)' }) @IsNumber() @Min(0) total_weight_kg: number;
  @ApiProperty({ description: 'Rate per kg, or rate per nag when rate_mode=PER_NAG' }) @IsNumber() @IsPositive() rate_per_kg: number;
  @ApiProperty({ enum: BaardanaSource }) @IsEnum(BaardanaSource) baardana_source: BaardanaSource;
  @ApiProperty({ default: 0 }) @IsNumber() @Min(0) baardana_quantity: number;
  @ApiProperty({ required: false, enum: ['PER_KG', 'PER_NAG'] }) @IsOptional() rate_mode?: 'PER_KG' | 'PER_NAG';
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() sort_order?: number;
}

export class CreateKCDto {
  @ApiProperty() @Matches(UUID_RE, UUID_MSG) customer_id: string;
  @ApiProperty({ required: false }) @Matches(UUID_RE, UUID_MSG) @IsOptional() truck_id?: string;
  @ApiProperty({ example: '2025-01-15' }) @IsDateString() sale_date: string;
  @ApiProperty({ type: [CreateLineItemDto] })
  @IsArray() @ValidateNested({ each: true }) @ArrayMinSize(1) @Type(() => CreateLineItemDto)
  line_items: CreateLineItemDto[];
  @ApiProperty() @IsString() @IsNotEmpty() idempotency_key: string;
}

export class AddPaymentDto {
  @ApiProperty() @Matches(UUID_RE, UUID_MSG) payment_mode_id: string;
  @ApiProperty({ description: 'Amount in rupees' }) @IsNumber() @IsPositive() amount: number;
  @ApiProperty({ required: false }) @IsString() @IsOptional() payment_reference?: string;
  @ApiProperty({ example: '2025-01-15' }) @IsDateString() payment_date: string;
  @ApiProperty({ required: false }) @IsBoolean() @IsOptional() is_udhar?: boolean;
  @ApiProperty({ required: false }) @IsDateString() @IsOptional() udhar_due_date?: string;
  @ApiProperty({ required: false }) @IsString() @IsOptional() notes?: string;
  @ApiProperty() @IsString() @IsNotEmpty() idempotency_key: string;
}

export class AuthorizeKCDto {
  @ApiProperty({ required: false }) @IsString() @IsOptional() notes?: string;
}

export class CancelKCDto {
  @ApiProperty({ description: 'Reason for cancellation is mandatory' })
  @IsString() @IsNotEmpty()
  reason: string;
}

export class UpdateLineItemsDto {
  @ApiProperty({ type: [CreateLineItemDto] })
  @IsArray() @ValidateNested({ each: true }) @ArrayMinSize(1) @Type(() => CreateLineItemDto)
  line_items: CreateLineItemDto[];
}
