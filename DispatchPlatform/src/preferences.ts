import type { Language, ReportDownloadFormat, RuntimeConfig } from './types';

export const CONSOLE_PREFERENCES_VERSION = 1 as const;
export const CONSOLE_PREFERENCES_STORAGE_KEY = 'testwise.console.preferences.v1';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const REDUCED_MOTION_ROOT_CLASS = 'settings-reduced-motion';

export interface ConsolePreferencesV1 {
  version: typeof CONSOLE_PREFERENCES_VERSION;
  defaultSutId: string;
  language: Language;
  reducedMotion: boolean;
  reportDownloadFormat: ReportDownloadFormat;
  /** Optional canonical scope used to migrate a saved Object when backend ids change. */
  defaultSutProduct?: string;
  defaultSutScene?: string;
}

export interface ConsolePreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PREFERENCE_FIELDS = [
  'version',
  'defaultSutId',
  'language',
  'reducedMotion',
  'reportDownloadFormat'
] as const;
const OPTIONAL_PREFERENCE_FIELDS = ['defaultSutProduct', 'defaultSutScene'] as const;

function browserPreferenceStorage(): ConsolePreferenceStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createConsolePreferencesFallback(
  runtimeConfig: RuntimeConfig
): ConsolePreferencesV1 {
  return {
    version: CONSOLE_PREFERENCES_VERSION,
    defaultSutId: runtimeConfig.sutTargets[0]?.id ?? '',
    language: runtimeConfig.defaultLanguage,
    reducedMotion: false,
    reportDownloadFormat: 'html'
  };
}

export function isConsolePreferencesV1(
  value: unknown,
  runtimeConfig: RuntimeConfig
): value is ConsolePreferencesV1 {
  if (!isRecord(value)) {
    return false;
  }

  const fields = Object.keys(value);
  const allowedFields = new Set<string>([
    ...PREFERENCE_FIELDS,
    ...OPTIONAL_PREFERENCE_FIELDS
  ]);
  if (
    PREFERENCE_FIELDS.some((field) => !fields.includes(field))
    || fields.some((field) => !allowedFields.has(field))
  ) {
    return false;
  }
  const hasProduct = typeof value.defaultSutProduct === 'string' && Boolean(value.defaultSutProduct);
  const hasScene = typeof value.defaultSutScene === 'string' && Boolean(value.defaultSutScene);
  if (hasProduct !== hasScene) {
    return false;
  }

  const knownBootstrapId = runtimeConfig.sutTargets.some(
    (sut) => sut.id === value.defaultSutId
  );
  return value.version === CONSOLE_PREFERENCES_VERSION
    && typeof value.defaultSutId === 'string'
    && Boolean(value.defaultSutId)
    && (knownBootstrapId || hasProduct)
    && (value.language === 'zh' || value.language === 'en')
    && typeof value.reducedMotion === 'boolean'
    && (value.reportDownloadFormat === 'html' || value.reportDownloadFormat === 'md');
}

export function resolveConsolePreferences(
  value: unknown,
  runtimeConfig: RuntimeConfig
): ConsolePreferencesV1 {
  return isConsolePreferencesV1(value, runtimeConfig)
    ? { ...value }
    : createConsolePreferencesFallback(runtimeConfig);
}

export function parseConsolePreferences(
  serialized: string,
  runtimeConfig: RuntimeConfig
): ConsolePreferencesV1 | null {
  try {
    const value: unknown = JSON.parse(serialized);
    return isConsolePreferencesV1(value, runtimeConfig) ? { ...value } : null;
  } catch {
    return null;
  }
}

