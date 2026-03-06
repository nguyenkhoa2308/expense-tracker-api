import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class CreateContributionDto {
  @ApiProperty({ example: 500000, description: 'Số tiền nạp' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;
}
