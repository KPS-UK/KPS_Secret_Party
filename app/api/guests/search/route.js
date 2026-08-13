import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const sql = getDb();
  const results = await sql`
    SELECT id, name, email, role, organisation, attended
    FROM guests
    WHERE name ILIKE ${'%' + q + '%'}
    ORDER BY name ASC
    LIMIT 8
  `;

  return NextResponse.json({ results });
}
