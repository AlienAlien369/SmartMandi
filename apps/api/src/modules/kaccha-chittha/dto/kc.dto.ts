import {
  IsString, IsNotEmpty, IsUUID, IsOptional, IsArray,
  ValidateNested, IsNumber, IsPositive, Min, IsEnum,
  IsDateString, IsBoolean, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { BaardanaSource } from '../../../common/enums';

export class CreateLineItemDto {
  @ApiProperty() @IsUUID() grade_config_id: string;
  @ApiProperty() @IsNumber() @Min(1) quantity_bags: number;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() weight_per_bag_kg?: number;
  @ApiProperty({ description: 'Total weight in kg' }) @IsNumber() @IsPositive() total_weight_kg: number;
  @ApiProperty({ description: 'Rate per kg in rupees' }) @IsNumber() @IsPositive() rate_per_kg: number;
  @ApiProperty({ enum: BaardanaSource }) @IsEnum(BaardanaSource) baardana_source: BaardanaSource;
  @ApiProperty({ default: 0 }) @IsNumber() @Min(0) baardana_quantity: number;
  @ApiProperty({ required: false }) @IsNumber() @IsOptional() sort_order?: number;
}

export class CreateKCDto {
  @ApiProperty() @IsUUID() customer_id: string;
  @ApiProperty({ required: false }) @IsUUID() @IsOptional() truck_id?: string;
  @ApiProperty({ example: '2025-01-15' }) @IsDateString() sale_date: string;
  @ApiProperty({ type: [CreateLineItemDto] })
  @IsArray() @ValidateNested({ each: true }) @ArrayMinSize(1) @Type(() => CreateLineItemDto)
  line_items: CreateLineItemDto[];
  @ApiProperty() @IsString() @IsNotEmpty() idempotency_key: string;
}

export class AddPaymentDto {
  @ApiProperty() @IsUUID() payment_mode_id: string;
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
