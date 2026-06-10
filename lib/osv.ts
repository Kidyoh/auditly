import type { PackageRef, VulnPackage, CVEDetail, Severity, Ecosystem } from './types';

const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch';
const BATCH_SIZE = 100;

// Shai-Hulud campaign watchlist — always flagged as CRITICAL
const WATCHLIST_PATTERNS: { pattern: RegExp; canonical: string }[] = [
  { pattern: /^open[-_]?search$/i, canonical: 'opensearch' },
  { pattern: /^mistral[-_]?ai$/i, canonical: 'mistralai' },
  { pattern: /^guardrails[-_]?ai$/i, canonical: 'guardrails-ai' },
  { pattern: /^uipath$/i, canonical: 'uipath' },
  { pattern: /^squawk$/i, canonical: 'squawk' },
  // common typosquatting variants
  { pattern: /^opensearch[-_]py$/i, canonical: 'opensearch' },
  { pattern: /^mistral$/i, canonical: 'mistralai' },
  { pattern: /^guardrailsai$/i, canonical: 'guardrails-ai' },
  { pattern: /^ui[-_]path$/i, canonical: 'uipath' },
  { pattern: /^sqawk$/i, canonical: 'squawk' },
  { pattern: /^squak$/i, canonical: 'squawk' },
];

export function isWatchlisted(name: string): string | null {
  for (const { pattern, canonical } of WATCHLIST_PATTERNS) {
    if (pattern.test(name)) return canonical;
  }
  return null;
}

interface OSVQuery {
  package: { name: string; ecosystem: string };
  version?: string;
}

interface OSVVuln {
  id: string;
  summary?: string;
  aliases?: string[];
  published?: string;
  modified?: string;
  severity?: Array<{ type: string; score: string }>;
  database_specific?: { severity?: string };
}

interface OSVBatchResult {
  results: Array<{ vulns?: OSVVuln[] }>;
}

function mapSeverity(vuln: OSVVuln): Severity {
  const s = vuln.database_specific?.severity?.toUpperCase();
  if (s === 'CRITICAL') return 'CRITICAL';
  if (s === 'HIGH') return 'HIGH';
  if (s === 'MEDIUM') return 'MEDIUM';
  if (s === 'LOW') return 'LOW';

  // Try CVSS score from severity array
  const cvss = vuln.severity?.find((sv) => sv.score);
  if (cvss) {
    const score = Number.parseFloat(cvss.score);
    if (score >= 9) return 'CRITICAL';
    if (score >= 7) return 'HIGH';
    if (score >= 4) return 'MEDIUM';
    return 'LOW';
  }

  return 'MEDIUM';
}

function osvVulnToCVE(vuln: OSVVuln): CVEDetail {
  // CVSS score may be a raw number string or a full vector (CVSS:3.1/AV:...).
  // Only store it when it parses to a finite number in 0–10 range.
  let cvssScore: number | undefined;
  for (const sv of vuln.severity ?? []) {
    const n = Number.parseFloat(sv.score);
    if (Number.isFinite(n) && n >= 0 && n <= 10) {
      cvssScore = n;
      break;
    }
  }

  return {
    id: vuln.id,
    summary: vuln.summary ?? 'No summary available',
    severity: mapSeverity(vuln),
    cvssScore,
    aliases: vuln.aliases ?? [],
    published: vuln.published ?? '',
    modified: vuln.modified ?? '',
  };
}

function highestSeverity(cves: CVEDetail[]): Severity {
  const order: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CLEAN'];
  for (const s of order) {
    if (cves.some((c) => c.severity === s)) return s;
  }
  return 'CLEAN';
}

async function queryOSVBatch(queries: OSVQuery[]): Promise<OSVVuln[][]> {
  const res = await fetch(OSV_BATCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries }),
  });

  if (!res.ok) {
    console.error(`OSV batch error: ${res.status}`);
    return queries.map(() => []);
  }

  const data = (await res.json()) as OSVBatchResult;
  return (data.results ?? []).map((r) => r.vulns ?? []);
}

function ecosystemToOSV(eco: Ecosystem): string {
  if (eco === 'npm') return 'npm';
  if (eco === 'PyPI') return 'PyPI';
  return eco;
}

export async function checkPackages(packages: PackageRef[]): Promise<VulnPackage[]> {
  if (packages.length === 0) return [];

  const results: VulnPackage[] = [];

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < packages.length; i += BATCH_SIZE) {
    const batch = packages.slice(i, i + BATCH_SIZE);
    const queries: OSVQuery[] = batch.map((p) => ({
      package: { name: p.name, ecosystem: ecosystemToOSV(p.ecosystem) },
      version: p.version === '*' ? undefined : p.version,
    }));

    let osvVulns: OSVVuln[][] = [];
    try {
      osvVulns = await queryOSVBatch(queries);
    } catch {
      osvVulns = batch.map(() => []);
    }

    for (let j = 0; j < batch.length; j++) {
      const pkg = batch[j];
      const vulns = osvVulns[j] ?? [];
      const watchlistMatch = isWatchlisted(pkg.name);
      const cves = vulns.map(osvVulnToCVE);

      // Watchlisted packages are always CRITICAL regardless of OSV results
      const severity = watchlistMatch ? 'CRITICAL' : highestSeverity(cves);

      if (cves.length > 0 || watchlistMatch) {
        results.push({
          ...pkg,
          vulnerabilities: cves,
          isWatchlisted: !!watchlistMatch,
          severity,
        });
      }
    }
  }

  return results;
}
