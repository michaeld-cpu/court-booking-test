import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  action?: React.ReactNode;
  wrapperClassName?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  wrapperClassName,
}: EmptyStateProps) {
  return (
    <div
      className={
        wrapperClassName ??
        'min-h-screen flex items-center justify-center px-4 py-12'
      }
    >
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full">
          {icon}
        </div>
        <div className="mt-6 space-y-2">
          <p className="font-bebas text-[2rem] uppercase text-gray-900 leading-none">{title}</p>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        {action && <div className="mt-6 space-y-3 mx-6">{action}</div>}
      </div>
    </div>
  );
}
