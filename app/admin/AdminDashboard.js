'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');

  const [statusQuery, setStatusQuery] = useState('');
  const [statusResults, setStatusResults] = useState([]);
  const [statusSearching, setStatusSearching] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  async function handleImport(event) {
    event.preventDefault();
    if (!file) {
      setImportError('Choose an excel file first');
      return;
    }
    setImportError('');
    setImportResult(null);
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/admin/import', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setImportError(data.error || 'Import failed');
        return;
      }
      setImportResult(data);
    } catch (err) {
      setImportError('Something went wrong, try again');
    } finally {
      setImporting(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.refresh();
  }

  async function handleStatusSearch(event) {
    event.preventDefault();
    setHasSearched(true);
    if (!statusQuery.trim()) {
      setStatusResults([]);
      return;
    }
    setStatusError('');
    setStatusSearching(true);
    try {
      const response = await fetch(`/api/admin/guest-status?q=${encodeURIComponent(statusQuery.trim())}`);
      const data = await response.json();
      if (!response.ok) {
        setStatusError(data.error || 'Search failed');
        return;
      }
      setStatusResults(data.results);
    } catch (err) {
      setStatusError('Something went wrong, try again');
    } finally {
      setStatusSearching(false);
    }
  }

  function rsvpLabel(status) {
    if (status === 'attending') return 'Attending';
    if (status === 'not_attending') return "Can't attend";
    return 'No response yet';
  }

  return (
    <>
      <form onSubmit={handleImport} className="admin-card">
        <h2>Import guest list</h2>
        <p className="sub" style={{ textAlign: 'left', marginBottom: 12 }}>
          Upload an excel file with columns: First Name, Last Name, Company Name, Email, Job Title.
          Contact owner, Record ID - Company, Company owner, Attending and Can&apos;t Attend are
          optional and will be saved if present.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          className="file-input"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
        {importError && <p className="error-text">{importError}</p>}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ marginTop: 12 }}
          disabled={importing}
        >
          {importing ? 'Importing...' : 'Import file'}
        </button>
        {importResult && (
          <div className="admin-summary">
            <p>
              {importResult.added} added, {importResult.updated} updated, out of{' '}
              {importResult.totalRows} rows.
            </p>
            {importResult.errors.length > 0 && (
              <div>
                <p className="error-line">{importResult.errors.length} row(s) had a problem:</p>
                {importResult.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="error-line">
                    {e}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </form>

      <div className="admin-card">
        <h2>Export guest list</h2>
        <p className="sub" style={{ textAlign: 'left', marginBottom: 12 }}>
          Download everyone on the list, including who has checked in.
        </p>
        <a
          href="/api/admin/export"
          className="btn btn-primary"
          style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
        >
          Download excel file
        </a>
      </div>

      <div className="admin-card">
        <h2>Check a guest&apos;s status</h2>
        <p className="sub" style={{ textAlign: 'left', marginBottom: 12 }}>
          Search by name or email to see if they&apos;ve confirmed attendance and whether they&apos;ve
          checked in.
        </p>
        <form onSubmit={handleStatusSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Name or email"
            value={statusQuery}
            onChange={(e) => setStatusQuery(e.target.value)}
            style={{
              flex: 1,
              padding: '11px 12px',
              borderRadius: 10,
              border: '1px solid var(--card-border)',
              background: 'var(--input-bg)',
              color: 'var(--white)',
              fontSize: 14,
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 20px' }} disabled={statusSearching}>
            {statusSearching ? '...' : 'Search'}
          </button>
        </form>
        {statusError && <p className="error-text">{statusError}</p>}
        {hasSearched && !statusSearching && statusResults.length === 0 && !statusError && (
          <p className="sub" style={{ textAlign: 'left', marginTop: 12 }}>
            No matches found.
          </p>
        )}
        {statusResults.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {statusResults.map((g) => (
              <div key={g.email} className="admin-summary" style={{ textAlign: 'left' }}>
                <p style={{ fontWeight: 600, margin: 0 }}>{g.name}</p>
                <p className="sub" style={{ textAlign: 'left', margin: '2px 0 8px' }}>
                  {g.role}
                  {g.role && g.organisation ? ' at ' : ''}
                  {g.organisation}
                </p>
                <p style={{ margin: '2px 0' }}>RSVP: {rsvpLabel(g.rsvp_status)}</p>
                <p style={{ margin: '2px 0' }}>
                  Checked in: {g.attended ? 'Yes' : 'No'}
                  {g.attended && g.checked_in_at
                    ? ` (${new Date(g.checked_in_at).toLocaleString('en-GB')})`
                    : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-ghost" onClick={handleLogout} style={{ maxWidth: 420 }}>
        Sign out
      </button>
    </>
  );
}