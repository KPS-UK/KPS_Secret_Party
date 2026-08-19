'use client';

import { useRouter, usePathname } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === '/login') return null;

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="logout-btn" type="button">
      Sign out
    </button>
  );
}