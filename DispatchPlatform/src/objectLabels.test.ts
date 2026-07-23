import { describe, expect, test } from 'vitest';
import type { SutTarget } from './types';
import {
  objectIdentityLabel,
  objectMatchesSearch,
  objectNameLabel,
  objectOptionLabel,
  productDisplayLabel,
  sceneDisplayLabel
} from './objectLabels';

const nativeTarget: SutTarget = {
  id: 'native-object',
  name: 'Backend native Object',
  product: '高码java',
  scene: '场景用例',
  version: 'live',
  apiBaseUrl: '/api',
  status: 'healthy'
};

describe('backend taxonomy display labels', () => {
  test('maps the approved native products and scenes without changing unknown values', () => {
    expect([
      productDisplayLabel('高码java'),
      productDisplayLabel('高码python'),
      productDisplayLabel('合一版本')
    ]).toEqual(['High-Code Java', 'High-Code Python', 'Unified Version']);
    expect([
      sceneDisplayLabel('DFx'),
      sceneDisplayLabel('DFX'),
      sceneDisplayLabel('场景用例'),
      sceneDisplayLabel('场景')
    ]).toEqual(['DFX', 'DFX', 'scene', 'scene']);
    expect(productDisplayLabel('Payments')).toBe('Payments');
    expect(sceneDisplayLabel('API')).toBe('API');
  });

  test('builds presentation labels while retaining native target fields and search aliases', () => {
    expect(objectIdentityLabel(nativeTarget)).toBe('High-Code Java scene');
    expect(objectOptionLabel(nativeTarget, [nativeTarget])).toBe('High-Code Java scene');
    expect(objectNameLabel({
      ...nativeTarget,
      name: '高码java 场景用例'
    })).toBe('High-Code Java scene');
    expect(objectNameLabel({
      ...nativeTarget,
      name: '高码java 场景用例 · Live'
    })).toBe('High-Code Java scene · Live');
    expect(objectMatchesSearch(nativeTarget, 'high-code')).toBe(true);
    expect(objectMatchesSearch(nativeTarget, '高码java')).toBe(true);
    expect(objectMatchesSearch(nativeTarget, 'scene')).toBe(true);
    expect(nativeTarget).toMatchObject({
      product: '高码java',
      scene: '场景用例'
    });
  });
});
