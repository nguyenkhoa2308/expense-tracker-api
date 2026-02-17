import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GmailService } from './gmail.service';
import { AiParserService } from './ai-parser.service';
import { EmailSyncService } from './email-sync.service';
import { EmailSyncController } from './email-sync.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [EmailSyncController],
  providers: [GmailService, AiParserService, EmailSyncService],
  exports: [EmailSyncService],
})
export class EmailSyncModule {}
