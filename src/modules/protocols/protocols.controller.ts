import { Body, Controller, Delete, Get, Inject, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/http';
import { responseSchema } from '../../common/resources';
import { ProtocolsService } from './protocols.service';
@ApiTags('protocols')
@Controller('protocols')
export class ProtocolsController {
  constructor(@Inject(ProtocolsService) private service: ProtocolsService) {}
  @Get()
  @ApiOkResponse({ schema: { type: 'object', required: ['data', 'count'], properties: { data: { type: 'array', items: responseSchema('protocol_templates') }, count: { type: 'number' } } } })
  list(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.list('protocol_templates', req.user, query); }
  @Post() @ApiBody({ schema: responseSchema('protocol_templates') })
  create(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.create('protocol_templates', req.user, body); }
  @Patch()
  update(@Req() req: AuthRequest, @Query() query: Record<string, string>, @Body() body: unknown) { return this.service.update('protocol_templates', req.user, query, body); }
  @Delete()
  remove(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.remove('protocol_templates', req.user, query); }
}
