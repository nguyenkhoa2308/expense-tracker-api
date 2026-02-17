import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GmailService } from './gmail.service';
import { EmailSyncService } from './email-sync.service';

@ApiTags('email-sync')
@Controller('email-sync')
export class EmailSyncController {
  constructor(
    private gmail: GmailService,
    private emailSync: EmailSyncService,
  ) {}

  @Get('gmail/connect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Gmail OAuth URL' })
  getGmailAuthUrl(@Request() req: { user: { id: string } }) {
    const url = this.gmail.getAuthUrl(req.user.id);
    return { url };
  }

  @Get('gmail/callback')
  @ApiOperation({ summary: 'Gmail OAuth callback' })
  async gmailCallback(
    @Query('code') code: string,
    @Query('state') userId: string,
    @Res() res: Response,
  ) {
    try {
      await this.gmail.handleCallback(code, userId);
      // Redirect to frontend settings page
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?gmail=connected`,
      );
    } catch {
      res.redirect(
        `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings?gmail=error`,
      );
    }
  }

  @Post('gmail/disconnect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Gmail' })
  async disconnectGmail(@Request() req: { user: { id: string } }) {
    await this.gmail.disconnect(req.user.id);
    return { success: true };
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually trigger email sync' })
  async manualSync(@Request() req: { user: { id: string } }) {
    return this.emailSync.manualSync(req.user.id);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Gmail connection status' })
  async getStatus(@Request() req: { user: { id: string } }) {
    // This info is returned in auth/profile, but keeping for convenience
    return { connected: true }; // Will be enhanced later
  }
}
