import { NextResponse } from 'next/server';
import { checkPassword, getSessionToken } from '../../../../lib/auth';

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
    maxAge: 60 * 60 * 8,
  });
  return response;
}
