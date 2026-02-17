import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @ApiProperty({ example: 'Budget Alert' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'You have spent 80% of your monthly budget' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
