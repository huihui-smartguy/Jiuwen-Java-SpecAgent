import { ArrowRight, CheckCircle2, CircleAlert, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCopy } from '../i18n';
import type { Language, NormalizedTaskStatus, RuntimeConfig, SutTarget } from '../types';
import { ExecutionFocus } from '../components/ExecutionFocus';

interface PageProps {
  language: Language;
  selectedSut: SutTarget;
  activeTask: NormalizedTaskStatus;
  runtimeConfig: RuntimeConfig;
}

export function Dashboard({ language, selectedSut, activeTask }: PageProps) {
  const t = getCopy(language);
  const cards = [
    { label: t.basic, pass: '96%', issues: '1', run: '10:42' },
    { label: t.performance, pass: '91%', issues: '2', run: '09:18' },
    { label: t.scenario, pass: '88%', issues: '3', run: 'Yesterday' },
    { label: t.dfx, pass: '93%', issues: '1', run: 'Jul 10' }
  ];
  const activityItems =
    language === 'zh'
      ? ['保存接口任务已发起', '门户回归已完成并生成摘要', '执行日志已导出', '营销系统 SUT 已完成健康检查']
      : [
          'Save API task was created',
          'Portal regression completed with a summary',
          'Execution logs were exported',
          'Marketing SUT health check completed'
        ];

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">TestWise</p>
          <h1>{t.dashboard}</h1>
          <p className="page-subtitle">{t.dashboardSubtitle}</p>
        </div>
        <Link className="button button--primary" to="/tasks">
          {t.newTask}
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <ExecutionFocus language={language} sut={selectedSut} task={activeTask} />

      <section className="kanban-quality" aria-labelledby="quality-summary-title">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">L0</p>
            <h2 id="quality-summary-title">{t.l0Summary}</h2>
          </div>
          <ShieldCheck aria-hidden="true" />
        </div>
        <div className="quality-grid quality-grid--four">
          {cards.map((card) => (
            <article className="quality-card" key={card.label}>
              <h3>{card.label}</h3>
              <strong className="quality-card__value">{card.pass}</strong>
              <dl>
                <div>
                  <dt>{t.activeIssues}</dt>
                  <dd>{card.issues}</dd>
                </div>
                <div>
                  <dt>{t.lastRun}</dt>
                  <dd>{card.run}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid section-grid--two kanban-bottom-grid">
        <div className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t.recentActivity}</p>
              <h2>{t.recentActivity}</h2>
            </div>
          </div>
          <ul className="activity-list">
            {activityItems.map((item) => (
              <li key={item}>
                <CheckCircle2 aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="attention-panel" aria-labelledby="attention-title">
          <CircleAlert aria-hidden="true" />
          <div>
            <p className="eyebrow">{t.attention}</p>
            <h2 id="attention-title">{t.noFakeLiveLogs}</h2>
          </div>
        </aside>
      </section>
    </div>
  );
}
