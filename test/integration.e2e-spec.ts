import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Integration: Register → Login → Expense → Stats', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testEmail = `test-${Date.now()}@integration.test`;
  const testPassword = 'Test123456';
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Cleanup test data
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) {
      await prisma.expense.deleteMany({ where: { userId: user.id } });
      await prisma.budget.deleteMany({ where: { userId: user.id } });
      await prisma.income.deleteMany({ where: { userId: user.id } });
      await prisma.notification.deleteMany({ where: { userId: user.id } });
      await prisma.chatMessage.deleteMany({ where: { userId: user.id } });
      await prisma.recurringTransaction.deleteMany({
        where: { userId: user.id },
      });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  it('should register a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        name: 'Integration Test',
      })
      .expect(201);

    expect(res.body).toHaveProperty('access_token');
    accessToken = (res.body as { access_token: string }).access_token;
  });

  it('should login with created user', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(201);

    expect(res.body).toHaveProperty('access_token');
    accessToken = (res.body as { access_token: string }).access_token;
  });

  it('should create an expense', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amount: 50000,
        category: 'food',
        description: 'Integration test expense',
      })
      .expect(201);

    const body = res.body as { id: string; amount: number; category: string };
    expect(body).toHaveProperty('id');
    expect(Number(body.amount)).toBe(50000);
    expect(body.category).toBe('food');
  });

  it('should get stats with the created expense', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/expenses/stats')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as {
      total: number;
      count: number;
      byCategory: Record<string, number>;
    };
    expect(body.total).toBeGreaterThanOrEqual(50000);
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.byCategory).toHaveProperty('food');
  });
});
