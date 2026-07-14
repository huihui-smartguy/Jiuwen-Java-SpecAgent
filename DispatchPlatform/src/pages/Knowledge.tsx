import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { PresentationOnlyButton } from '../components/PresentationOnlyButton';
import { getCopy } from '../i18n';
import type { Language } from '../types';

interface KnowledgeProps {
  language: Language;
}

const knowledgeData = {
  zh: {
    searchRegion: '知识搜索',
    searchLabel: '搜索知识库',
    searchPlaceholder: '搜索对象说明、测试策略、失败模式或标签',
    latestEyebrow: 'LATEST KNOWLEDGE',
    attentionEyebrow: 'NEEDS ATTENTION',
    viewGap: '查看',
    table: ['条目', '集合', '更新人', '更新时间'],
    collections: [
      {
        symbol: '◎',
        title: '对象手册',
        count: '42 条',
        description: '接口、环境与认证说明',
        meta: '12 个对象 · 今天更新',
        tone: 'accent'
      },
      {
        symbol: '◇',
        title: '测试策略',
        count: '18 条',
        description: '边界、分层与回归策略',
        meta: '覆盖 L0–L3 · 昨天更新',
        tone: 'warning'
      },
      {
        symbol: '△',
        title: '失败模式',
        count: '27 条',
        description: '常见根因与处置经验',
        meta: '9 个高频模式 · 7 月 12 日',
        tone: 'accent'
      }
    ],
    updates: [
      ['API 密钥轮换策略', '测试策略', 'huihui', '今天 10:26'],
      ['合一版本认证范围', '对象手册', 'liuming', '昨天 17:40'],
      ['会话过期常见根因', '失败模式', 'wangqi', '7 月 12 日'],
      ['数据源连通性检查', '对象手册', 'huihui', '7 月 11 日'],
      ['角色继承边界说明', '失败模式', 'liuming', '7 月 10 日']
    ],
    gaps: [
      {
        title: 'API 密钥删除策略',
        description: '缺少异常回滚步骤',
        status: '高优先级',
        priority: true
      },
      {
        title: '角色继承边界',
        description: '尚未关联验证脚本',
        status: '待关联',
        priority: false
      },
      {
        title: '会话续期规则',
        description: '最近 30 天未复核',
        status: '待复核',
        priority: false
      }
    ]
  },
  en: {
    searchRegion: 'Knowledge search',
    searchLabel: 'Search knowledge',
    searchPlaceholder: 'Search Object notes, test strategies, failure modes, or tags',
    latestEyebrow: 'LATEST KNOWLEDGE',
    attentionEyebrow: 'NEEDS ATTENTION',
    viewGap: 'View',
    table: ['Entry', 'Collection', 'Updated by', 'Updated'],
    collections: [
      {
        symbol: '◎',
        title: 'Object manuals',
        count: '42 entries',
        description: 'Interfaces, environments, and authentication',
        meta: '12 Objects · Updated today',
        tone: 'accent'
      },
      {
        symbol: '◇',
        title: 'Test strategies',
        count: '18 entries',
        description: 'Boundaries, levels, and regression strategy',
        meta: 'Covers L0–L3 · Updated yesterday',
        tone: 'warning'
      },
      {
        symbol: '△',
        title: 'Failure modes',
        count: '27 entries',
        description: 'Common root causes and remediation',
        meta: '9 frequent patterns · Jul 12',
        tone: 'accent'
      }
    ],
    updates: [
      ['API key rotation strategy', 'Test strategies', 'huihui', 'Today 10:26'],
      ['Unified authentication scope', 'Object manuals', 'liuming', 'Yesterday 17:40'],
      ['Common session-expiry causes', 'Failure modes', 'wangqi', 'Jul 12'],
      ['Data-source connectivity checks', 'Object manuals', 'huihui', 'Jul 11'],
      ['Role inheritance boundary notes', 'Failure modes', 'liuming', 'Jul 10']
    ],
    gaps: [
      {
        title: 'API key deletion strategy',
        description: 'Missing exception rollback steps',
        status: 'High priority',
        priority: true
      },
      {
        title: 'Role inheritance boundaries',
        description: 'No validation script linked',
        status: 'Needs linking',
        priority: false
      },
      {
        title: 'Session renewal rules',
        description: 'Not reviewed in the last 30 days',
        status: 'Review due',
        priority: false
      }
    ]
  }
} as const;

