// Opens the database. With DATABASE_URL it connects to hosted Postgres;
// without it, it runs an embedded Postgres (PGlite) so nothing needs installing.
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzleLite, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate as migrateLite } from 'drizzle-orm/pglite/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import * as schema from './schema';

export { schema };

/** One database type for the whole codebase, whichever engine is running. */
export type Db = PgliteDatabase<typeof schema>;
/** Either the database or an open transaction on it. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0] | Db;

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle');

export async function openDb(opts: { url?: string; dataDir?: string } = {}): Promise<{ db: Db; close: () => Promise<void> }> {
  if (opts.url) {
    const pool = new pg.Pool({ connectionString: opts.url, max: 5 });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    return { db: db as unknown as Db, close: () => pool.end() };
  }
  // dataDir undefined = in-memory (used by tests).
  if (opts.dataDir) mkdirSync(opts.dataDir, { recursive: true });
  const client = new PGlite(opts.dataDir);
  const db = drizzleLite(client, { schema });
  await migrateLite(db, { migrationsFolder });
  return { db, close: () => client.close() };
}
