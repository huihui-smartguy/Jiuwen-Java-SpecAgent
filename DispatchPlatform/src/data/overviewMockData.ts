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

export const overviewQualityMock = {
  totalExecutions: 134,
  executed: 134,
  unexecuted: 0,
  passed: 91,
  failed: 42,
  running: 1,
  overallPassRate: 67.91,
  totalIssues: 42,
  dimensions: {
    basic: {
      id: 'basic',
      passed: 91,
      total: 134,
      failed: 42,
      running: 1,
      score: 67.91,
      rating: 'B',
      issues: 7,
      criticalIssues: 1,
      majorIssues: 2,
      minorIssues: 4,
      status: 'attention'
    },
    dfx: {
      id: 'dfx',
      passed: 118,
      total: 134,
      failed: 15,
      running: 1,
      score: 88.06,
      rating: 'A-',
      issues: 5,
      criticalIssues: 0,
      majorIssues: 2,
      minorIssues: 3,
      status: 'healthy'
    },
    scenario: {
      id: 'scenario',
      passed: 104,
      total: 134,
      failed: 29,
      running: 1,
      score: 77.61,
      rating: 'B+',
      issues: 9,
      criticalIssues: 2,
      majorIssues: 3,
      minorIssues: 4,
      status: 'attention'
    },
    performance: {
      id: 'performance',
      passed: 86,
      total: 134,
      failed: 47,
      running: 1,
      score: 64.18,
      rating: 'A-',
      issues: 4,
      criticalIssues: 0,
      majorIssues: 1,
      minorIssues: 3,
      status: 'healthy'
    }
  } satisfies Record<QualityDimensionId, DimensionQualityMock>,
  performance: {
    p95: 412,
    trend: [
      { version: 'v1.0', p95: 498 },
      { version: 'v1.1', p95: 482 },
      { version: 'v1.2', p95: 450 },
      { version: 'v1.3', p95: 462 },
      { version: 'v1.4', p95: 436 },
      { version: 'v1.5', p95: 412 }
    ] satisfies PerformanceTrendPoint[],
    currentVersion: 'v1.5',
    baselineVersion: 'v1.2',
    baselineP95: 450,
    improvementMs: 38,
    improvementPercent: 8.4
  }
} as const;
