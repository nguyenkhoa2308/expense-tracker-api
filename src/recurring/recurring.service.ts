import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';

@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateRecurringDto) {
    // Parse date as local midnight to avoid timezone issues
    const [y, m, d] = dto.nextDate.split('-').map(Number);
    let nextDate = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // If nextDate is today or in the past, create all missed transactions and advance
    while (nextDate <= today) {
      const createData = {
        amount: Number(dto.amount),
        description: dto.description,
        category: dto.category,
        date: nextDate,
        source: 'recurring',
        userId,
      };

      if (dto.type === 'expense') {
        await this.prisma.expense.create({ data: createData });
      } else {
        await this.prisma.income.create({ data: createData });
      }

      nextDate = this.advanceDate(nextDate, dto.frequency);
    }

    return this.prisma.recurringTransaction.create({
      data: {
        ...dto,
        nextDate,
        userId,
      },
    });
  }

  findAllByUser(userId: string) {
    return this.prisma.recurringTransaction.findMany({
      where: { userId },
      orderBy: { nextDate: 'asc' },
    });
  }

  findOne(id: string, userId: string) {
    return this.prisma.recurringTransaction.findFirst({
      where: { id, userId },
    });
  }

  update(id: string, userId: string, dto: UpdateRecurringDto) {
    return this.prisma.recurringTransaction.updateMany({
      where: { id, userId },
      data: {
        ...dto,
        nextDate: dto.nextDate ? new Date(dto.nextDate) : undefined,
      },
    });
  }

  async toggleActive(id: string, userId: string) {
    const item = await this.prisma.recurringTransaction.findFirst({
      where: { id, userId },
    });
    if (!item) return null;

    return this.prisma.recurringTransaction.update({
      where: { id },
      data: { isActive: !item.isActive },
    });
  }

  remove(id: string, userId: string) {
    return this.prisma.recurringTransaction.deleteMany({
      where: { id, userId },
    });
  }

  private advanceDate(date: Date, frequency: string): Date {
    const next = new Date(date);
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
    return next;
  }

  /**
   * Cron job: every day at 1AM, check all active recurring transactions
   * where nextDate <= today. Creates ALL missed transactions (catch-up)
   * and advances nextDate to the next future date.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async processRecurring() {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    const dueItems = await this.prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        nextDate: { lte: now },
      },
    });

    this.logger.log(`Processing ${dueItems.length} recurring transactions`);

    for (const item of dueItems) {
      try {
        let currentDate = new Date(item.nextDate);
        let count = 0;

        // Loop: create transactions for every missed date until nextDate > now
        while (currentDate <= now) {
          const createData = {
            amount: item.amount,
            description: item.description,
            category: item.category,
            date: currentDate,
            source: 'recurring',
            userId: item.userId,
          };

          if (item.type === 'expense') {
            await this.prisma.expense.create({ data: createData });
          } else {
            await this.prisma.income.create({ data: createData });
          }

          count++;
          currentDate = this.advanceDate(currentDate, item.frequency);
        }

        // currentDate is now the next future date
        await this.prisma.recurringTransaction.update({
          where: { id: item.id },
          data: { nextDate: currentDate },
        });

        this.logger.log(
          `Created ${count} ${item.type}(s) "${item.description || item.category}" for user ${item.userId}, next: ${currentDate.toISOString()}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process recurring ${item.id}: ${error.message}`,
        );
      }
    }
  }
}
