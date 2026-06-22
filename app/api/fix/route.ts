import { NextRequest, NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/require-auth';
import { createAutoFix } from '@/lib/fixer';
import type { VulnPackage, Provider } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface FixRequestBody {
  owner: string;
  repoName: string;
  branch: string;
  provider: Provider;
  projectId?: number;
  pkg: VulnPackage;
}

export async function POST(req: NextRequest) {
  const { accessToken, error: authErr } = await requireAuthSession();
  if (authErr) return authErr;

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: 'No access token in session.' },
      { status: 401 },
    );
  }

  let body: FixRequestBody;
  try {
    body = (await req.json()) as FixRequestBody;
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request body.' }, { status: 400 });
  }

  const { owner, repoName, branch, provider, projectId = null, pkg } = body;

  if (!owner || !repoName || !branch || !provider || !pkg) {
    return NextResponse.json(
      { ok: false, message: 'Missing required fields: owner, repoName, branch, provider, pkg.' },
      { status: 400 },
    );
  }

  try {
    const { prUrl, newVersion } = await createAutoFix(
      accessToken,
      provider,
      owner,
      repoName,
      branch,
      projectId,
      pkg,
    );
    return NextResponse.json({ ok: true, prUrl, newVersion });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create fix';
    console.error('[api/fix] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
