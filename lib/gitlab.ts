import type { GitLabProject, GitLabTreeItem } from './types';

const GITLAB_API = 'https://gitlab.com/api/v4';

function buildHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function encodePath(path: string): string {
  return encodeURIComponent(path.replace(/^\//, ''));
}

export async function listAllProjects(token: string): Promise<GitLabProject[]> {
  const projects: GitLabProject[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const params = new URLSearchParams({
      membership: 'true',
      per_page: String(perPage),
      page: String(page),
    });
    const res = await fetch(`${GITLAB_API}/projects?${params}`, {
      headers: buildHeaders(token),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitLab API error ${res.status} listing projects: ${text.slice(0, 300)}`);
    }

    const batch = (await res.json()) as GitLabProject[];
    projects.push(...batch);

    if (batch.length < perPage) break;
    page++;
  }

  return projects;
}

export async function getAuthenticatedUser(token: string): Promise<string> {
  const res = await fetch(`${GITLAB_API}/user`, { headers: buildHeaders(token) });
  if (!res.ok) return '';
  const data = (await res.json()) as { username: string };
  return data.username ?? '';
}

export async function getProjectTree(
  token: string,
  projectId: number,
  branch: string,
): Promise<GitLabTreeItem[]> {
  const items: GitLabTreeItem[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const params = new URLSearchParams({
      recursive: 'true',
      ref: branch,
      per_page: String(perPage),
      page: String(page),
    });
    const res = await fetch(`${GITLAB_API}/projects/${projectId}/repository/tree?${params}`, {
      headers: buildHeaders(token),
    });

    if (!res.ok) {
      if (res.status === 404) return [];
      const text = await res.text().catch(() => '');
      throw new Error(
        `GitLab API error ${res.status} fetching tree for project ${projectId}: ${text.slice(0, 300)}`,
      );
    }

    const batch = (await res.json()) as GitLabTreeItem[];
    items.push(...batch);

    if (batch.length < perPage) break;
    page++;
  }

  return items;
}

export async function getFileContent(
  token: string,
  projectId: number,
  path: string,
  ref: string,
): Promise<string> {
  const url = `${GITLAB_API}/projects/${projectId}/repository/files/${encodePath(path)}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: buildHeaders(token) });

  if (!res.ok) return '';

  const data = (await res.json()) as { content?: string; encoding?: string };
  if (data.encoding === 'base64' && data.content) {
    return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
  }
  return '';
}

export async function createBranch(
  token: string,
  projectId: number,
  branchName: string,
  ref: string,
): Promise<void> {
  const res = await fetch(`${GITLAB_API}/projects/${projectId}/repository/branches`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({ branch: branchName, ref }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitLab API error ${res.status} creating branch: ${text.slice(0, 300)}`);
  }
}

export async function updateFile(
  token: string,
  projectId: number,
  path: string,
  content: string,
  commitMessage: string,
  branch: string,
): Promise<void> {
  const url = `${GITLAB_API}/projects/${projectId}/repository/files/${encodePath(path)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify({
      branch,
      content,
      commit_message: commitMessage,
      encoding: 'text',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitLab API error ${res.status} updating file: ${text.slice(0, 300)}`);
  }
}

export async function createMergeRequest(
  token: string,
  projectId: number,
  title: string,
  description: string,
  sourceBranch: string,
  targetBranch: string,
): Promise<{ web_url: string }> {
  const res = await fetch(`${GITLAB_API}/projects/${projectId}/merge_requests`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({
      title,
      description,
      source_branch: sourceBranch,
      target_branch: targetBranch,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitLab API error ${res.status} creating MR: ${text.slice(0, 300)}`);
  }

  return res.json() as Promise<{ web_url: string }>;
}
