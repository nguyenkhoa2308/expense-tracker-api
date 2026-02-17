import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
      },
    });

    const accessToken = this.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = await this.generateAndStoreRefreshToken(user.id);

    return { access_token: accessToken, refreshToken, userId: user.id };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = await this.generateAndStoreRefreshToken(user.id);

    return { access_token: accessToken, refreshToken, userId: user.id };
  }

  async refreshTokens(userId: string, rawToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken || !user.refreshTokenExpiry) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > user.refreshTokenExpiry) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null, refreshTokenExpiry: null },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const incomingHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    if (incomingHash !== user.refreshToken) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null, refreshTokenExpiry: null },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = this.generateAccessToken(user.id, user.email, user.role);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        gmailConnected: user.gmailConnected,
      },
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null, refreshTokenExpiry: null },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        gmailConnected: true,
        createdAt: true,
      },
    });
    return user;
  }

  private generateAccessToken(userId: string, email: string, role: string): string {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }

  private async generateAndStoreRefreshToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: hashedToken,
        refreshTokenExpiry: expiry,
      },
    });

    return rawToken;
  }
}
