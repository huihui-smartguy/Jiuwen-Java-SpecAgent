import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CatalogSnapshot, RuntimeConfig } from '../types';
import { CatalogProvider, useCatalog } from './CatalogProvider';

const runtimeConfig: RuntimeConfig = {
  apiBaseUrl: '/testwise/api/',
  deploymentMode: 'process',
  defaultLanguage: 'en',
  enableMockFallback: false,
  sutTargets: [{
    id: 'bootstrap-object',
    name: 'Bootstrap Object',
    product: 'Payments',
    scene: 'API',
    version: 'v1',
    apiBaseUrl: '/bootstrap-api',
    status: 'healthy'
  }]
};

function snapshot(revision: string): CatalogSnapshot {
  return {
    success: true,
    revision,
    generated_at: '2026-07-23T08:00:00Z',
    products: ['Payments'],
    objects: [{
      id: 'payments-api',
      product: 'Payments',
      scene: 'API',
      feature_count: 1,
      script_count: 1,
      features: [{
        id: 'feature-auth',
        name: 'Authentication',
        type: 'feature',
        script_count: 1,
        scripts: [{
          id: 'script-auth',
          name: 'test_auth',
          filename: 'test_auth.py',
          extension: '.py',
          product: 'Payments',
          scene: 'API',
          feature: 'Authentication',
          level: 'L0',
          size: 42,
          path: 'testcase/Payments/API/Authentication/test_auth.py'
        }]
      }]
    }],
    totals: {
      products: 1,
      objects: 1,
      features: 1,
      scripts: 1
    }
  };
}

function catalogResponse(revision: string, etag = `"${revision}"`) {
  return new Response(JSON.stringify(snapshot(revision)), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ETag: etag
    }
  });
}

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  readonly withCredentials: boolean;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private listeners = new Map<string, Set<EventListener>>();

  addEventListener = vi.fn((type: string, listener: EventListener) => {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  });

  removeEventListener = vi.fn((type: string, listener: EventListener) => {
    this.listeners.get(type)?.delete(listener);
  });

  close = vi.fn();

  constructor(url: string | URL, init?: EventSourceInit) {
    this.url = String(url);
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  emit(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

function CatalogProbe() {
  const catalog = useCatalog();
  return (
    <section>
      <output data-testid="state">{catalog.state}</output>
      <output data-testid="revision">{catalog.snapshot?.revision ?? 'none'}</output>
      <output data-testid="target">
        {catalog.targets[0]
          ? `${catalog.targets[0].id}:${catalog.targets[0].scriptCount}`
          : 'none'}
      </output>
      <output data-testid="object-count">{catalog.objectsById.size}</output>
      <output data-testid="changed-at">{catalog.changedAt ?? ''}</output>
      <output data-testid="has-error">{catalog.error ? 'yes' : 'no'}</output>
      <button
        type="button"
        onClick={() => {
          void catalog.refresh();
        }}
      >
        Refresh catalog
      </button>
    </section>
  );
}

function renderProvider() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retryDelay: 0
      }
    }
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CatalogProvider runtimeConfig={runtimeConfig}>
        <CatalogProbe />
      </CatalogProvider>
    </QueryClientProvider>
  );
  return { queryClient, ...view };
}

beforeEach(() => {
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('CatalogProvider', () => {
  test('publishes the initial live snapshot and opens one credentialed event stream', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      catalogResponse('catalog-r1', '"catalog-r1"')
    );

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('catalog-r1'));
    expect(screen.getByTestId('target')).toHaveTextContent('payments-api:1');
    expect(screen.getByTestId('object-count')).toHaveTextContent('1');
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]).toMatchObject({
      url: '/testwise/api/catalog/events',
      withCredentials: true
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe('/testwise/api/catalog');

    act(() => {
      MockEventSource.instances[0].onopen?.(new Event('open'));
    });
    expect(screen.getByTestId('state')).toHaveTextContent('live');
  });

  test('sends the weak catalog validator and retains the last snapshot across a manual 304 refresh', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(catalogResponse('catalog-r1', 'W/"catalog-r1"'))
      .mockResolvedValueOnce(new Response(null, {
        status: 304,
        headers: { ETag: 'W/"catalog-r1"' }
      }));
    const user = userEvent.setup();

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('catalog-r1'));
    const changedAt = screen.getByTestId('changed-at').textContent;

    await user.click(screen.getByRole('button', { name: 'Refresh catalog' }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

    expect(new Headers(fetchSpy.mock.calls[1][1]?.headers).get('If-None-Match'))
      .toBe('W/"catalog-r1"');
    expect(screen.getByTestId('revision')).toHaveTextContent('catalog-r1');
    expect(screen.getByTestId('target')).toHaveTextContent('payments-api:1');
    expect(screen.getByTestId('changed-at')).toHaveTextContent(changedAt ?? '');
    expect(screen.getByTestId('has-error')).toHaveTextContent('no');
  });

  test('uses the named catalog.changed event to invalidate the catalog without duplicating streams', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(catalogResponse('catalog-r1'))
      .mockResolvedValueOnce(catalogResponse('catalog-r2'));

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('catalog-r1'));
    const source = MockEventSource.instances[0];
    expect(source.addEventListener).toHaveBeenCalledTimes(1);
    expect(source.addEventListener).toHaveBeenCalledWith(
      'catalog.changed',
      expect.any(Function)
    );

    act(() => {
      source.emit('catalog.changed', { revision: 'catalog-r2' });
    });

    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('catalog-r2'));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  test('moves from polling to stale while retaining last-good data after refresh errors', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(catalogResponse('catalog-r1'))
      .mockRejectedValueOnce(new Error('catalog unavailable'))
      .mockRejectedValueOnce(new Error('catalog unavailable'));
    const user = userEvent.setup();

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('catalog-r1'));
    const source = MockEventSource.instances[0];
    act(() => {
      source.onopen?.(new Event('open'));
      source.onerror?.(new Event('error'));
    });
    expect(screen.getByTestId('state')).toHaveTextContent('polling');

    await user.click(screen.getByRole('button', { name: 'Refresh catalog' }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('stale'));
    expect(screen.getByTestId('revision')).toHaveTextContent('catalog-r1');
    expect(screen.getByTestId('target')).toHaveTextContent('payments-api:1');
    expect(screen.getByTestId('has-error')).toHaveTextContent('yes');
  });

  test('removes the named listener and closes the event stream on cleanup', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(catalogResponse('catalog-r1'));

    const { unmount } = renderProvider();
    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('catalog-r1'));
    const source = MockEventSource.instances[0];
    const namedListener = source.addEventListener.mock.calls[0][1];

    unmount();

    expect(source.removeEventListener).toHaveBeenCalledWith(
      'catalog.changed',
      namedListener
    );
    expect(source.close).toHaveBeenCalledTimes(1);
  });
});
