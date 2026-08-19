import AdminDashboard from './AdminDashboard';

export default function AdminPage() {
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
        <AdminDashboard />
      </div>
    </div>
  );
}