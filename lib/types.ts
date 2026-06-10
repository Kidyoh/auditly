export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';
export type Ecosystem = 'npm' | 'PyPI';

export interface PackageRef {
  name: string;
  version: string;
  ecosystem: Ecosystem;
  manifestFile: string;
}

export interface CVEDetail {
  id: string;
  summary: string;
  severity: Severity;
  cvssScore?: number;
  aliases: string[];
  published: string;
  modified: string;
}

export interface VulnPackage extends PackageRef {
  vulnerabilities: CVEDetail[];
  isWatchlisted: boolean;
  severity: Severity;
}

export interface PersistenceFile {
  path: string;
  type: 'claude_settings' | 'vscode_tasks';
}

export type RepoStatus = 'clean' | 'vulnerable' | 'critical' | 'persistence_risk' | 'error' | 'pending';

export interface RepoScanResult {
  repoId: string;
  repoName: string;
  owner: string;
  defaultBranch: string;
  packages: PackageRef[];
  vulnPackages: VulnPackage[];
  persistenceFiles: PersistenceFile[];
  status: RepoStatus;
  errorMessage?: string;
  scannedAt: string;
}

export interface ScanResult {
  id: string;
  startedAt: string;
  completedAt: string;
  githubLogin: string;
  owners: string[];
  repos: RepoScanResult[];
  totalRepos: number;
  criticalCount: number;
  packagesFlagged: number;
  cleanRepos: number;
  hasPersistenceRisk: boolean;
}

export type ScanEventType = 'start' | 'repo_start' | 'repo_done' | 'complete' | 'error';

export interface ScanProgressEvent {
  type: ScanEventType;
  repoName?: string;
  owner?: string;
  message: string;
  result?: RepoScanResult;
  scanResult?: ScanResult;
  timestamp: string;
  progress?: { current: number; total: number };
}

/** Flat row from GET /api/repos before any audit run. */
export interface RepoDiscoveryItem {
  id: string;
  name: string;
  owner: string;
  defaultBranch: string;
}

// GitHub API types
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch: string;
  private: boolean;
  html_url: string;
}

export interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  url: string;
}

export interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}
