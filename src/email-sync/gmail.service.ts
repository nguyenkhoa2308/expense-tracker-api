import { Injectable, Logger } from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  constructor(private prisma: PrismaService) {}

  // Generate OAuth URL for user to connect Gmail
  getAuthUrl(userId: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      state: userId, // Pass userId to callback
      prompt: 'consent',
    });
  }

  // Exchange auth code for tokens
  async handleCallback(code: string, userId: string) {
    const { tokens } = await this.oauth2Client.getToken(code);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        gmailAccessToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token,
        gmailTokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        gmailConnected: true,
      },
    });

    return { success: true };
  }

  // Disconnect Gmail
  async disconnect(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        gmailAccessToken: null,
        gmailRefreshToken: null,
        gmailTokenExpiry: null,
        gmailConnected: false,
      },
    });
  }

  // Get Gmail client for a user
  private async getGmailClient(userId: string): Promise<gmail_v1.Gmail | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        gmailAccessToken: true,
        gmailRefreshToken: true,
        gmailTokenExpiry: true,
      },
    });

    if (!user?.gmailRefreshToken) return null;

    this.oauth2Client.setCredentials({
      access_token: user.gmailAccessToken,
      refresh_token: user.gmailRefreshToken,
      expiry_date: user.gmailTokenExpiry?.getTime(),
    });

    // Auto refresh token if needed
    this.oauth2Client.on('tokens', async (tokens) => {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          gmailAccessToken: tokens.access_token,
          gmailTokenExpiry: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : null,
        },
      });
    });

    return google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  // Fetch bank notification emails
  async fetchBankEmails(userId: string): Promise<ParsedEmail[]> {
    const gmail = await this.getGmailClient(userId);
    if (!gmail) return [];

    try {
      // Search for bank notification emails (common Vietnamese banks)
      const query =
        'from:(vietcombank OR techcombank OR mbbank OR acb OR vpbank OR tpbank OR bidv OR agribank) newer_than:7d';

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50,
      });

      const messages = response.data.messages || [];
      const emails: ParsedEmail[] = [];

      for (const msg of messages) {
        // Check if already synced
        const alreadySynced = await this.prisma.syncedEmail.findUnique({
          where: {
            userId_messageId: { userId, messageId: msg.id! },
          },
        });

        if (alreadySynced) continue;

        // Fetch full message
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });

        const headers = fullMsg.data.payload?.headers || [];
        const subject = headers.find((h) => h.name === 'Subject')?.value || '';
        const from = headers.find((h) => h.name === 'From')?.value || '';
        const date = headers.find((h) => h.name === 'Date')?.value || '';

        // Get email body
        let body = '';
        const payload = fullMsg.data.payload;

        if (payload?.body?.data) {
          body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload?.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              body = Buffer.from(part.body.data, 'base64').toString('utf-8');
              break;
            }
          }
        }

        emails.push({
          messageId: msg.id!,
          subject,
          from,
          date,
          body,
        });
      }

      return emails;
    } catch (error) {
      this.logger.error(`Failed to fetch emails for user ${userId}:`, error);
      return [];
    }
  }

  // Mark email as synced
  async markAsSynced(userId: string, email: ParsedEmail) {
    await this.prisma.syncedEmail.create({
      data: {
        userId,
        messageId: email.messageId,
        subject: email.subject,
        from: email.from,
      },
    });
  }
}

export interface ParsedEmail {
  messageId: string;
  subject: string;
  from: string;
  date: string;
  body: string;
}
