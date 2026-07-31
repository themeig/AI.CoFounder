import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Supabase connection (service role — bypasses RLS)
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

function isSupabaseAvailable(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Local fallback paths (used only if Supabase is unavailable)
// ─────────────────────────────────────────────────────────────────────────────
const LOCAL_KEYS_FILE = path.join(process.cwd(), '.secure-data', 'keys.enc.json');
const LEGACY_KEYS_FILE = path.join(process.cwd(), 'src', 'lib', 'secure-keys.json');

// ─────────────────────────────────────────────────────────────────────────────
// Encryption — AES-256-GCM (authenticated encryption, 96-bit IV)
// Key is derived from ENCRYPTION_KEY env var, falling back to
// SUPABASE_SERVICE_ROLE_KEY (already secret), then a hardcoded default.
// The plain-text secret is NEVER stored anywhere — only the ciphertext.
// ─────────────────────────────────────────────────────────────────────────────
function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'default-antigravity-cofounder-secret';
  return crypto.createHash('sha256').update(secret).digest();
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

interface EncryptedPayload {
  iv: string;
  encryptedData: string;
  authTag: string;
}

export function encrypt(text: string): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const iv = Buffer.from(payload.iv, 'hex');
  const encrypted = Buffer.from(payload.encryptedData, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, undefined as any, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase SecureKey table operations
// ─────────────────────────────────────────────────────────────────────────────

async function supabaseGetKey(name: string): Promise<EncryptedPayload | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/SecureKey?name=eq.${encodeURIComponent(name)}&select=iv,encryptedData,authTag&limit=1`,
    { headers: supabaseHeaders() }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0] as EncryptedPayload;
}

async function supabaseSetKey(name: string, payload: EncryptedPayload): Promise<void> {
  // Upsert: insert or update if name already exists
  const res = await fetch(`${SUPABASE_URL}/rest/v1/SecureKey`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      name,
      iv: payload.iv,
      encryptedData: payload.encryptedData,
      authTag: payload.authTag,
      updatedAt: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Supabase REST error ${res.status}: ${await res.text()}`);
  }
}

async function supabaseHasKey(name: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/SecureKey?name=eq.${encodeURIComponent(name)}&select=id&limit=1`,
    { headers: supabaseHeaders() }
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function supabaseDeleteKey(name: string): Promise<void> {
  await fetch(
    `${SUPABASE_URL}/rest/v1/SecureKey?name=eq.${encodeURIComponent(name)}`,
    { method: 'DELETE', headers: supabaseHeaders() }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Local file fallback (used only when Supabase is unavailable)
// ─────────────────────────────────────────────────────────────────────────────

async function localReadStore(): Promise<Record<string, EncryptedPayload>> {
  // Try new local location first
  for (const filePath of [LOCAL_KEYS_FILE, LEGACY_KEYS_FILE]) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // try next
    }
  }
  return {};
}

async function localWriteStore(store: Record<string, EncryptedPayload>): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_KEYS_FILE), { recursive: true });
  await fs.writeFile(LOCAL_KEYS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-migration: move keys from local file → Supabase on first read
// ─────────────────────────────────────────────────────────────────────────────

async function migrateLocalToSupabase(): Promise<void> {
  const store = await localReadStore();
  if (Object.keys(store).length === 0) return;

  let migrated = 0;
  for (const [name, payload] of Object.entries(store)) {
    try {
      const alreadyInDb = await supabaseHasKey(name);
      if (!alreadyInDb) {
        await supabaseSetKey(name, payload);
        migrated++;
      }
    } catch {
      // ignore per-key failures
    }
  }

  if (migrated > 0) {
    console.log(`[secure-store] Migrated ${migrated} key(s) from local file to Supabase.`);
    // Clean up local files after successful migration
    await fs.unlink(LOCAL_KEYS_FILE).catch(() => {});
    await fs.unlink(LEGACY_KEYS_FILE).catch(() => {});
  }
}

let _migrationAttempted = false;

async function ensureMigrated(): Promise<void> {
  if (_migrationAttempted || !isSupabaseAvailable()) return;
  _migrationAttempted = true;
  await migrateLocalToSupabase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve a stored API key by name.
 * Priority: env var → Supabase → local file fallback.
 */
export async function getApiKey(name: string): Promise<string | null> {
  // 1. Environment variable (highest priority, useful for CI/CD)
  if (name === 'tavily' && process.env.TAVILY_API_KEY) return process.env.TAVILY_API_KEY;
  if (name === 'openai' && process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (name === 'stripe' && (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY)) {
    return process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY || null;
  }

  // 2. Supabase (primary storage)
  if (isSupabaseAvailable()) {
    await ensureMigrated();
    try {
      const payload = await supabaseGetKey(name);
      if (payload) return decrypt(payload);
    } catch (e) {
      console.error('[secure-store] Supabase read failed, falling back to local file:', e);
    }
  }

  // 3. Local file fallback
  try {
    const store = await localReadStore();
    const payload = store[name];
    if (payload?.iv && payload?.encryptedData && payload?.authTag) return decrypt(payload);
  } catch {}

  return null;
}

/**
 * Encrypt and persist an API key.
 * Saves to Supabase (primary) and local file (fallback).
 * The plain-text key is NEVER stored — only AES-256-GCM ciphertext.
 */
export async function setApiKey(name: string, key: string): Promise<void> {
  const payload = encrypt(key);

  if (isSupabaseAvailable()) {
    try {
      await supabaseSetKey(name, payload);
    } catch (e: any) {
      console.warn('[secure-store] Supabase setKey notice:', e.message);
    }
  }

  // Always persist to local encrypted fallback store as well
  try {
    const store = await localReadStore();
    store[name] = payload;
    await localWriteStore(store);
  } catch (e: any) {
    console.error('[secure-store] Local setKey failed:', e.message);
  }
}

/**
 * Check whether a key is configured.
 */
export async function hasApiKey(name: string): Promise<boolean> {
  if (name === 'tavily' && process.env.TAVILY_API_KEY) return true;
  if (name === 'openai' && process.env.OPENAI_API_KEY) return true;
  if (name === 'stripe' && (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_RESTRICTED_KEY)) return true;

  if (isSupabaseAvailable()) {
    await ensureMigrated();
    try {
      const dbHas = await supabaseHasKey(name);
      if (dbHas) return true;
    } catch {}
  }

  // Local fallback
  try {
    const store = await localReadStore();
    const p = store[name];
    return !!(p?.iv && p?.encryptedData && p?.authTag);
  } catch {
    return false;
  }
}

/**
 * Delete a stored API key from Supabase and local file.
 */
export async function deleteApiKey(name: string): Promise<void> {
  if (isSupabaseAvailable()) {
    try {
      await supabaseDeleteKey(name);
    } catch {}
  }

  // Also remove from local fallback
  try {
    const store = await localReadStore();
    if (name in store) {
      delete store[name];
      await localWriteStore(store);
    }
  } catch {}
}
