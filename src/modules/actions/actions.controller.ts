import { Body, Controller, Get, Inject, Post, Query, Req } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthRequest } from '../../common/http';
import { ActionsService } from './actions.service';

const actionBody = {
  type: 'object' as const,
  required: ['type'],
  properties: {
    type: { type: 'string', enum: ['register_patient', 'schedule_appointment', 'schedule_series', 'log_session', 'save_protocol', 'invite_patient'] },
    data: { type: 'object', additionalProperties: true },
    source_text: { type: 'string' },
  },
};

const planResponse = {
  type: 'object' as const,
  required: ['data', 'error'],
  properties: {
    data: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', format: 'uuid' },
        expires_at: { type: 'string', format: 'date-time' },
        action: { type: 'object', additionalProperties: true },
      },
      required: ['plan_id', 'expires_at', 'action'],
    },
    error: { type: 'string', nullable: true },
  },
};

const execResponse = {
  type: 'object' as const,
  required: ['data', 'error'],
  properties: {
    data: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', format: 'uuid' },
        type: { type: 'string' },
        result: { type: 'object', additionalProperties: true },
      },
      required: ['plan_id', 'type', 'result'],
    },
    error: { type: 'string', nullable: true },
  },
};

@ApiTags('actions')
@Controller('actions')
export class ActionsController {
  constructor(@Inject(ActionsService) private actions: ActionsService) {}

  /** Monta uma proposta sem passar pela IA, para quando o cliente já sabe o que quer. */
  @Post('plan')
  @ApiBody({ schema: actionBody })
  @ApiOkResponse({ schema: planResponse })
  async plan(@Req() req: AuthRequest, @Body() body: unknown) {
    return { data: await this.actions.plan(req.user, body), error: null };
  }

  /** Confirma e grava. Revalida tudo: o card pode ter sido editado. */
  @Post('execute')
  @ApiBody({ schema: { type: 'object', required: ['plan_id', 'action'], properties: { plan_id: { type: 'string', format: 'uuid' }, action: { type: 'object', additionalProperties: true } } } })
  @ApiOkResponse({ schema: execResponse })
  execute(@Req() req: AuthRequest, @Body() body: unknown) {
    return this.actions.execute(req.user, body);
  }

  @Get()
  @ApiOkResponse({ schema: { type: 'object', required: ['data', 'count'], properties: { data: { type: 'array', items: { type: 'object', additionalProperties: true } }, count: { type: 'number' } } } })
  history(@Req() req: AuthRequest, @Query('limit') limit?: string) {
    return this.actions.history(req.user, limit ? Number(limit) : undefined);
  }
}
