import { describe, expect, test } from 'vitest';
import type { CatalogObject, Script, SutTarget } from '../types';
import {
  catalogTargets,
  diffCatalogObjects,
  findMigratedTargetId,
  findTargetByScope,
  parseCatalogSnapshot
} from './model';

const products = ['高码java', '高码python', '合一版本'];
const scenes = ['API', 'WEB', 'DFx', '场景用例'];

function script(id: string, product = '合一版本', scene = 'API'): Script {
  return {
    id,
    name: id,
    filename: `${id}.py`,
    extension: '.py',
    product,
    scene,
    feature: '认证',
    level: 'L0',
    size: 10,
    path: `testcase/${product}/${scene}/认证/${id}.py`
  };
}

function fullSnapshot() {
  const objects = products.flatMap((product) => scenes.map((scene) => {
    const populated = product === '合一版本' && scene === 'API';
    return {
      id: `${product}:${scene}`,
      product,
      scene,
      feature_count: populated ? 1 : 0,
      script_count: populated ? 1 : 0,
      features: populated ? [{
        id: 'feature-auth',
        name: '认证',
        type: 'feature',
        script_count: 1,
        scripts: [script('script-auth')]
      }] : []
    };
  }));
  return {
    success: true,
    revision: 'catalog-all-12',
    generated_at: '2026-07-23T08:00:00Z',
    products,
    objects,
    totals: { products: 3, objects: 12, features: 1, scripts: 1 }
  };
}

describe('catalog model', () => {
  test('validates and maps all 12 configured Objects without changing backend scope values', () => {
    const snapshot = parseCatalogSnapshot(fullSnapshot());
    const targets = catalogTargets(snapshot, '/testwise/api');

    expect(snapshot.objects).toHaveLength(12);
    expect(targets).toHaveLength(12);
    expect(targets[0]).toMatchObject({
      product: '高码java',
      scene: 'API',
      apiBaseUrl: '/testwise/api',
      catalogRevision: 'catalog-all-12'
    });
    expect(targets.find((target) => target.product === '合一版本' && target.scene === 'API'))
      .toMatchObject({ scriptCount: 1, featureCount: 1 });
    expect(targets.filter((target) => target.scriptCount === 0)).toHaveLength(11);
  });

  test('rejects duplicate script ids and mismatched totals instead of hiding backend defects', () => {
    const duplicate = fullSnapshot();
    const second = duplicate.objects.find((object) => object.id === '高码python:API');
    if (second) {
      second.feature_count = 1;
      second.script_count = 1;
      second.features = [{
        id: 'feature-duplicate',
        name: '认证',
        type: 'feature',
        script_count: 1,
        scripts: [script('script-auth', '高码python')]
      }];
      duplicate.totals.features = 2;
      duplicate.totals.scripts = 2;
    }
    expect(() => parseCatalogSnapshot(duplicate)).toThrow(/duplicated/i);

    const mismatched = fullSnapshot();
    mismatched.totals.scripts = 99;
    expect(() => parseCatalogSnapshot(mismatched)).toThrow(/totals/i);
  });

  test('rejects numeric strings instead of coercing backend schema drift', () => {
    const invalidSize = fullSnapshot();
    const populatedScript = invalidSize.objects
      .find((object) => object.id === '合一版本:API')
      ?.features[0]?.scripts[0] as { size: unknown } | undefined;
    if (populatedScript) {
      populatedScript.size = '10';
    }
    expect(() => parseCatalogSnapshot(invalidSize)).toThrow(/size/i);

    const invalidTotals = fullSnapshot();
    (invalidTotals.totals as { scripts: unknown }).scripts = '1';
    expect(() => parseCatalogSnapshot(invalidTotals)).toThrow(/totals/i);
  });

  test('migrates legacy ids by canonical product and scene', () => {
    const targets = catalogTargets(parseCatalogSnapshot(fullSnapshot()), '/api');
    const bootstrap: SutTarget[] = [{
      id: 'legacy-unified-api',
      name: 'Legacy',
      product: '合一版本',
      scene: 'API',
      version: 'Live',
      apiBaseUrl: '/api',
      status: 'healthy'
    }];

    expect(findMigratedTargetId(targets, 'legacy-unified-api', bootstrap))
      .toBe('合一版本:API');
  });

  test('migrates the legacy 场景 alias to the backend-native 场景用例 scope', () => {
    const targets = catalogTargets(parseCatalogSnapshot(fullSnapshot()), '/api');
    const bootstrap: SutTarget[] = [{
      id: 'legacy-java-scene',
      name: 'Legacy scene',
      product: '高码java',
      scene: '场景',
      version: 'Live',
      apiBaseUrl: '/api',
      status: 'healthy'
    }];

    expect(findMigratedTargetId(targets, 'legacy-java-scene', bootstrap))
      .toBe('高码java:场景用例');
  });

  test('prefers an exact backend-native scope and only accepts a unique alias fallback', () => {
    const aliasFirst = [
      {
        id: 'python-dfx-uppercase',
        product: '高码python',
        scene: 'DFX'
      },
      {
        id: 'python-dfx-native',
        product: '高码python',
        scene: 'DFx'
      }
    ];
    expect(findTargetByScope(aliasFirst, {
      product: '高码python',
      scene: 'DFx'
    })?.id).toBe('python-dfx-native');

    const ambiguousAliases = [
      {
        id: 'java-scene-a',
        product: '高码java',
        scene: '场景用例'
      },
      {
        id: 'java-scene-b',
        product: '高码java',
        scene: '场景用例'
      }
    ];
    expect(findTargetByScope(ambiguousAliases, {
      product: '高码java',
      scene: '场景'
    })).toBeUndefined();
  });

  test('diffs execution changes by stable script id, not display name', () => {
    const beforeScript = script('stable-id');
    const before: CatalogObject = {
      id: 'object',
      product: '合一版本',
      scene: 'API',
      feature_count: 1,
      script_count: 1,
      features: [{
        id: 'feature',
        name: '认证',
        type: 'feature',
        script_count: 1,
        scripts: [beforeScript]
      }]
    };
    const afterScript = { ...beforeScript, name: 'renamed_test' };
    const added = script('new-id');
    const after: CatalogObject = {
      ...before,
      script_count: 2,
      features: [{
        ...before.features[0],
        script_count: 2,
        scripts: [afterScript, added]
      }]
    };

    const delta = diffCatalogObjects(before, after);
    expect(delta.added.map((item) => item.id)).toEqual(['new-id']);
    expect(delta.removed).toEqual([]);
    expect(delta.changed).toEqual([{ before: beforeScript, after: afterScript }]);
    expect(delta.hasChanges).toBe(true);
  });

  test('treats an in-place script content replacement as a material draft change', () => {
    const beforeScript = script('stable-id');
    const before: CatalogObject = {
      id: 'object',
      product: '合一版本',
      scene: 'API',
      feature_count: 1,
      script_count: 1,
      features: [{
        id: 'feature',
        name: '认证',
        type: 'feature',
        script_count: 1,
        scripts: [beforeScript]
      }]
    };
    const replacement = {
      ...beforeScript,
      size: beforeScript.size + 1,
      uploaded_at: '2026-07-23T09:00:00Z'
    };
    const after: CatalogObject = {
      ...before,
      features: [{
        ...before.features[0],
        scripts: [replacement]
      }]
    };

    expect(diffCatalogObjects(before, after).changed)
      .toEqual([{ before: beforeScript, after: replacement }]);
  });
});
