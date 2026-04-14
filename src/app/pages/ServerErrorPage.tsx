import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function ServerErrorPage() {
  return (
    <div className="relative min-h-svh overflow-hidden flex flex-col items-center justify-center px-4 py-20">
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xl w-full">
        {/* Eyebrow */}
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.25em] text-rose-600">
          Error 500
        </p>

        {/* Big Bebas heading */}
        <h1 className="font-bebas text-[clamp(3rem,14vw,6rem)] leading-none uppercase text-slate-950">
          Server Error
        </h1>

        {/* Divider */}
        <div className="mt-5 mb-7 h-[3px] w-16 bg-rose-200 rounded-full" />

        {/* Body copy */}
        <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-sm">
          Something went wrong on our side. Please try again in a moment.
        </p>

        {/* Action buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button 
            variant="outline" 
            className="h-11 px-8 rounded-full border-slate-200 text-slate-900 font-bold uppercase tracking-widest text-[10px]"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
          <Button 
            asChild 
            className="h-11 px-8 rounded-full bg-black text-white hover:bg-slate-900 font-bold uppercase tracking-widest text-[10px]"
          >
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
