import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { isKpsEmail } from '../../../../lib/kps';

export async function POST(request) {
  const body = await request.json();
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const role = (body.role || '').trim();
  const organisation = (body.organisation || '').trim();

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }

  // KPS staff are attending by default, so they are not left as "no response".
  const defaultRsvp = isKpsEmail(email) ? 'attending' : null;

  const sql = getDb();
  const existing = await sql`SELECT id FROM guests WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;

  if (existing.length) {
    const updated = await sql`
      UPDATE guests
      SET name = ${name}, role = ${role}, organisation = ${organisation},
          rsvp_status = COALESCE(rsvp_status, ${defaultRsvp}),
          attended = true, checked_in_at = now(), updated_at = now()
      WHERE id = ${existing[0].id}
      RETURNING name
    `;
    return NextResponse.json({ name: updated[0].name });
  }

  const inserted = await sql`
    INSERT INTO guests (name, email, role, organisation, rsvp_status, attended, checked_in_at, source)
    VALUES (${name}, ${email}, ${role}, ${organisation}, ${defaultRsvp}, true, now(), 'walk-in')
    RETURNING name
  `;

  return NextResponse.json({ name: inserted[0].name });
}
