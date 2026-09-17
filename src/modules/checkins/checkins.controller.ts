import { Body, Controller, Delete, Get, Inject, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/http';
import { responseSchema } from '../../common/resources';
import { CheckinsService } from './checkins.service';
@ApiTags('checkins')
@Controller('checkins')
export class CheckinsController {
  constructor(@Inject(CheckinsService) private service: CheckinsService) {}
  @Get()
  @ApiOkResponse({ schema: { type: 'object', required: ['data', 'count'], properties: { data: { type: 'array', items: responseSchema('workout_checkins') }, count: { type: 'number' } } } })
  list(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.list('workout_checkins', req.user, query); }
  @Post() @ApiBody({ schema: responseSchema('workout_checkins') })
  create(@Req() req: AuthRequest, @Body() body: unknown) { return this.service.create('workout_checkins', req.user, body); }
  @Patch()
  update(@Req() req: AuthRequest, @Query() query: Record<string, string>, @Body() body: unknown) { return this.service.update('workout_checkins', req.user, query, body); }
  @Delete()
  remove(@Req() req: AuthRequest, @Query() query: Record<string, string>) { return this.service.remove('workout_checkins', req.user, query); }
}
