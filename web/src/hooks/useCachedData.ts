import { useEffect, useState, useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Cache em memoria (persiste durante a sessao)
const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Hook para cachear dados durante a sessao do navegador.
 *
 * @param key - Identificador unico para o cache
 * @param fetchFn - Funcao assincrona que busca os dados
 * @param options - { maxAge?: numero em ms }
 */
export function useCachedData<T extends any[] = any[]>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: { maxAge?: number }
): {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T>(([] as unknown) as T);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);
  const keyRef = useRef(key);
  const maxAge = options?.maxAge ?? Infinity;

  const loadData = useCallback(async () => {
    const cached = memoryCache.get(key);
    if (cached) {
      const isExpired = Date.now() - cached.timestamp > maxAge;
      if (!isExpired) {
        setData(cached.data);
        setLoading(false);
        hasFetchedRef.current = true;
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      const inFlight = inFlightRequests.get(key);
      const request = inFlight ?? fetchFn();
      if (!inFlight) {
        inFlightRequests.set(key, request);
      }

      const result = await request;

      memoryCache.set(key, {
        data: result,
        timestamp: Date.now(),
      });

      setData(result);
      hasFetchedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      inFlightRequests.delete(key);
      setLoading(false);
    }
  }, [key, fetchFn, maxAge]);

  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      hasFetchedRef.current = false;
    }

    if (hasFetchedRef.current) {
      setLoading(false);
      return;
    }

    void loadData();
  }, [key, loadData]);

  const refetch = useCallback(async () => {
    memoryCache.delete(key);
    inFlightRequests.delete(key);
    hasFetchedRef.current = false;
    await loadData();
  }, [key, loadData]);

  return { data, loading, error, refetch };
}
