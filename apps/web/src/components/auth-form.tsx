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
  return user.role === 'mentor' ? '/admin' : '/dashboard';
}

export function AuthForm({ mode, audience }: AuthFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isRegister = mode === 'register';

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
            name: String(formData.get('name') ?? ''),
            email,
            password,
          })
        : await login({ email, password });

      if (result.user.role !== audience) {
        const correctLogin = result.user.role === 'mentor' ? '/admin/login' : '/login';
        try {
          await logout();
          setError(
            `This account is for ${result.user.role}s. You have been logged out; sign in at ${correctLogin} instead.`
          );
        } catch {
          setError(
            `This account is for ${result.user.role}s. We could not clear its session; please sign out and use ${correctLogin}.`
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {isRegister && (
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-zinc-200">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-200">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-200">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
          minLength={isRegister ? 8 : undefined}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-200" role="alert">
          {error.includes('/admin/login') ? (
            <>
              {error.split('/admin/login')[0]}
              <Link href="/admin/login" className="font-semibold text-indigo-300 underline underline-offset-2">
                /admin/login
              </Link>
              {error.split('/admin/login')[1]}
            </>
          ) : error.includes('/login') ? (
            <>
              {error.split('/login')[0]}
              <Link href="/login" className="font-semibold text-indigo-300 underline underline-offset-2">
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
        className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Please wait…' : isRegister ? 'Create learner account' : 'Log in'}
      </button>

      {audience === 'learner' ? (
        <p className="text-center text-sm text-zinc-400">
          {isRegister ? 'Already have an account? ' : 'New to CodeArena? '}
          <Link href={isRegister ? '/login' : '/register'} className="font-medium text-indigo-300 hover:text-indigo-200">
            {isRegister ? 'Log in' : 'Create a learner account'}
          </Link>
        </p>
      ) : (
        <p className="text-center text-sm text-zinc-400">
          Mentor accounts are created by invitation from the institution.
        </p>
      )}
    </form>
  );
}
