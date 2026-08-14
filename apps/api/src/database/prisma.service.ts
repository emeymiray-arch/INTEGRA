import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

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

    // Serverless: one connection per isolate; Neon needs TLS.
    const pool = new Pool({
      connectionString,
      max: 1,
      ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
    });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  async onModuleInit() {
    if (!this.pool) {
      console.warn('[Prisma] DATABASE_URL is not set — skipping $connect');
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool?.end();
  }
}
