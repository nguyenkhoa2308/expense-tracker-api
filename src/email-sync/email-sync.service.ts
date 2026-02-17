import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GmailService } from './gmail.service';
import { AiParserService } from './ai-parser.service';

@Injectable()
export class EmailSyncService {
  private readonly logger = new Logger(EmailSyncService.name);

  constructor(
    private prisma: PrismaService,
    private gmail: GmailService,
    private aiParser: AiParserService,
  ) {}

  // Run every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncAllUsers() {
    this.logger.log('Starting email sync for all users...');

    const users = await this.prisma.user.findMany({
      where: { gmailConnected: true },
      select: { id: true, email: true },
    });

    for (const user of users) {
      try {
        await this.syncUserEmails(user.id);
      } catch (error) {
        this.logger.error(`Failed to sync emails for user ${user.id}:`, error);
      }
    }

    this.logger.log(`Email sync completed for ${users.length} users`);
  }

  // Sync emails for a single user
  async syncUserEmails(userId: string): Promise<number> {
    const emails = await this.gmail.fetchBankEmails(userId);
    let created = 0;

    for (const email of emails) {
      try {
        // Parse email with AI
        const parsed = await this.aiParser.parseEmailContent(
          email.body,
          email.subject,
        );

        if (!parsed || parsed.type !== 'expense') {
          // Mark as synced but don't create expense (not a transaction or is income)
          await this.gmail.markAsSynced(userId, email);
          continue;
        }

        // Create expense
        await this.prisma.expense.create({
          data: {
            userId,
            amount: parsed.amount,
            description: parsed.description,
            category: parsed.category,
            date: new Date(parsed.date),
            source: 'email',
            emailId: email.messageId,
          },
        });

        // Mark email as synced
        await this.gmail.markAsSynced(userId, email);
        created++;

        this.logger.log(
          `Created expense from email: ${parsed.amount} - ${parsed.description}`,
        );
      } catch (error) {
        this.logger.error(`Failed to process email ${email.messageId}:`, error);
      }
    }

    return created;
  }

  // Manual sync trigger
  async manualSync(userId: string): Promise<{ synced: number }> {
    const synced = await this.syncUserEmails(userId);
    return { synced };
  }
}
