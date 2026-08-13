import crypto from 'crypto';

// The admin area doesn't need full user accounts, so we use one shared
// password (ADMIN_PASSWORD) and a session cookie whose value is a hash
// of that password combined with a secret. Only the server can produce
// a matching hash, so the cookie can't be guessed or forged.

export function checkPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  return candidate === expected;
}

export function getSessionToken() {
  const secret = process.env.SESSION_SECRET || '';
  const password = process.env.ADMIN_PASSWORD || '';
  return crypto.createHash('sha256').update(secret + ':' + password).digest('hex');
}

export function isAdminRequest(request) {
  const cookie = request.cookies.get('kps_admin')?.value;
  if (!cookie) return false;
  return cookie === getSessionToken();
}
