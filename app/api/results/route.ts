import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { requireAuthSession } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error: authErr } = await requireAuthSession();
  if (authErr) return authErr;

  return NextResponse.json({
    isScanning: store.isScanning,
    result: store.lastResult,
  });
}
