import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync, readFileSync } from 'node:fs';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveRuntimeConfig } from '../config/runtime';
import type { Language } from '../types';
import { Knowledge } from './Knowledge';

const runtimeConfig = resolveRuntimeConfig({
  defaultLanguage: 'zh',
  enableMockFallback: true
});

function LocationProbe() {
  return <span data-testid="location-path">{useLocation().pathname}</span>;
}

function renderKnowledge(language: Language = 'zh') {
  const props = {
    language,
    selectedSut: runtimeConfig.sutTargets[0],
    activeTask: null,
    runtimeConfig
  };

  return render(
    <MemoryRouter initialEntries={['/knowledge']}>
      <Knowledge {...props} />
      <LocationProbe />
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('approved Knowledge frame', () => {
  test('renders the exact approved Chinese composition, copy, counts, and source order', () => {
    const { container } = renderKnowledge();

    const title = screen.getByRole('heading', { level: 1, name: '知识库' });
    const header = title.closest('.page-header');
    expect(header).not.toBeNull();
    expect(within(header as HTMLElement).getByText(
      '把测试策略、对象说明和故障经验组织成可检索的执行知识。'
    )).toBeInTheDocument();
    expect(within(header as HTMLElement).getByRole('button', { name: '新建条目' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    const searchSurface = screen.getByRole('region', { name: '知识搜索' });
    expect(within(searchSurface).getByRole('searchbox', { name: '搜索知识库' })).toHaveAttribute(
      'placeholder',
      '搜索对象说明、测试策略、失败模式或标签'
    );
    expect(within(searchSurface).getByText('⌘ K')).toBeInTheDocument();
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);

    const collections = screen.getByRole('region', { name: '知识集合' });
    const collectionCards = within(collections).getAllByRole('article');
    expect(collectionCards).toHaveLength(3);
    expect(collectionCards.map((card) => within(card).getByRole('heading').textContent)).toEqual([
      '对象手册',
      '测试策略',
      '失败模式'
    ]);
    expect(collectionCards.map((card) => card.textContent)).toEqual([
      '◎42 条对象手册接口、环境与认证说明12 个对象 · 今天更新→',
      '◇18 条测试策略边界、分层与回归策略覆盖 L0–L3 · 昨天更新→',
      '△27 条失败模式常见根因与处置经验9 个高频模式 · 7 月 12 日→'
    ]);

    const recent = screen.getByRole('region', { name: '最近更新' });
    expect(within(recent).getByText('LATEST KNOWLEDGE')).toBeInTheDocument();
    expect(within(recent).getByRole('button', { name: '查看全部' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    const updates = within(recent).getAllByRole('row').slice(1);
    expect(updates).toHaveLength(5);
    expect(updates.map((row) => row.textContent)).toEqual([
      'API 密钥轮换策略测试策略huihui今天 10:26',
      '合一版本认证范围对象手册liuming昨天 17:40',
      '会话过期常见根因失败模式wangqi7 月 12 日',
      '数据源连通性检查对象手册huihui7 月 11 日',
      '角色继承边界说明失败模式liuming7 月 10 日'
    ]);

    const gaps = screen.getByRole('region', { name: '知识缺口' });
    expect(within(gaps).getByText('NEEDS ATTENTION')).toBeInTheDocument();
    expect(within(gaps).getByText('3')).toBeInTheDocument();
    const gapRows = within(gaps).getAllByRole('listitem');
    expect(gapRows).toHaveLength(3);
    expect(gapRows.map((row) => row.querySelector('h3')?.textContent)).toEqual([
      'API 密钥删除策略',
      '角色继承边界',
      '会话续期规则'
    ]);
    expect(within(gaps).getAllByRole('button', { name: /^查看/ })).toHaveLength(3);

    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(container.querySelectorAll('.knowledge-page > section')).toHaveLength(2);
    expect(container.querySelectorAll('.knowledge-lower-grid > section')).toHaveLength(2);
    expect(Array.from(container.querySelectorAll('.knowledge-page > section, .knowledge-lower-grid > section')))
      .toEqual([searchSurface, collections, recent, gaps]);
  });

  test('filters only the strings already rendered across all three local collections without requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderKnowledge();

    const search = screen.getByRole('searchbox', { name: '搜索知识库' });
    const collections = screen.getByRole('region', { name: '知识集合' });
    const recent = screen.getByRole('region', { name: '最近更新' });
    const gaps = screen.getByRole('region', { name: '知识缺口' });

    await user.type(search, '策略');

    expect(within(collections).getAllByRole('article')).toHaveLength(1);
    expect(within(collections).getByRole('heading', { name: '测试策略' })).toBeInTheDocument();
    expect(within(recent).getAllByRole('row')).toHaveLength(2);
    expect(within(recent).getByText('API 密钥轮换策略')).toBeInTheDocument();
    const filteredGapRows = within(gaps).getAllByRole('listitem');
    expect(filteredGapRows).toHaveLength(1);
    expect(filteredGapRows[0]).toHaveTextContent('API 密钥删除策略');
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.clear(search);
    expect(within(collections).getAllByRole('article')).toHaveLength(3);
    expect(within(recent).getAllByRole('row')).toHaveLength(6);
    expect(within(gaps).getAllByRole('listitem')).toHaveLength(3);

    await user.type(search, '绝无此项');
    expect(within(collections).queryAllByRole('article')).toHaveLength(0);
    expect(within(recent).queryAllByRole('listitem')).toHaveLength(0);
    expect(within(gaps).queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryByText(/未找到|没有匹配|搜索结果/i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-testid="knowledge-search-results"]')).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('keeps every approved action focusable and inert without requests, storage, overlays, feedback, or navigation', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    const { container } = renderKnowledge();

    const actions = [
      screen.getByRole('button', { name: '新建条目' }),
      screen.getByRole('button', { name: '查看全部' }),
      ...within(screen.getByRole('region', { name: '知识缺口' })).getAllByRole('button', { name: /^查看/ })
    ];
    expect(actions).toHaveLength(5);

    for (const action of actions) {
      expect(action).toHaveAttribute('aria-disabled', 'true');
      expect(action).not.toBeDisabled();
      action.focus();
      expect(action).toHaveFocus();
      await user.click(action);
      await user.keyboard('{Enter}');
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('location-path')).toHaveTextContent('/knowledge');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.querySelector('form')).not.toBeInTheDocument();
    expect(container.querySelector('footer')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-label*="pagination" i]')).not.toBeInTheDocument();
    expect(container.querySelector('[contenteditable="true"]')).not.toBeInTheDocument();
  });

  test('renders the approved local information architecture in English', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderKnowledge('en');

    expect(screen.getByRole('heading', { level: 1, name: 'Knowledge' })).toBeInTheDocument();
    expect(screen.getByText(
      'Organize test strategies, Object notes, and failure experience into searchable execution knowledge.'
    )).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New entry' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('region', { name: 'Knowledge search' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search knowledge' })).toHaveAttribute(
      'placeholder',
      'Search Object notes, test strategies, failure modes, or tags'
    );

    const collections = screen.getByRole('region', { name: 'Knowledge collections' });
    expect(within(collections).getAllByRole('article')).toHaveLength(3);
    expect(within(collections).getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'Object manuals',
      'Test strategies',
      'Failure modes'
    ]);
    expect(screen.getByRole('region', { name: 'Recent updates' })).toHaveTextContent(
      'API key rotation strategy'
    );
    const gaps = screen.getByRole('region', { name: 'Knowledge gaps' });
    expect(within(gaps).getAllByRole('listitem')).toHaveLength(3);
    expect(within(gaps).getAllByRole('button', { name: /^View/ })).toHaveLength(3);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('gives every gap action a unique row-context accessible name in both languages', () => {
    const chinese = renderKnowledge('zh');
    const chineseGaps = screen.getByRole('region', { name: '知识缺口' });
    const chineseActions = within(chineseGaps).getAllByRole('button');
    const expectedChineseNames = [
      '查看 API 密钥删除策略',
      '查看 角色继承边界',
      '查看 会话续期规则'
    ];

    expect(chineseActions).toHaveLength(3);
    expect(new Set(expectedChineseNames).size).toBe(3);
    chineseActions.forEach((action, index) => {
      expect(action).toHaveAccessibleName(expectedChineseNames[index]);
      expect(action).toHaveAttribute('aria-disabled', 'true');
    });

    chinese.unmount();
    renderKnowledge('en');
    const englishGaps = screen.getByRole('region', { name: 'Knowledge gaps' });
    const englishActions = within(englishGaps).getAllByRole('button');
    const expectedEnglishNames = [
      'View API key deletion strategy',
      'View Role inheritance boundaries',
      'View Session renewal rules'
    ];

    expect(englishActions).toHaveLength(3);
    expect(new Set(expectedEnglishNames).size).toBe(3);
    englishActions.forEach((action, index) => {
      expect(action).toHaveAccessibleName(expectedEnglishNames[index]);
      expect(action).toHaveAttribute('aria-disabled', 'true');
    });
  });

  test('imports only the Knowledge stylesheet, encodes the approved geometry, and removes the legacy placeholder', () => {
    const legacyPagePath = ['src/pages/Shell', 'Page.tsx'].join('');

    expect(existsSync('src/styles/routes/knowledge.css')).toBe(true);
    expect(existsSync(legacyPagePath)).toBe(false);

    const stylesIndex = readFileSync('src/styles.css', 'utf8');
    const knowledgeCss = readFileSync('src/styles/routes/knowledge.css', 'utf8');
    const knowledgeSource = readFileSync('src/pages/Knowledge.tsx', 'utf8');

    expect(stylesIndex).toContain("@import './styles/routes/knowledge.css';");
    expect(knowledgeSource).not.toMatch(/useQuery|useMutation|fetch\s*\(|localStorage|sessionStorage|<Link|<NavLink/);
    expect(knowledgeCss).not.toMatch(/linear-gradient\(/);
    expect(knowledgeCss).toMatch(
      /\.knowledge-page\s*\{[^}]*gap:\s*24px;/
    );
    expect(knowledgeCss).toMatch(
      /\.knowledge-page > \.page-header\s*\{[^}]*height:\s*110px;[^}]*min-height:\s*110px;/
    );
    expect(knowledgeCss).toMatch(
      /\.knowledge-page > \.page-header h1\s*\{[^}]*letter-spacing:\s*0;/
    );
    expect(knowledgeCss).toMatch(
      /\.knowledge-page > \.page-header \.page-subtitle\s*\{[^}]*margin-top:\s*10px;/
    );
    expect(knowledgeCss).toMatch(/\.knowledge-new-entry\s*\{[^}]*gap:\s*10px;/);
    expect(knowledgeCss).toMatch(
      /\.knowledge-search-surface\s*\{[^}]*height:\s*64px;[^}]*border-radius:\s*18px;/
    );
    expect(knowledgeCss).toMatch(
      /\.knowledge-collections\s*\{[^}]*grid-template-columns:\s*421px 422px 421px;[^}]*gap:\s*16px;/
    );
    expect(knowledgeCss).toMatch(/\.knowledge-collection-card\s*\{[^}]*height:\s*200px;[^}]*padding:\s*22px 24px;/);
    expect(knowledgeCss).toMatch(
      /\.knowledge-lower-grid\s*\{[^}]*grid-template-columns:\s*856px 416px;[^}]*gap:\s*24px;/
    );
    expect(knowledgeCss).toMatch(/\.knowledge-recent-card\s*\{[^}]*height:\s*476px;[^}]*padding:\s*22px 28px;/);
    expect(knowledgeCss).toMatch(/\.knowledge-gaps-card\s*\{[^}]*height:\s*476px;[^}]*padding:\s*22px 24px;/);
    expect(knowledgeCss).toMatch(
      /\.knowledge-page \.presentation-only-button\s*\{[^}]*min-height:\s*44px;/
    );
    expect(knowledgeCss).toMatch(
      /@media \(max-width:\s*980px\)[\s\S]*\.knowledge-recent-card,[\s\S]*\.knowledge-gaps-card\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/
    );
  });
});
