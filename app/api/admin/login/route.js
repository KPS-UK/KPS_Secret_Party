import { NextResponse } from 'next/server';
import { checkPassword, getSessionToken } from '../../../../lib/auth';
import { SESSION_MAX_AGE } from '../../../../lib/session';

export async function POST(request) {
  const body = await request.json();
  const password = body.password || '';

  if (!checkPassword(password)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('kps_admin', getSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}