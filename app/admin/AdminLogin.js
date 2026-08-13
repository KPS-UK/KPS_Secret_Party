'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!password) {
      setError('Enter the admin password');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Incorrect password');
        return;
      }
      router.refresh();
    } catch (err) {
      setError('Something went wrong, try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="admin-card">
      <h2>Sign in</h2>
      <div className="field-group">
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
        />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Checking...' : 'Sign in'}
      </button>
    </form>
  );
}
