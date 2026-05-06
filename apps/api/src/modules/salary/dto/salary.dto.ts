import {
  IsString, IsNotEmpty, IsOptional, IsDateString, IsNumberString, MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSalaryEntryDto {
  @ApiProperty({ description: 'User ID of the employee being paid' })
  @IsString() @IsNotEmpty()
  user_id: string;

  @ApiProperty({ example: '2025-01-15' })
  @IsDateString()
  salary_date: string;

  @ApiProperty({ example: '15000.00' })
  @IsNumberString()
  amount: string;

  @ApiPropertyOptional({ description: 'Notes or description for this salary entry' })
  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}
