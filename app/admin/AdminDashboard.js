'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');

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

  return (
    <>
      <form onSubmit={handleImport} className="admin-card">
        <h2>Import guest list</h2>
        <p className="sub" style={{ textAlign: 'left', marginBottom: 12 }}>
          Upload an excel file with columns: name, email, role, organisation.
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

      <button className="btn btn-ghost" onClick={handleLogout} style={{ maxWidth: 420 }}>
        Sign out
      </button>
    </>
  );
}
