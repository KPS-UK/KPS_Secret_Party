'use client';

import { useState } from 'react';
import AliasManager from './AliasManager';
import ResponseSummary from './ResponseSummary';

export default function AdminDashboard() {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const [statsVersion, setStatsVersion] = useState(0);

  const [clearing, setClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState('');

  const [tidying, setTidying] = useState(false);
  const [tidyChanges, setTidyChanges] = useState(null);
  const [tidyError, setTidyError] = useState('');

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
      setStatsVersion((v) => v + 1);
    } catch (err) {
      setImportError('Something went wrong, try again');
    } finally {
      setImporting(false);
    }
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

  async function handleUndoCheckin(guest) {
    if (!window.confirm(`Undo the check-in for ${guest.name}?`)) return;
    try {
      const response = await fetch('/api/admin/undo-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: guest.email }),
      });
      if (!response.ok) {
        const data = await response.json();
        setStatusError(data.error || 'Could not undo the check-in');
        return;
      }
      setStatusResults((current) =>
        current.map((g) =>
          g.email === guest.email ? { ...g, attended: false, checked_in_at: null } : g
        )
      );
      setStatsVersion((v) => v + 1);
    } catch (err) {
      setStatusError('Something went wrong, try again');
    }
  }

  async function handleClearCheckins() {
    const typed = window.prompt(
      'This clears every check-in and cannot be undone. Only do this before the event. Type CLEAR to continue.'
    );
    if (typed !== 'CLEAR') return;
    setClearMessage('');
    setClearing(true);
    try {
      const response = await fetch('/api/admin/clear-checkins', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        setClearMessage(data.error || 'Could not clear the check-ins');
        return;
      }
      setClearMessage(`${data.cleared} check-in(s) cleared.`);
      setStatusResults([]);
      setStatsVersion((v) => v + 1);
    } catch (err) {
      setClearMessage('Something went wrong, try again');
    } finally {
      setClearing(false);
    }
  }

  async function handleTidy() {
    setTidyError('');
    setTidyChanges(null);
    setTidying(true);
    try {
      const response = await fetch('/api/admin/tidy-organisations', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        setTidyError(data.error || 'Could not update the organisation names');
        return;
      }
      setTidyChanges(data.changes);
    } catch (err) {
      setTidyError('Something went wrong, try again');
    } finally {
      setTidying(false);
    }
  }

  function rsvpLabel(status) {
    if (status === 'attending') return 'Attending';
    if (status === 'not_attending') return "Can't attend";
    return 'No response yet';
  }

  return (
    <>
      <ResponseSummary version={statsVersion} />

      <div className="admin-card">
        <h2>Guest status</h2>
        <form onSubmit={handleStatusSearch} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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
                {g.attended && (
                  <p style={{ margin: '6px 0 0' }}>
                    <span
                      onClick={() => handleUndoCheckin(g)}
                      style={{ color: 'var(--cyan)', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Undo check-in
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleImport} className="admin-card">
        <h2>Import guest list</h2>
        <input
          type="file"
          accept=".xlsx,.xls"
          className="file-input"
          style={{ marginTop: 12 }}
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
              {importResult.added} added, {importResult.updated} updated
              {importResult.totalPeople !== undefined
                ? ` (${importResult.totalPeople} people from ${importResult.totalRows} rows).`
                : ` out of ${importResult.totalRows} rows.`}
            </p>
            {importResult.summary && (
              <p>
                In this file: {importResult.summary.attending} attending,{' '}
                {importResult.summary.declined} can't attend, {importResult.summary.noResponse} no
                response.
              </p>
            )}
            {(importResult.sheets || []).map((sheet) => (
              <p key={sheet.name} style={{ margin: '2px 0' }}>
                {sheet.name}: {sheet.rows} rows,{' '}
                {sheet.kind === 'responses' && "Attending and Can't Attend marks read"}
                {sheet.kind === 'attending' && 'everyone on it is attending'}
                {sheet.kind === 'details' && 'guest details only'}
                {sheet.kind === 'skipped' && `skipped (${sheet.note})`}
              </p>
            ))}
            {importResult.duplicatesMerged > 0 && (
              <p>{importResult.duplicatesMerged} duplicate row(s) merged by email.</p>
            )}
            {importResult.kpsDefaulted > 0 && (
              <p>{importResult.kpsDefaulted} KPS staff set to attending by default.</p>
            )}
            {importResult.possibleDuplicates && importResult.possibleDuplicates.length > 0 && (
              <div>
                <p className="error-line">
                  {importResult.possibleDuplicates.length} name(s) appear under more than one email,
                  so may be counted twice:
                </p>
                {importResult.possibleDuplicates.slice(0, 8).map((d, i) => (
                  <p key={i} className="error-line">
                    {d.name}: {d.emails.join(', ')}
                    {d.attending > 1 ? ` (counted as attending ${d.attending} times)` : ''}
                  </p>
                ))}
                {importResult.possibleDuplicates.length > 8 && (
                  <p className="error-line">
                    and {importResult.possibleDuplicates.length - 8} more
                  </p>
                )}
              </div>
            )}
            {importResult.organisationCorrections && importResult.organisationCorrections.length > 0 && (
              <div>
                <p>
                  {importResult.organisationCorrections.length} people had a company on the client
                  sheet that did not match their work email, and were set to the name their email
                  domain goes by:
                </p>
                {importResult.organisationCorrections.slice(0, 40).map((c, i) => (
                  <p key={i} style={{ margin: '2px 0' }}>
                    {c.name} ({c.email}): {c.from || '(blank)'} changed to {c.to}
                  </p>
                ))}
                {importResult.organisationCorrections.length > 40 && (
                  <p>and {importResult.organisationCorrections.length - 40} more</p>
                )}
              </div>
            )}
            {importResult.mergedPeople && importResult.mergedPeople.length > 0 && (
              <div>
                <p>
                  {importResult.mergedPeople.length} records were merged into one person each,
                  because the same person was listed under more than one email:
                </p>
                {importResult.mergedPeople.slice(0, 40).map((m, i) => (
                  <p key={i} style={{ margin: '2px 0' }}>
                    {m.name}: kept {m.keptEmail}, merged {m.removedEmail}
                  </p>
                ))}
                {importResult.mergedPeople.length > 40 && (
                  <p>and {importResult.mergedPeople.length - 40} more</p>
                )}
              </div>
            )}
            {importResult.renamedPeople && importResult.renamedPeople.length > 0 && (
              <div>
                <p>
                  {importResult.renamedPeople.length} name(s) did not match the email address and
                  were corrected from it:
                </p>
                {importResult.renamedPeople.map((r, i) => (
                  <p key={i} style={{ margin: '2px 0' }}>
                    {r.email}: {r.from} changed to {r.to}
                  </p>
                ))}
              </div>
            )}
            {importResult.staleDuplicates && importResult.staleDuplicates.length > 0 && (
              <div>
                <p>
                  {importResult.staleDuplicates.length} older record(s) were removed, because the
                  person is now in the file under a different email:
                </p>
                {importResult.staleDuplicates.map((d, i) => (
                  <p key={i} style={{ margin: '2px 0' }}>
                    {d.name}: {d.removedEmail} replaced by {d.keptEmail}
                  </p>
                ))}
              </div>
            )}
            {importResult.clientOnly && importResult.clientOnly.length > 0 && (
              <div>
                <p>
                  {importResult.clientOnly.length} people are attending because the client sheet
                  marks them (they are not on the All Sign Ups sheet):
                </p>
                {importResult.clientOnly.map((g, i) => (
                  <p key={i} style={{ margin: '2px 0' }}>
                    {g.name} ({g.email})
                  </p>
                ))}
              </div>
            )}
            {importResult.attendingReset && importResult.attendingReset.length > 0 && (
              <div>
                <p className="error-line">
                  {importResult.attendingReset.length} guest(s) were attending in the app from an
                  earlier import but are not attending in this file, so they were set back to no
                  response:
                </p>
                {importResult.attendingReset.slice(0, 8).map((g, i) => (
                  <p key={i} className="error-line">
                    {g.name} ({g.email})
                  </p>
                ))}
                {importResult.attendingReset.length > 8 && (
                  <p className="error-line">and {importResult.attendingReset.length - 8} more</p>
                )}
              </div>
            )}
            {importResult.conflicts && importResult.conflicts.length > 0 && (
              <div>
                <p className="error-line">
                  {importResult.conflicts.length} person(s) were marked both attending and can't
                  attend, and were counted as attending:
                </p>
                {importResult.conflicts.slice(0, 5).map((c, i) => (
                  <p key={i} className="error-line">
                    {c}
                  </p>
                ))}
              </div>
            )}
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
        <h2>Organisation names</h2>
        <p className="sub" style={{ textAlign: 'left', marginTop: 4 }}>
          Sets each person's company from their work email.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 12 }}
          onClick={handleTidy}
          disabled={tidying}
        >
          {tidying ? 'Updating...' : 'Tidy organisation names'}
        </button>
        {tidyError && <p className="error-text">{tidyError}</p>}
        {tidyChanges && (
          <div className="admin-summary">
            {tidyChanges.length === 0 ? (
              <p>Nothing to change, every name already matches the email address.</p>
            ) : (
              <>
                <p>{tidyChanges.length} people updated:</p>
                {tidyChanges.slice(0, 40).map((c, i) => (
                  <p key={i} style={{ margin: '2px 0' }}>
                    {c.name} ({c.email}): {c.from || '(blank)'} changed to {c.to}
                  </p>
                ))}
                {tidyChanges.length > 40 && <p>and {tidyChanges.length - 40} more</p>}
              </>
            )}
          </div>
        )}
      </div>

      <div className="admin-card">
        <h2>Export</h2>
        <a
          href="/api/admin/export?filter=checked-in"
          className="btn btn-primary"
          style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 12 }}
        >
          Download checked-in list
        </a>
        <a
          href="/api/admin/export"
          className="btn btn-ghost"
          style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 10 }}
        >
          Download full guest list with responses
        </a>
      </div>

      <AliasManager />

      <div className="admin-card">
        <h2>Before the event</h2>
        <p className="sub" style={{ textAlign: 'left', marginTop: 4 }}>
          Clears every check-in, for example after testing.
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 12 }}
          onClick={handleClearCheckins}
          disabled={clearing}
        >
          {clearing ? 'Clearing...' : 'Clear all check-ins'}
        </button>
        {clearMessage && <p className="admin-summary">{clearMessage}</p>}
      </div>
    </>
  );
}
