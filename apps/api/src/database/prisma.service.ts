import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { tenantQueryExtension } from '../common/tenant/tenant.extension';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool | null;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      super();
      this.pool = null;
      return;
    }

    const pool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 10000,
      ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
    });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;

    const extended = this.$extends(tenantQueryExtension as never);
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop === 'onModuleInit' || prop === 'onModuleDestroy' || prop === 'pool') {
          return Reflect.get(target, prop, receiver);
        }
        const fromExtended = Reflect.get(extended as object, prop, extended);
        if (fromExtended !== undefined) return fromExtended;
        return Reflect.get(target, prop, receiver);
      },
    }) as this;
  }

  async onModuleInit() {
    if (!this.pool) {
      console.warn('[Prisma] DATABASE_URL is not set — skipping $connect');
      return;
    }
    if (process.env.VERCEL) return;
    try {
      await this.$connect();
    } catch (error) {
      console.warn('[Prisma] initial connect failed, will retry on first query', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool?.end();
  }
}
