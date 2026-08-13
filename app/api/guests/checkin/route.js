import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

export async function POST(request) {
  const body = await request.json();
  const id = body.id;
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const role = (body.role || '').trim();
  const organisation = (body.organisation || '').trim();

  if (!id || !name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }

  const sql = getDb();
  const updated = await sql`
    UPDATE guests
    SET name = ${name}, email = ${email}, role = ${role}, organisation = ${organisation},
        attended = true, checked_in_at = now(), updated_at = now()
    WHERE id = ${id}
    RETURNING name
  `;

  if (!updated.length) {
    return NextResponse.json({ error: 'That guest could not be found' }, { status: 404 });
  }

  return NextResponse.json({ name: updated[0].name });
}
