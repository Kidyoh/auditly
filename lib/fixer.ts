import type { VulnPackage, Ecosystem, Provider, FixChange } from './types';
import {
  getDefaultBranchSha,
  getCommitData,
  createTree,
  createGitCommit,
  createBranch as ghCreateBranch,
  createPullRequest,
  getFileContent as ghGetFileContent,
} from './github';
import {
  createBranch as glCreateBranch,
  createMultiFileCommit,
  createMergeRequest,
  getFileContent as glGetFileContent,
} from './gitlab';

// ─── registry lookups ────────────────────────────────────────────────────────

async function getLatestVersion(name: string, ecosystem: Ecosystem): Promise<string | null> {
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
  if (fileName === 'package.json') return patchPackageJson(content, packageName, newVersion);
  if (fileName === 'requirements.txt') return patchRequirementsTxt(content, packageName, newVersion);
  if (fileName === 'pyproject.toml') return patchPyprojectToml(content, packageName, newVersion);
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
  const namePattern = new RegExp(String.raw`^${escapeRegex(packageName)}([>=<!\s,\[#]|$)`, 'i');
  return content
    .split('\n')
    .map((line) => (namePattern.test(line.trim()) ? `${packageName}>=${newVersion}` : line))
    .join('\n');
}

function patchPyprojectToml(content: string, packageName: string, newVersion: string): string {
  const namePattern = new RegExp(
    String.raw`(["']?)${escapeRegex(packageName)}\1[>=<!~^,\s]*[\d][^"'\s,]*`,
    'gi',
  );
  return content.replace(namePattern, `${packageName}>=${newVersion}`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

export interface AutoFixAllResult {
  prUrl: string;
  commitUrl: string;
  changes: FixChange[];
}

// ─── main orchestrator ────────────────────────────────────────────────────────

export async function createAutoFixAll(
  token: string,
  provider: Provider,
  owner: string,
  repoName: string,
  branch: string,
  projectId: number | null,
  vulnPackages: VulnPackage[],
): Promise<AutoFixAllResult> {
  // Resolve latest versions for all packages in parallel
  const versions = await Promise.all(
    vulnPackages.map((pkg) => getLatestVersion(pkg.name, pkg.ecosystem)),
  );

  // Build change list, skipping any package where we couldn't get a version
  const changes: FixChange[] = [];
  for (let i = 0; i < vulnPackages.length; i++) {
    const v = versions[i];
    if (v) {
      changes.push({
        name: vulnPackages[i].name,
        oldVersion: vulnPackages[i].version,
        newVersion: v,
        manifestFile: vulnPackages[i].manifestFile,
      });
    }
  }

  if (changes.length === 0) {
    throw new Error('Could not determine a latest version for any of the vulnerable packages.');
  }

  // Group changes by manifest file so we patch each file in a single pass
  const byManifest = new Map<string, FixChange[]>();
  for (const c of changes) {
    const list = byManifest.get(c.manifestFile) ?? [];
    list.push(c);
    byManifest.set(c.manifestFile, list);
  }

  const fixBranch = `fix/auditly-${Date.now()}`;

  if (provider === 'github') {
    return fixGitHub(token, owner, repoName, branch, fixBranch, byManifest, changes);
  }
  if (provider === 'gitlab') {
    if (projectId === null) throw new Error('GitLab project ID is required');
    return fixGitLab(token, projectId, branch, fixBranch, byManifest, changes);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// ─── GitHub: single commit via Git Trees API ──────────────────────────────────

async function fixGitHub(
  token: string,
  owner: string,
  repo: string,
  baseBranch: string,
  fixBranch: string,
  byManifest: Map<string, FixChange[]>,
  changes: FixChange[],
): Promise<AutoFixAllResult> {
  // Get the HEAD commit and its tree
  const headSha = await getDefaultBranchSha(token, owner, repo, baseBranch);
  const { treeSha: baseTreeSha } = await getCommitData(token, owner, repo, headSha);

  // Read every affected manifest and apply all its patches
  const blobs = await Promise.all(
    [...byManifest.entries()].map(async ([manifestPath, pkgChanges]) => {
      let content = await ghGetFileContent(token, owner, repo, manifestPath, baseBranch);
      if (!content) throw new Error(`Could not read ${manifestPath}`);
      for (const c of pkgChanges) {
        content = applyVersionToManifest(content, manifestPath, c.name, c.newVersion);
      }
      return { path: manifestPath, content };
    }),
  );

  // Create new tree → new commit → new branch → PR
  const newTreeSha = await createTree(token, owner, repo, baseTreeSha, blobs);
  const commitMessage = buildCommitMessage(changes);
  const commitSha = await createGitCommit(token, owner, repo, commitMessage, newTreeSha, headSha);
  await ghCreateBranch(token, owner, repo, fixBranch, commitSha);

  const pr = await createPullRequest(
    token,
    owner,
    repo,
    buildPrTitle(changes),
    buildPrBody(changes),
    fixBranch,
    baseBranch,
  );

  return {
    prUrl: pr.html_url,
    commitUrl: `https://github.com/${owner}/${repo}/commit/${commitSha}`,
    changes,
  };
}

// ─── GitLab: single commit via Commits API ────────────────────────────────────

async function fixGitLab(
  token: string,
  projectId: number,
  baseBranch: string,
  fixBranch: string,
  byManifest: Map<string, FixChange[]>,
  changes: FixChange[],
): Promise<AutoFixAllResult> {
  // Read every affected manifest and apply all its patches
  const actions = await Promise.all(
    [...byManifest.entries()].map(async ([manifestPath, pkgChanges]) => {
      let content = await glGetFileContent(token, projectId, manifestPath, baseBranch);
      if (!content) throw new Error(`Could not read ${manifestPath}`);
      for (const c of pkgChanges) {
        content = applyVersionToManifest(content, manifestPath, c.name, c.newVersion);
      }
      return { action: 'update' as const, file_path: manifestPath, content };
    }),
  );

  await glCreateBranch(token, projectId, fixBranch, baseBranch);

  const commit = await createMultiFileCommit(
    token,
    projectId,
    fixBranch,
    buildCommitMessage(changes),
    actions,
  );

  const mr = await createMergeRequest(
    token,
    projectId,
    buildPrTitle(changes),
    buildPrBody(changes),
    fixBranch,
    baseBranch,
  );

  return {
    prUrl: mr.web_url,
    commitUrl: commit.web_url,
    changes,
  };
}

// ─── message builders ─────────────────────────────────────────────────────────

function buildPrTitle(changes: FixChange[]): string {
  if (changes.length === 1) {
    return `fix: bump ${changes[0].name} to ${changes[0].newVersion}`;
  }
  return `fix: bump ${changes.length} vulnerable dependencies`;
}

function buildCommitMessage(changes: FixChange[]): string {
  const lines = changes.map((c) => `  - ${c.name}: ${c.oldVersion} → ${c.newVersion}`);
  return `fix: bump vulnerable dependencies\n\n${lines.join('\n')}\n\nCreated by Auditly.`;
}

function buildPrBody(changes: FixChange[]): string {
  const rows = changes
    .map((c) => `| \`${c.name}\` | \`${c.oldVersion}\` | \`${c.newVersion}\` | \`${c.manifestFile}\` |`)
    .join('\n');

  return `## Dependency fixes\n\n| Package | From | To | Manifest |\n|---------|------|----|----------|\n${rows}\n\nCreated by [Auditly](https://github.com/Kidyoh/auditly).`;
}
