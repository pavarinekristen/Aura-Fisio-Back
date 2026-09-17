import { Body, Controller, Delete, Get, Inject, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/http';
import { responseSchema } from '../../common/resources';
import { SessionsService } from './sessions.service';
@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(@Inject(SessionsService) private service: SessionsService) {}
  @Get()
  @ApiOkResponse({ schema: { type: 'object', required: ['data', 'count'], properties: { data: { type: 'array', items: responseSchema('clinical_sessions') }, count: { type: 'number' } } } })
  list(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.list('clinical_sessions', req.user, query); }
  @Post() @ApiBody({ schema: responseSchema('clinical_sessions') })
  create(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.create('clinical_sessions', req.user, body); }
  @Patch()
  update(@Req() req: AuthRequest, @Query() query: Record<string, string>, @Body() body: unknown) { return this.service.update('clinical_sessions', req.user, query, body); }
  @Delete()
  remove(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.remove('clinical_sessions', req.user, query); }
}
