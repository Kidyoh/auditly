'use client';

import { useQuery } from '@tanstack/react-query';
import type { ScanResult } from '@/lib/types';

interface ResultsResponse {
  isScanning: boolean;
  result: ScanResult | null;
}

export function useScanResults(enabled = true) {
  return useQuery<ResultsResponse>({
    queryKey: ['scan-results'],
    queryFn: async () => {
      const res = await fetch('/api/results');
      if (!res.ok) throw new Error('Failed to fetch results');
      return res.json() as Promise<ResultsResponse>;
    },
    enabled,
    refetchInterval: false,
  });
}
