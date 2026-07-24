export type LegacyQualityDimensionId = 'dfx' | 'scenario' | 'performance';

export type QualityStatusTone = 'attention' | 'healthy';

export interface LegacyDimensionQuality {
  id: LegacyQualityDimensionId;
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

export interface LegacyPerformanceTrendPoint {
  version: string;
  p95: number;
}

export interface LegacyPerformanceQuality {
  p95: number;
  trend: readonly LegacyPerformanceTrendPoint[];
  currentVersion: string;
  baselineVersion: string;
  baselineP95: number;
  improvementMs: number;
  improvementPercent: number;
}

export interface LegacyDimensionSnapshot {
  dimensions: Record<LegacyQualityDimensionId, LegacyDimensionQuality>;
  performance: LegacyPerformanceQuality;
}

interface LegacyFixtureInput {
  sourceVersion: string;
  total: number;
  scores: Record<LegacyQualityDimensionId, number>;
  dimensionIssues: Record<LegacyQualityDimensionId, number>;
  p95: number;
  baselineVersion: string;
  baselineP95: number;
  trend: readonly LegacyPerformanceTrendPoint[];
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
  id: LegacyQualityDimensionId,
  total: number,
  score: number,
  issues: number
): LegacyDimensionQuality {
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

function legacyFixture(input: LegacyFixtureInput): LegacyDimensionSnapshot {
  const improvementMs = input.baselineP95 - input.p95;
  return {
    dimensions: {
      dfx: dimensionFixture('dfx', input.total, input.scores.dfx, input.dimensionIssues.dfx),
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
      currentVersion: input.sourceVersion,
      baselineVersion: input.baselineVersion,
      baselineP95: input.baselineP95,
      improvementMs,
      improvementPercent: Number(((improvementMs / input.baselineP95) * 100).toFixed(1))
    }
  };
}

const legacyDimensionsByProduct = {
  高码java: {
    latest: legacyFixture({
      sourceVersion: 'v2.4.1',
      total: 134,
      scores: { dfx: 88.06, scenario: 77.61, performance: 64.18 },
      dimensionIssues: { dfx: 5, scenario: 9, performance: 4 },
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
    previous: legacyFixture({
      sourceVersion: 'v2.3.0',
      total: 128,
      scores: { dfx: 81.25, scenario: 70.31, performance: 58.59 },
      dimensionIssues: { dfx: 7, scenario: 13, performance: 6 },
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
    latest: legacyFixture({
      sourceVersion: 'v1.8.0',
      total: 116,
      scores: { dfx: 92.24, scenario: 84.48, performance: 81.9 },
      dimensionIssues: { dfx: 2, scenario: 5, performance: 3 },
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
    previous: legacyFixture({
      sourceVersion: 'v1.7.2',
      total: 104,
      scores: { dfx: 86.54, scenario: 78.85, performance: 74.04 },
      dimensionIssues: { dfx: 4, scenario: 7, performance: 5 },
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
    latest: legacyFixture({
      sourceVersion: 'v3.0.0',
      total: 168,
      scores: { dfx: 96.43, scenario: 91.07, performance: 89.29 },
      dimensionIssues: { dfx: 1, scenario: 4, performance: 2 },
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
    previous: legacyFixture({
      sourceVersion: 'v2.9.0',
      total: 152,
      scores: { dfx: 92.76, scenario: 86.84, performance: 82.24 },
      dimensionIssues: { dfx: 3, scenario: 6, performance: 3 },
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
} satisfies Record<string, { latest: LegacyDimensionSnapshot; previous: LegacyDimensionSnapshot }>;

type LegacyProduct = keyof typeof legacyDimensionsByProduct;

const legacyProductAliases: Record<string, LegacyProduct> = {
  '高码java': '高码java',
  'high-code java': '高码java',
  '高码python': '高码python',
  'high-code python': '高码python',
  '合一版本': '合一版本',
  'unified version': '合一版本'
};

export function getLegacyDimensionSnapshot(
  product: string,
  overviewVersion: string
): LegacyDimensionSnapshot | undefined {
  const canonicalProduct = legacyProductAliases[product.trim().toLocaleLowerCase()];
  if (!canonicalProduct) {
    return undefined;
  }
  const productFixtures = legacyDimensionsByProduct[canonicalProduct];
  return overviewVersion.startsWith('615:') ? productFixtures.previous : productFixtures.latest;
}
