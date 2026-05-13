'use client';

import { useQuery } from '@tanstack/react-query';
import type { RepoDiscoveryItem } from '@/lib/types';

interface ReposOkResponse {
  ok: true;
  message: string;
  projectCount: number;
  repos: RepoDiscoveryItem[];
}

interface ReposErrResponse {
  ok: false;
  message?: string;
}

export type ReposResponse = ReposOkResponse | ReposErrResponse;

export function useRepos(enabled = true) {
  return useQuery<{ repos: RepoDiscoveryItem[]; projectCount: number; message: string }>({
    queryKey: ['azure-repos'],
    queryFn: async () => {
      const res = await fetch('/api/repos');
      const data = (await res.json()) as ReposResponse;

      if (!res.ok || !data.ok || !('repos' in data)) {
        throw new Error(
          typeof data.ok === 'boolean' && !data.ok ? (data.message ?? 'Failed to list repos') : 'Failed',
        );
      }

      return {
        repos: data.repos,
        projectCount: data.projectCount,
        message: data.message,
      };
    },
    enabled,
    staleTime: 60_000,
    retry: 1,
  });
}
