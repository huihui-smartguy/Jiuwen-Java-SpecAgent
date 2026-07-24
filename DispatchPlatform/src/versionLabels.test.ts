import { describe, expect, test } from 'vitest';
import { formatTestVersionLabel } from './versionLabels';

describe('formatTestVersionLabel', () => {
  test('shows an identical 715 name and code once and appends Default once', () => {
    const version = {
      code: '715:0.2.0.beta3.post3',
      name: '715:0.2.0.beta3.post3'
    };

    expect(formatTestVersionLabel(version, {
      isDefault: true,
      defaultLabel: 'Default'
    })).toBe('715:0.2.0.beta3.post3 · Default');
    expect(version).toEqual({
      code: '715:0.2.0.beta3.post3',
      name: '715:0.2.0.beta3.post3'
    });
  });

  test('shows an identical non-default 615 name and code once', () => {
    expect(formatTestVersionLabel({
      code: '615:0.2.0.beta3',
      name: '615:0.2.0.beta3'
    })).toBe('615:0.2.0.beta3');
  });

  test('keeps a distinct human name and canonical code', () => {
    expect(formatTestVersionLabel({
      code: '715:0.2.0.beta3.post3',
      name: 'Unified 715'
    })).toBe('Unified 715 · 715:0.2.0.beta3.post3');
  });

  test('keeps case-distinct values distinct', () => {
    expect(formatTestVersionLabel({
      code: 'release1',
      name: 'Release1'
    })).toBe('Release1 · release1');
  });

  test('trims outer whitespace before exact comparison and suffix display', () => {
    expect(formatTestVersionLabel({
      code: '  release1  ',
      name: 'release1 '
    }, {
      isDefault: true,
      defaultLabel: ' 默认 '
    })).toBe('release1 · 默认');
  });

  test('falls back to the canonical code when the backend name is blank', () => {
    expect(formatTestVersionLabel({
      code: 'release1',
      name: '   '
    })).toBe('release1');
  });

  test('falls back to the human name without a dangling delimiter when the code is blank', () => {
    expect(formatTestVersionLabel({
      code: '   ',
      name: 'Release 1'
    })).toBe('Release 1');
  });
});
