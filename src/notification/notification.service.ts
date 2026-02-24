import { Injectable } from '@nestjs/common';
import { Observable, Subject, interval, map, merge } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

interface SseMessage {
  data: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  // SSE: Map userId → Subject[] (1 user có thể mở nhiều tab)
  private streams = new Map<string, Subject<SseMessage>[]>();

  subscribe(userId: string): Observable<SseMessage> {
    const subject = new Subject<SseMessage>();
    const userStreams = this.streams.get(userId) || [];
    userStreams.push(subject);
    this.streams.set(userId, userStreams);

    // Cleanup khi client disconnect (subject complete)
    subject.subscribe({
      complete: () => {
        const streams = this.streams.get(userId);
        if (streams) {
          const filtered = streams.filter((s) => s !== subject);
          if (filtered.length === 0) {
            this.streams.delete(userId);
          } else {
            this.streams.set(userId, filtered);
          }
        }
      },
    });

    // Heartbeat every 30s to keep connection alive
    const heartbeat$ = interval(30000).pipe(
      map(() => ({ data: { type: 'heartbeat' } })),
    );

    return merge(subject.asObservable(), heartbeat$);
  }

  private emit(userId: string, notification: Record<string, unknown>) {
    const subjects = this.streams.get(userId);
    subjects?.forEach((s) => s.next({ data: notification }));
  }

  async create(userId: string, dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: { ...dto, userId },
    });
    this.emit(userId, notification as unknown as Record<string, unknown>);
    return notification;
  }

  findAllByUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  remove(id: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId },
    });
  }
}
