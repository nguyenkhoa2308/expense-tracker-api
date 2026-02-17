import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { PaginationQueryDto, PaginatedResponseDto, StatsQueryDto } from '../common/dto';

@Injectable()
export class IncomeService {
  constructor(private prisma: PrismaService) {}

  create(userId: string, dto: CreateIncomeDto) {
    return this.prisma.income.create({
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : new Date(),
        userId,
      },
    });
  }

  findAllByUser(userId: string) {
    return this.prisma.income.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  async findPaginated(userId: string, query: PaginationQueryDto) {
    const { page = 1, limit = 10, search, category, sortBy = 'date', sortOrder = 'desc', dateFrom, dateTo, amountMin, amountMax } = query;

    const where: Prisma.IncomeWhereInput = { userId };

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
      this.prisma.income.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.income.count({ where }),
    ]);

    return new PaginatedResponseDto(data, total, page, limit);
  }

  findOne(id: string, userId: string) {
    return this.prisma.income.findFirst({
      where: { id, userId },
    });
  }

  update(id: string, userId: string, dto: UpdateIncomeDto) {
    return this.prisma.income.updateMany({
      where: { id, userId },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  remove(id: string, userId: string) {
    return this.prisma.income.deleteMany({
      where: { id, userId },
    });
  }

  // Statistics
  async getStats(userId: string, query?: StatsQueryDto) {
    const where: Prisma.IncomeWhereInput = { userId };

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

    const incomes = await this.prisma.income.findMany({ where });

    const total = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const byCategory = incomes.reduce(
      (acc, i) => {
        acc[i.category] = (acc[i.category] || 0) + Number(i.amount);
        return acc;
      },
      {} as Record<string, number>,
    );

    return { total, byCategory, count: incomes.length };
  }

  async exportCsv(userId: string, query?: StatsQueryDto): Promise<string> {
    const where: Prisma.IncomeWhereInput = { userId };

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

    const incomes = await this.prisma.income.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const header = 'Ngày,Danh mục,Mô tả,Số tiền';
    const rows = incomes.map((i) => {
      const date = new Date(i.date).toLocaleDateString('vi-VN');
      const desc = (i.description || '').replace(/"/g, '""');
      return `${date},${i.category},"${desc}",${Number(i.amount)}`;
    });

    return [header, ...rows].join('\n');
  }
}
