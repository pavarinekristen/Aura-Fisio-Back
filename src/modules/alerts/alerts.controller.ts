import { Body, Controller, Delete, Get, Inject, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/http';
import { responseSchema } from '../../common/resources';
import { AlertsService } from './alerts.service';
@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(@Inject(AlertsService) private service: AlertsService) {}
  @Get()
  @ApiOkResponse({ schema: { type: 'object', required: ['data', 'count'], properties: { data: { type: 'array', items: responseSchema('patient_alerts') }, count: { type: 'number' } } } })
  list(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.list('patient_alerts', req.user, query); }
  @Post() @ApiBody({ schema: responseSchema('patient_alerts') })
  create(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.create('patient_alerts', req.user, body); }
  @Patch()
  update(@Req() req: AuthRequest, @Query() query: Record<string, string>, @Body() body: unknown) { return this.service.update('patient_alerts', req.user, query, body); }
  @Delete()
  remove(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.remove('patient_alerts', req.user, query); }
}
