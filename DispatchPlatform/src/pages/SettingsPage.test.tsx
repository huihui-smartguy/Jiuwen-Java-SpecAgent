import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync, readFileSync } from 'node:fs';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import type { Language, SutTarget } from '../types';
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

function LocationProbe() {
  return <span data-testid="location-path">{useLocation().pathname}</span>;
}

function renderSettings({
  language = 'zh',
  selectedSut = objects[0],
  onObjectChange = vi.fn(),
  onLanguageChange = vi.fn(),
  withLocationProbe = false
}: {
  language?: Language;
  selectedSut?: SutTarget;
  onObjectChange?: (id: string) => void;
  onLanguageChange?: (language: Language) => void;
  withLocationProbe?: boolean;
} = {}) {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <SettingsPage
        language={language}
        selectedSut={selectedSut}
        runtimeConfig={runtimeConfig}
        onObjectChange={onObjectChange}
        onLanguageChange={onLanguageChange}
      />
      {withLocationProbe && <LocationProbe />}
    </MemoryRouter>
  );
}

function createReducedMotionQuery(initialMatches = false) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQuery = {
    matches: initialMatches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    }),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener)),
    dispatchEvent: vi.fn()
  };

  return {
    mediaQuery,
    setMatches(matches: boolean) {
      mediaQuery.matches = matches;
      const event = { matches, media: mediaQuery.media } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    }
  };
}

