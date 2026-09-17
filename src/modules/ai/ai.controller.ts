import { Body, Controller, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthRequest } from '../../common/http';
import { AiService } from './ai.service';
import { aiInput } from './ai.schemas';
@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(@Inject(AiService) private ai: AiService) {}
  @Post('aura-chat')
  @ApiBody({ schema: { type: 'object', properties: { patient_id: { type: 'string', format: 'uuid' }, mode: { type: 'string', enum: ['patient', 'professional', 'calendar'] }, messages: { type: 'array', items: { type: 'object', additionalProperties: true } }, message: { type: 'string' } } } })
  async chat(@Req() req: AuthRequest, @Body() raw: unknown, @Res() res: Response) {
    const input = aiInput.parse(raw);
    if (input.mode === 'professional') { res.json(await this.ai.professional(req.user, input)); return; }
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    const upstream = await this.ai.stream(req.user, input, abort.signal);
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
    const reader = upstream.body?.getReader();
    try {
      if (reader) while (!abort.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } finally { await reader?.cancel().catch(() => {}); res.end(); }
  }
  @Post(':action')
  async invoke(@Param('action') action: string, @Req() req: AuthRequest, @Body() body: unknown) { return { data: await this.ai.invoke(action, req.user, body), error: null }; }
}