export function loadConsolePreferences(
  runtimeConfig: RuntimeConfig,
  storage: ConsolePreferenceStorage | null = browserPreferenceStorage()
): ConsolePreferencesV1 {
  const fallback = createConsolePreferencesFallback(runtimeConfig);
  if (!storage) {
    return fallback;
  }

  try {
    const serialized = storage.getItem(CONSOLE_PREFERENCES_STORAGE_KEY);
    if (serialized === null) {
      return fallback;
    }

    return parseConsolePreferences(serialized, runtimeConfig) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveConsolePreferences(
  preferences: ConsolePreferencesV1,
  runtimeConfig: RuntimeConfig,
  storage: ConsolePreferenceStorage | null = browserPreferenceStorage()
): void {
  if (!isConsolePreferencesV1(preferences, runtimeConfig)) {
    throw new Error('Cannot save invalid TestWise console preferences.');
  }
  if (!storage) {
    throw new Error('Browser storage is unavailable.');
  }

  const completePreferenceObject: ConsolePreferencesV1 = {
    version: CONSOLE_PREFERENCES_VERSION,
    defaultSutId: preferences.defaultSutId,
    language: preferences.language,
    reducedMotion: preferences.reducedMotion,
    reportDownloadFormat: preferences.reportDownloadFormat,
    ...(preferences.defaultSutProduct && preferences.defaultSutScene
      ? {
          defaultSutProduct: preferences.defaultSutProduct,
          defaultSutScene: preferences.defaultSutScene
        }
      : {})
  };

  storage.setItem(
    CONSOLE_PREFERENCES_STORAGE_KEY,
    JSON.stringify(completePreferenceObject)
  );
}

export function areConsolePreferencesEqual(
  left: ConsolePreferencesV1,
  right: ConsolePreferencesV1
): boolean {
  return left.version === right.version
    && left.defaultSutId === right.defaultSutId
    && left.language === right.language
    && left.reducedMotion === right.reducedMotion
    && left.reportDownloadFormat === right.reportDownloadFormat
    && left.defaultSutProduct === right.defaultSutProduct
    && left.defaultSutScene === right.defaultSutScene;
}

export function subscribeToConsolePreferences(
  runtimeConfig: RuntimeConfig,
  listener: (preferences: ConsolePreferencesV1) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key !== CONSOLE_PREFERENCES_STORAGE_KEY
      && event.key !== null
    ) {
      return;
    }

    if (event.newValue === null) {
      listener(createConsolePreferencesFallback(runtimeConfig));
      return;
    }

    const preferences = parseConsolePreferences(event.newValue, runtimeConfig);
    if (preferences) {
      listener(preferences);
    }
  };

  window.addEventListener('storage', handleStorage);
  return () => window.removeEventListener('storage', handleStorage);
}

interface ReducedMotionBindingOptions {
  root?: HTMLElement;
  matchMedia?: ((query: string) => MediaQueryList) | null;
}

export function applyReducedMotionPreference(
  reducedMotion: boolean,
  options: ReducedMotionBindingOptions = {}
): () => void {
  const root = options.root
    ?? (typeof document === 'undefined' ? null : document.documentElement);
  if (!root) {
    return () => undefined;
  }

  const matchMedia = options.matchMedia === undefined
    ? (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia.bind(window)
        : null)
    : options.matchMedia;
  const mediaQuery = matchMedia?.(REDUCED_MOTION_QUERY) ?? null;

  const updateRootClass = () => {
    root.classList.toggle(
      REDUCED_MOTION_ROOT_CLASS,
      reducedMotion || Boolean(mediaQuery?.matches)
    );
  };
  updateRootClass();

  if (!mediaQuery) {
    return () => root.classList.remove(REDUCED_MOTION_ROOT_CLASS);
  }

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', updateRootClass);
    return () => {
      mediaQuery.removeEventListener('change', updateRootClass);
      root.classList.remove(REDUCED_MOTION_ROOT_CLASS);
    };
  }

  mediaQuery.addListener(updateRootClass);
  return () => {
    mediaQuery.removeListener(updateRootClass);
    root.classList.remove(REDUCED_MOTION_ROOT_CLASS);
  };
}
