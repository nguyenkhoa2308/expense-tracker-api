import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import * as express from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const REFRESH_COOKIE_NAME = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.service.register(dto);
    res.cookie(
      REFRESH_COOKIE_NAME,
      `${result.userId}:${result.refreshToken}`,
      COOKIE_OPTIONS,
    );
    return { access_token: result.access_token };
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const result = await this.service.login(dto);
    res.cookie(
      REFRESH_COOKIE_NAME,
      `${result.userId}:${result.refreshToken}`,
      COOKIE_OPTIONS,
    );
    return { access_token: result.access_token };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Req() req: express.Request) {
    const cookie = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!cookie) {
      throw new UnauthorizedException('No refresh token');
    }

    const separatorIndex = cookie.indexOf(':');
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const userId = cookie.substring(0, separatorIndex);
    const rawToken = cookie.substring(separatorIndex + 1);

    const result = await this.service.refreshTokens(userId, rawToken);

    return { access_token: result.access_token, user: result.user };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user' })
  async logout(
    @Req() req: express.Request,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const cookie = req.cookies?.[REFRESH_COOKIE_NAME];
    if (cookie) {
      const separatorIndex = cookie.indexOf(':');
      if (separatorIndex !== -1) {
        const userId = cookie.substring(0, separatorIndex);
        await this.service.logout(userId);
      }
    }

    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax' as const,
      path: '/',
    });

    return { message: 'Logged out' };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@Req() req: express.Request & { user: { id: string } }) {
    return this.service.getProfile(req.user.id);
  }
}
