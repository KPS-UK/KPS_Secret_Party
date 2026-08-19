// Same SHA-256 hash as lib/auth.js's getSessionToken, but using the Web
// Crypto API instead of Node's crypto module. Middleware runs in the Edge
// runtime, which doesn't support Node's crypto, so it needs this version.
export async function getSessionTokenEdge() {
  const secret = process.env.SESSION_SECRET || '';
  const password = process.env.ADMIN_PASSWORD || '';
  const data = new TextEncoder().encode(secret + ':' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}