import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from './config/runtime';
import {
  CONSOLE_PREFERENCES_STORAGE_KEY,
  REDUCED_MOTION_QUERY,
  REDUCED_MOTION_ROOT_CLASS,
  applyReducedMotionPreference,
  createConsolePreferencesFallback,
  isConsolePreferencesV1,
  loadConsolePreferences,
  parseConsolePreferences,
  saveConsolePreferences,
  subscribeToConsolePreferences,
  type ConsolePreferencesV1
} from './preferences';

const runtimeConfig = resolveRuntimeConfig({
  defaultLanguage: 'zh',
  sutTargets: [
    {
      id: 'sut-first',
      name: 'First',
      product: 'Product',
      scene: 'API',
      version: 'v1',
      apiBaseUrl: '/first',
      status: 'healthy'
    },
    {
      id: 'sut-second',
      name: 'Second',
      product: 'Product',
      scene: 'UI',
      version: 'v2',
      apiBaseUrl: '/second',
      status: 'degraded'
    }
  ]
});

const savedPreferences: ConsolePreferencesV1 = {
  version: 1,
  defaultSutId: 'sut-second',
  language: 'en',
  reducedMotion: true,
  reportDownloadFormat: 'md'
};

function dispatchPreferenceStorageEvent(newValue: string | null, key: string | null = CONSOLE_PREFERENCES_STORAGE_KEY) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
}

function createMediaQuery(initialMatches = false) {
  const listeners = new Set<() => void>();
  const mediaQuery = {
    matches: initialMatches,
    media: REDUCED_MOTION_QUERY,
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
    addListener: vi.fn((listener: () => void) => listeners.add(listener)),
    removeListener: vi.fn((listener: () => void) => listeners.delete(listener)),
    dispatchEvent: vi.fn()
  };

  return {
    mediaQuery: mediaQuery as unknown as MediaQueryList,
    setMatches(matches: boolean) {
      mediaQuery.matches = matches;
      listeners.forEach((listener) => listener());
    }
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('ConsolePreferencesV1 storage contract', () => {
  test('creates the safe runtime fallback required for first launch', () => {
    expect(createConsolePreferencesFallback(runtimeConfig)).toEqual({
      version: 1,
      defaultSutId: 'sut-first',
      language: 'zh',
      reducedMotion: false,
      reportDownloadFormat: 'html'
    });
  });

  test('loads a complete valid preference object', () => {
    window.localStorage.setItem(
      CONSOLE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(savedPreferences)
    );

    expect(loadConsolePreferences(runtimeConfig)).toEqual(savedPreferences);
    expect(isConsolePreferencesV1(savedPreferences, runtimeConfig)).toBe(true);
  });

  test.each([
    ['malformed JSON', '{'],
    ['outdated version', JSON.stringify({ ...savedPreferences, version: 0 })],
    ['unknown Object', JSON.stringify({ ...savedPreferences, defaultSutId: 'removed' })],
    ['unsupported report format', JSON.stringify({ ...savedPreferences, reportDownloadFormat: 'pdf' })],
    ['incomplete object', JSON.stringify({ version: 1, language: 'en' })],
    ['object with unknown fields', JSON.stringify({ ...savedPreferences, density: 'compact' })]
  ])('falls back safely for %s', (_label, serialized) => {
    window.localStorage.setItem(CONSOLE_PREFERENCES_STORAGE_KEY, serialized);

    expect(loadConsolePreferences(runtimeConfig)).toEqual(
      createConsolePreferencesFallback(runtimeConfig)
    );
    expect(parseConsolePreferences(serialized, runtimeConfig)).toBeNull();
  });

  test('falls back when browser storage is unavailable or throws while reading', () => {
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new DOMException('denied', 'SecurityError');
      }),
      setItem: vi.fn()
    };

    expect(loadConsolePreferences(runtimeConfig, null)).toEqual(
      createConsolePreferencesFallback(runtimeConfig)
    );
    expect(loadConsolePreferences(runtimeConfig, throwingStorage)).toEqual(
      createConsolePreferencesFallback(runtimeConfig)
    );
  });

  test('writes exactly one complete versioned object and rejects unsafe writes', () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn()
    };

    saveConsolePreferences(savedPreferences, runtimeConfig, storage);

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(
      CONSOLE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(savedPreferences)
    );
    expect(() => saveConsolePreferences(savedPreferences, runtimeConfig, null)).toThrow(
      'Browser storage is unavailable.'
    );
    expect(() => saveConsolePreferences(
      { ...savedPreferences, defaultSutId: 'unknown' },
      runtimeConfig,
      storage
    )).toThrow('Cannot save invalid TestWise console preferences.');
  });
});

describe('preference synchronization and reduced motion', () => {
  test('publishes only valid cross-tab updates and resets to fallback when storage is cleared', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToConsolePreferences(runtimeConfig, listener);

    dispatchPreferenceStorageEvent(JSON.stringify(savedPreferences));
    dispatchPreferenceStorageEvent(JSON.stringify({ ...savedPreferences, reportDownloadFormat: 'pdf' }));
    dispatchPreferenceStorageEvent(JSON.stringify(savedPreferences), 'unrelated.key');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(savedPreferences);

    dispatchPreferenceStorageEvent(null);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(createConsolePreferencesFallback(runtimeConfig));

    unsubscribe();
    dispatchPreferenceStorageEvent(JSON.stringify(savedPreferences));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test('combines the saved value with the operating-system preference without removing unrelated classes', () => {
    const root = document.createElement('div');
    root.classList.add('keep-me');
    const media = createMediaQuery(false);
    const cleanup = applyReducedMotionPreference(false, {
      root,
      matchMedia: vi.fn().mockReturnValue(media.mediaQuery)
    });

    expect(root).not.toHaveClass(REDUCED_MOTION_ROOT_CLASS);
    expect(root).toHaveClass('keep-me');

    media.setMatches(true);
    expect(root).toHaveClass(REDUCED_MOTION_ROOT_CLASS);
    media.setMatches(false);
    expect(root).not.toHaveClass(REDUCED_MOTION_ROOT_CLASS);

    cleanup();
    expect(media.mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(root).not.toHaveClass(REDUCED_MOTION_ROOT_CLASS);
    expect(root).toHaveClass('keep-me');
  });

  test('keeps reduced motion enabled when the saved preference is true', () => {
    const root = document.createElement('div');
    const media = createMediaQuery(false);
    const cleanup = applyReducedMotionPreference(true, {
      root,
      matchMedia: vi.fn().mockReturnValue(media.mediaQuery)
    });

    expect(root).toHaveClass(REDUCED_MOTION_ROOT_CLASS);
    media.setMatches(true);
    media.setMatches(false);
    expect(root).toHaveClass(REDUCED_MOTION_ROOT_CLASS);

    cleanup();
    expect(root).not.toHaveClass(REDUCED_MOTION_ROOT_CLASS);
  });
});
