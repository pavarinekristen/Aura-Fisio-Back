import { Body, Controller, Delete, Get, Inject, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/http';
import { responseSchema } from '../../common/resources';
import { CalendarService } from './calendar.service';
@ApiTags('calendar')
@Controller('calendar-events')
export class CalendarController {
  constructor(@Inject(CalendarService) private service: CalendarService) {}
  @Get()
  @ApiOkResponse({ schema: { type: 'object', required: ['data', 'count'], properties: { data: { type: 'array', items: responseSchema('calendar_events') }, count: { type: 'number' } } } })
  list(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.list('calendar_events', req.user, query); }
  @Post() @ApiBody({ schema: responseSchema('calendar_events') })
  create(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.create('calendar_events', req.user, body); }
  @Patch()
  update(@Req() req: AuthRequest, @Query() query: Record<string, string>, @Body() body: unknown) { return this.service.update('calendar_events', req.user, query, body); }
  @Delete()
  remove(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.remove('calendar_events', req.user, query); }
  @Post('publish')
  publish(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.publish(req.user, body); }
}
