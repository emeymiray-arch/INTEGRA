import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { assertProductionSecrets } from './config/assert-config';

let cachedApp: Application | undefined;
let bootstrapError: Error | undefined;

async function bootstrap(): Promise<Application> {
  if (bootstrapError) throw bootstrapError;
  if (cachedApp) return cachedApp;

  try {
    assertProductionSecrets();
    const expressApp = express();
    // Ensure JSON body works on Vercel Node (req/res) without relying on platform helpers.
    expressApp.use(express.json({ limit: '2mb' }));
    expressApp.use(express.urlencoded({ extended: true }));

    // Lightweight probe that does not need Nest bootstrap completion diagnostics.
    expressApp.get('/api/health', async (_req, res) => {
      const hasDbUrl = Boolean(process.env.DATABASE_URL);
      if (!hasDbUrl) {
        res.status(503).json({
          ok: false,
          db: 'missing',
          message: 'База не настроена',
        });
        return;
      }
      try {
        const { Pool } = await import('pg');
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          max: 1,
          connectionTimeoutMillis: 4000,
          ssl: process.env.DATABASE_URL?.includes('localhost')
            ? undefined
            : { rejectUnauthorized: false },
        });
        await pool.query('select 1');
        await pool.end();
        res.status(200).json({ ok: true, db: 'up' });
      } catch {
        res.status(503).json({
          ok: false,
          db: 'down',
          message:
            'База данных недоступна. Подождите минуту. Если не открывается сутки — проверьте оплату Neon.',
        });
      }
    });

    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
      logger: ['error', 'warn', 'log'],
      bodyParser: false,
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
    cachedApp = expressApp;
    return expressApp;
  } catch (error) {
    bootstrapError = error instanceof Error ? error : new Error(String(error));
    console.error('[INTEGRA] Nest bootstrap failed:', bootstrapError);
    throw bootstrapError;
  }
}

function runExpress(app: Application, req: Request, res: Response): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      if (err) reject(err instanceof Error ? err : new Error(String(err)));
      else resolve();
    };

    res.once('finish', () => finish());
    res.once('close', () => finish());

    try {
      // Call as Node request listener. Never export the Express app itself to Vercel
      // (that triggers the deprecated app.router path in platform helpers).
      const listener = app as unknown as (
        req: Request,
        res: Response,
        next: NextFunction,
      ) => void;
      listener(req, res, (err?: unknown) => finish(err));
    } catch (err) {
      finish(err);
    }
  });
}

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    if (!process.env.DATABASE_URL) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          data: null,
          error: {
            code: 'DATABASE_URL_MISSING',
            message:
              'DATABASE_URL не задан. Добавьте Neon DATABASE_URL в Environment Variables проекта Vercel (Production).',
          },
        }),
      );
      return;
    }

    const app = await bootstrap();
    await runExpress(app, req, res);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error('[INTEGRA] Function invocation failed:', message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          data: null,
          error: {
            code: 'FUNCTION_INVOCATION_FAILED',
            message: 'Сервис временно недоступен. Повторите вход через минуту.',
            url: req.url,
            method: req.method,
          },
        }),
      );
    }
  }
}
