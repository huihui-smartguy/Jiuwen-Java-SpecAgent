import type { SutTarget } from './types';

type ObjectLabelKind = 'identity' | 'name';

function baseObjectLabel(target: SutTarget, kind: ObjectLabelKind) {
  return kind === 'name'
    ? target.name
    : `${target.product} ${target.scene}`.trim();
}

/**
 * Native select menus need a unique label when separate live endpoints share the
 * same approved visible identity. The closed Figma summary remains unchanged.
 */
export function objectOptionLabel(
  target: SutTarget,
  targets: readonly SutTarget[],
  kind: ObjectLabelKind = 'identity'
) {
  const baseLabel = baseObjectLabel(target, kind);
  const duplicateCount = targets.filter(
    (candidate) => baseObjectLabel(candidate, kind) === baseLabel
  ).length;

  return duplicateCount > 1 ? `${baseLabel} · ${target.id}` : baseLabel;
}
