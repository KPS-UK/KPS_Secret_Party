'use client';

import { useEffect, useState } from 'react';

export default function ResponseSummary({ version }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  // Reloads whenever `version` changes, which the dashboard bumps after an import.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setError(data.error || 'Could not load the summary');
          return;
        }
        setError('');
        setStats(data);
      } catch (err) {
        if (!cancelled) setError('Something went wrong, try again');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [version]);

  // [label, value, indented]
  const rows = stats
    ? [
        ['Total guests', stats.total, false],
        ['KPS staff', stats.kps_total, true],
        ['External guests', stats.total - stats.kps_total, true],
        ['Attending', stats.attending, false],
        ['KPS staff', stats.kps_attending, true],
        ['External guests', stats.attending - stats.kps_attending, true],
        ["Can't attend", stats.declined, false],
        ['No response yet', stats.no_response, false],
        ['Checked in', stats.checked_in, false],
        ['Walk-ins checked in', stats.walk_ins, false],
        ['Attending, not arrived yet', stats.attending_not_arrived, false],
      ]
    : [];

  return (
    <div className="admin-card">
      <h2>Responses and check-ins</h2>
      {error && <p className="error-text">{error}</p>}
      {!stats && !error && (
        <p className="sub" style={{ textAlign: 'left' }}>
          Loading...
        </p>
      )}
      {rows.map(([label, value, indented], i) => (
        <div className="kv" key={`${label}-${i}`}>
          <span style={{ paddingLeft: indented ? 16 : 0 }}>{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}
