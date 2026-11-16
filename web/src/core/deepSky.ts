import type { BodyId } from '@sss/tools/types';

/**
 * The nebulae (nebulae.ts), the Messier objects drawn as nothing else (messier.ts) and the
 * named stars and black holes marked (notableStars.ts), made bodies, by body id: what each is
 * called as a kind and its other names -- kept apart from the catalogues so that search.ts and
 * floatingOrigin.ts can name and sort them without importing any.
 */
export interface DeepSkyTag {
  /** What it is, as its panel and the search say it: "Planetary nebula", "Open cluster". */
  readonly label: string;
  /** Its other names, found by the search: "M42", "NGC 1976". */
  readonly aliases: readonly string[];
}

const tags = new Map<BodyId, DeepSkyTag>();

export function registerDeepSky(id: BodyId, tag: DeepSkyTag): void {
  tags.set(id, tag);
}

export function deepSkyOf(id: BodyId | null): DeepSkyTag | null {
  return id === null ? null : (tags.get(id) ?? null);
}

/**
 * A 'deep-sky' body is one of two layers': a Messier mark's or a marked star's. Each layer
 * switches its own pseudo-kind (App.tsx LAYER_KINDS, floatingOrigin.ts isShown).
 */
export const MESSIER_MARK_KIND = 'messier-mark';
export const NOTABLE_STAR_KIND = 'notable-star';
/** A marked star's body id begins so (notableStars.ts). */
export const NOTABLE_STAR_PREFIX = 'notable-';

/** The pseudo-kind of the layer a 'deep-sky' body is in. */
export function deepSkyLayerKind(id: BodyId): string {
  return id.startsWith(NOTABLE_STAR_PREFIX) ? NOTABLE_STAR_KIND : MESSIER_MARK_KIND;
}
