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

    const searchSurface = screen.getByRole('region', { name: '今天要查找什么?' });
    expect(within(searchSurface).getByText('搜索 Feature、运行手册、失败模式与对象约束')).toBeInTheDocument();
    expect(within(searchSurface).getByRole('searchbox', { name: '搜索知识库' })).toHaveAttribute(
      'placeholder',
      '搜索知识库'
    );
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
      '对象手册4 个对象 · 37 篇说明版本、依赖、凭据与环境约束',
      '测试策略18 个 Feature · 62 篇策略范围、级别与验收信号',
      '失败模式29 个已知模式 · 8 个待更新诊断路径与恢复步骤'
    ]);

    const recent = screen.getByRole('region', { name: '最近更新' });
    expect(within(recent).getByText('与当前 Object 相关')).toBeInTheDocument();
    expect(within(recent).getByRole('button', { name: '查看全部' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    const updates = within(recent).getAllByRole('listitem');
    expect(updates).toHaveLength(3);
    expect(updates.map((row) => row.textContent)).toEqual([
      'API 密钥回归测试策略覆盖范围、数据准备与验收标准12 min',
      '合一版本 v4.12 环境约束运行端口、服务依赖与凭据轮换Yesterday',
      '任务长时间 Pending 的诊断路径队列、Worker 与状态同步检查清单Jul 10'
    ]);

    const gaps = screen.getByRole('region', { name: '知识缺口' });
    expect(within(gaps).getByText('3 open')).toBeInTheDocument();
    const gapRows = within(gaps).getAllByRole('listitem');
    expect(gapRows).toHaveLength(3);
    expect(gapRows.map((row) => row.textContent)).toEqual([
      '撤销密钥失败模式补充',
      'L3 场景重试策略补充',
      '日志导出权限说明补充'
    ]);
    expect(within(gaps).getAllByRole('button', { name: '补充' })).toHaveLength(3);

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
    expect(within(recent).getAllByRole('listitem')).toHaveLength(1);
    expect(within(recent).getByText('API 密钥回归测试策略')).toBeInTheDocument();
    expect(within(gaps).getAllByRole('listitem')).toHaveLength(1);
    expect(within(gaps).getByText('L3 场景重试策略')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.clear(search);
    expect(within(collections).getAllByRole('article')).toHaveLength(3);
    expect(within(recent).getAllByRole('listitem')).toHaveLength(3);
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
      ...screen.getAllByRole('button', { name: '补充' })
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
    expect(screen.getByRole('region', { name: 'What do you want to find today?' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search knowledge' })).toHaveAttribute(
      'placeholder',
      'Search knowledge'
    );

    const collections = screen.getByRole('region', { name: 'Knowledge collections' });
    expect(within(collections).getAllByRole('article')).toHaveLength(3);
    expect(within(collections).getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'Object manuals',
      'Test strategies',
      'Failure modes'
    ]);
    expect(screen.getByRole('region', { name: 'Recent updates' })).toHaveTextContent(
      'API key regression test strategy'
    );
    const gaps = screen.getByRole('region', { name: 'Knowledge gaps' });
    expect(within(gaps).getAllByRole('listitem')).toHaveLength(3);
    expect(within(gaps).getAllByRole('button', { name: 'Add details' })).toHaveLength(3);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(fetchSpy).not.toHaveBeenCalled();
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
    expect(knowledgeCss.match(/linear-gradient\(/g)).toHaveLength(1);
    expect(knowledgeCss).toMatch(
      /\.knowledge-search-surface\s*\{[^}]*height:\s*96px;[^}]*background:\s*linear-gradient\(/
    );
    expect(knowledgeCss).toMatch(
      /\.knowledge-collections\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*18px;/
    );
    expect(knowledgeCss).toMatch(/\.knowledge-collection-card\s*\{[^}]*height:\s*152px;/);
    expect(knowledgeCss).toMatch(
      /\.knowledge-lower-grid\s*\{[^}]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*18px;/
    );
    expect(knowledgeCss).toMatch(/\.knowledge-recent-card\s*\{[^}]*grid-column:\s*span 8;[^}]*height:\s*259px;/);
    expect(knowledgeCss).toMatch(/\.knowledge-gaps-card\s*\{[^}]*grid-column:\s*span 4;[^}]*height:\s*259px;/);
    expect(knowledgeCss).toMatch(
      /\.knowledge-page \.presentation-only-button\s*\{[^}]*min-height:\s*44px;/
    );
    expect(knowledgeCss).toMatch(
      /@media \(max-width:\s*980px\)[\s\S]*\.knowledge-recent-card,[\s\S]*\.knowledge-gaps-card\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/
    );
  });
});
