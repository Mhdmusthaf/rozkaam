// Starts the Rozkaam API.
import { serve } from '@hono/node-server';

import { createApp } from './app';
import { openDb } from './db/client';
import { env } from './env';

const { db } = await openDb({ url: env.DATABASE_URL, dataDir: env.DATA_DIR });
const app = createApp(db);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Rozkaam API listening on http://localhost:${info.port}`);
  console.log(`Database: ${env.DATABASE_URL ? 'hosted Postgres' : `embedded (${env.DATA_DIR})`} · SMS: ${env.SMS_PROVIDER}`);
});
