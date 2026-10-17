'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { logout } from '../lib/auth';

type LogoutButtonProps = {
  redirectTo: string;
  className?: string;
};

export function LogoutButton({ redirectTo, className }: LogoutButtonProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setError('');
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace(redirectTo);
      router.refresh();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to log out.');
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className={className ?? 'rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-60'}
      >
        {isLoggingOut ? 'Logging out…' : 'Log out'}
      </button>
      {error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
    </div>
  );
}
