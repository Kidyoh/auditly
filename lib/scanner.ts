import { listAllRepos, getAuthenticatedUser, getRepoTree, getFileContent } from './github';
import {
  listAllProjects,
  getAuthenticatedUser as getGitLabUser,
  getProjectTree,
  getFileContent as getGitLabFileContent,
} from './gitlab';
import { checkPackages } from './osv';
import type {
  GitHubRepo,
  GitLabProject,
  PackageRef,
  PersistenceFile,
  Provider,
  RepoScanResult,
  ScanResult,
  ScanProgressEvent,
} from './types';

const MANIFEST_FILES = new Set([
  'package.json',
  'requirements.txt',
  'pyproject.toml',
]);
const PERSISTENCE_PATHS = ['.claude/settings.json', '.vscode/tasks.json'];

function repoStatus(result: Omit<RepoScanResult, 'status'>): RepoScanResult['status'] {
  if (result.persistenceFiles.length > 0) return 'persistence_risk';
  const hasCritical = result.vulnPackages.some((p) => p.severity === 'CRITICAL');
  if (hasCritical) return 'critical';
  const hasVuln = result.vulnPackages.length > 0;
  if (hasVuln) return 'vulnerable';
  return 'clean';
}

function parsePackageJson(content: string, filePath: string): PackageRef[] {
  try {
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const deps: Record<string, string> = {};
    if (pkg.dependencies) Object.assign(deps, pkg.dependencies);
    if (pkg.devDependencies) Object.assign(deps, pkg.devDependencies);
    if (pkg.peerDependencies) Object.assign(deps, pkg.peerDependencies);
    return Object.entries(deps).map(([name, version]) => ({
      name,
      version: version.replace(/^[\^~>=<]/, '').split(' ')[0],
      ecosystem: 'npm',
      manifestFile: filePath,
    }));
  } catch {
    return [];
  }
}

const REQ_PKG_LINE_RE = /^([A-Za-z0-9_.-]+)([>=<!~^,\s].+)?$/;
const REQ_VERSION_IN_SPEC_RE = /[>=<!~^,\s]*(\d[^\s,]*)/;

function parseRequirementsTxt(content: string, filePath: string): PackageRef[] {
  const packages: PackageRef[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) continue;

    const match = REQ_PKG_LINE_RE.exec(trimmed);
    if (!match) continue;

    const name = match[1];
    const versionPart = match[2] ?? '';
    const verMatch = REQ_VERSION_IN_SPEC_RE.exec(versionPart);
    const version = verMatch?.[1] ?? '*';
    packages.push({ name, version, ecosystem: 'PyPI', manifestFile: filePath });
  }
  return packages;
}

const PYPROJECT_DEPS_SECTION_RE =
  /\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/;
const PYPROJECT_PKG_NAME_RE = /^([A-Za-z0-9_.-]+)/;
const PYPROJECT_VERSION_RE = /[>=<!~^,\s]*(\d[^\s,]*)/;

