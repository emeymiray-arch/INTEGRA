import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

let cachedServer: Express | undefined;

async function bootstrap(): Promise<Express> {
  if (cachedServer) {
    return cachedServer;
  }

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const corsOrigin = config.get<string>('corsOrigin') ?? '*';
  const origin: boolean | string[] =
    corsOrigin === '*' ? true : corsOrigin.split(',').map((v: string) => v.trim());

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();
  cachedServer = expressApp;
  return expressApp;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrap();
  return server(req, res);
}
