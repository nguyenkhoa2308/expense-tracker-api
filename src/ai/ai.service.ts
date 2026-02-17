import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;
  private provider: 'openai' | 'groq' | 'gemini' | 'deepseek' | 'none' = 'none';

  constructor(private prisma: PrismaService) {
    // Support multiple AI providers
    // Priority: OPENAI > GROQ > GEMINI > DEEPSEEK
    let apiKey: string | undefined;
    let baseURL: string;

    if (process.env.OPENAI_API_KEY) {
      apiKey = process.env.OPENAI_API_KEY;
      baseURL = 'https://api.openai.com/v1';
      this.provider = 'openai';
      this.logger.log('Using OpenAI API');
    } else if (process.env.GROQ_API_KEY) {
      apiKey = process.env.GROQ_API_KEY;
      baseURL = 'https://api.groq.com/openai/v1';
      this.provider = 'groq';
      this.logger.log('Using Groq API');
    } else if (process.env.GEMINI_API_KEY) {
      apiKey = process.env.GEMINI_API_KEY;
      baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai';
      this.provider = 'gemini';
      this.logger.log('Using Gemini API');
    } else if (process.env.DEEPSEEK_API_KEY) {
      apiKey = process.env.DEEPSEEK_API_KEY;
      baseURL = 'https://api.deepseek.com';
      this.provider = 'deepseek';
      this.logger.log('Using DeepSeek API');
    } else {
      this.logger.warn('No AI API key configured!');
      apiKey = '';
      baseURL = '';
    }

    this.openai = new OpenAI({
      apiKey,
      baseURL,
    });
  }

  private getModel(): string {
    switch (this.provider) {
      case 'openai':
        return 'gpt-4o-mini';
      case 'groq':
        // Groq - fast & free, using Llama 3.3
        return 'llama-3.3-70b-versatile';
      case 'gemini':
        return 'gemini-2.0-flash';
      case 'deepseek':
        return 'deepseek-chat';
      default:
        return 'gpt-4o-mini';
    }
  }

  async chatStream(userId: string, message: string, onChunk: (chunk: string) => void): Promise<void> {
    if (!message || typeof message !== 'string' || message.trim() === '') {
      onChunk('Vui lòng nhập câu hỏi của bạn.');
      return;
    }

    // Save user message to DB
    await this.prisma.chatMessage.create({
      data: { userId, role: 'user', content: message.trim() },
    });

    // Get conversation history from DB (last 10 messages)
    const history = await this.prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const [expenses, incomes, expenseStats, incomeStats] = await Promise.all([
      this.prisma.expense.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 100 }),
      this.prisma.income.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 100 }),
      this.getExpenseStats(userId),
      this.getIncomeStats(userId),
    ]);

    const context = this.buildContext(expenses, expenseStats, incomes, incomeStats);
    const systemPrompt = `Bạn là trợ lý AI giúp quản lý tài chính cá nhân. Trả lời bằng tiếng Việt, ngắn gọn và hữu ích.

Dữ liệu tài chính của người dùng:
${context}

Hãy phân tích và đưa ra lời khuyên dựa trên dữ liệu này. Nếu người dùng hỏi về thu nhập hoặc chi tiêu, hãy sử dụng dữ liệu thực tế.`;

    const conversationHistory = history.reverse().map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ];

    const model = this.getModel();
    let fullResponse = '';

    const stream = await this.openai.chat.completions.create({
      model,
      messages,
      max_tokens: 1000,
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }

    // Save full response to DB
    await this.prisma.chatMessage.create({
      data: { userId, role: 'assistant', content: fullResponse || 'Xin lỗi, tôi không thể trả lời.' },
    });
  }

  async parseTransaction(_userId: string, text: string) {
    const today = new Date().toISOString().split('T')[0];

    const model = this.getModel();
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Bạn là parser chuyển text tự nhiên thành dữ liệu giao dịch tài chính. Trả về JSON duy nhất, không giải thích.

Danh mục chi tiêu: food, transport, shopping, entertainment, bills, health, education, transfer, other
Danh mục thu nhập: salary, freelance, investment, bonus, gift, refund, other

Quy tắc:
- "k" = nghìn (45k = 45000), "tr" hoặc "củ" = triệu (1tr = 1000000, 1 củ = 1000000)
- Mặc định type là "expense" trừ khi rõ ràng là thu nhập (lương, thưởng, nhận tiền...)
- Nếu không nói ngày cụ thể, dùng "${today}"
- "sáng nay", "hôm nay" = "${today}"
- "hôm qua" = ngày trước đó

Trả về đúng format JSON:
{"amount": number, "category": string, "description": string, "date": "YYYY-MM-DD", "type": "expense"|"income"}`,
        },
        { role: 'user', content: text },
      ],
      max_tokens: 200,
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content || '';

    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        amount: Number(parsed.amount) || 0,
        category: parsed.category || 'other',
        description: parsed.description || '',
        date: parsed.date || today,
        type: parsed.type === 'income' ? 'income' : 'expense',
        originalText: text,
      };
    } catch {
      this.logger.error('Failed to parse AI response:', raw);
      throw new Error('Không thể phân tích văn bản. Vui lòng thử lại.');
    }
  }

  async confirmParsedTransaction(userId: string, data: {
    amount: number;
    category: string;
    description?: string;
    date: string;
    type: 'expense' | 'income';
  }) {
    if (data.type === 'income') {
      return this.prisma.income.create({
        data: {
          userId,
          amount: data.amount,
          category: data.category,
          description: data.description || null,
          date: new Date(data.date),
        },
      });
    }

    return this.prisma.expense.create({
      data: {
        userId,
        amount: data.amount,
        category: data.category,
        description: data.description || null,
        date: new Date(data.date),
      },
    });
  }

  private async getExpenseStats(userId: string) {
    const expenses = await this.prisma.expense.findMany({
      where: { userId },
    });

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const byCategory: Record<string, number> = {};

    for (const expense of expenses) {
      byCategory[expense.category] =
        (byCategory[expense.category] || 0) + Number(expense.amount);
    }

    return { total, byCategory, count: expenses.length };
  }

  private async getIncomeStats(userId: string) {
    const incomes = await this.prisma.income.findMany({
      where: { userId },
    });

    const total = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const byCategory: Record<string, number> = {};

    for (const income of incomes) {
      byCategory[income.category] =
        (byCategory[income.category] || 0) + Number(income.amount);
    }

    return { total, byCategory, count: incomes.length };
  }

  private buildContext(
    expenses: Array<{
      amount: unknown;
      category: string;
      description: string | null;
      date: Date;
    }>,
    expenseStats: { total: number; byCategory: Record<string, number>; count: number },
    incomes: Array<{
      amount: unknown;
      category: string;
      description: string | null;
      date: Date;
    }>,
    incomeStats: { total: number; byCategory: Record<string, number>; count: number },
  ): string {
    const expenseCategoryLabels: Record<string, string> = {
      food: 'Ăn uống',
      transport: 'Di chuyển',
      shopping: 'Mua sắm',
      entertainment: 'Giải trí',
      bills: 'Hóa đơn',
      health: 'Sức khỏe',
      education: 'Học tập',
      transfer: 'Chuyển khoản',
      other: 'Khác',
    };

    const incomeCategoryLabels: Record<string, string> = {
      salary: 'Lương',
      freelance: 'Freelance',
      investment: 'Đầu tư',
      bonus: 'Thưởng',
      gift: 'Quà tặng',
      refund: 'Hoàn tiền',
      other: 'Khác',
    };

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(amount);

    const balance = incomeStats.total - expenseStats.total;

    let context = `💰 SỐ DƯ HIỆN TẠI: ${formatCurrency(balance)} (${balance >= 0 ? 'Dương' : 'Âm'})

📈 TỔNG QUAN THU NHẬP:
- Tổng thu nhập: ${formatCurrency(incomeStats.total)}
- Số giao dịch: ${incomeStats.count}

📉 TỔNG QUAN CHI TIÊU:
- Tổng chi tiêu: ${formatCurrency(expenseStats.total)}
- Số giao dịch: ${expenseStats.count}

📁 THU NHẬP THEO DANH MỤC:
`;

    for (const [cat, amount] of Object.entries(incomeStats.byCategory).sort(
      (a, b) => b[1] - a[1],
    )) {
      const percent = incomeStats.total
        ? ((amount / incomeStats.total) * 100).toFixed(1)
        : 0;
      context += `- ${incomeCategoryLabels[cat] || cat}: ${formatCurrency(amount)} (${percent}%)\n`;
    }

    context += `\n📁 CHI TIÊU THEO DANH MỤC:
`;

    for (const [cat, amount] of Object.entries(expenseStats.byCategory).sort(
      (a, b) => b[1] - a[1],
    )) {
      const percent = expenseStats.total
        ? ((amount / expenseStats.total) * 100).toFixed(1)
        : 0;
      context += `- ${expenseCategoryLabels[cat] || cat}: ${formatCurrency(amount)} (${percent}%)\n`;
    }

    context += `\n📝 GIAO DỊCH GẦN ĐÂY:
`;

    // Combine and sort recent transactions
    const recentTransactions = [
      ...expenses.slice(0, 5).map(e => ({ ...e, type: 'expense' as const })),
      ...incomes.slice(0, 5).map(i => ({ ...i, type: 'income' as const })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

    for (const tx of recentTransactions) {
      const date = new Date(tx.date).toLocaleDateString('vi-VN');
      const labels = tx.type === 'expense' ? expenseCategoryLabels : incomeCategoryLabels;
      const sign = tx.type === 'expense' ? '-' : '+';
      context += `- ${date}: ${sign}${formatCurrency(Number(tx.amount))} - ${labels[tx.category] || tx.category}${tx.description ? ` (${tx.description})` : ''}\n`;
    }

    return context;
  }

  async getInsights(userId: string): Promise<string> {
    const [expenseStats, incomeStats] = await Promise.all([
      this.getExpenseStats(userId),
      this.getIncomeStats(userId),
    ]);

    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    if (expenseStats.count === 0 && incomeStats.count === 0) {
      return 'Bạn chưa có giao dịch nào. Hãy thêm thu nhập hoặc chi tiêu để nhận phân tích.';
    }

    const balance = incomeStats.total - expenseStats.total;
    let insights = `📊 **Tổng quan tài chính:**
- 💰 Số dư: ${formatCurrency(balance)} (${balance >= 0 ? '✅ Dương' : '❌ Âm'})
- 📈 Thu nhập: ${formatCurrency(incomeStats.total)} (${incomeStats.count} giao dịch)
- 📉 Chi tiêu: ${formatCurrency(expenseStats.total)} (${expenseStats.count} giao dịch)

💡 **Nhận xét:**`;

    if (incomeStats.count > 0) {
      const topIncome = Object.entries(incomeStats.byCategory).sort((a, b) => b[1] - a[1])[0];
      if (topIncome) {
        insights += `\n- Nguồn thu chính: **${this.getIncomeCategoryLabel(topIncome[0])}** (${((topIncome[1] / incomeStats.total) * 100).toFixed(0)}%)`;
      }
    }

    if (expenseStats.count > 0) {
      const topExpense = Object.entries(expenseStats.byCategory).sort((a, b) => b[1] - a[1])[0];
      if (topExpense) {
        insights += `\n- Chi nhiều nhất: **${this.getCategoryLabel(topExpense[0])}** (${((topExpense[1] / expenseStats.total) * 100).toFixed(0)}%)`;
      }
    }

    if (balance < 0) {
      insights += `\n- ⚠️ Bạn đang chi tiêu vượt thu nhập ${formatCurrency(Math.abs(balance))}`;
    } else if (incomeStats.total > 0) {
      const savingRate = ((balance / incomeStats.total) * 100).toFixed(0);
      insights += `\n- 💵 Tỷ lệ tiết kiệm: ${savingRate}%`;
    }

    insights += `\n\nHỏi tôi để được tư vấn chi tiết hơn!`;
    return insights;
  }

  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      food: 'Ăn uống',
      transport: 'Di chuyển',
      shopping: 'Mua sắm',
      entertainment: 'Giải trí',
      bills: 'Hóa đơn',
      health: 'Sức khỏe',
      education: 'Học tập',
      transfer: 'Chuyển khoản',
      other: 'Khác',
    };
    return labels[category] || category;
  }

  private getIncomeCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      salary: 'Lương',
      freelance: 'Freelance',
      investment: 'Đầu tư',
      bonus: 'Thưởng',
      gift: 'Quà tặng',
      refund: 'Hoàn tiền',
      other: 'Khác',
    };
    return labels[category] || category;
  }

  async getChatHistory(userId: string) {
    return this.prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    });
  }

  async clearChatHistory(userId: string) {
    return this.prisma.chatMessage.deleteMany({
      where: { userId },
    });
  }
}
