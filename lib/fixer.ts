import type { VulnPackage, Ecosystem, Provider } from './types';
import {
  getDefaultBranchSha,
  getFileSha,
  createBranch as ghCreateBranch,
  updateFile as ghUpdateFile,
  createPullRequest,
  getFileContent as ghGetFileContent,
} from './github';
import {
  createBranch as glCreateBranch,
  updateFile as glUpdateFile,
  createMergeRequest,
  getFileContent as glGetFileContent,
} from './gitlab';

// ─── registry lookups ────────────────────────────────────────────────────────

export async function getLatestVersion(
  name: string,
  ecosystem: Ecosystem,
): Promise<string | null> {
  try {
    if (ecosystem === 'npm') {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { 'dist-tags'?: { latest?: string } };
      return data['dist-tags']?.latest ?? null;
    }

    if (ecosystem === 'PyPI') {
      const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
      if (!res.ok) return null;
      const data = (await res.json()) as { info?: { version?: string } };
      return data.info?.version ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

// ─── manifest patching ───────────────────────────────────────────────────────

export function applyVersionToManifest(
  content: string,
  manifestFile: string,
  packageName: string,
  newVersion: string,
): string {
  const fileName = manifestFile.split('/').pop() ?? '';

  if (fileName === 'package.json') {
    return patchPackageJson(content, packageName, newVersion);
  }
  if (fileName === 'requirements.txt') {
    return patchRequirementsTxt(content, packageName, newVersion);
  }
  if (fileName === 'pyproject.toml') {
    return patchPyprojectToml(content, packageName, newVersion);
  }
  return content;
}

function patchPackageJson(content: string, packageName: string, newVersion: string): string {
  try {
    const pkg = JSON.parse(content) as Record<string, unknown>;
    const depFields = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
    let patched = false;

    for (const field of depFields) {
      const deps = pkg[field] as Record<string, string> | undefined;
      if (deps && packageName in deps) {
        const current = deps[packageName];
        // Preserve leading prefix (^, ~, >=, etc.)
        const prefix = /^[^0-9*]/.exec(current)?.[0] ?? '';
        deps[packageName] = `${prefix}${newVersion}`;
        patched = true;
      }
    }

    return patched ? JSON.stringify(pkg, null, 2) + '\n' : content;
  } catch {
    return content;
  }
}

function patchRequirementsTxt(content: string, packageName: string, newVersion: string): string {
  const lines = content.split('\n');
  const namePattern = new RegExp(`^${escapeRegex(packageName)}([>=<!\\s,\\[#]|$)`, 'i');
  return lines
    .map((line) => (namePattern.test(line.trim()) ? `${packageName}>=${newVersion}` : line))
    .join('\n');
}

function patchPyprojectToml(content: string, packageName: string, newVersion: string): string {
  const namePattern = new RegExp(
    `(["']?)${escapeRegex(packageName)}\\1[>=<!~^,\\s]*[\\d][^"'\\s,]*`,
    'gi',
  );
  return content.replace(namePattern, `${packageName}>=${newVersion}`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── main fix orchestrator ───────────────────────────────────────────────────

export interface AutoFixResult {
  prUrl: string;
  newVersion: string;
}

export async function createAutoFix(
  token: string,
  provider: Provider,
  owner: string,
  repoName: string,
  branch: string,
  projectId: number | null,
  pkg: VulnPackage,
): Promise<AutoFixResult> {
  const newVersion = await getLatestVersion(pkg.name, pkg.ecosystem);
  if (!newVersion) {
    throw new Error(`Could not determine latest version for ${pkg.name}`);
  }

  const safeBranchName = `fix/${pkg.name.replace(/[^a-zA-Z0-9._-]/g, '-')}-to-${newVersion}`;

  if (provider === 'github') {
    return createGitHubFix(token, owner, repoName, branch, pkg, newVersion, safeBranchName);
  }

  if (provider === 'gitlab') {
    if (projectId === null) throw new Error('GitLab project ID is required');
    return createGitLabFix(token, projectId, branch, pkg, newVersion, safeBranchName);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

async function createGitHubFix(
  token: string,
  owner: string,
  repo: string,
  baseBranch: string,
  pkg: VulnPackage,
  newVersion: string,
  fixBranch: string,
): Promise<AutoFixResult> {
  const [headSha, currentContent, fileSha] = await Promise.all([
    getDefaultBranchSha(token, owner, repo, baseBranch),
    ghGetFileContent(token, owner, repo, pkg.manifestFile, baseBranch),
    getFileSha(token, owner, repo, pkg.manifestFile, baseBranch),
  ]);

  if (!currentContent || !fileSha) {
    throw new Error(`Could not read ${pkg.manifestFile} from ${owner}/${repo}`);
  }

  const updatedContent = applyVersionToManifest(
    currentContent,
    pkg.manifestFile,
    pkg.name,
    newVersion,
  );

  await ghCreateBranch(token, owner, repo, fixBranch, headSha);
  await ghUpdateFile(token, {
    owner,
    repo,
    path: pkg.manifestFile,
    content: updatedContent,
    message: `fix: bump ${pkg.name} to ${newVersion}`,
    branch: fixBranch,
    currentSha: fileSha,
  });

  const pr = await createPullRequest(
    token,
    owner,
    repo,
    `fix: bump ${pkg.name} to ${newVersion}`,
    `Bumps \`${pkg.name}\` from \`${pkg.version}\` to \`${newVersion}\` to address known vulnerabilities.\n\nCreated by Auditly.`,
    fixBranch,
    baseBranch,
  );

  return { prUrl: pr.html_url, newVersion };
}

async function createGitLabFix(
  token: string,
  projectId: number,
  baseBranch: string,
  pkg: VulnPackage,
  newVersion: string,
  fixBranch: string,
): Promise<AutoFixResult> {
  const currentContent = await glGetFileContent(token, projectId, pkg.manifestFile, baseBranch);
  if (!currentContent) {
    throw new Error(`Could not read ${pkg.manifestFile} from project ${projectId}`);
  }

  const updatedContent = applyVersionToManifest(
    currentContent,
    pkg.manifestFile,
    pkg.name,
    newVersion,
  );

  await glCreateBranch(token, projectId, fixBranch, baseBranch);
  await glUpdateFile(
    token,
    projectId,
    pkg.manifestFile,
    updatedContent,
    `fix: bump ${pkg.name} to ${newVersion}`,
    fixBranch,
  );

  const mr = await createMergeRequest(
    token,
    projectId,
    `fix: bump ${pkg.name} to ${newVersion}`,
    `Bumps \`${pkg.name}\` from \`${pkg.version}\` to \`${newVersion}\` to address known vulnerabilities.\n\nCreated by Auditly.`,
    fixBranch,
    baseBranch,
  );

  return { prUrl: mr.web_url, newVersion };
}
