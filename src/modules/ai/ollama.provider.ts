import { BadGatewayException, Injectable, Logger, ServiceUnavailableException, type OnModuleInit } from '@nestjs/common';
import { env } from '../../config/env';

export type OllamaStatus = { status: 'ok' | 'model_missing' | 'down'; model: string; base_url: string };

@Injectable()
export class OllamaProvider implements OnModuleInit {
  private readonly logger = new Logger(OllamaProvider.name);
  private get baseUrl() { return env.OLLAMA_BASE_URL.replace(/\/$/, ''); }

  /** Loads the model into memory on boot so the first chat does not pay the cold-start cost (CPU: 20-40s). */
  async onModuleInit() {
    if (!env.OLLAMA_WARMUP || env.NODE_ENV === 'test') return;
    const status = await this.status();
    if (status.status !== 'ok') { this.logger.warn(`IA indisponível (${status.status}). Chat da Aura ficará offline até o Ollama subir com o modelo ${env.OLLAMA_MODEL}.`); return; }
    fetch(`${this.baseUrl}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: env.OLLAMA_MODEL, keep_alive: env.OLLAMA_KEEP_ALIVE }), signal: AbortSignal.timeout(env.OLLAMA_TIMEOUT_MS) })
      .then(r => this.logger.log(r.ok ? `Modelo ${env.OLLAMA_MODEL} carregado no Ollama.` : `Warm-up do Ollama falhou (${r.status}).`))
      .catch(() => this.logger.warn('Warm-up do Ollama não concluiu.'));
  }

  /** Cheap liveness probe used by /health. Never throws. */
  async status(): Promise<OllamaStatus> {
    const base = { model: env.OLLAMA_MODEL, base_url: this.baseUrl };
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) return { status: 'down', ...base };
      const body = await response.json() as { models?: { name: string }[] };
      const installed = (body.models ?? []).some(m => m.name === env.OLLAMA_MODEL || m.name === `${env.OLLAMA_MODEL}:latest`);
      return { status: installed ? 'ok' : 'model_missing', ...base };
    } catch { return { status: 'down', ...base }; }
  }

  async request(messages: unknown[], stream = false, signal?: AbortSignal, jsonMode = false) {
    const converted = messages.map(raw => {
      const message = raw as { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] };
      if (typeof message.content === 'string') return message;
      return {
        role: message.role,
        content: message.content.filter(p => p.type === 'text').map(p => p.text).join('\n'),
        images: message.content.filter(p => p.type === 'image_url').map(p => p.image_url!.url.split(',')[1]),
      };
    });
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(env.OLLAMA_TIMEOUT_MS)]) : AbortSignal.timeout(env.OLLAMA_TIMEOUT_MS),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: env.OLLAMA_MODEL, messages: converted, stream, think: false, keep_alive: env.OLLAMA_KEEP_ALIVE, ...(jsonMode ? { format: 'json' } : {}), options: { num_predict: jsonMode ? 1024 : 4096, num_ctx: env.OLLAMA_NUM_CTX, temperature: 0.3 } }),
      });
    } catch { throw new ServiceUnavailableException('Ollama indisponível ou demorou demais. Inicie a IA com npm run ai:up e tente novamente.'); }
    if (!response.ok) {
      await response.body?.cancel();
      throw new BadGatewayException(response.status === 404 ? `Modelo ${env.OLLAMA_MODEL} não instalado no Ollama. Execute npm run ai:pull.` : 'O Ollama não conseguiu responder. Confira o modelo e a memória disponível.');
    }
    if (!stream) return response;
    if (!response.body) throw new BadGatewayException('Ollama retornou uma resposta vazia.');
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';
    const emit = (line: string, controller: TransformStreamDefaultController<Uint8Array>) => {
      if (!line.trim()) return;
      const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean; error?: string };
      if (chunk.error) throw new Error('Ollama interrompeu a geração.');
      if (chunk.message?.content) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk.message.content } }] })}\n\n`));
      if (chunk.done) controller.enqueue(encoder.encode('data: [DONE]\n\n'));
    };
    const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        let end: number;
        while ((end = buffer.indexOf('\n')) !== -1) { emit(buffer.slice(0, end), controller); buffer = buffer.slice(end + 1); }
      },
      flush(controller) { buffer += decoder.decode(); if (buffer.trim()) emit(buffer, controller); },
    }));
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
  }
  async text(messages: unknown[], jsonMode = false): Promise<string> {
    const response = await this.request(messages, false, undefined, jsonMode);
    const body = await response.json() as { message?: { content?: string } };
    const text = body.message?.content;
    if (!text) throw new BadGatewayException('A IA retornou uma resposta vazia.');
    return text;
  }
}
