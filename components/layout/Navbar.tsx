'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

function UserAvatar({
  name,
  email,
  image,
}: Readonly<{ name?: string | null; email?: string | null; image?: string | null }>) {
  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? email ?? 'User avatar'}
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-full ring-1 ring-primary/30"
        unoptimized
      />
    );
  }

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
          <UserAvatar
            name={session.user.name}
            email={session.user.email}
            image={session.user.image}
          />
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
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-card/80 backdrop-blur-md supports-backdrop-filter:bg-card/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <Link
          href="/"
          className="group flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-md"
        >
          <Image
            src="/logo.png"
            alt="Auditly logo"
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg object-contain"
            priority
          />
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Auditly</span>
        </Link>

        {authActions}
      </div>
    </header>
  );
}
