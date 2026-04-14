import React from 'react';
import { Mail, MessageSquare, Phone } from 'lucide-react';

export function ContactUs() {
  return (
    <div className="relative min-h-svh overflow-hidden flex flex-col items-center justify-center px-4 py-20">


      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xl w-full">
        {/* Eyebrow */}
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.25em] text-slate-900">
          Contact Us
        </p>

        {/* Big Bebas heading */}
        <h1 className="font-bebas text-[clamp(3rem,14vw,6rem)] leading-none uppercase text-slate-950">
          Coming Soon
        </h1>

        {/* Lime divider */}
        <div className="mt-5 mb-7 h-[3px] w-16 bg-slate-300 rounded-full" />

        {/* Body copy */}
        <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-sm">
          We are preparing a better support experience for you.
        </p>

        {/* Channel chips */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {[
            { icon: <Mail className="size-4" />, label: 'Email' },
            { icon: <Phone className="size-4" />, label: 'Phone' },
            { icon: <MessageSquare className="size-4" />, label: 'Live Chat' },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-400"
            >
              {icon}
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
