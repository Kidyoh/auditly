import { Badge } from '@/components/ui/badge';
import type { Severity, RepoStatus } from '@/lib/types';

const SEVERITY_CONFIG: Record<Severity, { label: string; className: string }> = {
  CRITICAL: {
    label: 'Critical',
    className:
      'bg-red-50 text-red-700 border-red-200 text-[10px] font-medium uppercase tracking-wide',
  },
  HIGH: {
    label: 'High',
    className:
      'bg-orange-50 text-orange-800 border-orange-200 text-[10px] font-medium uppercase tracking-wide',
  },
  MEDIUM: {
    label: 'Medium',
    className:
      'bg-amber-50 text-amber-800 border-amber-200 text-[10px] font-medium uppercase tracking-wide',
  },
  LOW: {
    label: 'Low',
    className:
      'bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-medium uppercase tracking-wide',
  },
  CLEAN: {
    label: 'Clean',
    className:
      'bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-medium uppercase tracking-wide',
  },
};

const STATUS_CONFIG: Record<RepoStatus, { label: string; className: string }> = {
  clean: {
    label: 'Clean',
    className:
      'bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-medium uppercase tracking-wide',
  },
  vulnerable: {
    label: 'Vulnerable',
    className:
      'bg-orange-50 text-orange-800 border-orange-200 text-[10px] font-medium uppercase tracking-wide',
  },
  critical: {
    label: 'Critical',
    className:
      'bg-red-50 text-red-700 border-red-200 text-[10px] font-medium uppercase tracking-wide',
  },
  persistence_risk: {
    label: 'Persistence',
    className:
      'bg-red-50 text-red-700 border-red-200 text-[10px] font-medium uppercase tracking-wide',
  },
  error: {
    label: 'Error',
    className:
      'bg-zinc-100 text-zinc-600 border-zinc-200 text-[10px] font-medium uppercase tracking-wide',
  },
  pending: {
    label: 'Pending',
    className:
      'bg-zinc-100 text-zinc-600 border-zinc-200 text-[10px] font-medium uppercase tracking-wide',
  },
};

export function SeverityBadge({ severity }: Readonly<{ severity: Severity }>) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

export function StatusBadge({ status }: Readonly<{ status: RepoStatus }>) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
