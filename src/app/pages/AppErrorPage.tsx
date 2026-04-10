import React from 'react';
import { Button } from '../components/ui/button';

interface AppErrorPageProps {
  onRetry: () => void;
  onGoHome: () => void;
  errorMessage?: string | null;
}

export function AppErrorPage({ onRetry, onGoHome, errorMessage }: AppErrorPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-slate-100 px-6 py-16 sm:px-10">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <div className="w-full rounded-2xl border border-rose-200/70 bg-white/90 p-10 text-center shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur-sm md:p-14">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-600">
            Application Error
          </p>
          <h1 className="mt-3 text-4xl font-bebas uppercase tracking-widest text-slate-900 md:text-5xl">
            Something went wrong
          </h1>
          <p className="mt-4 text-base text-slate-600 md:text-lg">
            An unexpected error occurred. You can retry or return to the home page.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Button variant="outline" size="lg" onClick={onRetry}>
              Try Again
            </Button>
            <Button size="lg" onClick={onGoHome}>
              Go to Home
            </Button>
          </div>

          {errorMessage ? (
            <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs text-slate-500">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
