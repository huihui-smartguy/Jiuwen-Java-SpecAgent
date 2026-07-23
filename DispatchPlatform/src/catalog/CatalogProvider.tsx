import {
  useQuery,
  useQueryClient,
  type QueryKey
} from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { getCatalog, getCatalogEventsUrl } from '../api/client';
import { mockFeatures, mockScripts } from '../data/mockData';
import type {
  CatalogObject,
  CatalogSnapshot,
  CatalogSutTarget,
  RuntimeConfig
} from '../types';
import { catalogTargets, createFallbackCatalog } from './model';

export const CATALOG_POLL_INTERVAL_MS = 5000;

export type CatalogConnectionState =
  | 'connecting'
  | 'live'
  | 'polling'
  | 'stale'
  | 'unavailable'
  | 'mock';

export interface CatalogQueryData {
  snapshot: CatalogSnapshot;
  etag?: string;
  checkedAt: string;
  changedAt: string;
  source: 'live' | 'mock';
}

export interface CatalogContextValue {
  snapshot?: CatalogSnapshot;
  targets: CatalogSutTarget[];
  objectsById: ReadonlyMap<string, CatalogObject>;
  state: CatalogConnectionState;
  isFetching: boolean;
  isInitialLoading: boolean;
  error: unknown;
  checkedAt?: string;
  changedAt?: string;
  refresh: (throwOnError?: boolean) => Promise<CatalogQueryData | undefined>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

function canonicalApiBaseUrl(value: string): string {
  const trimmed = value.trim() || '/api';
  return trimmed === '/' ? trimmed : trimmed.replace(/\/+$/, '');
}

export function catalogQueryKey(apiBaseUrl: string): QueryKey {
  return ['test-catalog', canonicalApiBaseUrl(apiBaseUrl)] as const;
}

function eventRevision(event: MessageEvent<string>): string | undefined {
  try {
    const data: unknown = JSON.parse(event.data);
    return typeof data === 'object'
      && data !== null
      && 'revision' in data
      && typeof (data as { revision?: unknown }).revision === 'string'
      ? (data as { revision: string }).revision
      : undefined;
  } catch {
    return undefined;
  }
}

export function CatalogProvider({
  runtimeConfig,
  children
}: {
  runtimeConfig: RuntimeConfig;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const apiBaseUrl = canonicalApiBaseUrl(runtimeConfig.apiBaseUrl);
  const key = useMemo(() => catalogQueryKey(apiBaseUrl), [apiBaseUrl]);
  const fallbackCatalog = useMemo(
    () => createFallbackCatalog(runtimeConfig, mockFeatures, mockScripts),
    [runtimeConfig]
  );
  const [eventState, setEventState] = useState<'connecting' | 'live' | 'polling'>('connecting');
  const latestAdvertisedRevisionRef = useRef<string | undefined>(undefined);
  const eventRefreshTimerRef = useRef<number | undefined>(undefined);

  const query = useQuery<CatalogQueryData>({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const previous = queryClient.getQueryData<CatalogQueryData>(key);
      try {
        const response = await getCatalog(
          { apiBaseUrl },
          { etag: previous?.etag, signal }
        );
        const checkedAt = new Date().toISOString();
        if (response.kind === 'not-modified') {
          if (!previous) {
            throw new Error('The catalog returned 304 before a snapshot was cached.');
          }
          return {
            ...previous,
            etag: response.etag ?? previous.etag,
            checkedAt
          };
        }
        return {
          snapshot: response.snapshot,
          etag: response.etag,
          checkedAt,
          changedAt: checkedAt,
          source: 'live'
        };
      } catch (error) {
        if (runtimeConfig.enableMockFallback && !previous) {
          const checkedAt = new Date().toISOString();
          return {
            snapshot: fallbackCatalog,
            checkedAt,
            changedAt: checkedAt,
            source: 'mock'
          };
        }
        throw error;
      }
    },
    // SSE is the primary live signal. Poll only while the stream is connecting
    // or degraded so each client does not rescan the full backend catalog twice.
    refetchInterval: eventState === 'live' ? false : CATALOG_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    retry: 1
  });

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      setEventState('polling');
      return undefined;
    }
    let disposed = false;
    const source = new EventSource(getCatalogEventsUrl({ apiBaseUrl }), {
      withCredentials: true
    });
    setEventState('connecting');
    const scheduleRevisionRefresh = (revision: string, retry = false) => {
      latestAdvertisedRevisionRef.current = revision;
      if (eventRefreshTimerRef.current !== undefined) {
        window.clearTimeout(eventRefreshTimerRef.current);
      }
      eventRefreshTimerRef.current = window.setTimeout(() => {
        eventRefreshTimerRef.current = undefined;
        if (disposed) {
          return;
        }
        const current = queryClient.getQueryData<CatalogQueryData>(key);
        if (current?.snapshot.revision === latestAdvertisedRevisionRef.current) {
          return;
        }
        void queryClient.invalidateQueries(
          { queryKey: key, exact: true },
          { cancelRefetch: true }
        ).then(() => {
          if (disposed || retry) {
            return;
          }
          const refreshed = queryClient.getQueryData<CatalogQueryData>(key);
          const advertised = latestAdvertisedRevisionRef.current;
          if (advertised && refreshed?.snapshot.revision !== advertised) {
            scheduleRevisionRefresh(advertised, true);
          }
        });
      }, retry ? 250 : 50);
    };
    const handleEvent = (event: Event) => {
      const revision = eventRevision(event as MessageEvent<string>);
      if (revision) {
        scheduleRevisionRefresh(revision);
      }
    };
    source.onopen = () => {
      if (!disposed) {
        setEventState('live');
      }
    };
    source.onerror = () => {
      if (!disposed) {
        setEventState('polling');
      }
    };
    source.addEventListener('catalog.changed', handleEvent);
    return () => {
      disposed = true;
      if (eventRefreshTimerRef.current !== undefined) {
        window.clearTimeout(eventRefreshTimerRef.current);
        eventRefreshTimerRef.current = undefined;
      }
      source.removeEventListener('catalog.changed', handleEvent);
      source.close();
    };
  }, [apiBaseUrl, key, queryClient]);

  const data = query.data;
  const targets = useMemo(
    () => {
      if (!data) {
        return [];
      }
      const liveTargets = catalogTargets(data.snapshot, apiBaseUrl);
      return liveTargets.map((target) => {
        const exactBootstrap = runtimeConfig.sutTargets.find(
          (candidate) => candidate.id === target.id
        );
        const scopeBootstrap = runtimeConfig.sutTargets.filter((candidate) => (
            candidate.product === target.product
            && candidate.scene === target.scene
        ));
        const bootstrap = exactBootstrap
          ?? (scopeBootstrap.length === 1 ? scopeBootstrap[0] : undefined);
        if (!bootstrap) {
          return target;
        }
        return data.source === 'mock'
          ? { ...target, ...bootstrap }
          : {
              ...target,
              name: bootstrap.name,
              version: bootstrap.version,
              status: bootstrap.status
            };
      });
    },
    [apiBaseUrl, data, runtimeConfig.sutTargets]
  );
  const objectsById = useMemo<ReadonlyMap<string, CatalogObject>>(
    () => new Map(data?.snapshot.objects.map((object) => [object.id, object]) ?? []),
    [data]
  );
  const state: CatalogConnectionState = !data
    ? query.isError ? 'unavailable' : 'connecting'
    : data.source === 'mock'
      ? 'mock'
      : query.isError
        ? 'stale'
        : eventState;
  const value = useMemo<CatalogContextValue>(() => ({
    snapshot: data?.snapshot,
    targets,
    objectsById,
    state,
    isFetching: query.isFetching,
    isInitialLoading: query.isPending && !data,
    error: query.error,
    checkedAt: data?.checkedAt,
    changedAt: data?.changedAt,
    refresh: async (throwOnError = false) => (
      await query.refetch({ cancelRefetch: false, throwOnError })
    ).data
  }), [
    data,
    objectsById,
    query.error,
    query.isFetching,
    query.isPending,
    query.refetch,
    state,
    targets
  ]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const value = useContext(CatalogContext);
  if (!value) {
    throw new Error('useCatalog must be used inside CatalogProvider.');
  }
  return value;
}

export function useOptionalCatalog(): CatalogContextValue | null {
  return useContext(CatalogContext);
}
