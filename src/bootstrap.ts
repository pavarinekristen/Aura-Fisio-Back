import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/http';
import { env } from './config/env';

export async function createApp(includeDocs = env.NODE_ENV !== 'test') {
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(json({ limit: '12mb' }));
  app.use(cookieParser());
  app.enableCors({ origin: env.FRONTEND_ORIGIN, credentials: true });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  const document = includeDocs ? SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Bio Intelligence API').setVersion('1.0').addCookieAuth('biohub_session').build()) : undefined;
  if (document && env.NODE_ENV !== 'production') SwaggerModule.setup('api/docs', app, document);
  return { app, document };
}
