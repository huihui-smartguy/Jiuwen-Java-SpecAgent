import { describe, expect, test } from 'vitest';
import type {
  ReportResultRow,
  ReportRisk,
  StatisticsFilters,
  TaskScriptActualStatus,
  TaskScriptStatusResponse
} from './types';

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

  test('models raw pytest script statuses independently from display statuses', () => {
    const actualStatus: TaskScriptActualStatus = 'SKIPPED';
    const response: TaskScriptStatusResponse = {
      success: true,
      task_id: 'task-contract',
      scripts_status: [{
        script_id: 'script-1',
        script_name: 'test_contract.py',
        version: 'release1',
        status: 'failed',
        actual_status: actualStatus,
        started_at: null,
        completed_at: null,
        duration_seconds: null,
        error_message: null
      }],
      summary: {
        todo_count: 0,
        pass_count: 0,
        failed_count: 1,
        running_count: 0,
        actual_status_distribution: {
          PASSED: 0,
          FAILED: 0,
          SKIPPED: 1,
          ERROR: 0
        }
      }
    };
    // @ts-expect-error raw pytest status values are uppercase and distinct from display status
    const invalidActualStatus: TaskScriptActualStatus = 'pass';

    expect(response.scripts_status[0]?.actual_status).toBe('SKIPPED');
    expect(invalidActualStatus).toBe('pass');
  });
});
