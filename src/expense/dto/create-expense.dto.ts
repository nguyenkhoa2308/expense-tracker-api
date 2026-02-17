import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 50000, description: 'Amount in VND' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({ example: 'Lunch at office' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'food', description: 'Expense category' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ example: '2025-12-10' })
  @IsDateString()
  @IsOptional()
  date?: string;
}
