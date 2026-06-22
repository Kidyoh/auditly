import { NextRequest, NextResponse } from 'next/server';
import { requireAuthSession } from '@/lib/require-auth';
import { createAutoFixAll } from '@/lib/fixer';
import type { VulnPackage, Provider } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface FixRequestBody {
  owner: string;
  repoName: string;
  branch: string;
  provider: Provider;
  projectId?: number | null;
  vulnPackages: VulnPackage[];
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

  const { owner, repoName, branch, provider, projectId = null, vulnPackages } = body;

  if (!owner || !repoName || !branch || !provider || !Array.isArray(vulnPackages) || vulnPackages.length === 0) {
    return NextResponse.json(
      { ok: false, message: 'Missing required fields: owner, repoName, branch, provider, vulnPackages.' },
      { status: 400 },
    );
  }

  try {
    const result = await createAutoFixAll(
      accessToken,
      provider,
      owner,
      repoName,
      branch,
      projectId ?? null,
      vulnPackages,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create fix';
    console.error('[api/fix] failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
