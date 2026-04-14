import React from 'react';
import { Button } from '../components/ui/button';

interface AppErrorPageProps {
  onRetry: () => void;
  onGoHome: () => void;
  errorMessage?: string | null;
}

export function AppErrorPage({ onRetry, onGoHome, errorMessage }: AppErrorPageProps) {
  return (
    <div className="relative min-h-svh overflow-hidden flex flex-col items-center justify-center px-4 py-20">
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xl w-full">
        {/* Eyebrow */}
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.25em] text-rose-600">
          Application Error
        </p>

        {/* Big Bebas heading */}
        <h1 className="font-bebas text-[clamp(2rem,10vw,4rem)] leading-none uppercase text-slate-950">
          Something went wrong
        </h1>

        {/* Divider */}
        <div className="mt-5 mb-7 h-[3px] w-16 bg-rose-200 rounded-full" />

        {/* Body copy */}
        <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-sm">
          An unexpected error occurred. You can retry or return to the home page.
        </p>

        {/* Action buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button 
            variant="outline" 
            className="h-11 px-8 rounded-full border-slate-200 text-slate-900 font-bold uppercase tracking-widest text-[10px]"
            onClick={onRetry}
          >
            Retry
          </Button>
          <Button 
            className="h-11 px-8 rounded-full bg-black text-white hover:bg-slate-900 font-bold uppercase tracking-widest text-[10px]"
            onClick={onGoHome}
          >
            Go to Home
          </Button>
        </div>

        {/* Debug info */}
        {errorMessage ? (
          <div className="mt-12 w-full max-w-md">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Error Details</p>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-left font-mono text-[10px] text-slate-500 break-words">
              {errorMessage}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
