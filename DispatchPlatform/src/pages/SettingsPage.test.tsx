import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import {
  CONSOLE_PREFERENCES_STORAGE_KEY,
  type ConsolePreferencesV1
} from '../preferences';
import type { Language, RuntimeConfig, SutTarget } from '../types';
import { SettingsPage } from './SettingsPage';

const objects: SutTarget[] = [
  {
    id: 'object-live',
    name: '合一版本 API',
    product: '合一版本',
    scene: 'API',
    version: 'Live',
    apiBaseUrl: '/testwise/api',
    status: 'healthy'
  },
  {
    id: 'object-next',
    name: '下一代对象',
    product: '下一代',
    scene: '场景',
    version: 'v5.0',
    apiBaseUrl: '',
    status: 'degraded'
  }
];

const runtimeConfig = resolveRuntimeConfig({
  apiBaseUrl: '/runtime-api',
  deploymentMode: 'container',
  defaultLanguage: 'zh',
  enableMockFallback: true,
  sutTargets: objects
});

const markdownPreferences: ConsolePreferencesV1 = {
  version: 1,
  defaultSutId: 'object-next',
  language: 'en',
  reducedMotion: true,
  reportDownloadFormat: 'md'
};

function renderSettings({
  language = 'zh',
  selectedSut = objects[0],
  defaultSutSnapshot,
  preferences,
  config = runtimeConfig,
  onObjectChange = vi.fn(),
  onLanguageChange = vi.fn(),
  onPreferencesChange = vi.fn()
}: {
  language?: Language;
  selectedSut?: SutTarget;
  defaultSutSnapshot?: SutTarget;
  preferences?: ConsolePreferencesV1;
  config?: RuntimeConfig;
  onObjectChange?: (id: string) => void;
  onLanguageChange?: (language: Language) => void;
  onPreferencesChange?: (preferences: ConsolePreferencesV1) => void;
} = {}) {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <SettingsPage
        language={language}
        selectedSut={selectedSut}
        defaultSutSnapshot={defaultSutSnapshot}
        runtimeConfig={config}
        preferences={preferences}
        onObjectChange={onObjectChange}
        onLanguageChange={onLanguageChange}
        onPreferencesChange={onPreferencesChange}
      />
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined
  });
});

