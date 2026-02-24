import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateBudgetDto {
  @ApiProperty({ example: 'food', description: 'Expense category' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 2000000, description: 'Budget amount in VND' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ example: 2, description: 'Month (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ example: 2026, description: 'Year' })
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;
}
