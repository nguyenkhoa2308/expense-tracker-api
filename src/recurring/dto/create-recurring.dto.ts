import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRecurringDto {
  @ApiProperty({ example: 'expense', enum: ['expense', 'income'] })
  @IsIn(['expense', 'income'])
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 50000, description: 'Amount in VND' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({ example: 'Tiền nhà hàng tháng' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'bills', description: 'Category' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    example: 'monthly',
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
  })
  @IsIn(['daily', 'weekly', 'monthly', 'yearly'])
  @IsNotEmpty()
  frequency: string;

  @ApiProperty({ example: '2026-03-01', description: 'Next execution date' })
  @IsDateString()
  @IsNotEmpty()
  nextDate: string;
}
