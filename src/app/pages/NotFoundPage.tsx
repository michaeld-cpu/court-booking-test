import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function NotFoundPage() {
  return (
    <div className="relative min-h-svh overflow-hidden flex flex-col items-center justify-center px-4 py-20">
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xl w-full">
        {/* Eyebrow */}
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.25em] text-slate-900">
          Error 404
        </p>

        {/* Big Bebas heading */}
        <h1 className="font-bebas text-[clamp(3rem,14vw,6rem)] leading-none uppercase text-slate-950">
          Not Found
        </h1>

        {/* Divider */}
        <div className="mt-5 mb-7 h-[3px] w-16 bg-slate-300 rounded-full" />

        {/* Body copy */}
        <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-sm">
          The page you are looking for does not exist or has been moved.
        </p>

        {/* Action button */}
        <div className="mt-10">
          <Button asChild className="h-11 px-8 rounded-full bg-black text-white hover:bg-slate-900 font-bold uppercase tracking-widest text-[10px]">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
