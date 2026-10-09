import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export async function POST(request) {
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: 'Tick at least one person' }, { status: 400 });
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: 'Too many people selected at once' }, { status: 400 });
  }

  const sql = getDb();
  // Skips anyone already checked in, so their original check-in time is kept.
  const updated = await sql`
    UPDATE guests
    SET attended = true, checked_in_at = now(), updated_at = now()
    WHERE id = ANY(${ids}) AND attended IS NOT TRUE
    RETURNING name
  `;

  if (!updated.length) {
    return NextResponse.json({ error: 'Those guests are already checked in' }, { status: 409 });
  }

  return NextResponse.json({ names: updated.map((g) => g.name) });
}
