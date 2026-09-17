import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OllamaProvider } from './ollama.provider';
@Module({ controllers: [AiController], providers: [AiService, OllamaProvider], exports: [OllamaProvider] })
export class AiModule {}
