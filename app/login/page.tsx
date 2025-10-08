"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch('/api/admin/login', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Unexpected response while logging in');
      }

      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-10 shadow-xl shadow-blue-500/10">
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">Catalog Admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-neutral-900">Welcome back</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Press login to enter the connectivity dashboard.
          </p>
        </div>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isSubmitting) {
              void handleLogin();
            }
          }}
        >
          <button
            type="submit"
            className="group relative flex items-center justify-center rounded-full px-6 py-3 text-base font-medium text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-80"
            disabled={isSubmitting}
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#0070f3] via-[#4f8cff] to-[#3291ff] shadow-[0_20px_45px_rgba(79,140,255,0.35)] transition group-hover:brightness-110" />
            <span className="relative">{isSubmitting ? 'Logging in…' : 'Login'}</span>
          </button>
          {error ? (
            <p className="text-center text-sm text-red-500">{error}</p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
