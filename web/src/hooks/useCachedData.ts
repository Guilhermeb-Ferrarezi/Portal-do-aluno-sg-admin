import { useEffect, useState, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Cache em memória (persiste durante a sessão)
const memoryCache = new Map<string, CacheEntry<any>>();

/**
 * Hook para cachear dados durante a sessão do navegador
 * Os dados são carregados apenas uma vez por sessão
 *
 * @param key - Identificador único para o cache
 * @param fetchFn - Função assíncrona que busca os dados
 * @param options - { maxAge?: número em ms }
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
  const maxAge = options?.maxAge ?? Infinity; // Por padrão, não expira

  useEffect(() => {
    // Se já fez fetch nesta sessão, não fazer de novo
    if (hasFetchedRef.current) {
      setLoading(false);
      return;
    }

    // Verificar se tem cache válido
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

    // Fazer fetch
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchFn();

        // Cachear resultado
        memoryCache.set(key, {
          data: result,
          timestamp: Date.now(),
        });

        setData(result);
        hasFetchedRef.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [key, fetchFn, maxAge]);

  const refetch = async () => {
    // Limpar cache e força refetch
    memoryCache.delete(key);
    hasFetchedRef.current = false;

    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn();
      memoryCache.set(key, {
        data: result,
        timestamp: Date.now(),
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch };
}
