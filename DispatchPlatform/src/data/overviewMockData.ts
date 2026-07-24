export type QualityDimensionId = 'basic' | 'dfx' | 'scenario' | 'performance';

export type QualityStatusTone = 'attention' | 'healthy';

export interface DimensionQualityMock {
  id: QualityDimensionId;
  passed: number;
  total: number;
  failed: number;
  running: number;
  score: number;
  rating: string;
  issues: number;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  status: QualityStatusTone;
}

export interface PerformanceTrendPoint {
  version: string;
  p95: number;
}

export interface OverviewQualityMock {
  version: string;
  totalExecutions: number;
  executed: number;
  unexecuted: number;
  passed: number;
  failed: number;
  running: number;
  overallPassRate: number;
  totalIssues: number;
  status: QualityStatusTone;
  dimensions: Record<QualityDimensionId, DimensionQualityMock>;
  performance: {
    p95: number;
    trend: readonly PerformanceTrendPoint[];
    currentVersion: string;
    baselineVersion: string;
    baselineP95: number;
    improvementMs: number;
    improvementPercent: number;
  };
}

interface QualityFixtureInput {
  version: string;
  total: number;
  passed: number;
  failed: number;
  running: number;
  totalIssues: number;
  scores: Record<QualityDimensionId, number>;
  dimensionIssues: Record<QualityDimensionId, number>;
  p95: number;
  baselineVersion: string;
  baselineP95: number;
  trend: readonly PerformanceTrendPoint[];
}

function ratingForScore(score: number) {
  if (score >= 93) {
    return 'A';
  }
  if (score >= 85) {
    return 'A-';
  }
  if (score >= 78) {
    return 'B+';
  }
  if (score >= 65) {
    return 'B';
  }
  return 'B-';
}

function dimensionFixture(
  id: QualityDimensionId,
  total: number,
  score: number,
  issues: number
): DimensionQualityMock {
  const running = total > 0 ? 1 : 0;
  const passed = Math.round((total * score) / 100);
  const failed = Math.max(0, total - passed - running);
  const criticalIssues = score < 75 && issues > 0 ? 1 : 0;
  const majorIssues = Math.min(
    issues - criticalIssues,
    Math.ceil((issues - criticalIssues) * 0.4)
  );

  return {
    id,
    passed,
    total,
    failed,
    running,
    score,
    rating: ratingForScore(score),
    issues,
    criticalIssues,
    majorIssues,
    minorIssues: issues - criticalIssues - majorIssues,
    status: score >= 80 ? 'healthy' : 'attention'
  };
}

function qualityFixture(input: QualityFixtureInput): OverviewQualityMock {
  const overallPassRate = Number(((input.passed / input.total) * 100).toFixed(2));
  const improvementMs = input.baselineP95 - input.p95;

  return {
    version: input.version,
    totalExecutions: input.total,
    executed: input.passed + input.failed + input.running,
    unexecuted: Math.max(0, input.total - input.passed - input.failed - input.running),
    passed: input.passed,
    failed: input.failed,
    running: input.running,
    overallPassRate,
    totalIssues: input.totalIssues,
    status: overallPassRate >= 80 ? 'healthy' : 'attention',
    dimensions: {
      basic: dimensionFixture(
        'basic',
        input.total,
        input.scores.basic,
        input.dimensionIssues.basic
      ),
      dfx: dimensionFixture(
        'dfx',
        input.total,
        input.scores.dfx,
        input.dimensionIssues.dfx
      ),
      scenario: dimensionFixture(
        'scenario',
        input.total,
        input.scores.scenario,
        input.dimensionIssues.scenario
      ),
      performance: dimensionFixture(
        'performance',
        input.total,
        input.scores.performance,
        input.dimensionIssues.performance
      )
    },
    performance: {
      p95: input.p95,
      trend: input.trend,
      currentVersion: input.version,
      baselineVersion: input.baselineVersion,
      baselineP95: input.baselineP95,
      improvementMs,
      improvementPercent: Number(((improvementMs / input.baselineP95) * 100).toFixed(1))
    }
  };
}

/**
 * Product and version keys intentionally use the backend's native identifiers.
 * Display-name translation belongs at the UI boundary; API identity never does.
 */
