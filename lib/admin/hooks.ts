/* eslint-disable @typescript-eslint/no-explicit-any */
import useSWR, { type KeyedMutator } from 'swr';
import { fetchData } from './api-client';

/**
 * Custom hooks for admin data fetching.
 *
 * Backed by SWR's global cache so switching admin tabs (which remounts
 * these sections, since Radix TabsContent unmounts inactive panels)
 * reuses already-fetched data instead of refetching from scratch every
 * time — the cached value renders instantly while SWR revalidates in
 * the background.
 */

function useAdminList<T = any>(endpoint: string | null) {
  const { data, error, isLoading, mutate } = useSWR<T[]>(endpoint, fetchData);
  return {
    data: data ?? [],
    loading: isLoading,
    error: (error as Error) ?? null,
    mutate,
  };
}

export function usePartners(excludeAdmin = true) {
  const { data, loading, error, mutate } = useAdminList<any>(
    '/api/admin/partners',
  );
  const partners = excludeAdmin
    ? data.filter((p: any) => p.role === 'PARTNER')
    : data;

  return { partners, loading, error, refetch: () => mutate(), mutate };
}

export function useProducts() {
  const { data, loading, error, mutate } = useAdminList<any>(
    '/api/admin/products',
  );
  return { products: data, loading, error, refetch: () => mutate(), mutate };
}

export function useGroups() {
  const { data, loading, error, mutate } = useAdminList<any>(
    '/api/admin/groups',
  );
  return { groups: data, loading, error, refetch: () => mutate(), mutate };
}

export function useCurrentUser() {
  const { data, error, isLoading } = useSWR<any>('/api/me', fetchData);
  return { user: data ?? null, loading: isLoading, error: (error as Error) ?? null };
}

export type { KeyedMutator };
