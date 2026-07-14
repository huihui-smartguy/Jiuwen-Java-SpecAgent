import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  CornerDownRight,
  Diamond,
  Search
} from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { PresentationOnlyButton } from '../components/PresentationOnlyButton';
import { getCopy } from '../i18n';
import type { Language } from '../types';

interface KnowledgeProps {
  language: Language;
}

function includesSearch(values: readonly string[], search: string): boolean {
  return !search || values.some((value) => value.toLocaleLowerCase().includes(search));
}

export function Knowledge({ language }: KnowledgeProps) {
  const t = getCopy(language);
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const collections = [
    {
      title: t.objectManuals,
      count: t.objectManualsCount,
      detail: t.objectManualsDetail,
      icon: Diamond
    },
    {
      title: t.testStrategies,
      count: t.testStrategiesCount,
      detail: t.testStrategiesDetail,
      icon: CornerDownRight
    },
    {
      title: t.failureModes,
      count: t.failureModesCount,
      detail: t.failureModesDetail,
      icon: CircleAlert
    }
  ].filter((item) => includesSearch([item.title, item.count, item.detail], normalizedSearch));
  const updates = [
    {
      title: t.knowledgeUpdateApiKeyTitle,
      detail: t.knowledgeUpdateApiKeyDetail,
      time: t.knowledgeUpdateApiKeyTime
    },
    {
      title: t.knowledgeUpdateEnvironmentTitle,
      detail: t.knowledgeUpdateEnvironmentDetail,
      time: t.knowledgeUpdateEnvironmentTime
    },
    {
      title: t.knowledgeUpdatePendingTitle,
      detail: t.knowledgeUpdatePendingDetail,
      time: t.knowledgeUpdatePendingTime
    }
  ].filter((item) => includesSearch([item.title, item.detail, item.time], normalizedSearch));
  const gaps = [
    t.keyRevocationKnowledgeGap,
    t.scenarioRetryKnowledgeGap,
    t.logExportPermissionKnowledgeGap
  ].filter((item) => includesSearch([item], normalizedSearch));

  return (
    <div className="page-stack knowledge-page">
      <PageHeader
        title={t.knowledge}
        subtitle={t.knowledgeSubtitle}
        action={(
          <PresentationOnlyButton className="knowledge-new-entry">
            {t.newKnowledgeEntry}
            <ArrowRight aria-hidden="true" />
          </PresentationOnlyButton>
        )}
      />

      <section className="knowledge-search-surface" aria-labelledby="knowledge-search-title">
        <div>
          <h2 id="knowledge-search-title">{t.knowledgeSearchTitle}</h2>
          <p>{t.knowledgeSearchHint}</p>
        </div>
        <label className="knowledge-search-control">
          <Search aria-hidden="true" />
          <span className="sr-only">{t.searchKnowledge}</span>
          <input
            type="search"
            aria-label={t.searchKnowledge}
            placeholder={t.searchKnowledge}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </section>

      <section className="knowledge-collections" aria-label={t.knowledgeCollections}>
        {collections.map(({ title, count, detail, icon: Icon }) => (
          <article className="knowledge-collection-card" key={title}>
            <span className="knowledge-collection-icon">
              <Icon aria-hidden="true" />
            </span>
            <h2>{title}</h2>
            <p>{count}</p>
            <p>{detail}</p>
          </article>
        ))}
      </section>

      <div className="knowledge-lower-grid">
        <section className="knowledge-lower-card knowledge-recent-card" aria-labelledby="knowledge-recent-title">
          <div className="knowledge-card-heading">
            <div>
              <h2 id="knowledge-recent-title">{t.recentUpdates}</h2>
              <p>{t.currentObjectRelated}</p>
            </div>
            <PresentationOnlyButton className="knowledge-view-all">
              {t.viewAll}
              <ArrowRight aria-hidden="true" />
            </PresentationOnlyButton>
          </div>
          <ul className="knowledge-update-list">
            {updates.map((item) => (
              <li key={item.title}>
                <span className="knowledge-update-icon">
                  <ArrowUpRight aria-hidden="true" />
                </span>
                <span className="knowledge-update-copy">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </span>
                <time>{item.time}</time>
              </li>
            ))}
          </ul>
        </section>

        <section className="knowledge-lower-card knowledge-gaps-card" aria-labelledby="knowledge-gaps-title">
          <div className="knowledge-card-heading">
            <h2 id="knowledge-gaps-title">{t.knowledgeGaps}</h2>
            <span className="knowledge-open-count">{t.openKnowledgeGaps}</span>
          </div>
          <ul className="knowledge-gap-list">
            {gaps.map((item) => (
              <li key={item}>
                <span>{item}</span>
                <PresentationOnlyButton>
                  {t.addKnowledgeDetails}
                  <span className="sr-only">{` ${item}`}</span>
                </PresentationOnlyButton>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
