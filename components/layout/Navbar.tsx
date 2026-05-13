'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function UserAvatar({ name, email }: Readonly<{ name?: string | null; email?: string | null }>) {
  const source = (name || email || '').trim();
  const initials =
    source
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join('') || 'U';

  return (
    <div
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-indigo-500 text-[10px] font-semibold text-white shadow-sm ring-1 ring-primary/30"
    >
      {initials}
    </div>
  );
}

export function Navbar() {
  const { data: session, status } = useSession();

  let authActions: React.ReactNode = null;
  if (status === 'authenticated' && session?.user) {
    authActions = (
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-full border border-hairline bg-card/80 py-1 pl-1 pr-3 shadow-sm sm:flex">
          <UserAvatar name={session.user.name} email={session.user.email} />
          <span
            className="max-w-56 truncate text-xs font-medium text-foreground"
            title={session.user.email ?? ''}
          >
            {session.user.name ?? session.user.email ?? 'Signed in'}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void signOut({ callbackUrl: '/signin' })}
        >
          Sign out
        </Button>
      </div>
    );
  } else if (status === 'unauthenticated') {
    authActions = (
      <Link href="/signin" className={cn(buttonVariants({ variant: 'default', size: 'sm' }))}>
        Sign in
      </Link>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-card/80 backdrop-blur-md supports-backdrop-filter:bg-card/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <Link
          href="/"
          className="group flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-md"
        >
          <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-primary to-indigo-500 text-primary-foreground shadow-[0_6px_16px_-6px_color-mix(in_oklab,var(--primary)_60%,transparent)] ring-1 ring-primary/30">
            <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2.25} />
            <span
              aria-hidden
              className="absolute inset-0 rounded-lg bg-linear-to-b from-white/25 to-transparent"
            />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-semibold tracking-tight text-foreground">Repo Audit</span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Azure DevOps · Dependency security
            </span>
          </span>
        </Link>

        {authActions}
      </div>
    </header>
  );
}
