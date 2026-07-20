import { describe, expect, test } from 'vitest';
import { reportOutcome } from './reportSemantics';

describe('report semantics', () => {
  test('never presents a zero-result snapshot as passed', () => {
    expect(reportOutcome(
      { total: 0, success_rate: 100 },
      { passed: true, verdict: '通过' },
      'zh'
    )).toEqual({
      kind: 'no_results',
      label: '无匹配数据',
      tone: 'neutral',
      rate: '—'
    });
  });

  test('preserves definitive pass and failure conclusions when executions exist', () => {
    expect(reportOutcome(
      { total: 5, success_rate: 80 },
      { passed: false, verdict: '不通过' },
      'zh'
    )).toMatchObject({ kind: 'failed', label: '不通过', tone: 'danger', rate: '80.0%' });
    expect(reportOutcome(
      { total: 5, success_rate: 100 },
      { passed: true, verdict: 'Passed' },
      'en'
    )).toMatchObject({ kind: 'passed', label: 'Passed', tone: 'success', rate: '100.0%' });
  });
});
