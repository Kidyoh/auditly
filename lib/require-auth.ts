import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function requireAuthSession() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      accessToken: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { session, accessToken: session.accessToken ?? null, error: null as null };
}
