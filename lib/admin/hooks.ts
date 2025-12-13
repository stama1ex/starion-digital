/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { AdminAPI } from './api-client';

/**
 * Custom hooks for admin data fetching
 */

export function usePartners(excludeAdmin = true) {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AdminAPI.getPartners();
      const filtered = excludeAdmin
        ? data.filter((p: any) => p.name !== 'ADMIN')
        : data;
      setPartners(filtered);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching partners:', err);
    } finally {
      setLoading(false);
    }
  }, [excludeAdmin]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  return { partners, loading, error, refetch: fetchPartners };
}

export function useProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AdminAPI.getProducts();
      setProducts(data);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}

export function useGroups() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AdminAPI.getGroups();
      setGroups(data);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching groups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return { groups, loading, error, refetch: fetchGroups };
}

export function useCurrentUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        setLoading(true);
        const data = await AdminAPI.getCurrentUser();
        setUser(data);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching current user:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  return { user, loading, error };
}