afterEach(() => {
  document.documentElement.classList.remove('settings-reduced-motion', 'settings-test-class');
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('approved Settings frame', () => {
  test('renders the exact approved four-card composition, selected Object, and read-only runtime values', () => {
    const { container } = renderSettings();

    const title = screen.getByRole('heading', { level: 1, name: '设置' });
    const header = title.closest('.page-header');
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByText(
      '管理对象连接、运行环境与控制台偏好，变更保持显式可审计。'
    )).toBeInTheDocument();
    const save = within(header as HTMLElement).getByRole('button', { name: '保存更改' });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).not.toBeDisabled();

    const cards = Array.from(container.querySelectorAll<HTMLElement>('.settings-grid > .settings-card'));
    expect(cards).toHaveLength(4);
    expect(cards.map((card) => within(card).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'Object 连接',
      '运行环境',
      '控制台偏好',
      '报告与日志'
    ]);

    const objectCard = screen.getByRole('region', { name: 'Object 连接' });
    expect(within(objectCard).getByText('Connected')).toBeInTheDocument();
    expect(within(objectCard).getByText('合一版本 API', { selector: '.settings-select-object-name' }))
      .toBeInTheDocument();
    expect(within(objectCard).queryByText('Live')).not.toBeInTheDocument();
    expect(within(objectCard).getByRole('combobox', { name: '默认 Object' })).toHaveValue(
      'object-live'
    );

    const runtimeCard = screen.getByRole('region', { name: '运行环境' });
    expect(within(runtimeCard).getByText('只读配置')).toBeInTheDocument();
    const deployment = within(runtimeCard).getByRole('textbox', { name: 'Deployment mode' });
    const apiBase = within(runtimeCard).getByRole('textbox', { name: 'API base URL' });
    expect(deployment).toHaveValue('Container');
    expect(deployment).toHaveAttribute('readonly');
    expect(apiBase).toHaveValue('/testwise/api');
    expect(apiBase).toHaveAttribute('readonly');
    expect(within(runtimeCard).getByRole('button', { name: '复制 API base URL' })).toBeInTheDocument();
  });

  test('delegates Object and language changes only through the shared callbacks', async () => {
    const user = userEvent.setup();
    const onObjectChange = vi.fn();
    const onLanguageChange = vi.fn();
    renderSettings({ onObjectChange, onLanguageChange });

    await user.selectOptions(screen.getByRole('combobox', { name: '默认 Object' }), 'object-next');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'en');

    expect(onObjectChange).toHaveBeenCalledTimes(1);
    expect(onObjectChange).toHaveBeenCalledWith('object-next');
    expect(onLanguageChange).toHaveBeenCalledTimes(1);
    expect(onLanguageChange).toHaveBeenCalledWith('en');
  });

  test('keeps connection, reduced-motion, format, and retention controls local to the current render', async () => {
    const media = createReducedMotionQuery(false);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(media.mediaQuery));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const onObjectChange = vi.fn();
    const onLanguageChange = vi.fn();
    const user = userEvent.setup();
    renderSettings({ onObjectChange, onLanguageChange });

    const connection = screen.getByRole('switch', { name: '连接检查' });
    const reducedMotion = screen.getByRole('switch', { name: 'Reduced motion' });
    const format = screen.getByRole('combobox', { name: 'Default format' });
    const retention = screen.getByRole('combobox', { name: 'Retention' });
    expect(connection).toHaveAttribute('aria-checked', 'true');
    expect(reducedMotion).toHaveAttribute('aria-checked', 'false');
    expect(format).toHaveValue('pdf-json');
    expect(retention).toHaveValue('30');

    await user.click(connection);
    await user.click(reducedMotion);
    await user.selectOptions(format, 'pdf');
    await user.selectOptions(retention, '90');

    expect(connection).toHaveAttribute('aria-checked', 'false');
    expect(reducedMotion).toHaveAttribute('aria-checked', 'true');
    expect(format).toHaveValue('pdf');
    expect(retention).toHaveValue('90');
    expect(onObjectChange).not.toHaveBeenCalled();
    expect(onLanguageChange).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
  });

  test('combines the local reduced-motion control with system preference changes and cleans up only its root class', async () => {
    const media = createReducedMotionQuery(false);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(media.mediaQuery));
    document.documentElement.classList.add('settings-test-class');
    const user = userEvent.setup();
    const view = renderSettings();

    expect(document.documentElement).not.toHaveClass('settings-reduced-motion');
    expect(document.documentElement).toHaveClass('settings-test-class');

    await user.click(screen.getByRole('switch', { name: 'Reduced motion' }));
    expect(document.documentElement).toHaveClass('settings-reduced-motion');

    await user.click(screen.getByRole('switch', { name: 'Reduced motion' }));
    expect(document.documentElement).not.toHaveClass('settings-reduced-motion');

    act(() => media.setMatches(true));
    expect(document.documentElement).toHaveClass('settings-reduced-motion');
    act(() => media.setMatches(false));
    expect(document.documentElement).not.toHaveClass('settings-reduced-motion');

    view.unmount();
    expect(media.mediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(document.documentElement).not.toHaveClass('settings-reduced-motion');
    expect(document.documentElement).toHaveClass('settings-test-class');
  });

  test('copies exactly the displayed resolved API base without success or failure feedback', async () => {
    const writeText = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('clipboard unavailable'));
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    renderSettings();

    const copy = screen.getByRole('button', { name: '复制 API base URL' });
    await user.click(copy);
    await user.click(copy);

    expect(writeText).toHaveBeenNthCalledWith(1, '/testwise/api');
    expect(writeText).toHaveBeenNthCalledWith(2, '/testwise/api');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/已复制|复制失败|copied|copy failed/i)).not.toBeInTheDocument();
  });

  test('keeps Save focusable and entirely inert with zero persistence, navigation, overlays, or feedback', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const writeText = vi.fn();
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    const { container } = renderSettings({ withLocationProbe: true });
    const save = screen.getByRole('button', { name: '保存更改' });

    save.focus();
    expect(save).toHaveFocus();
    await user.click(save);
    await user.keyboard('{Enter}');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByTestId('location-path')).toHaveTextContent('/settings');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/保存成功|已保存|saved|success/i)).not.toBeInTheDocument();
    expect(container.querySelector('form')).not.toBeInTheDocument();
    expect(container.querySelector('footer')).not.toBeInTheDocument();
  });

  test('imports the dedicated stylesheet and encodes the approved flexible geometry and no-persistence boundary', () => {
    expect(existsSync('src/styles/routes/settings.css')).toBe(true);

    const stylesIndex = readFileSync('src/styles.css', 'utf8');
    const settingsCss = readFileSync('src/styles/routes/settings.css', 'utf8');
    const settingsSource = readFileSync('src/pages/SettingsPage.tsx', 'utf8');

    expect(stylesIndex).toContain("@import './styles/routes/settings.css';");
    expect(settingsSource).not.toMatch(
      /useQuery|useMutation|fetch\s*\(|localStorage|sessionStorage|<Link|<NavLink|useNavigate/
    );
    expect(settingsCss).toMatch(
      /\.settings-page\s*\{[^}]*gap:\s*24px;/
    );
    expect(settingsCss).toMatch(
      /\.settings-page > \.page-header\s*\{[^}]*height:\s*118px;[^}]*min-height:\s*118px;/
    );
    expect(settingsCss).toMatch(
      /\.settings-page > \.page-header h1\s*\{[^}]*letter-spacing:\s*0;/
    );
    expect(settingsCss).toMatch(
      /\.settings-page > \.page-header \.page-subtitle\s*\{[^}]*margin-top:\s*10px;/
    );
    expect(settingsCss).toMatch(/\.settings-save\s*\{[^}]*gap:\s*10px;/);
    expect(settingsCss).toMatch(
      /\.settings-runtime-pill\s*\{[^}]*width:\s*auto;[^}]*min-width:\s*96px;/
    );
    expect(settingsCss).toMatch(
      /\.settings-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*636px\)\);[^}]*grid-auto-rows:\s*minmax\(310px,\s*auto\);[^}]*gap:\s*24px;/
    );
    expect(settingsCss).toMatch(
      /\.settings-card\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*310px;[^}]*padding:\s*24px 28px;/
    );
    expect(settingsCss).toMatch(
      /\.settings-card__description\s*\{[^}]*font-size:\s*14px;[^}]*line-height:\s*22px;[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/
    );
    expect(settingsCss).toMatch(
      /\.settings-row\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*78px;/
    );
    expect(settingsCss).toMatch(
      /\.settings-card--preferences \.settings-row,[\s\S]*\.settings-card--reports \.settings-row\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*91px;/
    );
    expect(settingsCss).toMatch(
      /\.settings-row__label strong\s*\{[^}]*font-size:\s*14px;[^}]*line-height:\s*22px;[^}]*overflow-wrap:\s*anywhere;/
    );
    expect(settingsCss).toMatch(
      /\.settings-row__label > span\s*\{[^}]*font-size:\s*12px;[^}]*line-height:\s*18px;[^}]*overflow-wrap:\s*anywhere;/
    );
    expect(settingsCss).toMatch(/\.settings-select-shell\s*\{[^}]*width:\s*250px;/);
    expect(settingsCss).toMatch(/\.settings-control\s*\{[^}]*min-height:\s*48px;/);
    expect(settingsCss).toMatch(
      /\.settings-select-visual\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*48px;/
    );
    expect(settingsCss).not.toMatch(
      /\.settings-card__description\s*\{[^}]*(?:overflow:\s*hidden|text-overflow:\s*ellipsis|white-space:\s*nowrap)/
    );
    expect(settingsCss).toMatch(
      /@media \(max-width:\s*980px\)[\s\S]*\.settings-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/
    );
  });
});
