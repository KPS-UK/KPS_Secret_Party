import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const sql = getDb();
  const results = await sql`
    SELECT name, email, organisation, role, rsvp_status, attended, checked_in_at
    FROM guests
    WHERE name ILIKE ${'%' + q + '%'} OR email ILIKE ${'%' + q + '%'}
    ORDER BY name ASC
    LIMIT 10
  `;

  return NextResponse.json({ results });
}