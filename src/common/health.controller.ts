import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './http';
import { PrismaService } from '../database/prisma.service';
import { OllamaProvider } from '../modules/ai/ollama.provider';
@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private db: PrismaService, @Inject(OllamaProvider) private ollama: OllamaProvider) {}
  @Public() @Get()
  async health() {
    try { await this.db.$queryRaw`SELECT 1`; }
    catch { throw new ServiceUnavailableException('Banco indisponível.'); }
    // AI is optional: report it, never fail the probe because of it.
    const ai = await this.ollama.status();
    return { status: 'ok', database: 'ok', ai: ai.status, ai_model: ai.model };
  }
}
