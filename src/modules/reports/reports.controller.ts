import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthRequest } from '../../common/http';
import { ReportsService } from './reports.service';
@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private reports: ReportsService) {}
  @Get('export')
  async export(@Req() req: AuthRequest, @Query() query: Record<string, string>, @Res() res: Response) {
    const csv = await this.reports.export(req.user, query);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="relatorio.csv"' }).send(csv);
  }
}
