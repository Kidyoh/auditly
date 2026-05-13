import { NextResponse } from 'next/server';
import {
  listAllProjectNames,
  listAllRepositories,
  testConnection,
} from '@/lib/azure';
import { requireAuthSession } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

/** Discovers every Git repository across all Azure DevOps projects (no audit). */
export async function GET() {
  const { error: authErr } = await requireAuthSession();
  if (authErr) return authErr;

  const orgUrl = process.env.AZURE_ORG_URL?.trim() ?? '';
  const pat = process.env.AZURE_PAT?.trim() ?? '';

  if (!orgUrl || !pat) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Azure is not configured. Set AZURE_ORG_URL and AZURE_PAT on the server.',
      },
      { status: 503 },
    );
  }

  const connectionTest = await testConnection(orgUrl, pat);
  if (!connectionTest.ok) {
    return NextResponse.json({ ok: false, message: connectionTest.message }, { status: 401 });
  }

  try {
    const projects = await listAllProjectNames(orgUrl, pat);
    const repos = await listAllRepositories(orgUrl, pat, projects);

    return NextResponse.json({
      ok: true,
      message: `${repos.length} repositories across ${projects.length} project(s)`,
      projectCount: projects.length,
      repos: repos.map((r) => ({
        id: r.id,
        name: r.name,
        project: r.project.name,
        defaultBranch: r.defaultBranch?.replace(/^refs\/heads\//, '') ?? 'main',
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list repositories';
    console.error('[api/repos] discovery failed:', err);
    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
