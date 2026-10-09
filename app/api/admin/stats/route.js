import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';
import { kpsEmailPatterns } from '../../../../lib/kps';

export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const sql = getDb();
  const kps = kpsEmailPatterns();
  const rows = await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE LOWER(email) LIKE ANY(${kps}::text[]))::int AS kps_total,
           COUNT(*) FILTER (WHERE rsvp_status = 'attending')::int AS attending,
           COUNT(*) FILTER (
             WHERE rsvp_status = 'attending' AND LOWER(email) LIKE ANY(${kps}::text[])
           )::int AS kps_attending,
           COUNT(*) FILTER (WHERE rsvp_status = 'not_attending')::int AS declined,
           COUNT(*) FILTER (WHERE rsvp_status IS NULL)::int AS no_response,
           COUNT(*) FILTER (WHERE attended IS TRUE)::int AS checked_in,
           COUNT(*) FILTER (WHERE attended IS TRUE AND source = 'walk-in')::int AS walk_ins,
           COUNT(*) FILTER (WHERE rsvp_status = 'attending' AND attended IS NOT TRUE)::int AS attending_not_arrived
    FROM guests
  `;

  return NextResponse.json(rows[0]);
}
