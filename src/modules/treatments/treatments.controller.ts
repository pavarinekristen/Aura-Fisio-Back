import { Body, Controller, Delete, Get, Inject, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/http';
import { responseSchema } from '../../common/resources';
import { TreatmentsService } from './treatments.service';
@ApiTags('treatments')
@Controller('treatments')
export class TreatmentsController {
  constructor(@Inject(TreatmentsService) private service: TreatmentsService) {}
  @Get()
  @ApiOkResponse({ schema: { type: 'object', required: ['data', 'count'], properties: { data: { type: 'array', items: responseSchema('treatment_plans') }, count: { type: 'number' } } } })
  list(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.list('treatment_plans', req.user, query); }
  @Post() @ApiBody({ schema: responseSchema('treatment_plans') })
  create(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.create('treatment_plans', req.user, body); }
  @Patch()
  update(@Req() req: AuthRequest, @Query() query: Record<string, string>, @Body() body: unknown) { return this.service.update('treatment_plans', req.user, query, body); }
  @Delete()
  remove(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.remove('treatment_plans', req.user, query); }
}
