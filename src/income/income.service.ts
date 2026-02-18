import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { join } from 'path';
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

  async exportPdf(userId: string, query?: StatsQueryDto): Promise<Buffer> {
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

    const total = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const byCategory: Record<string, number> = {};
    incomes.forEach((i) => {
      byCategory[i.category] = (byCategory[i.category] || 0) + Number(i.amount);
    });

    const formatVND = (n: number) =>
      new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

    const categoryLabels: Record<string, string> = {
      salary: 'Lương', freelance: 'Freelance', investment: 'Đầu tư',
      bonus: 'Thưởng', gift: 'Quà tặng', refund: 'Hoàn tiền', other: 'Khác',
    };

    const now = new Date();
    const monthLabel = query?.dateFrom
      ? `${new Date(query.dateFrom).toLocaleDateString('vi-VN')} - ${query.dateTo ? new Date(query.dateTo).toLocaleDateString('vi-VN') : 'nay'}`
      : `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;

    const fontRegular = join(process.cwd(), 'assets/fonts/Roboto-Regular.ttf');
    const fontBold = join(process.cwd(), 'assets/fonts/Roboto-Bold.ttf');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('Roboto', fontRegular);
      doc.registerFont('Roboto-Bold', fontBold);

      // Header accent line
      doc.rect(50, 40, 495, 4).fill('#27ae60');
      doc.moveDown(1.5);

      // Title
      doc.font('Roboto-Bold').fontSize(22).fillColor('#2c3e50')
        .text('BÁO CÁO THU NHẬP', { align: 'center' });
      doc.moveDown(0.3);
      doc.font('Roboto').fontSize(11).fillColor('#7f8c8d')
        .text(monthLabel, { align: 'center' });
      doc.moveDown(1.5);

      // Summary box
      const summaryTop = doc.y;
      const summaryH = incomes.length > 0 ? 80 : 65;
      doc.rect(50, summaryTop, 495, summaryH).fill('#f8f9fa');

      doc.font('Roboto-Bold').fontSize(13).fillColor('#2c3e50')
        .text('TỔNG QUAN', 70, summaryTop + 12);
      doc.moveTo(70, summaryTop + 30).lineTo(220, summaryTop + 30).stroke('#27ae60');

      doc.font('Roboto').fontSize(11).fillColor('#2c3e50');
      doc.text(`Tổng thu nhập:  ${formatVND(total)}`, 70, summaryTop + 38);
      doc.text(`Số giao dịch:  ${incomes.length}`, 300, summaryTop + 38);
      if (incomes.length > 0) {
        doc.text(`Trung bình/giao dịch:  ${formatVND(total / incomes.length)}`, 70, summaryTop + 56);
      }

      doc.y = summaryTop + summaryH + 10;
      doc.moveDown(0.8);

      // Category breakdown
      doc.font('Roboto-Bold').fontSize(13).fillColor('#2c3e50')
        .text('THU NHẬP THEO DANH MỤC');
      const catUnderY = doc.y;
      doc.moveTo(50, catUnderY).lineTo(240, catUnderY).stroke('#27ae60');
      doc.moveDown(0.5);

      doc.font('Roboto').fontSize(11);
      const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
      const catColors = ['#27ae60', '#2ecc71', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#95a5a6'];
      sortedCategories.forEach(([cat, amount], idx) => {
        const percent = total > 0 ? ((amount / total) * 100).toFixed(1) : '0';
        const barWidth = total > 0 ? (amount / total) * 200 : 0;
        const rowY = doc.y;
        const color = catColors[idx % catColors.length];

        doc.fillColor('#2c3e50')
          .text(`${categoryLabels[cat] || cat}`, 70, rowY, { width: 120 });
        doc.rect(200, rowY + 2, barWidth, 10).fill(color);
        doc.fillColor('#2c3e50')
          .text(`${formatVND(amount)} (${percent}%)`, 410, rowY, { width: 140, align: 'right' });

        doc.y = rowY + 20;
      });
      doc.moveDown(1);

      // Transaction table
      doc.font('Roboto-Bold').fontSize(13).fillColor('#2c3e50')
        .text('CHI TIẾT GIAO DỊCH');
      const detailUnderY = doc.y;
      doc.moveTo(50, detailUnderY).lineTo(230, detailUnderY).stroke('#27ae60');
      doc.moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      const colX = [50, 130, 235, 380];
      doc.rect(50, tableTop - 3, 495, 20).fill('#2c3e50');
      doc.font('Roboto-Bold').fontSize(9).fillColor('#ffffff');
      doc.text('Ngày', colX[0] + 5, tableTop, { width: 75 });
      doc.text('Danh mục', colX[1] + 5, tableTop, { width: 100 });
      doc.text('Mô tả', colX[2] + 5, tableTop, { width: 140 });
      doc.text('Số tiền', colX[3] + 5, tableTop, { width: 110, align: 'right' });

      let y = tableTop + 22;

      for (let idx = 0; idx < incomes.length; idx++) {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }

        const i = incomes[idx];
        if (idx % 2 === 0) {
          doc.rect(50, y - 3, 495, 18).fill('#f8f9fa');
        }

        const date = new Date(i.date).toLocaleDateString('vi-VN');
        const desc = (i.description || '—').substring(0, 35);

        doc.fillColor('#2c3e50').font('Roboto').fontSize(9);
        doc.text(date, colX[0] + 5, y, { width: 75 });
        doc.text(categoryLabels[i.category] || i.category, colX[1] + 5, y, { width: 100 });
        doc.text(desc, colX[2] + 5, y, { width: 140 });
        doc.text(formatVND(Number(i.amount)), colX[3] + 5, y, { width: 110, align: 'right' });

        y += 18;
      }

      // Total row
      doc.moveTo(50, y).lineTo(545, y).stroke('#2c3e50');
      y += 5;
      doc.font('Roboto-Bold').fontSize(10).fillColor('#27ae60');
      doc.text('TỔNG CỘNG', colX[0] + 5, y);
      doc.text(formatVND(total), colX[3] + 5, y, { width: 110, align: 'right' });

      // Footer
      doc.font('Roboto').fontSize(8).fillColor('#bdc3c7')
        .text(
          `Xuất ngày: ${now.toLocaleDateString('vi-VN')} ${now.toLocaleTimeString('vi-VN')}  •  Smart Expense Tracker`,
          50, y + 30, { align: 'center', width: 495 },
        );

      doc.end();
    });
  }
}
