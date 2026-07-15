import { describe, expect, test } from 'vitest';
import type { ReportResultRow, ReportRisk, StatisticsFilters } from './types';

describe('backend contract types', () => {
  test('accepts only documented statistics filter combinations', () => {
    const all: StatisticsFilters = {};
    const product: StatisticsFilters = { product: '合一版本' };
    const scene: StatisticsFilters = { product: '合一版本', scene: 'API' };
    // @ts-expect-error scene is invalid without its product dimension
    const invalid: StatisticsFilters = { scene: 'API' };

    expect([all, product, scene, invalid]).toHaveLength(4);
  });

  test('rejects undocumented report risk and result statuses', () => {
    // @ts-expect-error risk levels are high, medium, or low
    const riskLevel: ReportRisk['level'] = 'urgent';
    // @ts-expect-error result statuses are pass, failed, skipped, or running
    const resultStatus: ReportResultRow['status'] = 'unknown';

    expect([riskLevel, resultStatus]).toHaveLength(2);
  });
});
