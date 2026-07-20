import type { Language, ReportConclusion, ReportSummary } from './types';

export type ReportOutcomeKind = 'passed' | 'failed' | 'no_results';

export interface ReportOutcomePresentation {
  kind: ReportOutcomeKind;
  label: string;
  tone: 'success' | 'danger' | 'neutral';
  rate: string;
}

export function reportOutcomeKind(
  summary: Pick<ReportSummary, 'total'>,
  conclusion: Pick<ReportConclusion, 'passed'>
): ReportOutcomeKind {
  if (summary.total <= 0) {
    return 'no_results';
  }
  return conclusion.passed ? 'passed' : 'failed';
}

export function reportOutcome(
  summary: Pick<ReportSummary, 'total' | 'success_rate'>,
  conclusion: Pick<ReportConclusion, 'passed' | 'verdict'>,
  language: Language
): ReportOutcomePresentation {
  const kind = reportOutcomeKind(summary, conclusion);
  if (kind === 'no_results') {
    return {
      kind,
      label: language === 'zh' ? '无匹配数据' : 'No matching data',
      tone: 'neutral',
      rate: '—'
    };
  }
  return {
    kind,
    label: conclusion.verdict,
    tone: kind === 'passed' ? 'success' : 'danger',
    rate: `${summary.success_rate.toFixed(1)}%`
  };
}
