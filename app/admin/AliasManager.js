'use client';

import { useState, useEffect } from 'react';

export default function AliasManager() {
  const [aliases, setAliases] = useState([]);
  const [organisations, setOrganisations] = useState([]);
  const [organisation, setOrganisation] = useState('');
  const [alias, setAlias] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const response = await fetch('/api/admin/aliases');
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not load alternate names');
        return;
      }
      setAliases(data.aliases || []);
      setOrganisations(data.organisations || []);
    } catch (err) {
      setError('Something went wrong, try again');
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(event) {
    event.preventDefault();
    if (!organisation.trim() || !alias.trim()) {
      setError('Enter the organisation and at least one alternate name');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const response = await fetch('/api/admin/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organisation, alias }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not save');
        return;
      }
      setOrganisation('');
      setAlias('');
      await load();
    } catch (err) {
      setError('Something went wrong, try again');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id) {
    setError('');
    try {
      const response = await fetch(`/api/admin/aliases?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Could not remove');
        return;
      }
      await load();
    } catch (err) {
      setError('Something went wrong, try again');
    }
  }

  const grouped = aliases.reduce((acc, a) => {
    if (!acc[a.organisation]) acc[a.organisation] = [];
    acc[a.organisation].push(a);
    return acc;
  }, {});

  return (
    <form onSubmit={handleAdd} className="admin-card">
      <h2>Alternate organisation names</h2>
      <p className="sub" style={{ textAlign: 'left', marginBottom: 12 }}>
        Add acronyms or other names a company is known by, so searching either one finds the same group.
      </p>

      <div className="field-group">
        <input
          type="text"
          list="alias-org-options"
          placeholder="Organisation (pick from the list)"
          autoComplete="off"
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
        />
        <datalist id="alias-org-options">
          {organisations.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </div>
      <div className="field-group">
        <input
          type="text"
          placeholder="Alternate name, e.g. TWC (separate several with commas)"
          autoComplete="off"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
        />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving...' : 'Add alternate name'}
      </button>

      {loaded && aliases.length === 0 && (
        <p className="admin-summary">No alternate names added yet.</p>
      )}
      {Object.keys(grouped).length > 0 && (
        <div className="admin-summary">
          {Object.keys(grouped).map((org) => (
            <div key={org} style={{ marginTop: 10 }}>
              <p style={{ margin: 0, color: 'var(--white)', fontWeight: 600 }}>{org}</p>
              {grouped[org].map((a) => (
                <p
                  key={a.id}
                  style={{ margin: '4px 0', display: 'flex', justifyContent: 'space-between', gap: 12 }}
                >
                  <span>{a.alias}</span>
                  <span
                    onClick={() => handleRemove(a.id)}
                    style={{ color: 'var(--cyan)', textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    Remove
                  </span>
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
