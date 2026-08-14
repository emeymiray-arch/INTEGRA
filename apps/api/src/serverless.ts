import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express, Request, Response } from 'express';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

let cachedServer: Express | undefined;
let bootstrapError: Error | undefined;

async function bootstrap(): Promise<Express> {
  if (bootstrapError) {
    throw bootstrapError;
  }
  if (cachedServer) {
    return cachedServer;
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
    cachedServer = expressApp;
    return expressApp;
  } catch (error) {
    bootstrapError = error instanceof Error ? error : new Error(String(error));
    console.error('[INTEGRA] Nest bootstrap failed:', bootstrapError);
    throw bootstrapError;
  }
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

    const server = await bootstrap();
    // Use handle() — calling the app as a function triggers Express 3-era app.router paths.
    await new Promise<void>((resolve, reject) => {
      try {
        server.handle(req, res, (err?: unknown) => {
          if (err) reject(err);
          else resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
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
