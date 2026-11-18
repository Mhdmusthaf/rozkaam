// File storage for KYC documents and check-in photos.
//
// Files are kept in the database for now. That makes them durable on any
// host (free hosts wipe their disk on every restart) and needs no extra
// account. When volume grows, move the bytes to Cloudflare R2 by replacing
// the two functions below; nothing else in the code changes.
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { schema, type Db } from '../db/client';

const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const isAllowedType = (contentType: string) => contentType in ALLOWED;

/** Stores a file and returns its key. */
export async function saveFile(db: Db, ownerId: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const key = `${randomUUID()}.${ALLOWED[contentType]}`;
  await db.insert(schema.files).values({ key, ownerId, contentType, data: Buffer.from(bytes) });
  return key;
}

/** Reads a stored file, or null if it does not exist. */
export async function readStoredFile(db: Db, key: string): Promise<{ bytes: Uint8Array; contentType: string; ownerId: string } | null> {
  const [f] = await db.select().from(schema.files).where(eq(schema.files.key, key));
  if (!f) return null;
  return { bytes: new Uint8Array(f.data), contentType: f.contentType, ownerId: f.ownerId };
}
