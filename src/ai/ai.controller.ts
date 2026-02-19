import { Controller, Post, Get, Delete, Body, UseGuards, Request, Res, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';

class ChatDto {
  @ApiProperty({ example: 'Tôi chi tiêu nhiều nhất vào gì?' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

class ParseDto {
  @ApiProperty({ example: 'Ăn phở 45k sáng nay' })
  @IsString()
  @IsNotEmpty()
  text: string;
}

class ConfirmParseDto {
  @ApiProperty({ example: 45000 })
  @IsNumber()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: 'food' })
  @IsString()
  category: string;

  @ApiProperty({ example: 'Ăn phở' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-02-17' })
  @IsString()
  date: string;

  @ApiProperty({ example: 'expense', enum: ['expense', 'income'] })
  @IsIn(['expense', 'income'])
  type: 'expense' | 'income';
}

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Throttle({ default: { ttl: 60000, limit: 10 } })
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat with AI (streaming SSE)' })
  async chatStream(
    @Request() req: { user: { id: string } },
    @Body() body: ChatDto,
    @Res() res: Response,
  ) {
    const message = body?.message || '';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      await this.aiService.chatStream(req.user.id, message, (chunk: string) => {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ error: 'Không thể xử lý yêu cầu AI' })}\n\n`);
    }
    res.end();
  }

  @Post('parse')
  @ApiOperation({ summary: 'Parse natural language into transaction data' })
  async parse(
    @Request() req: { user: { id: string } },
    @Body() body: ParseDto,
  ) {
    return this.aiService.parseTransaction(req.user.id, body.text);
  }

  @Post('parse/confirm')
  @ApiOperation({ summary: 'Confirm and save parsed transaction' })
  async confirmParse(
    @Request() req: { user: { id: string } },
    @Body() body: ConfirmParseDto,
  ) {
    return this.aiService.confirmParsedTransaction(req.user.id, body);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get chat history' })
  async getHistory(@Request() req: { user: { id: string } }) {
    const messages = await this.aiService.getChatHistory(req.user.id);
    return { messages };
  }

  @Delete('history')
  @ApiOperation({ summary: 'Clear chat history' })
  async clearHistory(@Request() req: { user: { id: string } }) {
    await this.aiService.clearChatHistory(req.user.id);
    return { success: true };
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get AI insights about spending' })
  async getInsights(@Request() req: { user: { id: string } }) {
    const insights = await this.aiService.getInsights(req.user.id);
    return { insights };
  }
}
