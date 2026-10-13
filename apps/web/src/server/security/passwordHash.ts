import 'server-only';

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('base64url');
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString('base64url')}`;
}

export function verifyPasswordHash(password: string, encodedHash: string): boolean {
  if (!encodedHash.startsWith('scrypt$')) return false;
  const [, salt, expected] = encodedHash.split('$');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 32).toString('base64url');
  return safeEqual(actual, expected);
}
