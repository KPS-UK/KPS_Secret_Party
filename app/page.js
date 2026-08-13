'use client';

import { useState, useEffect } from 'react';

const EMPTY_FORM = { id: null, name: '', email: '', role: '', organisation: '' };

export default function CheckInPage() {
  const [screen, setScreen] = useState('search');
  const [searchValue, setSearchValue] = useState('');
  const [searchError, setSearchError] = useState('');
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showEdit, setShowEdit] = useState(false);
  const [formError, setFormError] = useState('');
  const [welcomeName, setWelcomeName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (screen !== 'welcome') return;
    const timer = setTimeout(() => {
      resetAndReturn();
    }, 10000);
    return () => clearTimeout(timer);
  }, [screen]);

  async function handleSearch(event) {
    event.preventDefault();
    const value = searchValue.trim();
    if (!value) {
      setSearchError('Enter your name to continue');
      return;
    }
    setSearchError('');
    setSubmitting(true);
    try {
      const response = await fetch(`/api/guests/search?q=${encodeURIComponent(value)}`);
      const data = await response.json();
      const results = data.results || [];

      if (results.length === 0) {
        setForm({ ...EMPTY_FORM, name: value });
        setFormError('');
        setScreen('new');
      } else if (results.length === 1) {
        selectMatch(results[0]);
      } else {
        setMatches(results);
        setScreen('matches');
      }
    } catch (err) {
      setSearchError('Something went wrong, try again');
    } finally {
      setSubmitting(false);
    }
  }

  function selectMatch(guest) {
    setForm({
      id: guest.id,
      name: guest.name,
      email: guest.email,
      role: guest.role,
      organisation: guest.organisation,
    });
    setShowEdit(false);
    setScreen('confirm');
  }

  async function handleConfirm() {
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Name and email are required');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/guests/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setFormError(data.error || 'Something went wrong, try again');
        return;
      }
      setWelcomeName(data.name);
      setScreen('welcome');
    } catch (err) {
      setFormError('Something went wrong, try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister() {
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Fill in your name and email to continue');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/guests/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setFormError(data.error || 'Something went wrong, try again');
        return;
      }
      setWelcomeName(data.name);
      setScreen('welcome');
    } catch (err) {
      setFormError('Something went wrong, try again');
    } finally {
      setSubmitting(false);
    }
  }

  function resetAndReturn() {
    setSearchValue('');
    setSearchError('');
    setMatches([]);
    setForm(EMPTY_FORM);
    setShowEdit(false);
    setFormError('');
    setWelcomeName('');
    setScreen('search');
  }

  function goToNewGuest(prefillName) {
    setForm({ ...EMPTY_FORM, name: prefillName || '' });
    setFormError('');
    setScreen('new');
  }

  return (
    <div className="page">
      <div className="rays" />
      <div className="dots" />
      <div className="phone">
        {screen === 'search' && (
          <>
            <img src="/kps-logo.png" alt="KPS" className="logo-img" />
            <h1 className="event-name">KPS Secret Party</h1>
            <p className="welcome-text">Welcome</p>
            <p className="sub">Please check in below</p>
            <form onSubmit={handleSearch}>
              <div className="field-group" style={{ marginTop: 28 }}>
                <input
                  type="text"
                  id="search-input"
                  placeholder="Name"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
                {searchError && <p className="error-text">{searchError}</p>}
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Searching...' : 'Find my invite'}
              </button>
            </form>
            <div className="spacer" />
          </>
        )}

        {screen === 'matches' && (
          <>
            <div className="brand-row">
              <span className="kps">KPS</span>
            </div>
            <h1 className="headline" style={{ fontSize: 28 }}>
              A few names
              <br />
              match
            </h1>
            <p className="sub">Tap yours to continue</p>
            <div className="match-list">
              {matches.map((guest) => (
                <button key={guest.id} className="match-item" onClick={() => selectMatch(guest)}>
                  <p className="name">{guest.name}</p>
                  <p className="meta">
                    {guest.role}
                    {guest.role && guest.organisation ? ' at ' : ''}
                    {guest.organisation}
                  </p>
                </button>
              ))}
            </div>
            <p className="helper-link">
              None of these are you?{' '}
              <span onClick={() => goToNewGuest(searchValue)}>Register here</span>
            </p>
            <div className="spacer" />
            <button className="btn btn-ghost" onClick={() => setScreen('search')}>
              Back to search
            </button>
          </>
        )}

        {screen === 'confirm' && (
          <>
            <div className="brand-row">
              <span className="kps">KPS</span>
            </div>
            <h1 className="headline" style={{ fontSize: 28 }}>
              You&apos;re on
              <br />
              the list
            </h1>
            <p className="sub">Check your details are correct</p>

            {!showEdit && (
              <div className="card">
                <p className="name">{form.name}</p>
                <p className="role">
                  {form.role}
                  {form.role && form.organisation ? ' at ' : ''}
                  {form.organisation}
                </p>
                <div className="kv">
                  <span>Email</span>
                  <span>{form.email}</span>
                </div>
                <div className="kv">
                  <span>Organisation</span>
                  <span>{form.organisation}</span>
                </div>
              </div>
            )}

            {!showEdit && (
              <p className="edit-toggle" onClick={() => setShowEdit(true)}>
                Edit my details
              </p>
            )}

            {showEdit && (
              <>
                <div className="field-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label>Email address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label>Role</label>
                  <input
                    type="text"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label>Organisation</label>
                  <input
                    type="text"
                    value={form.organisation}
                    onChange={(e) => setForm({ ...form, organisation: e.target.value })}
                  />
                </div>
              </>
            )}

            {formError && <p className="error-text">{formError}</p>}

            <button
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? 'Checking in...' : 'Confirm and check in'}
            </button>
            <button className="btn btn-ghost" onClick={() => setScreen('search')}>
              Back to search
            </button>
            <div className="spacer" />
          </>
        )}

        {screen === 'new' && (
          <>
            <div className="brand-row">
              <span className="kps">KPS</span>
            </div>
            <h1 className="headline" style={{ fontSize: 26 }}>
              Let&apos;s get you
              <br />
              on the list
            </h1>
            <p className="sub">We couldn&apos;t find a pre-registration, add your details below</p>
            <div className="field-group">
              <label>Name</label>
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label>Email address</label>
              <input
                type="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label>Role</label>
              <input
                type="text"
                placeholder="Your job title"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label>Organisation</label>
              <input
                type="text"
                placeholder="Company name"
                value={form.organisation}
                onChange={(e) => setForm({ ...form, organisation: e.target.value })}
              />
            </div>
            {formError && <p className="error-text">{formError}</p>}
            <button
              className="btn btn-primary"
              style={{ marginTop: 8 }}
              onClick={handleRegister}
              disabled={submitting}
            >
              {submitting ? 'Registering...' : 'Register and check in'}
            </button>
            <button className="btn btn-ghost" onClick={() => setScreen('search')}>
              Back to search
            </button>
            <div className="spacer" />
          </>
        )}

        {screen === 'welcome' && (
          <>
            <div className="welcome-icon" style={{ marginTop: 32 }}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#3bd6c9"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="32"
                height="32"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h1 className="headline" style={{ fontSize: 30, marginTop: 8 }}>
              Welcome,
              <br />
              <span
                className="script"
                style={{ fontSize: 38, display: 'inline-block', padding: '10px 0' }}
              >
                {welcomeName || 'Guest'}
              </span>
            </h1>
            <p className="sub" style={{ fontSize: 20 }}>
              Enjoy the party.
            </p>
            <div className="spacer" />
            <button className="btn btn-primary" onClick={resetAndReturn}>
              Done - next guest
            </button>
          </>
        )}
      </div>
    </div>
  );
}
