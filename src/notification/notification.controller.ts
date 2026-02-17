import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  Request,
  Sse,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly service: NotificationService,
    private readonly jwtService: JwtService,
  ) {}

  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream for realtime notifications' })
  stream(@Query('token') token: string): Observable<unknown> {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }
    try {
      const payload = this.jwtService.verify(token);
      return this.service.subscribe(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create notification' })
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateNotificationDto,
  ) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all notifications' })
  findAll(@Request() req: { user: { id: string } }) {
    return this.service.findAllByUser(req.user.id);
  }

  @Get('unread-count')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get unread count' })
  getUnreadCount(@Request() req: { user: { id: string } }) {
    return this.service.getUnreadCount(req.user.id);
  }

  @Patch(':id/read')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark as read' })
  markAsRead(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.service.markAsRead(id, req.user.id);
  }

  @Patch('read-all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mark all as read' })
  markAllAsRead(@Request() req: { user: { id: string } }) {
    return this.service.markAllAsRead(req.user.id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete notification' })
  remove(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.service.remove(id, req.user.id);
  }
}
