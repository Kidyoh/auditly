import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function requireAuthSession() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session, error: null as null };
}
