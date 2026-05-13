import type { AzureRepo, AzureItemsResponse, AzureItem } from './types';

const API_VERSION = '7.1';

function buildHeaders(pat: string): HeadersInit {
  const token = Buffer.from(`:${pat}`).toString('base64');
  return {
    Authorization: `Basic ${token}`,
    'Content-Type': 'application/json',
    // X-TFS-FedAuthRedirect=Suppress turns Azure DevOps's HTML sign-in redirect
    // (returned when a PAT is invalid/expired) into a proper 401. Without this,
    // bad-PAT responses arrive as 200/203 with HTML, breaking JSON parsing.
    'X-TFS-FedAuthRedirect': 'Suppress',
    Accept: 'application/json',
  };
}

/**
 * Throws a clear error if Azure DevOps returned the HTML sign-in page instead
 * of JSON. This happens when the PAT is missing/expired/lacks scope, and the
 * response can still be a 200 — we have to inspect Content-Type ourselves.
 */
function ensureJsonResponse(res: Response, context: string): void {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return;
  throw new Error(
    `Azure DevOps returned a non-JSON response (${res.status} ${res.headers.get('content-type') ?? 'unknown content-type'}) while ${context}. ` +
      `This almost always means AZURE_PAT is invalid, expired, or lacks the required scopes ` +
      `(Code: Read and Project and Team: Read). Regenerate the PAT and update .env.`,
  );
}

export async function listRepositories(orgUrl: string, pat: string, project: string): Promise<AzureRepo[]> {
  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/git/repositories?api-version=${API_VERSION}`;
  const res = await fetch(url, { headers: buildHeaders(pat) });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Azure API error ${res.status} listing repos for project "${project}": ${text.slice(0, 300)}`);
  }

  ensureJsonResponse(res, `listing repos for project "${project}"`);
  const data = (await res.json()) as { value: AzureRepo[]; count: number };
  return data.value ?? [];
}

export async function listAllRepositories(
  orgUrl: string,
  pat: string,
  projects: string[],
): Promise<AzureRepo[]> {
  const results = await Promise.allSettled(projects.map((p) => listRepositories(orgUrl, pat, p)));
  const repos: AzureRepo[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') repos.push(...r.value);
  }
  return repos;
}

/** Lists every team project name in the organization (paged via $skip/$top). */
export async function listAllProjectNames(orgUrl: string, pat: string): Promise<string[]> {
  const names: string[] = [];
  const pageSize = 500;
  let skip = 0;

  while (true) {
    const params = new URLSearchParams({
      'api-version': API_VERSION,
      $top: String(pageSize),
      $skip: String(skip),
    });
    const url = `${orgUrl}/_apis/projects?${params}`;
    const res = await fetch(url, { headers: buildHeaders(pat) });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Azure API error ${res.status} listing projects: ${text.slice(0, 300)}`);
    }

    ensureJsonResponse(res, 'listing projects');
    const data = (await res.json()) as { value?: { name: string }[] };
    const batch = data.value ?? [];
    names.push(...batch.map((p) => p.name));
    skip += batch.length;
    if (batch.length === 0 || batch.length < pageSize) break;
  }

  return names;
}

export async function listRepoItems(
  orgUrl: string,
  pat: string,
  project: string,
  repoId: string,
  scopePath = '/',
): Promise<AzureItem[]> {
  const params = new URLSearchParams({
    recursionLevel: 'Full',
    scopePath,
    'api-version': API_VERSION,
  });
  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/git/repositories/${repoId}/items?${params}`;
  const res = await fetch(url, { headers: buildHeaders(pat) });

  if (!res.ok) {
    if (res.status === 404) return [];
    const text = await res.text().catch(() => '');
    throw new Error(`Azure API error ${res.status} listing items for repo ${repoId}: ${text.slice(0, 300)}`);
  }

  ensureJsonResponse(res, `listing items for repo ${repoId}`);
  const data = (await res.json()) as AzureItemsResponse;
  return data.value ?? [];
}

export async function getFileContent(
  orgUrl: string,
  pat: string,
  project: string,
  repoId: string,
  path: string,
  branch?: string,
): Promise<string> {
  const params = new URLSearchParams({
    path,
    'api-version': API_VERSION,
    '$format': 'text',
  });
  if (branch) params.set('versionDescriptor.version', branch.replace('refs/heads/', ''));

  const url = `${orgUrl}/${encodeURIComponent(project)}/_apis/git/repositories/${repoId}/items?${params}`;
  const res = await fetch(url, {
    headers: {
      ...buildHeaders(pat),
      Accept: 'text/plain',
    },
  });

  if (!res.ok) {
    if (res.status === 404) return '';
    throw new Error(`Azure API error ${res.status} fetching file ${path}`);
  }

  return res.text();
}

export async function testConnection(orgUrl: string, pat: string): Promise<{ ok: boolean; message: string }> {
  try {
    const url = `${orgUrl}/_apis/projects?api-version=${API_VERSION}&$top=1`;
    const res = await fetch(url, { headers: buildHeaders(pat) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          message:
            `Azure DevOps rejected the PAT (HTTP ${res.status}). Verify AZURE_PAT is valid, not expired, ` +
            `and has Code: Read + Project and Team: Read scopes.`,
        };
      }
      return { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        message:
          'Azure DevOps returned a sign-in page instead of JSON. AZURE_PAT is likely invalid or expired. ' +
          'Generate a new PAT (https://dev.azure.com/<org>/_usersSettings/tokens) with Code: Read and ' +
          'Project and Team: Read, then update .env.',
      };
    }
    return { ok: true, message: 'Connection successful' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}
