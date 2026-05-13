import {
  listAllProjectNames,
  listAllRepositories,
  listRepoItems,
  getFileContent,
} from './azure';
import { checkPackages } from './osv';
import type {
  AzureRepo,
  PackageRef,
  PersistenceFile,
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

async function scanRepo(
  orgUrl: string,
  pat: string,
  repo: AzureRepo,
): Promise<RepoScanResult> {
  const project = repo.project.name;
  const scannedAt = new Date().toISOString();

  try {
    const items = await listRepoItems(orgUrl, pat, project, repo.id);
    const filePaths = items.filter((i) => !i.isFolder).map((i) => i.path);

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
        const content = await getFileContent(orgUrl, pat, project, repo.id, path, repo.defaultBranch);
        if (content) allPackages.push(...parseManifest(content, path));
      }),
    );

    const uniquePackages = deduplicatePackages(allPackages);
    const vulnPackages = await checkPackages(uniquePackages);

    const partial = {
      repoId: repo.id,
      repoName: repo.name,
      project,
      defaultBranch: repo.defaultBranch ?? 'main',
      packages: uniquePackages,
      vulnPackages,
      persistenceFiles,
      scannedAt,
    };

    return { ...partial, status: repoStatus(partial) };
  } catch (err) {
    return {
      repoId: repo.id,
      repoName: repo.name,
      project,
      defaultBranch: repo.defaultBranch ?? 'main',
      packages: [],
      vulnPackages: [],
      persistenceFiles: [],
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Scan failed',
      scannedAt,
    };
  }
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

export async function runScan(
  orgUrl: string,
  pat: string,
  onProgress: (event: ScanProgressEvent) => void,
): Promise<ScanResult> {
  const scanId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  onProgress({
    type: 'start',
    message: 'Discovering Azure DevOps projects…',
    timestamp: new Date().toISOString(),
  });

  const projects = await listAllProjectNames(orgUrl, pat);
  if (projects.length === 0) {
    onProgress({
      type: 'error',
      message: 'No projects found in this Azure DevOps organization.',
      timestamp: new Date().toISOString(),
    });
    throw new Error('SCAN_NO_PROJECTS');
  }

  onProgress({
    type: 'start',
    message: `Starting scan of ${projects.length} project(s)…`,
    timestamp: new Date().toISOString(),
  });

  const repos = await listAllRepositories(orgUrl, pat, projects);
  const repoResults: RepoScanResult[] = [];

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    onProgress({
      type: 'repo_start',
      repoName: repo.name,
      project: repo.project.name,
      message: `Scanning ${repo.project.name}/${repo.name}…`,
      timestamp: new Date().toISOString(),
      progress: { current: i + 1, total: repos.length },
    });

    const result = await scanRepo(orgUrl, pat, repo);
    repoResults.push(result);

    onProgress({
      type: 'repo_done',
      repoName: repo.name,
      project: repo.project.name,
      message: `Completed ${repo.project.name}/${repo.name}`,
      result,
      timestamp: new Date().toISOString(),
      progress: { current: i + 1, total: repos.length },
    });
  }

  const criticalCount = repoResults.filter(
    (r) => r.status === 'critical' || r.status === 'persistence_risk',
  ).length;
  const packagesFlagged = repoResults.reduce((acc, r) => acc + r.vulnPackages.length, 0);
  const cleanRepos = repoResults.filter((r) => r.status === 'clean').length;
  const hasPersistenceRisk = repoResults.some((r) => r.persistenceFiles.length > 0);

  const scanResult: ScanResult = {
    id: scanId,
    startedAt,
    completedAt: new Date().toISOString(),
    orgUrl,
    projects,
    repos: repoResults,
    totalRepos: repoResults.length,
    criticalCount,
    packagesFlagged,
    cleanRepos,
    hasPersistenceRisk,
  };

  onProgress({
    type: 'complete',
    message: `Scan complete. ${repoResults.length} repos scanned.`,
    scanResult,
    timestamp: new Date().toISOString(),
  });

  return scanResult;
}
