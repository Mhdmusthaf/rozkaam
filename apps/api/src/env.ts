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
  NODE_ENV: z.string().default('development'),
  // Comma-separated website addresses allowed to call the API. Empty = any (local development only).
  CORS_ORIGINS: z.string().default(''),
});

const parsed = schema.parse(process.env);

const production = parsed.NODE_ENV === 'production';

// A hosted server must never run on the well-known development values:
// with them, anyone could sign in as anyone.
if (production) {
  const problems = [
    parsed.JWT_SECRET === 'dev-only-secret-change-me-please-32chars' && 'JWT_SECRET is still the development value',
    parsed.SMS_PROVIDER === 'sandbox' && parsed.SANDBOX_OTP === '123456' && 'SANDBOX_OTP is still 123456',
    !parsed.DATABASE_URL && 'DATABASE_URL is not set',
    !parsed.CORS_ORIGINS && 'CORS_ORIGINS is not set',
  ].filter(Boolean);
  if (problems.length) {
    console.error(`Refusing to start in production:\n - ${problems.join('\n - ')}`);
    process.exit(1);
  }
}

export const env = {
  ...parsed,
  production,
  corsOrigins: parsed.CORS_ORIGINS.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean),
  DATABASE_URL: parsed.DATABASE_URL || undefined,
  adminPhones: parsed.ADMIN_PHONES.split(',').map((p) => p.trim()).filter(Boolean),
};
