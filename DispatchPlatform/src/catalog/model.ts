import type {
  CatalogFeature,
  CatalogObject,
  CatalogSnapshot,
  CatalogSutTarget,
  Feature,
  RuntimeConfig,
  Script
} from '../types';
import { productDisplayLabel, sceneDisplayLabel } from '../objectLabels';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Catalog field "${field}" must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return requireString(value, field);
}

function parseScript(
  value: unknown,
  object: Pick<CatalogObject, 'product' | 'scene'>,
  featureName: string,
  field: string
): Script {
  if (!isRecord(value)) {
    throw new Error(`Catalog field "${field}" must be an object.`);
  }
  if (typeof value.size !== 'number' || !Number.isFinite(value.size) || value.size < 0) {
    throw new Error(`Catalog field "${field}.size" must be a non-negative number.`);
  }
  const script: Script = {
    id: requireString(value.id, `${field}.id`),
    name: requireString(value.name, `${field}.name`),
    filename: requireString(value.filename, `${field}.filename`),
    extension: requireString(value.extension, `${field}.extension`),
    product: requireString(value.product, `${field}.product`),
    scene: requireString(value.scene, `${field}.scene`),
    feature: requireString(value.feature, `${field}.feature`),
    level: requireString(value.level, `${field}.level`),
    size: value.size,
    uploaded_at: optionalString(value.uploaded_at, `${field}.uploaded_at`),
    uploaded_by: optionalString(value.uploaded_by, `${field}.uploaded_by`),
    path: requireString(value.path, `${field}.path`)
  };
  if (
    script.product !== object.product
    || script.scene !== object.scene
    || script.feature !== featureName
  ) {
    throw new Error(`Catalog script "${script.id}" does not match its Object and Feature scope.`);
  }
  return script;
}

function parseFeature(
  value: unknown,
  object: Pick<CatalogObject, 'product' | 'scene'>,
  field: string,
  globalScriptIds: Set<string>
): CatalogFeature {
  if (!isRecord(value) || !Array.isArray(value.scripts)) {
    throw new Error(`Catalog field "${field}" must contain a scripts array.`);
  }
  const name = requireString(value.name, `${field}.name`);
  const scripts = value.scripts.map((script, index) => (
    parseScript(script, object, name, `${field}.scripts[${index}]`)
  ));
  const scriptCount = value.script_count;
  if (!isNonNegativeInteger(scriptCount) || scriptCount !== scripts.length) {
    throw new Error(`Catalog field "${field}.script_count" does not match its scripts array.`);
  }
  for (const script of scripts) {
    if (globalScriptIds.has(script.id)) {
      throw new Error(`Catalog script id "${script.id}" is duplicated.`);
    }
    globalScriptIds.add(script.id);
  }
  return {
    id: requireString(value.id, `${field}.id`),
    name,
    type: requireString(value.type, `${field}.type`),
    script_count: scriptCount,
    scripts
  };
}

function parseObject(
  value: unknown,
  index: number,
  products: Set<string>,
  globalScriptIds: Set<string>
): CatalogObject {
  const field = `objects[${index}]`;
  if (!isRecord(value) || !Array.isArray(value.features)) {
    throw new Error(`Catalog field "${field}" must contain a features array.`);
  }
  const product = requireString(value.product, `${field}.product`);
  const scene = requireString(value.scene, `${field}.scene`);
  if (!products.has(product)) {
    throw new Error(`Catalog Object "${product} / ${scene}" references an unknown product.`);
  }
  const object = { product, scene };
  const features = value.features.map((feature, featureIndex) => (
    parseFeature(feature, object, `${field}.features[${featureIndex}]`, globalScriptIds)
  ));
  const featureIds = new Set(features.map((feature) => feature.id));
  if (featureIds.size !== features.length) {
    throw new Error(`Catalog Object "${product} / ${scene}" contains duplicate Feature ids.`);
  }
  const featureCount = value.feature_count;
  const scriptCount = value.script_count;
  const actualScriptCount = features.reduce((total, feature) => total + feature.scripts.length, 0);
  if (!isNonNegativeInteger(featureCount) || featureCount !== features.length) {
    throw new Error(`Catalog field "${field}.feature_count" does not match its features array.`);
  }
  if (!isNonNegativeInteger(scriptCount) || scriptCount !== actualScriptCount) {
    throw new Error(`Catalog field "${field}.script_count" does not match its Feature scripts.`);
  }
  return {
    id: requireString(value.id, `${field}.id`),
    product,
    scene,
    feature_count: featureCount,
    script_count: scriptCount,
    latest_changed_at: optionalString(value.latest_changed_at, `${field}.latest_changed_at`),
    features
  };
}

