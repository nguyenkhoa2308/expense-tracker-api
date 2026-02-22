import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseService } from './expense.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ExpenseService', () => {
  let service: ExpenseService;
  let prisma: { expense: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      expense: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ExpenseService>(ExpenseService);
  });

  describe('create', () => {
    it('should create an expense with userId', async () => {
      const mockExpense = {
        id: 'exp-1',
        amount: 50000,
        category: 'food',
        userId: 'user-1',
      };
      prisma.expense.create.mockResolvedValue(mockExpense);

      const result = await service.create('user-1', {
        amount: 50000,
        category: 'food',
        description: 'Lunch',
      });

      expect(result).toEqual(mockExpense);
      expect(prisma.expense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 50000,
          category: 'food',
          userId: 'user-1',
        }),
      });
    });
  });

  describe('findAllByUser', () => {
    it('should return all expenses for a user', async () => {
      const mockExpenses = [
        { id: 'exp-1', amount: 50000, category: 'food' },
        { id: 'exp-2', amount: 30000, category: 'transport' },
      ];
      prisma.expense.findMany.mockResolvedValue(mockExpenses);

      const result = await service.findAllByUser('user-1');

      expect(result).toHaveLength(2);
      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { date: 'desc' },
      });
    });
  });

  describe('getStats', () => {
    it('should return correct total, byCategory, and count', async () => {
      prisma.expense.findMany.mockResolvedValue([
        { amount: 50000, category: 'food' },
        { amount: 30000, category: 'food' },
        { amount: 20000, category: 'transport' },
      ]);

      const result = await service.getStats('user-1');

      expect(result.total).toBe(100000);
      expect(result.count).toBe(3);
      expect(result.byCategory).toEqual({ food: 80000, transport: 20000 });
    });
  });
});
