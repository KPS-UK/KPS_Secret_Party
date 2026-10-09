import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';
import { undoCheckIn } from '../../../../lib/checkins';

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const body = await request.json();
  const email = String(body.email || '').trim();
  if (!email) {
    return NextResponse.json({ error: 'No guest was given' }, { status: 400 });
  }

  const name = await undoCheckIn(getDb(), email);
  if (!name) {
    return NextResponse.json({ error: 'That guest could not be found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, name });
}
