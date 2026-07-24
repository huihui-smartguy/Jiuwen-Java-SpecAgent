import type { TestVersion } from './types';

interface TestVersionLabelOptions {
  defaultLabel?: string;
  isDefault?: boolean;
}

/**
 * Formats a backend test-version label without changing its canonical code.
 *
 * Only outer whitespace is normalized. Equality remains exact and
 * case-sensitive so distinct backend names are never collapsed accidentally.
 */
export function formatTestVersionLabel(
  version: Pick<TestVersion, 'code' | 'name'>,
  options: TestVersionLabelOptions = {}
): string {
  const code = version.code.trim();
  const name = version.name.trim();
  const baseLabel = name && code && name !== code
    ? `${name} · ${code}`
    : code || name;
  const defaultLabel = options.defaultLabel?.trim();

  return options.isDefault && defaultLabel
    ? `${baseLabel} · ${defaultLabel}`
    : baseLabel;
}
