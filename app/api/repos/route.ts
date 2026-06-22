import { NextResponse } from 'next/server';
import { listAllRepos } from '@/lib/github';
import { listAllProjects } from '@/lib/gitlab';
import { requireAuthSession } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { accessToken, provider, error: authErr } = await requireAuthSession();
  if (authErr) return authErr;

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, message: 'No access token in session. Please sign out and sign in again.' },
      { status: 401 },
    );
  }

  try {
    if (provider === 'gitlab') {
      const projects = await listAllProjects(accessToken);
      const owners = [...new Set(projects.map((p) => p.namespace.path))];

      return NextResponse.json({
        ok: true,
        message: `${projects.length} projects across ${owners.length} namespace(s)`,
        ownerCount: owners.length,
        repos: projects.map((p) => ({
          id: String(p.id),
          name: p.name,
          owner: p.namespace.path,
          defaultBranch: p.default_branch ?? 'main',
          provider: 'gitlab',
        })),
      });
    }

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
        provider: 'github',
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list repositories';
    console.error('[api/repos] discovery failed:', err);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