describe('R8 Settings persistence', () => {
  test('renders four roomy cards, read-only runtime values, and only supported controls', () => {
    const { container } = renderSettings();

    const save = screen.getByRole('button', { name: '保存更改' });
    expect(save).toBeDisabled();

    const cards = Array.from(container.querySelectorAll<HTMLElement>('.settings-grid > .settings-card'));
    expect(cards).toHaveLength(4);
    expect(cards.map((card) => within(card).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'Object 连接',
      '运行环境',
      '控制台偏好',
      '报告与日志'
    ]);

    expect(screen.queryByRole('switch', { name: '连接检查' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Retention' })).not.toBeInTheDocument();

    const defaultObject = screen.getByRole('combobox', { name: '默认 Object' });
    expect(within(defaultObject).getByRole('option', { name: 'Unified Version API' }))
      .toHaveValue('object-live');
    expect(within(defaultObject).getByRole('option', { name: '下一代对象' }))
      .toHaveValue('object-next');
    expect(screen.getByText('Unified Version API', {
      selector: '.settings-select-object-name'
    })).toBeInTheDocument();

    const runtimeCard = screen.getByRole('region', { name: '运行环境' });
    expect(within(runtimeCard).getByRole('textbox', { name: '部署模式' }))
      .toHaveAttribute('readonly');
    expect(within(runtimeCard).getByRole('textbox', { name: '部署模式' }))
      .toHaveValue('Container');
    expect(within(runtimeCard).getByRole('textbox', { name: 'API base URL' }))
      .toHaveAttribute('readonly');
    expect(within(runtimeCard).getByRole('textbox', { name: 'API base URL' }))
      .toHaveValue('/testwise/api');

    const format = screen.getByRole('combobox', { name: '默认下载格式' });
    expect(format).toHaveValue('html');
    expect(within(format).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'HTML',
      'Markdown'
    ]);
    expect(screen.queryByText(/PDF|JSON/)).not.toBeInTheDocument();
  });

  test('uses validated saved defaults instead of immediate header session overrides', () => {
    window.localStorage.setItem(
      CONSOLE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(markdownPreferences)
    );

    renderSettings({ language: 'zh', selectedSut: objects[0] });

    expect(screen.getByRole('combobox', { name: '默认 Object' })).toHaveValue('object-next');
    expect(screen.getByRole('combobox', { name: '语言' })).toHaveValue('en');
    expect(screen.getByRole('switch', { name: '减少动态效果' }))
      .toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('combobox', { name: '默认下载格式' })).toHaveValue('md');
    expect(screen.getByRole('textbox', { name: 'API base URL' })).toHaveValue('/testwise/api');
  });

  test('represents a removed persisted default without silently selecting another Object', () => {
    const removedObject: SutTarget = {
      ...objects[0],
      id: 'removed-object',
      name: '合一版本 WEB',
      scene: 'WEB'
    };
    const removedPreferences: ConsolePreferencesV1 = {
      version: 1,
      defaultSutId: removedObject.id,
      defaultSutProduct: removedObject.product,
      defaultSutScene: removedObject.scene,
      language: 'en',
      reducedMotion: false,
      reportDownloadFormat: 'html'
    };
    const liveOnlyConfig = {
      ...runtimeConfig,
      sutTargets: [objects[1]]
    };

    renderSettings({
      language: 'en',
      selectedSut: removedObject,
      preferences: removedPreferences,
      config: liveOnlyConfig
    });

    const select = screen.getByRole('combobox', { name: 'Default Object' });
    expect(select).toHaveValue('removed-object');
    expect(within(select).getByRole('option', {
      name: 'Unified Version WEB · Removed'
    })).toBeDisabled();
    expect(screen.getByText('Unified Version WEB', {
      selector: '.settings-select-object-name'
    })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  test('preserves a legacy no-scope removed default during an ad-hoc selection and save', async () => {
    const user = userEvent.setup();
    const removedObject: SutTarget = {
      ...objects[0],
      id: 'legacy-removed-object',
      name: '合一版本 WEB',
      scene: 'WEB'
    };
    const legacyPreferences: ConsolePreferencesV1 = {
      version: 1,
      defaultSutId: removedObject.id,
      language: 'en',
      reducedMotion: false,
      reportDownloadFormat: 'html'
    };
    const onObjectChange = vi.fn();

    renderSettings({
      language: 'en',
      selectedSut: objects[1],
      defaultSutSnapshot: removedObject,
      preferences: legacyPreferences,
      config: {
        ...runtimeConfig,
        sutTargets: [objects[1]]
      },
      onObjectChange
    });

    expect(screen.getByRole('combobox', { name: 'Default Object' }))
      .toHaveValue(removedObject.id);
    expect(screen.getByText('Unified Version WEB', {
      selector: '.settings-select-object-name'
    })).toBeInTheDocument();
    expect(within(screen.getByRole('combobox', { name: 'Default Object' })).getByRole(
      'option',
      { name: 'Unified Version WEB · Removed' }
    )).toBeDisabled();
    await user.click(screen.getByRole('switch', { name: 'Reduced motion' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(JSON.parse(
      window.localStorage.getItem(CONSOLE_PREFERENCES_STORAGE_KEY) ?? '{}'
    )).toMatchObject({
      defaultSutId: removedObject.id,
      reducedMotion: true
    });
    expect(onObjectChange).toHaveBeenCalledWith(removedObject.id);
  });

  test('labels a removed persisted default from its saved scope during an ad-hoc live selection', () => {
    const removedPreferences: ConsolePreferencesV1 = {
      version: 1,
      defaultSutId: 'removed-unified-web',
      defaultSutProduct: '合一版本',
      defaultSutScene: 'WEB',
      language: 'en',
      reducedMotion: false,
      reportDownloadFormat: 'html'
    };
    const liveOnlyConfig = {
      ...runtimeConfig,
      sutTargets: [objects[1]]
    };

    renderSettings({
      language: 'en',
      selectedSut: objects[1],
      preferences: removedPreferences,
      config: liveOnlyConfig
    });

    const select = screen.getByRole('combobox', { name: 'Default Object' });
    expect(select).toHaveValue('removed-unified-web');
    expect(within(select).getByRole('option', {
      name: 'Unified Version WEB · Removed'
    })).toBeDisabled();
    expect(screen.getByText('Unified Version WEB', {
      selector: '.settings-select-object-name'
    })).toBeInTheDocument();
    expect(screen.queryByText('下一代对象', {
      selector: '.settings-select-object-name'
    })).not.toBeInTheDocument();
  });

  test('stages every field and writes the complete object before applying it to the shell', async () => {
    const callOrder: string[] = [];
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(
      this: Storage,
      key: string,
      value: string
    ) {
      callOrder.push('storage');
      originalSetItem.call(this, key, value);
    });
    const onObjectChange = vi.fn(() => callOrder.push('object'));
    const onLanguageChange = vi.fn(() => callOrder.push('language'));
    const onPreferencesChange = vi.fn(() => callOrder.push('preferences'));
    const user = userEvent.setup();
    renderSettings({ onObjectChange, onLanguageChange, onPreferencesChange });

    await user.selectOptions(screen.getByRole('combobox', { name: '默认 Object' }), 'object-next');
    await user.selectOptions(screen.getByRole('combobox', { name: '语言' }), 'en');
    await user.click(screen.getByRole('switch', { name: '减少动态效果' }));
    await user.selectOptions(screen.getByRole('combobox', { name: '默认下载格式' }), 'md');

    expect(onObjectChange).not.toHaveBeenCalled();
    expect(onLanguageChange).not.toHaveBeenCalled();
    expect(onPreferencesChange).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(CONSOLE_PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(screen.getByRole('button', { name: '保存更改' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '保存更改' }));

    const expectedPreferences: ConsolePreferencesV1 = {
      version: 1,
      defaultSutId: 'object-next',
      defaultSutProduct: '下一代',
      defaultSutScene: '场景',
      language: 'en',
      reducedMotion: true,
      reportDownloadFormat: 'md'
    };
    expect(await screen.findByRole('status')).toHaveTextContent('设置已保存并应用。');
    expect(JSON.parse(
      window.localStorage.getItem(CONSOLE_PREFERENCES_STORAGE_KEY) ?? '{}'
    )).toEqual(expectedPreferences);
    expect(onPreferencesChange).toHaveBeenCalledWith(expectedPreferences);
    expect(onObjectChange).toHaveBeenCalledWith('object-next');
    expect(onLanguageChange).toHaveBeenCalledWith('en');
    expect(callOrder).toEqual(['storage', 'preferences', 'object', 'language']);
    expect(screen.getByRole('button', { name: '保存更改' })).toBeDisabled();
  });

  test('retains the dirty draft and exposes an accessible retryable error when storage fails', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'QuotaExceededError');
    });
    const onObjectChange = vi.fn();
    const onLanguageChange = vi.fn();
    const onPreferencesChange = vi.fn();
    const user = userEvent.setup();
    renderSettings({ onObjectChange, onLanguageChange, onPreferencesChange });

    const format = screen.getByRole('combobox', { name: '默认下载格式' });
    await user.selectOptions(format, 'md');
    await user.click(screen.getByRole('button', { name: '保存更改' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('无法保存设置');
    expect(format).toHaveValue('md');
    expect(screen.getByRole('button', { name: '保存更改' })).toBeEnabled();
    expect(onPreferencesChange).not.toHaveBeenCalled();
    expect(onObjectChange).not.toHaveBeenCalled();
    expect(onLanguageChange).not.toHaveBeenCalled();
  });

  test('updates a directly rendered Settings page for valid cross-tab changes', () => {
    const onObjectChange = vi.fn();
    const onLanguageChange = vi.fn();
    const onPreferencesChange = vi.fn();
    renderSettings({ onObjectChange, onLanguageChange, onPreferencesChange });

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: CONSOLE_PREFERENCES_STORAGE_KEY,
        newValue: JSON.stringify(markdownPreferences)
      }));
    });

    expect(screen.getByRole('combobox', { name: '默认 Object' })).toHaveValue('object-next');
    expect(screen.getByRole('combobox', { name: '语言' })).toHaveValue('en');
    expect(onPreferencesChange).toHaveBeenCalledWith(markdownPreferences);
    expect(onObjectChange).toHaveBeenCalledWith('object-next');
    expect(onLanguageChange).toHaveBeenCalledWith('en');
  });

  test('copies the displayed resolved API base without coupling it to preference storage', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    renderSettings();

    await user.click(screen.getByRole('button', { name: '复制 API base URL' }));

    expect(writeText).toHaveBeenCalledWith('/testwise/api');
    expect(window.localStorage.getItem(CONSOLE_PREFERENCES_STORAGE_KEY)).toBeNull();
  });

  test('keeps feedback stable until the next edit and then returns to a normal dirty state', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.selectOptions(screen.getByRole('combobox', { name: '默认下载格式' }), 'md');
    await user.click(screen.getByRole('button', { name: '保存更改' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: '默认下载格式' }), 'html');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存更改' })).toBeEnabled();

    await user.selectOptions(screen.getByRole('combobox', { name: '默认下载格式' }), 'md');
    await waitFor(() => expect(screen.getByRole('button', { name: '保存更改' })).toBeDisabled());
  });
});

describe('R8 Settings layout contract', () => {
  test('preserves spacious responsive typography without body text below 13px', () => {
    const css = readFileSync('src/styles/routes/settings.css', 'utf8');

    expect(css).toMatch(/\.settings-page\s*\{[^}]*gap:\s*24px;/);
    expect(css).toMatch(/\.settings-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*636px\)\);[^}]*gap:\s*24px;/);
    expect(css).toMatch(/\.settings-card\s*\{[^}]*min-height:\s*300px;[^}]*padding:\s*26px 28px;/);
    expect(css).toMatch(/\.settings-card__description\s*\{[^}]*font-size:\s*14px;[^}]*line-height:\s*22px;/);
    expect(css).toMatch(/\.settings-row__label > span\s*\{[^}]*font-size:\s*13px;[^}]*line-height:\s*20px;/);
    expect(css).toMatch(/\.settings-control\s*\{[^}]*min-height:\s*48px;/);
    expect(css).toMatch(/@media \(max-width:\s*980px\)[\s\S]*\.settings-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/);
    expect(css).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.settings-row\s*\{[^}]*min-height:\s*104px;/);
    expect(css).not.toMatch(/font-size:\s*(?:9|10|11|12)px/);
  });
});
