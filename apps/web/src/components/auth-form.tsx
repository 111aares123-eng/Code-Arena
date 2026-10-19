'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { login, logout, register, type AuthUser } from '../lib/auth';

type AuthFormProps = {
  mode: 'login' | 'register';
  audience: 'learner' | 'mentor';
};

function dashboardFor(user: AuthUser) {
  return user.role === 'STUDENT' ? '/dashboard' : '/admin';
}

export function AuthForm({ mode, audience }: AuthFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isRegister = mode === 'register';
  const isMentor = audience === 'mentor';
  const focusStyle = isMentor
    ? 'focus:border-violet-400 focus:ring-violet-500/30'
    : 'focus:border-indigo-400 focus:ring-indigo-500/30';
  const linkStyle = isMentor
    ? 'text-violet-300 hover:text-violet-200'
    : 'text-indigo-300 hover:text-indigo-200';
  const buttonStyle = isMentor
    ? 'bg-violet-600 shadow-violet-600/25 hover:bg-violet-500 focus-visible:outline-violet-300'
    : 'bg-indigo-600 shadow-indigo-600/25 hover:bg-indigo-500 focus-visible:outline-indigo-300';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    try {
      const result = isRegister
        ? await register({
            username: String(formData.get('username') ?? ''),
            displayName: String(formData.get('name') ?? ''),
            email,
            password,
          })
        : await login({ email, password });

      const userIsMentor = result.user.role === 'INSTRUCTOR' || result.user.role === 'ADMIN';
      const audienceIsMentor = audience === 'mentor';
      if (userIsMentor !== audienceIsMentor) {
        const correctLogin = userIsMentor ? '/admin/login' : '/login';
        const roleLabel = userIsMentor ? 'mentor' : 'learner';
        try {
          await logout();
          router.refresh();
          setError(
            `This account is for ${roleLabel}s. You have been logged out; sign in at ${correctLogin} instead.`
          );
        } catch {
          setError(
            `This account is for ${roleLabel}s. We could not clear its session; please sign out and use ${correctLogin}.`
          );
        }
        return;
      }

      router.push(dashboardFor(result.user));
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to complete the request.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ca-enter ca-enter-4 min-w-0 space-y-5">
      {isRegister && (
        <div>
          <label htmlFor="username" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_]{3,30}"
            title="Use 3 to 30 letters, numbers, or underscores."
            className={`mb-5 w-full min-w-0 rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none transition-colors focus:ring-2 ${focusStyle}`}
          />
          <label htmlFor="name" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Display name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            className={`w-full min-w-0 rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none transition-colors focus:ring-2 ${focusStyle}`}
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={`w-full min-w-0 rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none transition-colors focus:ring-2 ${focusStyle}`}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
          minLength={isRegister ? 8 : undefined}
          className={`w-full min-w-0 rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-3 text-sm text-white outline-none transition-colors focus:ring-2 ${focusStyle}`}
        />
      </div>

      {error && (
        <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100" role="alert">
          {error.includes('/admin/login') ? (
            <>
              {error.split('/admin/login')[0]}
              <Link href="/admin/login" className="font-semibold text-indigo-200 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300">
                /admin/login
              </Link>
              {error.split('/admin/login')[1]}
            </>
          ) : error.includes('/login') ? (
            <>
              {error.split('/login')[0]}
              <Link href="/login" className="font-semibold text-indigo-200 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300">
                /login
              </Link>
              {error.split('/login')[1]}
            </>
          ) : (
            error
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={`ca-button-glow ${isMentor ? 'ca-button-glow-mentor' : ''} relative isolate inline-flex min-h-12 w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${buttonStyle}`}
      >
        {isSubmitting ? 'Please wait…' : isRegister ? 'Create learner account' : 'Log in'}
      </button>

      {audience === 'learner' ? (
        <p className="text-center text-sm leading-6 text-zinc-400">
          {isRegister ? 'Already have an account? ' : 'New to CodeArena? '}
          <Link href={isRegister ? '/login' : '/register'} className={`font-semibold ${linkStyle} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300`}>
            {isRegister ? 'Log in' : 'Create a learner account'}
          </Link>
        </p>
      ) : (
        <p className="text-center text-sm leading-6 text-zinc-400">
          Mentor accounts are created by invitation from the institution.
        </p>
      )}
    </form>
  );
}