function includesSearch(values: readonly string[], search: string): boolean {
  return !search || values.some((value) => value.toLocaleLowerCase().includes(search));
}

export function Knowledge({ language }: KnowledgeProps) {
  const t = getCopy(language);
  const copy = knowledgeData[language];
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const collections = copy.collections.filter((item) => (
    includesSearch([item.title, item.count, item.description, item.meta], normalizedSearch)
  ));
  const updates = copy.updates.filter((item) => includesSearch(item, normalizedSearch));
  const gaps = copy.gaps.filter((item) => (
    includesSearch([item.title, item.description, item.status], normalizedSearch)
  ));

  return (
    <div className="page-stack knowledge-page">
      <PageHeader
        title={t.knowledge}
        subtitle={t.knowledgeSubtitle}
        action={(
          <PresentationOnlyButton className="knowledge-new-entry">
            {t.newKnowledgeEntry}
            <span aria-hidden="true">→</span>
          </PresentationOnlyButton>
        )}
      />

      <section className="knowledge-search-surface" aria-label={copy.searchRegion}>
        <label className="knowledge-search-control">
          <span className="knowledge-search-symbol" aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label={copy.searchLabel}
            placeholder={copy.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <span className="knowledge-search-shortcut" aria-hidden="true">⌘ K</span>
      </section>

      <section className="knowledge-collections" aria-label={t.knowledgeCollections}>
        {collections.map((item) => (
          <article className="knowledge-collection-card" key={item.title}>
            <div className="knowledge-collection-card__header">
              <span className={`knowledge-collection-icon is-${item.tone}`} aria-hidden="true">
                {item.symbol}
              </span>
              <strong>{item.count}</strong>
            </div>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <div className="knowledge-collection-card__footer">
              <span>{item.meta}</span>
              <span aria-hidden="true">→</span>
            </div>
          </article>
        ))}
      </section>

      <div className="knowledge-lower-grid">
        <section className="knowledge-lower-card knowledge-recent-card" aria-labelledby="knowledge-recent-title">
          <div className="knowledge-card-heading">
            <div>
              <p className="knowledge-eyebrow">{copy.latestEyebrow}</p>
              <h2 id="knowledge-recent-title">{t.recentUpdates}</h2>
            </div>
            <PresentationOnlyButton className="knowledge-view-all">
              {t.viewAll}
              <span aria-hidden="true">→</span>
            </PresentationOnlyButton>
          </div>
          <div className="knowledge-update-table-scroll">
            <table className="knowledge-update-table">
              <thead>
                <tr>
                  {copy.table.map((heading) => <th key={heading}>{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {updates.map(([title, collection, owner, time], index) => (
                  <tr key={title} className={index % 2 === 1 ? 'is-shaded' : ''}>
                    <td>{title}</td>
                    <td><span>{collection}</span></td>
                    <td>{owner}</td>
                    <td>{time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="knowledge-lower-card knowledge-gaps-card" aria-labelledby="knowledge-gaps-title">
          <div className="knowledge-card-heading knowledge-gaps-heading">
            <div>
              <p className="knowledge-eyebrow">{copy.attentionEyebrow}</p>
              <h2 id="knowledge-gaps-title">{t.knowledgeGaps}</h2>
            </div>
            <span className="knowledge-open-count">{copy.gaps.length}</span>
          </div>
          <ul className="knowledge-gap-list">
            {gaps.map((item) => (
              <li className={item.priority ? 'is-priority' : ''} key={item.title}>
                <div className="knowledge-gap-list__heading">
                  <h3>{item.title}</h3>
                  <PresentationOnlyButton>
                    <span aria-hidden="true">→</span>
                    <span className="sr-only">{`${copy.viewGap} ${item.title}`}</span>
                  </PresentationOnlyButton>
                </div>
                <p>{item.description}</p>
                <strong>{item.status}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
