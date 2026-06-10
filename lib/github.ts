import type { GitHubRepo, GitHubTreeItem, GitHubTreeResponse } from './types';

const GITHUB_API = 'https://api.github.com';

function buildHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Lists all repos accessible to the authenticated user (owned, collaborator, org member). Paginated. */
export async function listAllRepos(token: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const params = new URLSearchParams({
      affiliation: 'owner,collaborator',
      per_page: String(perPage),
      page: String(page),
    });
    const res = await fetch(`${GITHUB_API}/user/repos?${params}`, {
      headers: buildHeaders(token),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitHub API error ${res.status} listing repos: ${text.slice(0, 300)}`);
    }

    const batch = (await res.json()) as GitHubRepo[];
    repos.push(...batch);

    if (batch.length < perPage) break;
    page++;
  }

  return repos;
}

/** Returns the authenticated user's GitHub login. */
export async function getAuthenticatedUser(token: string): Promise<string> {
  const res = await fetch(`${GITHUB_API}/user`, { headers: buildHeaders(token) });
  if (!res.ok) return '';
  const data = (await res.json()) as { login: string };
  return data.login ?? '';
}

/** Returns a flat list of all file paths in the repo's default branch (recursive tree walk). */
export async function getRepoTree(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<GitHubTreeItem[]> {
  const ref = branch.replace(/^refs\/heads\//, '');
  const res = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    { headers: buildHeaders(token) },
  );

  if (!res.ok) {
    if (res.status === 404) return [];
    const text = await res.text().catch(() => '');
    throw new Error(
      `GitHub API error ${res.status} fetching tree for ${owner}/${repo}: ${text.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as GitHubTreeResponse;
  return data.tree ?? [];
}

/** Returns raw text content of a file at the given path/ref. Returns '' on 404 or >1 MB. */
export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string> {
  const cleanRef = ref.replace(/^refs\/heads\//, '');
  const url = `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.replace(/^\//, '')}?ref=${encodeURIComponent(cleanRef)}`;
  const res = await fetch(url, { headers: buildHeaders(token) });

  if (!res.ok) {
    // 403 = file too large (>1 MB), 404 = not found — both are non-fatal
    return '';
  }

  const data = (await res.json()) as { content?: string; encoding?: string };
  if (data.encoding === 'base64' && data.content) {
    return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
  }
  return '';
}
