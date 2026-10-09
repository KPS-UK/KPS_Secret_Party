// Anyone with an email on one of these domains is KPS staff. In the sign up
// tracker, all 44 KPS staff use @kps.com. Add a domain here if staff use more.
export const KPS_EMAIL_DOMAINS = ['kps.com'];

// Patterns for SQL: LOWER(email) LIKE ANY(...)
export function kpsEmailPatterns() {
  return KPS_EMAIL_DOMAINS.map((domain) => '%@' + domain.toLowerCase());
}

export function isKpsEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return KPS_EMAIL_DOMAINS.some((domain) => e.endsWith('@' + domain.toLowerCase()));
}
