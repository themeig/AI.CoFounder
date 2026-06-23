import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const KEYS_FILE_PATH = path.join(process.cwd(), 'src/lib/secure-keys.json');

// Derive 32-byte key from environment secret
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-antigravity-cofounder-secret';
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
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag
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

// Secure key management file utility
export async function getApiKey(name: string): Promise<string | null> {
  try {
    const data = await fs.readFile(KEYS_FILE_PATH, 'utf-8');
    const store = JSON.parse(data);
    const payload = store[name];
    if (!payload || !payload.iv || !payload.encryptedData || !payload.authTag) {
      return null;
    }
    return decrypt(payload);
  } catch (e) {
    return null;
  }
}

export async function setApiKey(name: string, key: string): Promise<void> {
  let store: Record<string, EncryptedPayload> = {};
  try {
    const data = await fs.readFile(KEYS_FILE_PATH, 'utf-8');
    store = JSON.parse(data);
  } catch (e) {
    // File doesn't exist or is invalid
  }
  
  store[name] = encrypt(key);
  await fs.mkdir(path.dirname(KEYS_FILE_PATH), { recursive: true });
  await fs.writeFile(KEYS_FILE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export async function hasApiKey(name: string): Promise<boolean> {
  try {
    const data = await fs.readFile(KEYS_FILE_PATH, 'utf-8');
    const store = JSON.parse(data);
    const payload = store[name];
    return !!(payload && payload.iv && payload.encryptedData && payload.authTag);
  } catch (e) {
    return false;
  }
}

export async function deleteApiKey(name: string): Promise<void> {
  let store: Record<string, EncryptedPayload> = {};
  try {
    const data = await fs.readFile(KEYS_FILE_PATH, 'utf-8');
    store = JSON.parse(data);
  } catch (e) {
    return;
  }
  
  delete store[name];
  await fs.writeFile(KEYS_FILE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}
