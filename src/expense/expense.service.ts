import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { PaginationQueryDto, PaginatedResponseDto, StatsQueryDto } from '../common/dto';

@Injectable()
export class ExpenseService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : new Date(),
        userId,
      },
    });
  }

  findAllByUser(userId: string) {
    return this.prisma.expense.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  async findPaginated(userId: string, query: PaginationQueryDto) {
    const { page = 1, limit = 10, search, category, sortBy = 'date', sortOrder = 'desc', dateFrom, dateTo, amountMin, amountMax } = query;

    const where: Prisma.ExpenseWhereInput = { userId };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        (where.date as Prisma.DateTimeFilter).gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        (where.date as Prisma.DateTimeFilter).lt = endDate;
      }
    }

    if (amountMin !== undefined || amountMax !== undefined) {
      where.amount = {};
      if (amountMin !== undefined) {
        (where.amount as Prisma.DecimalFilter).gte = amountMin;
      }
      if (amountMax !== undefined) {
        (where.amount as Prisma.DecimalFilter).lte = amountMax;
      }
    }

    const allowedSortFields = ['date', 'amount', 'category', 'createdAt'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'date';

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  findOne(id: string, userId: string) {
    return this.prisma.expense.findFirst({
      where: { id, userId },
    });
  }

  update(id: string, userId: string, dto: UpdateExpenseDto) {
    return this.prisma.expense.updateMany({
      where: { id, userId },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  remove(id: string, userId: string) {
    return this.prisma.expense.deleteMany({
      where: { id, userId },
    });
  }

  // Statistics
  async getStats(userId: string, query?: StatsQueryDto) {
    const where: Prisma.ExpenseWhereInput = { userId };

    if (query) {
      const { category, dateFrom, dateTo, amountMin, amountMax } = query;

      if (category) {
        where.category = category;
      }

      if (dateFrom || dateTo) {
        where.date = {};
        if (dateFrom) {
          (where.date as Prisma.DateTimeFilter).gte = new Date(dateFrom);
        }
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setDate(endDate.getDate() + 1);
          (where.date as Prisma.DateTimeFilter).lt = endDate;
        }
      }

      if (amountMin !== undefined || amountMax !== undefined) {
        where.amount = {};
        if (amountMin !== undefined) {
          (where.amount as Prisma.DecimalFilter).gte = amountMin;
        }
        if (amountMax !== undefined) {
          (where.amount as Prisma.DecimalFilter).lte = amountMax;
        }
      }
    }

    const expenses = await this.prisma.expense.findMany({ where });

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const byCategory = expenses.reduce(
      (acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
        return acc;
      },
      {} as Record<string, number>,
    );

    return { total, byCategory, count: expenses.length };
  }

  async exportCsv(userId: string, query?: StatsQueryDto): Promise<string> {
    const where: Prisma.ExpenseWhereInput = { userId };

    if (query) {
      const { category, dateFrom, dateTo, amountMin, amountMax } = query;
      if (category) where.category = category;
      if (dateFrom || dateTo) {
        where.date = {};
        if (dateFrom) (where.date as Prisma.DateTimeFilter).gte = new Date(dateFrom);
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setDate(endDate.getDate() + 1);
          (where.date as Prisma.DateTimeFilter).lt = endDate;
        }
      }
      if (amountMin !== undefined || amountMax !== undefined) {
        where.amount = {};
        if (amountMin !== undefined) (where.amount as Prisma.DecimalFilter).gte = amountMin;
        if (amountMax !== undefined) (where.amount as Prisma.DecimalFilter).lte = amountMax;
      }
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const header = 'Ngày,Danh mục,Mô tả,Số tiền';
    const rows = expenses.map((e) => {
      const date = new Date(e.date).toLocaleDateString('vi-VN');
      const desc = (e.description || '').replace(/"/g, '""');
      return `${date},${e.category},"${desc}",${Number(e.amount)}`;
    });

    return [header, ...rows].join('\n');
  }
}
