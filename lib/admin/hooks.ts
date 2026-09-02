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
  const { data, error, isLoading, mutate } = useSWR<T[]>(endpoint, fetchData, {
    // По умолчанию SWR ретраит ошибку бесконечно с backoff ~5с. Если эндпоинт
    // стабильно падает (напр. не применена миграция), это заваливает сервер
    // 500-ками и дёргает isLoading туда-сюда на каждой попытке. Ограничиваем.
    errorRetryCount: 3,
  });
  return {
    data: data ?? [],
    loading: isLoading,
    // был ли хоть один успешный ответ — чтобы отличать «ещё не грузилось» от
    // «загрузилось и реально пусто» (иначе разовая фоновая ошибка после
    // успешной загрузки подменяет пустое состояние на экран ошибки)
    loaded: data !== undefined,
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

export function useARExperiences() {
  const { data, loading, loaded, error, mutate } =
    useAdminList<any>('/api/admin/ar');
  return {
    experiences: data,
    loading,
    loaded,
    error,
    refetch: () => mutate(),
    mutate,
  };
}

export function useCurrentUser() {
  const { data, error, isLoading } = useSWR<any>('/api/me', fetchData, {
    errorRetryCount: 3,
  });
  return { user: data ?? null, loading: isLoading, error: (error as Error) ?? null };
}

export type { KeyedMutator };
