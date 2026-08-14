import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Application, type Request, type Response } from 'express';
import serverlessHttp from 'serverless-http';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

let cachedExpress: Application | undefined;
let cachedHandler: ((req: Request, res: Response) => unknown) | undefined;
let bootstrapError: Error | undefined;

async function bootstrap(): Promise<Application> {
  if (bootstrapError) {
    throw bootstrapError;
  }
  if (cachedExpress) {
    return cachedExpress;
  }

  try {
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
    cachedExpress = expressApp;
    return expressApp;
  } catch (error) {
    bootstrapError = error instanceof Error ? error : new Error(String(error));
    console.error('[INTEGRA] Nest bootstrap failed:', bootstrapError);
    throw bootstrapError;
  }
}

async function getHandler() {
  if (cachedHandler) {
    return cachedHandler;
  }
  const expressApp = await bootstrap();
  // serverless-http adapts Express for Lambda/Vercel without touching deprecated app.router
  cachedHandler = serverlessHttp(expressApp) as (req: Request, res: Response) => unknown;
  return cachedHandler;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    if (!process.env.DATABASE_URL) {
      res.status(503).json({
        data: null,
        error: {
          code: 'DATABASE_URL_MISSING',
          message:
            'DATABASE_URL не задан. Добавьте PostgreSQL (Neon) и переменную DATABASE_URL в настройках Vercel.',
        },
      });
      return;
    }

    const run = await getHandler();
    await run(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown serverless error';
    console.error('[INTEGRA] Function invocation failed:', message);
    if (!res.headersSent) {
      res.status(500).json({
        data: null,
        error: {
          code: 'FUNCTION_INVOCATION_FAILED',
          message,
        },
      });
    }
  }
}
