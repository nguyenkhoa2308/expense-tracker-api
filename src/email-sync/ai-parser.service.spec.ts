// Mock OpenAI BEFORE importing the service
const mockCreate = jest.fn();
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
  };
});

// Mock GoogleGenerativeAI
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(),
}));

import { AiParserService } from './ai-parser.service';

describe('AiParserService', () => {
  let service: AiParserService;

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = 'test-key';
    mockCreate.mockReset();
    service = new AiParserService();
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
  });

  it('should parse valid bank email and return ParsedTransaction', async () => {
    const mockTransaction = {
      amount: 50000,
      description: 'Ăn trưa',
      category: 'food',
      date: '2026-02-21',
      type: 'expense',
    };

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockTransaction) } }],
    });

    const result = await service.parseEmailContent(
      'VCB: GD: -50,000 VND tai QUAN AN 123',
      'Thong bao giao dich VCB',
    );

    expect(result).toEqual(mockTransaction);
  });

  it('should return null for non-transaction email', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'null' } }],
    });

    const result = await service.parseEmailContent(
      'Ma OTP cua ban la: 123456',
      'Ma xac thuc OTP',
    );

    expect(result).toBeNull();
  });
});
