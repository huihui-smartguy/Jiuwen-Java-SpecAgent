import type { SutTarget } from './types';

type ObjectLabelKind = 'identity' | 'name';

const productDisplayLabels: Readonly<Record<string, string>> = {
  '高码java': 'High-Code Java',
  '高码python': 'High-Code Python',
  '合一版本': 'Unified Version'
};

const sceneDisplayLabels: Readonly<Record<string, string>> = {
  DFx: 'DFX',
  DFX: 'DFX',
  '场景用例': 'scene',
  '场景': 'scene'
};

/**
 * Translate backend taxonomy only at the presentation boundary. Callers must
 * continue using the native value for catalog identity, persistence, queries,
 * and task/report payloads.
 */
export function productDisplayLabel(product: string) {
  return productDisplayLabels[product.trim()] ?? product;
}

export function sceneDisplayLabel(scene: string) {
  return sceneDisplayLabels[scene.trim()] ?? scene;
}

export function objectIdentityLabel(target: SutTarget) {
  return `${productDisplayLabel(target.product)} ${sceneDisplayLabel(target.scene)}`.trim();
}

function replaceLabelToken(value: string, nativeValue: string, displayValue: string) {
  const escaped = nativeValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return value.replace(
    new RegExp(`(^|[\\s·/|_-])${escaped}(?=$|[\\s·/|_-])`, 'gu'),
    (_match, prefix: string) => `${prefix}${displayValue}`
  );
}

export function objectNameLabel(target: SutTarget) {
  const nativeIdentity = `${target.product} ${target.scene}`.trim();
  if (target.name.trim() === nativeIdentity) {
    return objectIdentityLabel(target);
  }

  return replaceLabelToken(
    replaceLabelToken(target.name, target.product, productDisplayLabel(target.product)),
    target.scene,
    sceneDisplayLabel(target.scene)
  );
}

function baseObjectLabel(target: SutTarget, kind: ObjectLabelKind) {
  return kind === 'name'
    ? objectNameLabel(target)
    : objectIdentityLabel(target);
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

export interface ObjectProductGroup {
  product: string;
  objects: SutTarget[];
}

/**
 * Preserve backend ordering while grouping Objects by their first product
 * occurrence. Scene ordering inside each product remains untouched.
 */
export function groupObjectsByProduct(targets: readonly SutTarget[]): ObjectProductGroup[] {
  const groups = new Map<string, SutTarget[]>();

  targets.forEach((target) => {
    const group = groups.get(target.product);
    if (group) {
      group.push(target);
    } else {
      groups.set(target.product, [target]);
    }
  });

  return Array.from(groups, ([product, objects]) => ({ product, objects }));
}

export function objectMatchesSearch(target: SutTarget, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [
    target.product,
    target.scene,
    productDisplayLabel(target.product),
    sceneDisplayLabel(target.scene),
    target.name,
    target.id
  ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
}
