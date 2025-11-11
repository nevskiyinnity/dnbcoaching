// User storage and utilities (dev-friendly file-backed store)

import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  name: string;
  code: string;
  expiryDate: string | null; // ISO string or null for no expiry
  createdAt: string;
}

// Where to store data during local/dev usage. On Vercel prod, filesystem is read-only.
// For production, replace with a proper database or Vercel KV.
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}
}

function readAll(): User[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as User[];
    return [];
  } catch {
    return [];
  }
}

function writeAll(users: User[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch {
    // swallow in dev; callers will still return best-effort results
  }
}

export function getAllUsers(): User[] {
  // Read fresh each call to keep both admin and chat in sync across functions in dev
  return readAll();
}

export function getUserByCode(code: string): User | undefined {
  return getAllUsers().find(u => u.code === code);
}

export function addUser(user: User): void {
  const users = getAllUsers();
  users.push(user);
  writeAll(users);
}

export function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): boolean {
  const users = getAllUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return false;
  users[index] = { ...users[index], ...updates };
  writeAll(users);
  return true;
}

export function deleteUser(id: string): boolean {
  const users = getAllUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return false;
  users.splice(index, 1);
  writeAll(users);
  return true;
}

export function isCodeValid(code: string): { valid: boolean; user?: User; reason?: string } {
  const clean = (code || '').trim().toUpperCase();
  if (!clean) return { valid: false, reason: 'Invalid code' };
  const user = getUserByCode(clean);
  if (!user) return { valid: false, reason: 'Invalid code' };
  
  if (user.expiryDate) {
    const expiry = new Date(user.expiryDate);
    const now = new Date();
    if (now > expiry) {
      return { valid: false, user, reason: 'Code expired' };
    }
  }
  
  return { valid: true, user };
}

export function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
