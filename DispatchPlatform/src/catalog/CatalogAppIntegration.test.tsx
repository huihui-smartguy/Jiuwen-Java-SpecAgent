import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppShell } from '../AppShell';
import { resolveRuntimeConfig } from '../config/runtime';
import {
  CONSOLE_PREFERENCES_STORAGE_KEY,
  type ConsolePreferencesV1
} from '../preferences';
import type { CatalogSnapshot, RuntimeConfig, Script } from '../types';

const products = ['高码java', '高码python', '合一版本'];
const scenes = ['API', 'WEB', 'DFx', '场景用例'];

function scriptFor(
  product: string,
  scene: string,
  objectIndex: number,
  suffix = 'base'
): Script {
  return {
    id: `script-${objectIndex}-${suffix}`,
    name: `catalog_script_${objectIndex}_${suffix}`,
    filename: `catalog_script_${objectIndex}_${suffix}.py`,
    extension: '.py',
    product,
    scene,
    feature: `Feature ${objectIndex}`,
    level: objectIndex % 2 ? 'L1' : 'L0',
    size: 100 + objectIndex,
    uploaded_at: '2026-07-23T08:00:00Z',
    uploaded_by: 'catalog-service',
    path: `testcase/${product}/${scene}/catalog_script_${objectIndex}_${suffix}.py`
  };
}

function fullCatalog(revision = 'catalog-r1'): CatalogSnapshot {
  const objects = products.flatMap((product, productIndex) => (
    scenes.map((scene, sceneIndex) => {
      const objectIndex = productIndex * scenes.length + sceneIndex;
      const script = scriptFor(product, scene, objectIndex);
      return {
        id: `catalog-object-${objectIndex}`,
        product,
        scene,
        feature_count: 1,
        script_count: 1,
        latest_changed_at: '2026-07-23T08:00:00Z',
        features: [{
          id: `feature-${objectIndex}`,
          name: script.feature,
          type: 'feature',
          script_count: 1,
          scripts: [script]
        }]
      };
    })
  ));
  return {
    success: true,
    revision,
    generated_at: '2026-07-23T08:00:00Z',
    products,
    objects,
    totals: {
      products: products.length,
      objects: objects.length,
      features: objects.length,
      scripts: objects.length
    }
  };
}

function response(body: unknown, init: ResponseInit = {}) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers
    },
    ...init
  }));
}

