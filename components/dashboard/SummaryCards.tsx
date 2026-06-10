'use client';

import { cn } from '@/lib/utils';
import { ShieldCheck, AlertTriangle, PackageOpen, CheckCircle2, type LucideIcon } from 'lucide-react';
import type { ScanResult } from '@/lib/types';

interface SummaryCardsProps {
  result: ScanResult | null;
  isScanning: boolean;
  inventoryLoading?: boolean;
}

type Tone = 'brand' | 'danger' | 'warn' | 'success';

type Stat = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: Tone;
  subtext?: string;
};

const TONE_STYLES: Record<
  Tone,
  { value: string; iconWrap: string; iconColor: string; accent: string }
> = {
  brand: {
    value: 'text-foreground',
    iconWrap: 'bg-primary/10 ring-1 ring-primary/15',
    iconColor: 'text-primary',
    accent: 'from-primary/70 to-primary/0',
  },
  danger: {
    value: 'text-red-600',
    iconWrap: 'bg-red-50 ring-1 ring-red-200/70',
    iconColor: 'text-red-600',
    accent: 'from-red-500/70 to-red-500/0',
  },
  warn: {
    value: 'text-orange-600',
    iconWrap: 'bg-orange-50 ring-1 ring-orange-200/70',
    iconColor: 'text-orange-600',
    accent: 'from-orange-500/70 to-orange-500/0',
  },
  success: {
    value: 'text-emerald-600',
    iconWrap: 'bg-emerald-50 ring-1 ring-emerald-200/70',
    iconColor: 'text-emerald-600',
    accent: 'from-emerald-500/70 to-emerald-500/0',
  },
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  subtext,
  loading,
}: Readonly<Stat & { loading?: boolean }>) {
  const styles = TONE_STYLES[tone];
  return (
    <div className="group surface-card relative overflow-hidden p-5 transition-all duration-200 hover:-translate-y-px hover:shadow-pop">
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-0 top-0 h-px bg-linear-to-r',
          styles.accent,
          'opacity-70 group-hover:opacity-100',
        )}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              'font-heading text-[2rem] font-semibold leading-none tracking-tight tabular-nums',
              styles.value,
              loading && 'animate-pulse text-muted-foreground/60',
            )}
          >
            {loading ? '—' : value.toLocaleString()}
          </p>
          {subtext ? (
            <p className="line-clamp-1 text-[11px] text-muted-foreground">{subtext}</p>
          ) : (
            <p className="text-[11px] text-transparent" aria-hidden>
              .
            </p>
          )}
        </div>

        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-[1.03]',
            styles.iconWrap,
          )}
        >
          <Icon className={cn('h-[18px] w-[18px]', styles.iconColor)} strokeWidth={2.1} />
        </span>
      </div>
    </div>
  );
}

export function SummaryCards({
  result,
  isScanning,
  inventoryLoading = false,
}: Readonly<SummaryCardsProps>) {
  const cleanPct =
    result && result.totalRepos > 0
      ? Math.round((result.cleanRepos / result.totalRepos) * 100)
      : null;

  const stats: Stat[] = [
    {
      label: 'Repositories',
      value: result?.totalRepos ?? 0,
      icon: ShieldCheck,
      tone: 'brand',
      subtext: result ? `${result.owners.length} owner${result.owners.length === 1 ? '' : 's'}` : 'Awaiting inventory',
    },
    {
      label: 'Critical issues',
      value: result?.criticalCount ?? 0,
      icon: AlertTriangle,
      tone: result && result.criticalCount > 0 ? 'danger' : 'success',
      subtext: result?.hasPersistenceRisk
        ? 'Includes persistence indicators'
        : result && result.criticalCount === 0
          ? 'No critical CVEs detected'
          : undefined,
    },
    {
      label: 'Packages flagged',
      value: result?.packagesFlagged ?? 0,
      icon: PackageOpen,
      tone: result && result.packagesFlagged > 0 ? 'warn' : 'success',
      subtext: result ? 'Vulnerable or on watchlist' : undefined,
    },
    {
      label: 'Clean repos',
      value: result?.cleanRepos ?? 0,
      icon: CheckCircle2,
      tone: 'success',
      subtext: cleanPct !== null ? `${cleanPct}% of inventory` : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <StatCard key={s.label} {...s} loading={inventoryLoading || (isScanning && !result)} />
      ))}
    </div>
  );
}