function parsePyprojectToml(content: string, filePath: string): PackageRef[] {
  const packages: PackageRef[] = [];
  const depSection = PYPROJECT_DEPS_SECTION_RE.exec(content);
  if (depSection) {
    const lines = depSection[1].split('\n');
    for (const line of lines) {
      const clean = line.replace(/['"]/g, '').trim().replace(/,$/, '');
      if (!clean || clean.startsWith('#')) continue;
      const match = PYPROJECT_PKG_NAME_RE.exec(clean);
      if (match) {
        const versionMatch = PYPROJECT_VERSION_RE.exec(clean);
        packages.push({
          name: match[1],
          version: versionMatch?.[1] ?? '*',
          ecosystem: 'PyPI',
          manifestFile: filePath,
        });
      }
    }
  }
  return packages;
}

function parseManifest(content: string, filePath: string): PackageRef[] {
  const fileName = filePath.split('/').pop() ?? '';
  if (fileName === 'package.json') return parsePackageJson(content, filePath);
  if (fileName === 'requirements.txt') return parseRequirementsTxt(content, filePath);
  if (fileName === 'pyproject.toml') return parsePyprojectToml(content, filePath);
  return [];
}

function deduplicatePackages(packages: PackageRef[]): PackageRef[] {
  const seen = new Set<string>();
  return packages.filter((p) => {
    const key = `${p.ecosystem}:${p.name}@${p.version}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── GitHub scanning ──────────────────────────────────────────────────────────

async function scanRepo(token: string, repo: GitHubRepo): Promise<RepoScanResult> {
  const owner = repo.owner.login;
  const branch = repo.default_branch ?? 'main';
  const scannedAt = new Date().toISOString();

  try {
    const tree = await getRepoTree(token, owner, repo.name, branch);
    const filePaths = tree.filter((i) => i.type === 'blob').map((i) => i.path);

    const manifestPaths = filePaths.filter((p) => {
      const name = p.split('/').pop() ?? '';
      return MANIFEST_FILES.has(name);
    });

    const persistenceDetected = PERSISTENCE_PATHS.filter((pp) =>
      filePaths.some((fp) => fp.toLowerCase().endsWith(pp.toLowerCase())),
    );

    const persistenceFiles: PersistenceFile[] = persistenceDetected.map((p) => ({
      path: p,
      type: p.includes('.claude') ? 'claude_settings' : 'vscode_tasks',
    }));

    const allPackages: PackageRef[] = [];
    await Promise.allSettled(
      manifestPaths.map(async (path) => {
        const content = await getFileContent(token, owner, repo.name, path, branch);
        if (content) allPackages.push(...parseManifest(content, path));
      }),
    );

    const uniquePackages = deduplicatePackages(allPackages);
    const vulnPackages = await checkPackages(uniquePackages);

    const partial = {
      repoId: String(repo.id),
      repoName: repo.name,
      owner,
      defaultBranch: branch,
      provider: 'github' as Provider,
      packages: uniquePackages,
      vulnPackages,
      persistenceFiles,
      scannedAt,
    };

    return { ...partial, status: repoStatus(partial) };
  } catch (err) {
    return {
      repoId: String(repo.id),
      repoName: repo.name,
      owner,
      defaultBranch: branch,
      provider: 'github',
      packages: [],
      vulnPackages: [],
      persistenceFiles: [],
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Scan failed',
      scannedAt,
    };
  }
}

// ─── GitLab scanning ─────────────────────────────────────────────────────────

async function scanRepoGitLab(token: string, project: GitLabProject): Promise<RepoScanResult> {
  const owner = project.namespace.path;
  const branch = project.default_branch ?? 'main';
  const scannedAt = new Date().toISOString();

  try {
    const tree = await getProjectTree(token, project.id, branch);
    const filePaths = tree.filter((i) => i.type === 'blob').map((i) => i.path);

    const manifestPaths = filePaths.filter((p) => {
      const name = p.split('/').pop() ?? '';
      return MANIFEST_FILES.has(name);
    });

    const persistenceDetected = PERSISTENCE_PATHS.filter((pp) =>
      filePaths.some((fp) => fp.toLowerCase().endsWith(pp.toLowerCase())),
    );

    const persistenceFiles: PersistenceFile[] = persistenceDetected.map((p) => ({
      path: p,
      type: p.includes('.claude') ? 'claude_settings' : 'vscode_tasks',
    }));

    const allPackages: PackageRef[] = [];
    await Promise.allSettled(
      manifestPaths.map(async (path) => {
        const content = await getGitLabFileContent(token, project.id, path, branch);
        if (content) allPackages.push(...parseManifest(content, path));
      }),
    );

    const uniquePackages = deduplicatePackages(allPackages);
    const vulnPackages = await checkPackages(uniquePackages);

    const partial = {
      repoId: String(project.id),
      repoName: project.name,
      owner,
      defaultBranch: branch,
      provider: 'gitlab' as Provider,
      packages: uniquePackages,
      vulnPackages,
      persistenceFiles,
      scannedAt,
    };

    return { ...partial, status: repoStatus(partial) };
  } catch (err) {
    return {
      repoId: String(project.id),
      repoName: project.name,
      owner,
      defaultBranch: branch,
      provider: 'gitlab',
      packages: [],
      vulnPackages: [],
      persistenceFiles: [],
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Scan failed',
      scannedAt,
    };
  }
}

// ─── orchestrator ─────────────────────────────────────────────────────────────

export async function runScan(
  token: string,
  onProgress: (event: ScanProgressEvent) => void,
  targetRepoIds?: string[],
  provider: Provider = 'github',
): Promise<ScanResult> {
  const scanId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  onProgress({
    type: 'start',
    message: `Discovering ${provider === 'gitlab' ? 'GitLab' : 'GitHub'} repositories…`,
    timestamp: new Date().toISOString(),
  });

  const result = await (provider === 'gitlab'
    ? runGitLabScan(token, onProgress, scanId, startedAt, targetRepoIds)
    : runGitHubScan(token, onProgress, scanId, startedAt, targetRepoIds));

  onProgress({
    type: 'complete',
    message: `Scan complete. ${result.totalRepos} repo${result.totalRepos === 1 ? '' : 's'} scanned.`,
    scanResult: result,
    timestamp: new Date().toISOString(),
  });

  return result;
}

async function runGitHubScan(
  token: string,
  onProgress: (event: ScanProgressEvent) => void,
  scanId: string,
  startedAt: string,
  targetRepoIds?: string[],
): Promise<ScanResult> {
  const [repos, githubLogin] = await Promise.all([
    listAllRepos(token),
    getAuthenticatedUser(token),
  ]);

  if (repos.length === 0) {
    onProgress({ type: 'error', message: 'No repositories found for this GitHub account.', timestamp: new Date().toISOString() });
    throw new Error('SCAN_NO_REPOS');
  }

  const filtered = targetRepoIds?.length
    ? repos.filter((r) => targetRepoIds.includes(String(r.id)))
    : repos;

  if (filtered.length === 0) {
    onProgress({ type: 'error', message: 'None of the selected repositories were found.', timestamp: new Date().toISOString() });
    throw new Error('SCAN_NO_REPOS');
  }

  onProgress({
    type: 'start',
    message: `Starting scan of ${filtered.length} repositor${filtered.length === 1 ? 'y' : 'ies'}…`,
    timestamp: new Date().toISOString(),
  });

  const repoResults: RepoScanResult[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const repo = filtered[i];
    onProgress({
      type: 'repo_start',
      repoName: repo.name,
      owner: repo.owner.login,
      message: `Scanning ${repo.owner.login}/${repo.name}…`,
      timestamp: new Date().toISOString(),
      progress: { current: i + 1, total: filtered.length },
    });

    const result = await scanRepo(token, repo);
    repoResults.push(result);

    onProgress({
      type: 'repo_done',
      repoName: repo.name,
      owner: repo.owner.login,
      message: `Completed ${repo.owner.login}/${repo.name}`,
      result,
      timestamp: new Date().toISOString(),
      progress: { current: i + 1, total: filtered.length },
    });
  }

  return buildScanResult(scanId, startedAt, githubLogin, repoResults);
}

async function runGitLabScan(
  token: string,
  onProgress: (event: ScanProgressEvent) => void,
  scanId: string,
  startedAt: string,
  targetRepoIds?: string[],
): Promise<ScanResult> {
  const [projects, userLogin] = await Promise.all([
    listAllProjects(token),
    getGitLabUser(token),
  ]);

  if (projects.length === 0) {
    onProgress({ type: 'error', message: 'No projects found for this GitLab account.', timestamp: new Date().toISOString() });
    throw new Error('SCAN_NO_REPOS');
  }

  const filtered = targetRepoIds?.length
    ? projects.filter((p) => targetRepoIds.includes(String(p.id)))
    : projects;

  if (filtered.length === 0) {
    onProgress({ type: 'error', message: 'None of the selected projects were found.', timestamp: new Date().toISOString() });
    throw new Error('SCAN_NO_REPOS');
  }

  onProgress({
    type: 'start',
    message: `Starting scan of ${filtered.length} project${filtered.length === 1 ? '' : 's'}…`,
    timestamp: new Date().toISOString(),
  });

  const repoResults: RepoScanResult[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const project = filtered[i];
    const owner = project.namespace.path;
    onProgress({
      type: 'repo_start',
      repoName: project.name,
      owner,
      message: `Scanning ${owner}/${project.name}…`,
      timestamp: new Date().toISOString(),
      progress: { current: i + 1, total: filtered.length },
    });

    const result = await scanRepoGitLab(token, project);
    repoResults.push(result);

    onProgress({
      type: 'repo_done',
      repoName: project.name,
      owner,
      message: `Completed ${owner}/${project.name}`,
      result,
      timestamp: new Date().toISOString(),
      progress: { current: i + 1, total: filtered.length },
    });
  }

  return buildScanResult(scanId, startedAt, userLogin, repoResults);
}

function buildScanResult(
  scanId: string,
  startedAt: string,
  userLogin: string,
  repoResults: RepoScanResult[],
): ScanResult {
  const criticalCount = repoResults.filter(
    (r) => r.status === 'critical' || r.status === 'persistence_risk',
  ).length;
  const packagesFlagged = repoResults.reduce((acc, r) => acc + r.vulnPackages.length, 0);
  const cleanRepos = repoResults.filter((r) => r.status === 'clean').length;
  const hasPersistenceRisk = repoResults.some((r) => r.persistenceFiles.length > 0);
  const owners = [...new Set(repoResults.map((r) => r.owner))].sort((a, b) => a.localeCompare(b));

  const scanResult: ScanResult = {
    id: scanId,
    startedAt,
    completedAt: new Date().toISOString(),
    githubLogin: userLogin,
    owners,
    repos: repoResults,
    totalRepos: repoResults.length,
    criticalCount,
    packagesFlagged,
    cleanRepos,
    hasPersistenceRisk,
  };

  return scanResult;
}