export function parseCatalogSnapshot(value: unknown): CatalogSnapshot {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.products) || !Array.isArray(value.objects)) {
    throw new Error('Catalog response is malformed.');
  }
  const products = value.products.map((product, index) => (
    requireString(product, `products[${index}]`)
  ));
  if (new Set(products).size !== products.length) {
    throw new Error('Catalog products must be unique.');
  }
  const productSet = new Set(products);
  const globalScriptIds = new Set<string>();
  const objects = value.objects.map((object, index) => (
    parseObject(object, index, productSet, globalScriptIds)
  ));
  const objectIds = new Set(objects.map((object) => object.id));
  const objectScopes = new Set(objects.map((object) => `${object.product}\u0000${object.scene}`));
  if (objectIds.size !== objects.length || objectScopes.size !== objects.length) {
    throw new Error('Catalog Objects must have unique ids and product/scene scopes.');
  }
  if (!isRecord(value.totals)) {
    throw new Error('Catalog totals are missing.');
  }
  const totalProducts = value.totals.products;
  const totalObjects = value.totals.objects;
  const totalFeatures = value.totals.features;
  const totalScripts = value.totals.scripts;
  const actualFeatures = objects.reduce((total, object) => total + object.features.length, 0);
  const actualScripts = objects.reduce((total, object) => total + object.script_count, 0);
  if (
    !isNonNegativeInteger(totalProducts)
    || !isNonNegativeInteger(totalObjects)
    || !isNonNegativeInteger(totalFeatures)
    || !isNonNegativeInteger(totalScripts)
    || totalProducts !== products.length
    || totalObjects !== objects.length
    || totalFeatures !== actualFeatures
    || totalScripts !== actualScripts
  ) {
    throw new Error('Catalog totals do not match the snapshot contents.');
  }
  const totals = {
    products: totalProducts,
    objects: totalObjects,
    features: totalFeatures,
    scripts: totalScripts
  };
  return {
    success: true,
    revision: requireString(value.revision, 'revision'),
    generated_at: requireString(value.generated_at, 'generated_at'),
    products,
    objects,
    totals
  };
}

export function scriptsForCatalogObject(object: CatalogObject): Script[] {
  return object.features.flatMap((feature) => feature.scripts);
}

export function catalogTargets(
  snapshot: CatalogSnapshot,
  apiBaseUrl: string
): CatalogSutTarget[] {
  return snapshot.objects.map((object) => ({
    id: object.id,
    catalogObjectId: object.id,
    catalogRevision: snapshot.revision,
    name: `${object.product} ${object.scene}`,
    product: object.product,
    scene: object.scene,
    version: 'Live',
    apiBaseUrl,
    status: 'healthy',
    featureCount: object.feature_count,
    scriptCount: object.script_count,
    latestChangedAt: object.latest_changed_at
  }));
}

export function objectForTarget(
  snapshot: CatalogSnapshot | undefined,
  target: Pick<SutTargetLike, 'id' | 'product' | 'scene'>
): CatalogObject | undefined {
  return snapshot?.objects.find((object) => object.id === target.id)
    ?? snapshot?.objects.find((object) => (
      object.product === target.product && object.scene === target.scene
    ));
}

type SutTargetLike = { id: string; product: string; scene: string };

export function sameObjectScope(
  left: Pick<SutTargetLike, 'product' | 'scene'>,
  right: Pick<SutTargetLike, 'product' | 'scene'>
): boolean {
  return productDisplayLabel(left.product) === productDisplayLabel(right.product)
    && sceneDisplayLabel(left.scene) === sceneDisplayLabel(right.scene);
}

