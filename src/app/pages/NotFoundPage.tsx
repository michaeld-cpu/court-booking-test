import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function NotFoundPage() {
  return (
    <div className="min-h-[70vh] px-6 py-16 sm:px-10">
      <div className="mx-auto flex max-w-3xl items-center justify-center">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm md:p-14">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Error 404
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-900 md:text-5xl">
            Page Not Found
          </h1>
          <p className="mt-4 text-base text-slate-600 md:text-lg">
            The page you are looking for does not exist or has been moved.
          </p>
          <div className="mt-8 flex items-center justify-center">
            <Button asChild size="lg">
              <Link to="/">Go to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
