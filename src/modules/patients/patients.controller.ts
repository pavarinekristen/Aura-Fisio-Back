import { Body, Controller, Delete, Get, Inject, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/http';
import { responseSchema } from '../../common/resources';
import { PatientsService } from './patients.service';
@ApiTags('patients')
@Controller('profiles')
export class PatientsController {
  constructor(@Inject(PatientsService) private service: PatientsService) {}
  @Get()
  @ApiOkResponse({ schema: { type: 'object', required: ['data', 'count'], properties: { data: { type: 'array', items: responseSchema('profiles') }, count: { type: 'number' } } } })
  list(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.list('profiles', req.user, query); }
  @Post() @ApiBody({ schema: responseSchema('profiles') })
  create(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.create('profiles', req.user, body); }
  @Patch()
  update(@Req() req: AuthRequest, @Query() query: Record<string, string>, @Body() body: unknown) { return this.service.update('profiles', req.user, query, body); }
  @Delete()
  remove(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.remove('profiles', req.user, query); }
}
