import { NextResponse } from 'next/server';
import { listAllRepos } from '@/lib/github';
import { requireAuthSession } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

/** Discovers every GitHub repository the authenticated user has access to. */
export async function GET() {
  const { accessToken, error: authErr } = await requireAuthSession();
  if (authErr) return authErr;

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: 'No GitHub access token in session. Please sign out and sign in again.' },
      { status: 401 },
    );
  }

  try {
    const repos = await listAllRepos(accessToken);
    const owners = [...new Set(repos.map((r) => r.owner.login))];

    return NextResponse.json({
      ok: true,
      message: `${repos.length} repositories across ${owners.length} owner(s)`,
      ownerCount: owners.length,
      repos: repos.map((r) => ({
        id: String(r.id),
        name: r.name,
        owner: r.owner.login,
        defaultBranch: r.default_branch ?? 'main',
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list repositories';
    console.error('[api/repos] discovery failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
