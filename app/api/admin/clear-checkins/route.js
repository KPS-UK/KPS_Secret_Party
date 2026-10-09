import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/auth';
import { clearCheckIns } from '../../../../lib/checkins';

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const cleared = await clearCheckIns(getDb());
  return NextResponse.json({ ok: true, cleared });
}
