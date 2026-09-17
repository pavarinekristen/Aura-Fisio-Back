import 'dotenv/config';
import { z } from 'zod';

export const env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().url(),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:8080'),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('qwen3.5:2b'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().min(1000).default(180000),
  OLLAMA_NUM_CTX: z.coerce.number().int().min(512).max(32768).default(4096),
  OLLAMA_KEEP_ALIVE: z.string().default('10m'),
  OLLAMA_WARMUP: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
}).parse(process.env);
