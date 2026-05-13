'use client';

import { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface PersistenceBannerProps {
  readonly paths: string[];
}

export function PersistenceBanner({ paths }: Readonly<PersistenceBannerProps>) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || paths.length === 0) return null;

  return (
    <div className="relative w-full border-b border-red-200 bg-linear-to-b from-red-50 to-red-50/70">
      <div
        aria-hidden
        className="bg-grid-soft pointer-events-none absolute inset-0 opacity-30 mask-[linear-gradient(to_bottom,black,transparent)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-4 md:px-8">
        <div className="flex items-start gap-3 pr-10">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 ring-1 ring-red-200">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-semibold text-red-900">
                Possible persistence artifacts detected
              </p>
              <span className="text-[11px] uppercase tracking-[0.12em] text-red-700/70">
                Action recommended
              </span>
            </div>
            <p className="text-xs leading-relaxed text-red-900/80">
              Uninstalling packages may not remove these files. Review and delete them in source
              control if unintended.
            </p>
            <ul className="flex flex-wrap gap-1.5 pt-1">
              {paths.map((p) => (
                <li key={p}>
                  <code className="inline-block rounded-md border border-red-200 bg-white/80 px-2 py-1 font-mono text-[11px] text-red-900 shadow-sm">
                    {p}
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss banner"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-red-700/70 transition-colors hover:bg-red-100 hover:text-red-800"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
