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
  project: string;
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
  orgUrl: string;
  projects: string[];
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
  project?: string;
  message: string;
  result?: RepoScanResult;
  scanResult?: ScanResult;
  timestamp: string;
  progress?: { current: number; total: number };
}

export interface AzureSettings {
  orgUrl: string;
  pat: string;
  projects: string[];
}

export interface AzureRepo {
  id: string;
  name: string;
  project: { id: string; name: string };
  defaultBranch?: string;
  remoteUrl: string;
}

/** Flat row from GET /api/repos before any audit run. */
export interface RepoDiscoveryItem {
  id: string;
  name: string;
  project: string;
  defaultBranch: string;
}

export interface AzureItemsResponse {
  value: AzureItem[];
  count: number;
}

export interface AzureItem {
  objectId: string;
  gitObjectType: string;
  commitId: string;
  path: string;
  isFolder: boolean;
  url: string;
}

export interface AzureFileContent {
  content: string;
}
