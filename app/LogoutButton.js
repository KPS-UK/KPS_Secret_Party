'use client';

import { usePathname } from 'next/navigation';

export default function LogoutButton() {
  const pathname = usePathname();

  if (pathname === '/login') return null;

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <button onClick={handleLogout} className="logout-btn" type="button">
      Sign out
    </button>
  );
}
