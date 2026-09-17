import { Body, Controller, Delete, Get, Inject, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/http';
import { responseSchema } from '../../common/resources';
import { IntakesService } from './intakes.service';
@ApiTags('intakes')
@Controller('intakes')
export class IntakesController {
  constructor(@Inject(IntakesService) private service: IntakesService) {}
  @Get()
  @ApiOkResponse({ schema: { type: 'object', required: ['data', 'count'], properties: { data: { type: 'array', items: responseSchema('patient_intake') }, count: { type: 'number' } } } })
  list(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.list('patient_intake', req.user, query); }
  @Post() @ApiBody({ schema: responseSchema('patient_intake') })
  create(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.create('patient_intake', req.user, body); }
  @Patch()
  update(@Req() req: AuthRequest, @Query() query: Record<string, string>, @Body() body: unknown) { return this.service.update('patient_intake', req.user, query, body); }
  @Delete()
  remove(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.remove('patient_intake', req.user, query); }
}
