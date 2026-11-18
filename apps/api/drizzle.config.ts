import { defineConfig } from 'drizzle-kit';

// Generates SQL migration files in ./drizzle from src/db/schema.ts.
export default defineConfig({ dialect: 'postgresql', schema: './src/db/schema.ts', out: './drizzle' });
