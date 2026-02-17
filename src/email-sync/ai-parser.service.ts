import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ParsedTransaction {
  amount: number;
  description: string;
  category: string;
  date: string;
  type: 'expense' | 'income';
}

@Injectable()
export class AiParserService {
  private readonly logger = new Logger(AiParserService.name);
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;

  constructor() {
    // Initialize AI clients based on available API keys
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    if (process.env.DEEPSEEK_API_KEY) {
      // DeepSeek uses OpenAI-compatible API
      this.openai = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1',
      });
    }
  }

  async parseEmailContent(
    emailBody: string,
    subject: string,
  ): Promise<ParsedTransaction | null> {
    const prompt = `Analyze this Vietnamese bank notification email and extract transaction details.

Email Subject: ${subject}
Email Body:
${emailBody}

Extract and return JSON with these fields:
- amount: number (in VND, no currency symbol)
- description: string (transaction description/merchant)
- category: string (one of: food, transport, shopping, entertainment, bills, health, education, transfer, other)
- date: string (YYYY-MM-DD format)
- type: "expense" or "income"

If this is NOT a transaction notification (e.g., OTP, ads, promotions), return null.
Only return valid JSON, nothing else.`;

    try {
      let response: string | null = null;

      // Try DeepSeek/OpenAI first, then Gemini
      if (this.openai) {
        response = await this.callOpenAI(prompt);
      } else if (this.gemini) {
        response = await this.callGemini(prompt);
      }

      if (!response) {
        this.logger.warn('No AI provider available');
        return null;
      }

      // Parse JSON response
      const cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      if (cleaned === 'null' || cleaned === '') return null;

      return JSON.parse(cleaned) as ParsedTransaction;
    } catch (error) {
      this.logger.error('Failed to parse email:', error);
      return null;
    }
  }

  private async callOpenAI(prompt: string): Promise<string | null> {
    if (!this.openai) return null;

    const completion = await this.openai.chat.completions.create({
      model: process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a financial data parser. Extract transaction data from bank notification emails. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens: 500,
    });

    return completion.choices[0]?.message?.content || null;
  }

  private async callGemini(prompt: string): Promise<string | null> {
    if (!this.gemini) return null;

    const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}
