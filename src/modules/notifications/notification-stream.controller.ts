import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthRequest } from '../../common/http';
import { PrismaService } from '../../database/prisma.service';
import { AuthService, SESSION_COOKIE } from '../auth/auth.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationStreamController {
  constructor(@Inject(PrismaService) private db: PrismaService, @Inject(AuthService) private auth: AuthService) {}
  @Get('stream')
  stream(@Req() req: AuthRequest, @Res() res: Response) {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    res.write('event: ready\ndata: {}\n\n');
    let closed = false;
    let busy = false;
    const seen = new Set<string>();
    const connected = new Date(Date.now() - 3000);
    const timer = setInterval(async () => {
      if (closed || busy) return;
      busy = true;
      try {
        await this.auth.authenticate(req.cookies?.[SESSION_COOKIE]);
        const rows = await this.db.patientNotification.findMany({ where: { patient_id: req.user.id, created_at: { gte: connected }, is_dismissed: false }, orderBy: { created_at: 'asc' } });
        for (const row of rows) if (!seen.has(row.id)) { seen.add(row.id); res.write(`data: ${JSON.stringify(row)}\n\n`); }
        res.write(': keep-alive\n\n');
      } catch { clearInterval(timer); res.end(); }
      finally { busy = false; }
    }, 3000);
    res.on('close', () => { closed = true; clearInterval(timer); });
  }
}
