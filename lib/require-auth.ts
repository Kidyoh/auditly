import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { Provider } from '@/lib/types';

export async function requireAuthSession() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      accessToken: null,
      provider: null as Provider | null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return {
    session,
    accessToken: session.accessToken ?? null,
    provider: (session.provider ?? 'github') as Provider,
    error: null,
  };
}
