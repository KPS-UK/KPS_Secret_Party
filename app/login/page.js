import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionToken } from '../../lib/auth';
import LoginForm from './LoginForm';

export default async function LoginPage({ searchParams }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('kps_admin')?.value;
  const authed = Boolean(token) && token === getSessionToken();

  const params = await searchParams;
  const next = params?.next || '/';

  // Already signed in (e.g. cookie still valid, or they hit /login
  // directly out of habit) - no need to show the form again.
  if (authed) {
    redirect(next);
  }

  return (
    <div className="page-scroll" style={{ alignItems: 'flex-start', paddingTop: 60 }}>
      <div className="rays" />
      <div className="dots" />
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <img src="/kps-logo.png" alt="KPS" className="logo-img" />
        <h1 className="event-name">KPS Secret Party</h1>
        <LoginForm next={next} />
      </div>
    </div>
  );
}