export function findTargetByScope<T extends SutTargetLike>(
  targets: readonly T[],
  scope: Pick<SutTargetLike, 'product' | 'scene'>
): T | undefined {
  const exactMatch = targets.find((target) => (
    target.product === scope.product && target.scene === scope.scene
  ));
  if (exactMatch) {
    return exactMatch;
  }

  const aliasMatches = targets.filter((target) => sameObjectScope(target, scope));
  return aliasMatches.length === 1 ? aliasMatches[0] : undefined;
}

export function findMigratedTargetId(
  targets: readonly SutTargetLike[],
  storedId: string,
  bootstrapTargets: readonly SutTargetLike[]
): string | undefined {
  if (targets.some((target) => target.id === storedId)) {
    return storedId;
  }
  const legacy = bootstrapTargets.find((target) => target.id === storedId);
  if (!legacy) {
    return undefined;
  }
  return findTargetByScope(targets, legacy)?.id;
}

export function createFallbackCatalog(
  runtimeConfig: RuntimeConfig,
  features: readonly Feature[],
  scripts: readonly Script[]
): CatalogSnapshot {
  const products = Array.from(new Set(runtimeConfig.sutTargets.map((target) => target.product)));
  const objects = runtimeConfig.sutTargets.map<CatalogObject>((target) => {
    const targetScripts = scripts.filter((script) => (
      script.product === target.product && script.scene === target.scene
    ));
    const featureNames = Array.from(new Set([
      ...features.map((feature) => feature.name),
      ...targetScripts.map((script) => script.feature)
    ]));
    const targetFeatures = featureNames.map<CatalogFeature>((name) => {
      const fixture = features.find((feature) => feature.name === name);
      const featureScripts = targetScripts.filter((script) => script.feature === name);
      return {
        id: fixture?.id ?? `mock-feature:${target.id}:${name}`,
        name,
        type: fixture?.type ?? featureScripts[0]?.level ?? 'feature',
        script_count: featureScripts.length,
        scripts: featureScripts
      };
    }).filter((feature) => feature.scripts.length > 0);
    return {
      id: target.id,
      product: target.product,
      scene: target.scene,
      feature_count: targetFeatures.length,
      script_count: targetScripts.length,
      features: targetFeatures
    };
  });
  return {
    success: true,
    revision: 'mock-catalog-v1',
    generated_at: new Date(0).toISOString(),
    products,
    objects,
    totals: {
      products: products.length,
      objects: objects.length,
      features: objects.reduce((total, object) => total + object.feature_count, 0),
      scripts: objects.reduce((total, object) => total + object.script_count, 0)
    }
  };
}

function executionScriptFingerprint(script: Script): string {
  return [
    script.id,
    script.name,
    script.filename,
    script.extension,
    script.path,
    script.feature,
    script.level,
    String(script.size),
    script.uploaded_at ?? ''
  ].join('\u0000');
}

export interface CatalogObjectDelta {
  added: Script[];
  removed: Script[];
  changed: Array<{ before: Script; after: Script }>;
  hasChanges: boolean;
}

export function diffCatalogObjects(
  before: CatalogObject,
  after: CatalogObject
): CatalogObjectDelta {
  const beforeById = new Map(scriptsForCatalogObject(before).map((script) => [script.id, script]));
  const afterById = new Map(scriptsForCatalogObject(after).map((script) => [script.id, script]));
  const added = Array.from(afterById.values()).filter((script) => !beforeById.has(script.id));
  const removed = Array.from(beforeById.values()).filter((script) => !afterById.has(script.id));
  const changed = Array.from(afterById.values()).flatMap((afterScript) => {
    const beforeScript = beforeById.get(afterScript.id);
    return beforeScript && executionScriptFingerprint(beforeScript) !== executionScriptFingerprint(afterScript)
      ? [{ before: beforeScript, after: afterScript }]
      : [];
  });
  return { added, removed, changed, hasChanges: Boolean(added.length || removed.length || changed.length) };
}
