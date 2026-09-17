import { Body, Controller, Delete, Get, Inject, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/http';
import { responseSchema } from '../../common/resources';
import { NotificationsService } from './notifications.service';
@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private service: NotificationsService) {}
  @Get()
  @ApiOkResponse({ schema: { type: 'object', required: ['data', 'count'], properties: { data: { type: 'array', items: responseSchema('patient_notifications') }, count: { type: 'number' } } } })
  list(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.list('patient_notifications', req.user, query); }
  @Post() @ApiBody({ schema: responseSchema('patient_notifications') })
  create(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.create('patient_notifications', req.user, body); }
  @Patch()
  update(@Req() req: AuthRequest, @Query() query: Record<string, string>, @Body() body: unknown) { return this.service.update('patient_notifications', req.user, query, body); }
  @Delete()
  remove(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.remove('patient_notifications', req.user, query); }
}
