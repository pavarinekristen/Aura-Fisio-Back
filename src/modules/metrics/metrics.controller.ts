import { Body, Controller, Delete, Get, Inject, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/http';
import { responseSchema } from '../../common/resources';
import { MetricsService } from './metrics.service';
@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(@Inject(MetricsService) private service: MetricsService) {}
  @Get()
  @ApiOkResponse({ schema: { type: 'object', required: ['data', 'count'], properties: { data: { type: 'array', items: responseSchema('clinical_metrics') }, count: { type: 'number' } } } })
  list(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.list('clinical_metrics', req.user, query); }
  @Post() @ApiBody({ schema: responseSchema('clinical_metrics') })
  create(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.create('clinical_metrics', req.user, body); }
  @Patch()
  update(@Req() req: AuthRequest, @Query() query: Record<string, string>, @Body() body: unknown) { return this.service.update('clinical_metrics', req.user, query, body); }
  @Delete()
  remove(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.remove('clinical_metrics', req.user, query); }
}
