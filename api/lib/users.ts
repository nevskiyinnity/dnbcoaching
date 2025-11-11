// User storage and utilities

export interface User {
  id: string;
  name: string;
  code: string;
  expiryDate: string | null; // ISO string or null for no expiry
  createdAt: string;
}

// In-memory storage (for production, consider using a database)
const users: User[] = [];

export function getAllUsers(): User[] {
  return [...users];
}

export function getUserByCode(code: string): User | undefined {
  return users.find(u => u.code === code);
}

export function addUser(user: User): void {
  users.push(user);
}

export function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): boolean {
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return false;
  users[index] = { ...users[index], ...updates };
  return true;
}

export function deleteUser(id: string): boolean {
  const index = users.findIndex(u => u.id === id);
  if (index === -1) return false;
  users.splice(index, 1);
  return true;
}

export function isCodeValid(code: string): { valid: boolean; user?: User; reason?: string } {
  const user = getUserByCode(code);
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