function renderCatalogApp(
  runtimeConfig: RuntimeConfig,
  initialPath = '/scripts'
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppShell runtimeConfig={runtimeConfig} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('settings-reduced-motion', 'lang-zh', 'lang-en');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('live catalog application integration', () => {
  test('initializes the first Feature when Tasks mounts after the catalog is already cached', async () => {
    const user = userEvent.setup();
    const catalog = fullCatalog('catalog-preloaded-before-tasks');
    const selectedObject = catalog.objects[0];
    const runtimeConfig = resolveRuntimeConfig({
      apiBaseUrl: '/runtime-api',
      defaultLanguage: 'en',
      enableMockFallback: false,
      sutTargets: [{
        id: selectedObject.id,
        name: 'Catalog Object',
        product: selectedObject.product,
        scene: selectedObject.scene,
        version: 'live',
        apiBaseUrl: '/runtime-api',
        status: 'healthy'
      }]
    });
    vi.stubGlobal('EventSource', undefined);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname === '/runtime-api/catalog') {
        return response(catalog, {
          headers: { ETag: '"catalog-preloaded-before-tasks"' }
        });
      }
      if (url.pathname === '/runtime-api/versions') {
        return response({
          success: true,
          default_version: 'release1',
          versions: [{
            code: 'release1',
            name: 'Release 1',
            description: 'Stable test batch',
            created_at: '2026-07-01T00:00:00Z',
            is_default: true
          }]
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${url.pathname}`));
    });

    renderCatalogApp(runtimeConfig);

    expect(await screen.findByText('catalog_script_0_base')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Tasks' }));

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Feature' }))
      .toHaveValue('Feature 0'));
    expect(screen.getByText('catalog_script_0_base')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Launch execution' }))
      .toBeEnabled());
  });

  test('migrates a legacy Object id, renders all 12 Objects without fanout, and shares them with Observe and Settings', async () => {
    const user = userEvent.setup();
    const catalog = fullCatalog();
    const legacyTarget = {
      id: 'legacy-java-api',
      name: 'Legacy Java API',
      product: '高码java',
      scene: 'API',
      version: 'legacy',
      apiBaseUrl: '/legacy-java-api',
      status: 'healthy' as const
    };
    const runtimeConfig = resolveRuntimeConfig({
      apiBaseUrl: '/runtime-api',
      defaultLanguage: 'en',
      enableMockFallback: false,
      sutTargets: [legacyTarget]
    });
    const savedPreferences: ConsolePreferencesV1 = {
      version: 1,
      defaultSutId: legacyTarget.id,
      language: 'en',
      reducedMotion: false,
      reportDownloadFormat: 'html'
    };
    window.localStorage.setItem(
      CONSOLE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(savedPreferences)
    );
    vi.stubGlobal('EventSource', undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname === '/runtime-api/catalog') {
        return response(catalog, { headers: { ETag: '"catalog-r1"' } });
      }
      if (url.pathname === '/runtime-api/tasks') {
        return response({
          success: true,
          total: 0,
          limit: 100,
          offset: 0,
          tasks: []
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${url.pathname}`));
    });

    renderCatalogApp(runtimeConfig);

    const headerControl = screen.getByTestId('object-control');
    const headerTrigger = within(headerControl).getByRole('button');
    await waitFor(() => expect(headerTrigger).toHaveAccessibleName(
      'Choose Object: High-Code Java API'
    ));
    await user.click(headerTrigger);
    const picker = screen.getByRole('dialog', { name: 'Choose Object' });
    expect(within(picker).getAllByRole('option')).toHaveLength(12);
    expect(within(picker).getByRole('option', {
      name: 'High-Code Java API · 1 script'
    })).toHaveAttribute('aria-selected', 'true');
    expect(within(picker).getByRole('option', {
      name: 'Unified Version scene · 1 script'
    })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(JSON.parse(
      window.localStorage.getItem(CONSOLE_PREFERENCES_STORAGE_KEY) ?? '{}'
    )).toMatchObject({
      defaultSutId: 'catalog-object-0',
      defaultSutProduct: '高码java',
      defaultSutScene: 'API'
    });
    const liveState = await screen.findByTestId('catalog-sync-state');
    expect(liveState).toHaveTextContent('Polling fallback');
    expect(liveState).not.toHaveTextContent('Checked');
    expect(liveState.parentElement).toHaveTextContent('Checked');

    await waitFor(() => expect(
      screen.getAllByTestId('script-summary-value').map((item) => item.textContent)
    ).toEqual(['12', '1', '1', '12']));
    expect(screen.getByText('catalog_script_0_base')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([input]) => (
      /\/(?:features|scripts)$/.test(new URL(String(input), 'http://local.test').pathname)
    ))).toBe(false);

    await user.click(screen.getByRole('link', { name: 'Observe' }));
    await waitFor(() => expect(fetchSpy.mock.calls.some(([input]) => (
      new URL(String(input), 'http://local.test').pathname === '/runtime-api/tasks'
    ))).toBe(true));
    expect(fetchSpy.mock.calls.some(([input]) => (
      new URL(String(input), 'http://local.test').pathname.startsWith('/legacy-java-api/')
    ))).toBe(false);

    await user.click(screen.getByRole('link', { name: 'Settings' }));
    const defaultObject = screen.getByRole('combobox', { name: 'Default Object' });
    expect(within(defaultObject).getAllByRole('option')).toHaveLength(12);
    expect(within(defaultObject).getByRole('option', { name: 'High-Code Python DFX' }))
      .toHaveValue('catalog-object-6');
    await user.selectOptions(defaultObject, 'catalog-object-6');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(headerTrigger).toHaveAccessibleName(
      'Choose Object: High-Code Python DFX'
    ));
    expect(JSON.parse(
      window.localStorage.getItem(CONSOLE_PREFERENCES_STORAGE_KEY) ?? '{}'
    )).toMatchObject({
      defaultSutId: 'catalog-object-6',
      defaultSutProduct: '高码python',
      defaultSutScene: 'DFx'
    });
  });

  test('retains an ad-hoc selected Object as a read-only snapshot when the backend removes it', async () => {
    const user = userEvent.setup();
    let currentCatalog = fullCatalog('catalog-before-removal');
    const savedDefault = currentCatalog.objects[0];
    const removedObject = currentCatalog.objects[6];
    window.localStorage.setItem(
      CONSOLE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        defaultSutId: savedDefault.id,
        defaultSutProduct: savedDefault.product,
        defaultSutScene: savedDefault.scene,
        language: 'en',
        reducedMotion: false,
        reportDownloadFormat: 'html'
      } satisfies ConsolePreferencesV1)
    );
    vi.stubGlobal('EventSource', undefined);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname === '/runtime-api/catalog') {
        return response(currentCatalog, {
          headers: { ETag: `"${currentCatalog.revision}"` }
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${url.pathname}`));
    });
    const runtimeConfig = resolveRuntimeConfig({
      apiBaseUrl: '/runtime-api',
      defaultLanguage: 'en',
      enableMockFallback: false,
      sutTargets: [{
        id: savedDefault.id,
        name: 'Saved default',
        product: savedDefault.product,
        scene: savedDefault.scene,
        version: 'live',
        apiBaseUrl: '/runtime-api',
        status: 'healthy'
      }]
    });

    renderCatalogApp(runtimeConfig);

    const headerControl = screen.getByTestId('object-control');
    const headerTrigger = within(headerControl).getByRole('button');
    await waitFor(() => expect(headerTrigger).toHaveAccessibleName(
      'Choose Object: High-Code Java API'
    ));
    await user.click(headerTrigger);
    await user.click(screen.getByRole('option', {
      name: 'High-Code Python DFX · 1 script'
    }));
    expect(await screen.findByText('catalog_script_6_base')).toBeInTheDocument();

    const nextObjects = currentCatalog.objects.filter((object) => object.id !== removedObject.id);
    currentCatalog = {
      ...currentCatalog,
      revision: 'catalog-after-removal',
      generated_at: '2026-07-23T08:02:00Z',
      objects: nextObjects,
      totals: {
        ...currentCatalog.totals,
        objects: nextObjects.length,
        features: nextObjects.length,
        scripts: nextObjects.length
      }
    };
    await user.click(screen.getByRole('button', { name: 'Refresh catalog' }));

    expect(await screen.findByText(
      'This test Object was removed from the latest catalog. The current list is retained as a read-only snapshot; select another Object.'
    )).toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: 'Choose Object: High-Code Python DFX · Removed'
    })).toBeInTheDocument();
    expect(screen.getByText('catalog_script_6_base')).toBeInTheDocument();
    expect(JSON.parse(
      window.localStorage.getItem(CONSOLE_PREFERENCES_STORAGE_KEY) ?? '{}'
    )).toMatchObject({ defaultSutId: savedDefault.id });
  });

  test('keeps a saved Object removed before startup unavailable instead of substituting the first live Object', async () => {
    const currentCatalog = fullCatalog('catalog-with-removed-default');
    const removedObject = currentCatalog.objects[6];
    const remainingObjects = currentCatalog.objects.filter(
      (object) => object.id !== removedObject.id
    );
    const snapshot: CatalogSnapshot = {
      ...currentCatalog,
      objects: remainingObjects,
      totals: {
        ...currentCatalog.totals,
        objects: remainingObjects.length,
        features: remainingObjects.length,
        scripts: remainingObjects.length
      }
    };
    window.localStorage.setItem(
      CONSOLE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        defaultSutId: removedObject.id,
        defaultSutProduct: removedObject.product,
        defaultSutScene: removedObject.scene,
        language: 'en',
        reducedMotion: false,
        reportDownloadFormat: 'html'
      } satisfies ConsolePreferencesV1)
    );
    vi.stubGlobal('EventSource', undefined);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname === '/runtime-api/catalog') {
        return response(snapshot, {
          headers: { ETag: `"${snapshot.revision}"` }
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${url.pathname}`));
    });
    const runtimeConfig = resolveRuntimeConfig({
      apiBaseUrl: '/runtime-api',
      defaultLanguage: 'en',
      enableMockFallback: false,
      sutTargets: [{
        id: snapshot.objects[0].id,
        name: 'First live Object',
        product: snapshot.objects[0].product,
        scene: snapshot.objects[0].scene,
        version: 'live',
        apiBaseUrl: '/runtime-api',
        status: 'healthy'
      }]
    });

    renderCatalogApp(runtimeConfig, '/tasks');

    expect(await screen.findByRole('button', {
      name: 'Choose Object: High-Code Python DFX · Removed'
    })).toBeInTheDocument();
    const removalMessage = await screen.findByText(
      'The current test Object was removed. Select another Object.'
    );
    expect(removalMessage.closest('[role="alert"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Launch execution' })).toBeDisabled();
    expect(screen.queryByText('First live Object')).not.toBeInTheDocument();
  });

  test('migrates a pre-catalog ad-hoc bootstrap selection without persisting it as the default', async () => {
    const user = userEvent.setup();
    const catalog = fullCatalog('catalog-after-bootstrap-selection');
    const bootstrapTargets = [
      {
        id: 'legacy-java-api',
        name: 'Legacy Java API',
        product: '高码java',
        scene: 'API',
        version: 'legacy',
        apiBaseUrl: '/runtime-api',
        status: 'healthy' as const
      },
      {
        id: 'legacy-python-web',
        name: 'Legacy Python WEB',
        product: '高码python',
        scene: 'WEB',
        version: 'legacy',
        apiBaseUrl: '/runtime-api',
        status: 'healthy' as const
      }
    ];
    const runtimeConfig = resolveRuntimeConfig({
      apiBaseUrl: '/runtime-api',
      defaultLanguage: 'en',
      enableMockFallback: false,
      sutTargets: bootstrapTargets
    });
    let resolveCatalogRequest: ((value: Response) => void) | undefined;
    const catalogRequest = new Promise<Response>((resolve) => {
      resolveCatalogRequest = resolve;
    });
    vi.stubGlobal('EventSource', undefined);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname === '/runtime-api/catalog') {
        return catalogRequest;
      }
      return Promise.reject(new Error(`Unexpected request: ${url.pathname}`));
    });

    renderCatalogApp(runtimeConfig);

    await user.click(screen.getByRole('button', {
      name: 'Choose Object: High-Code Java API'
    }));
    await user.click(screen.getByRole('option', {
      name: 'High-Code Python WEB'
    }));
    expect(window.localStorage.getItem(CONSOLE_PREFERENCES_STORAGE_KEY)).toBeNull();

    resolveCatalogRequest?.(new Response(JSON.stringify(catalog), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ETag: '"catalog-after-bootstrap-selection"'
      }
    }));

    expect(await screen.findByRole('button', {
      name: 'Choose Object: High-Code Python WEB'
    })).toBeInTheDocument();
    expect(window.localStorage.getItem(CONSOLE_PREFERENCES_STORAGE_KEY)).toBeNull();
  });

  test('freezes a task draft on material catalog changes and reconciles selections by stable script id', async () => {
    const user = userEvent.setup();
    const first = fullCatalog('catalog-r1');
    const selectedObject = first.objects[0];
    const retainedScript = scriptFor(selectedObject.product, selectedObject.scene, 0, 'retained');
    const alternateScript = {
      ...scriptFor(selectedObject.product, selectedObject.scene, 0, 'alternate'),
      feature: 'Alternate Feature'
    };
    selectedObject.features[0].scripts.push(retainedScript);
    selectedObject.features[0].script_count = 2;
    selectedObject.features.push({
      id: 'feature-alternate',
      name: alternateScript.feature,
      type: 'feature',
      script_count: 1,
      scripts: [alternateScript]
    });
    selectedObject.feature_count = 2;
    selectedObject.script_count = 3;
    first.totals.features += 1;
    first.totals.scripts += 2;

    const second = structuredClone(first);
    second.revision = 'catalog-r2';
    second.generated_at = '2026-07-23T08:01:00Z';
    const updatedObject = second.objects[0];
    const addedScript = scriptFor(updatedObject.product, updatedObject.scene, 0, 'added');
    updatedObject.features[0].scripts = [retainedScript, addedScript];
    updatedObject.latest_changed_at = '2026-07-23T08:01:00Z';

    let currentCatalog = first;
    const postedBodies: unknown[] = [];
    vi.stubGlobal('EventSource', undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname === '/runtime-api/catalog') {
        return response(currentCatalog, {
          headers: { ETag: `"${currentCatalog.revision}"` }
        });
      }
      if (url.pathname === '/runtime-api/versions') {
        return response({
          success: true,
          default_version: 'release1',
          versions: [{
            code: 'release1',
            name: 'Release 1',
            description: 'Stable',
            created_at: '2026-07-01T00:00:00Z',
            is_default: true
          }]
        });
      }
      if (url.pathname === '/runtime-api/tasks' && init?.method === 'POST') {
        postedBodies.push(JSON.parse(String(init.body)));
        return response({
          success: true,
          task_id: 'catalog-task',
          status: 'queued',
          message: 'queued',
          catalog_revision: currentCatalog.revision
        });
      }
      if (url.pathname === '/runtime-api/tasks') {
        return response({
          success: true,
          total: 0,
          limit: 100,
          offset: 0,
          tasks: []
        });
      }
      return Promise.reject(new Error(`Unexpected request: ${url.pathname}`));
    });
    const runtimeConfig = resolveRuntimeConfig({
      apiBaseUrl: '/runtime-api',
      defaultLanguage: 'en',
      enableMockFallback: false,
      sutTargets: [{
        id: selectedObject.id,
        name: 'Catalog Object',
        product: selectedObject.product,
        scene: selectedObject.scene,
        version: 'live',
        apiBaseUrl: '/runtime-api',
        status: 'healthy'
      }]
    });

    renderCatalogApp(runtimeConfig, '/tasks');

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Feature' }))
      .toHaveValue(selectedObject.features[0].name));
    await user.click(screen.getByRole('radio', { name: 'By scripts' }));
    const originalScript = selectedObject.features[0].scripts[0];
    await user.click(screen.getByRole('checkbox', {
      name: `Select ${originalScript.name}`
    }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Feature' }),
      alternateScript.feature
    );
    expect(screen.getByRole('checkbox', {
      name: `Select ${alternateScript.name}`
    })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Launch execution' })).toBeDisabled();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Feature' }),
      selectedObject.features[0].name
    );
    expect(screen.getByRole('checkbox', {
      name: `Select ${originalScript.name}`
    })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', {
      name: `Select ${originalScript.name}`
    }));
    await user.click(screen.getByRole('checkbox', {
      name: `Select ${retainedScript.name}`
    }));
    expect(screen.getByRole('button', { name: 'Launch execution' })).toBeEnabled();

    currentCatalog = second;
    await user.click(screen.getByRole('button', { name: 'Refresh catalog' }));

    const updateTitle = await screen.findByText('Script catalog update available');
    expect(updateTitle.closest('[role="alert"]'))
      .toHaveTextContent('1 added, 1 removed, 0 changed');
    expect(screen.getByText(originalScript.name)).toBeInTheDocument();
    expect(screen.queryByText(addedScript.name)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Launch execution' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Apply latest catalog' }));
    expect(screen.queryByText(originalScript.name)).not.toBeInTheDocument();
    expect(screen.getByText(addedScript.name)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {
      name: `Select ${retainedScript.name}`
    })).toBeChecked();
    expect(screen.getByRole('checkbox', {
      name: `Select ${addedScript.name}`
    })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Launch execution' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Launch execution' }));
    await waitFor(() => expect(postedBodies).toHaveLength(1));
    expect(postedBodies[0]).toMatchObject({
      catalog_revision: 'catalog-r2',
      script_ids: [retainedScript.id],
      script_name: [retainedScript.name]
    });
    expect(fetchSpy.mock.calls.some(([input]) => (
      /\/(?:features|scripts)$/.test(new URL(String(input), 'http://local.test').pathname)
    ))).toBe(false);
  });

  test('surfaces backend 409 CATALOG_CHANGED and keeps execution on the task page', async () => {
    const user = userEvent.setup();
    const catalog = fullCatalog('catalog-race');
    vi.stubGlobal('EventSource', undefined);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = new URL(String(input), 'http://local.test');
      if (url.pathname === '/runtime-api/catalog') {
        return response(catalog, { headers: { ETag: '"catalog-race"' } });
      }
      if (url.pathname === '/runtime-api/versions') {
        return response({
          success: true,
          default_version: 'release1',
          versions: [{
            code: 'release1',
            name: 'Release 1',
            description: 'Stable',
            created_at: '2026-07-01T00:00:00Z',
            is_default: true
          }]
        });
      }
      if (url.pathname === '/runtime-api/tasks' && init?.method === 'POST') {
        return response({
          success: false,
          message: 'Catalog changed',
          error_code: 'CATALOG_CHANGED',
          catalog_revision: 'catalog-newer',
          details: {
            requested_revision: 'catalog-race',
            current_revision: 'catalog-newer'
          }
        }, { status: 409 });
      }
      return Promise.reject(new Error(`Unexpected request: ${url.pathname}`));
    });
    const firstObject = catalog.objects[0];
    const runtimeConfig = resolveRuntimeConfig({
      apiBaseUrl: '/runtime-api',
      defaultLanguage: 'en',
      enableMockFallback: false,
      sutTargets: [{
        id: firstObject.id,
        name: 'Catalog Object',
        product: firstObject.product,
        scene: firstObject.scene,
        version: 'live',
        apiBaseUrl: '/runtime-api',
        status: 'healthy'
      }]
    });

    renderCatalogApp(runtimeConfig, '/tasks');

    const launch = await screen.findByRole('button', { name: 'Launch execution' });
    await waitFor(() => expect(launch).toBeEnabled());
    await user.click(launch);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The catalog changed before launch'
    );
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();
  });

  test('keeps structured catalog failures compatible with explicit demo fallback launches', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('EventSource', undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => response({
      success: false,
      message: 'Catalog route is unavailable in this demo backend',
      error_code: 'NOT_FOUND'
    }, { status: 404 }));
    const runtimeConfig = resolveRuntimeConfig({
      apiBaseUrl: '/runtime-api',
      defaultLanguage: 'en',
      enableMockFallback: true
    });

    renderCatalogApp(runtimeConfig, '/tasks');

    await waitFor(() => expect(screen.getByTestId('catalog-sync-state'))
      .toHaveTextContent('Demo catalog'));
    const launch = await screen.findByRole('button', { name: 'Launch execution' });
    await waitFor(() => expect(launch).toBeEnabled());
    await user.click(launch);

    expect(await screen.findByRole(
      'heading',
      { name: 'Observe' },
      { timeout: 3000 }
    )).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });
});
