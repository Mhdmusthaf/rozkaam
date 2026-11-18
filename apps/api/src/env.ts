// Reads configuration from environment variables (see .env.example).
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';

// Minimal .env loader so no extra dependency is needed.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
}

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(24).default('dev-only-secret-change-me-please-32chars'),
  PORT: z.coerce.number().default(4000),
  SMS_PROVIDER: z.enum(['sandbox']).default('sandbox'),
  SANDBOX_OTP: z.string().regex(/^\d{6}$/).default('123456'),
  ADMIN_PHONES: z.string().default(''),
  DATA_DIR: z.string().default('.data'),
  UPLOAD_DIR: z.string().default('uploads'),
});

const parsed = schema.parse(process.env);

export const env = {
  ...parsed,
  DATABASE_URL: parsed.DATABASE_URL || undefined,
  adminPhones: parsed.ADMIN_PHONES.split(',').map((p) => p.trim()).filter(Boolean),
};
