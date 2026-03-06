import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateGoalDto {
  @ApiProperty({ example: 50000, description: 'Số tiền mục tiêu' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ example: 'Mua điện thoại mới', description: 'Mô tả mục tiêu' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: '2025-12-31',
    description: 'Ngày hoàn thành mục tiêu',
  })
  @IsNotEmpty()
  @IsDateString()
  deadline: string;

  @ApiProperty({ example: '50000', description: 'Số tiền ban đầu' })
  @IsOptional()
  @IsNumber()
  initialAmount?: number;
}
