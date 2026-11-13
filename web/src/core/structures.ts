import type { BodyId, LaniakeaLandmark } from '@sss/tools/types';

/**
 * The named structures made bodies (laniakea.ts ensureStructureBodies), by body id: kept apart
 * from laniakea.ts so that search.ts can name their kinds without importing the catalogue.
 */
export const structureBodies = new Map<BodyId, LaniakeaLandmark>();

export function structureOf(id: BodyId | null): LaniakeaLandmark | null {
  return id === null ? null : (structureBodies.get(id) ?? null);
}

/** What a structure is, as its panel and the search say it. */
export function structureKindLabel(kind: LaniakeaLandmark['kind']): string {
  switch (kind) {
    case 'cluster':
      return 'Galaxy cluster';
    case 'supercluster':
      return 'Supercluster';
    case 'basin':
      return 'Basin of attraction';
    case 'attractor':
      return 'Attractor';
    case 'repeller':
      return 'Repeller';
    case 'void':
      return 'Void';
    case 'wall':
      return 'Wall';
  }
}