export const overviewQualityMockByProductVersion = {
  高码java: {
    'v2.4.1': qualityFixture({
      version: 'v2.4.1',
      total: 134,
      passed: 91,
      failed: 42,
      running: 1,
      totalIssues: 42,
      scores: { basic: 67.91, dfx: 88.06, scenario: 77.61, performance: 64.18 },
      dimensionIssues: { basic: 7, dfx: 5, scenario: 9, performance: 4 },
      p95: 412,
      baselineVersion: 'v2.2.0',
      baselineP95: 450,
      trend: [
        { version: 'v2.0.0', p95: 498 },
        { version: 'v2.1.0', p95: 482 },
        { version: 'v2.2.0', p95: 450 },
        { version: 'v2.3.0', p95: 462 },
        { version: 'v2.4.0', p95: 436 },
        { version: 'v2.4.1', p95: 412 }
      ]
    }),
    'v2.3.0': qualityFixture({
      version: 'v2.3.0',
      total: 128,
      passed: 78,
      failed: 49,
      running: 1,
      totalIssues: 50,
      scores: { basic: 60.94, dfx: 81.25, scenario: 70.31, performance: 58.59 },
      dimensionIssues: { basic: 11, dfx: 7, scenario: 13, performance: 6 },
      p95: 488,
      baselineVersion: 'v2.1.0',
      baselineP95: 521,
      trend: [
        { version: 'v1.9.0', p95: 552 },
        { version: 'v2.0.0', p95: 538 },
        { version: 'v2.1.0', p95: 521 },
        { version: 'v2.2.0', p95: 506 },
        { version: 'v2.2.5', p95: 497 },
        { version: 'v2.3.0', p95: 488 }
      ]
    })
  },
  高码python: {
    'v1.8.0': qualityFixture({
      version: 'v1.8.0',
      total: 116,
      passed: 102,
      failed: 13,
      running: 1,
      totalIssues: 14,
      scores: { basic: 87.93, dfx: 92.24, scenario: 84.48, performance: 81.9 },
      dimensionIssues: { basic: 4, dfx: 2, scenario: 5, performance: 3 },
      p95: 285,
      baselineVersion: 'v1.6.0',
      baselineP95: 326,
      trend: [
        { version: 'v1.4.0', p95: 352 },
        { version: 'v1.5.0', p95: 341 },
        { version: 'v1.6.0', p95: 326 },
        { version: 'v1.7.0', p95: 314 },
        { version: 'v1.7.2', p95: 301 },
        { version: 'v1.8.0', p95: 285 }
      ]
    }),
    'v1.7.2': qualityFixture({
      version: 'v1.7.2',
      total: 104,
      passed: 84,
      failed: 19,
      running: 1,
      totalIssues: 22,
      scores: { basic: 80.77, dfx: 86.54, scenario: 78.85, performance: 74.04 },
      dimensionIssues: { basic: 6, dfx: 4, scenario: 7, performance: 5 },
      p95: 319,
      baselineVersion: 'v1.5.0',
      baselineP95: 356,
      trend: [
        { version: 'v1.3.0', p95: 382 },
        { version: 'v1.4.0', p95: 371 },
        { version: 'v1.5.0', p95: 356 },
        { version: 'v1.6.0', p95: 344 },
        { version: 'v1.7.0', p95: 331 },
        { version: 'v1.7.2', p95: 319 }
      ]
    })
  },
  合一版本: {
    'v3.0.0': qualityFixture({
      version: 'v3.0.0',
      total: 168,
      passed: 158,
      failed: 10,
      running: 0,
      totalIssues: 9,
      scores: { basic: 94.05, dfx: 96.43, scenario: 91.07, performance: 89.29 },
      dimensionIssues: { basic: 2, dfx: 1, scenario: 4, performance: 2 },
      p95: 198,
      baselineVersion: 'v2.8.0',
      baselineP95: 238,
      trend: [
        { version: 'v2.6.0', p95: 264 },
        { version: 'v2.7.0', p95: 251 },
        { version: 'v2.8.0', p95: 238 },
        { version: 'v2.9.0', p95: 224 },
        { version: 'v2.9.5', p95: 211 },
        { version: 'v3.0.0', p95: 198 }
      ]
    }),
    'v2.9.0': qualityFixture({
      version: 'v2.9.0',
      total: 152,
      passed: 137,
      failed: 14,
      running: 1,
      totalIssues: 16,
      scores: { basic: 90.13, dfx: 92.76, scenario: 86.84, performance: 82.24 },
      dimensionIssues: { basic: 4, dfx: 3, scenario: 6, performance: 3 },
      p95: 231,
      baselineVersion: 'v2.7.0',
      baselineP95: 269,
      trend: [
        { version: 'v2.4.0', p95: 301 },
        { version: 'v2.5.0', p95: 288 },
        { version: 'v2.6.0', p95: 279 },
        { version: 'v2.7.0', p95: 269 },
        { version: 'v2.8.0', p95: 247 },
        { version: 'v2.9.0', p95: 231 }
      ]
    })
  }
} satisfies Record<string, Record<string, OverviewQualityMock>>;

export type NativeOverviewProduct = keyof typeof overviewQualityMockByProductVersion;

function productFixture(product: string): Record<string, OverviewQualityMock> | undefined {
  if (!Object.prototype.hasOwnProperty.call(overviewQualityMockByProductVersion, product)) {
    return undefined;
  }

  return overviewQualityMockByProductVersion[product as NativeOverviewProduct];
}

export function getOverviewQualityVersions(product: string): readonly string[] {
  const fixture = productFixture(product);
  return fixture ? Object.keys(fixture) : [];
}

export function getDefaultOverviewQualityVersion(product: string): string | undefined {
  return getOverviewQualityVersions(product)[0];
}

export function getOverviewQualityMock(
  product: string,
  version: string
): OverviewQualityMock | undefined {
  const fixture = productFixture(product);
  return fixture && Object.prototype.hasOwnProperty.call(fixture, version)
    ? fixture[version]
    : undefined;
}
