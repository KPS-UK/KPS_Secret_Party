import { cookies } from 'next/headers';
import { getSessionToken } from '../../lib/auth';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('kps_admin')?.value;
  const authed = Boolean(token) && token === getSessionToken();

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
        <div className="brand-row">
          <span className="kps">KPS</span>
        </div>
        <h1 className="headline" style={{ fontSize: 26 }}>
          Guest list
          <br />
          admin
        </h1>
        {authed ? <AdminDashboard /> : <AdminLogin />}
      </div>
    </div>
  );
}