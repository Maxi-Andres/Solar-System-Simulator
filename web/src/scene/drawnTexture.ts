import type { BodyDefinition, TextureSetId, TextureVariant } from '@sss/tools/types';

/**
 * Which of a body's two surface maps is drawn, decided body by body.
 *
 * The catalog carries two sets (TEXTURE_SETS in tools/src/catalog.ts) and they differ on three
 * bodies only. Each of the three was looked at on its own:
 *
 * - **Mars: the true-colour map.** Viking-derived, butterscotch where the illustrative one is
 *   orange-red. Its mean colour sits much nearer Mars's measured one: in linear light, red to
 *   green to blue 1 : 0.52 : 0.20 against the illustrative map's 1 : 0.23 : 0.11 and the
 *   1 : 0.66 : 0.33 that Mallama et al. 2017's band albedos give the whole disc (hazes, clouds
 *   and caps included, which a map of the ground does not hold). Its brightness is the disc's
 *   to 5%.
 * - **Neptune: the true-colour map**, which is the illustrative map's Voyager 2 clouds in
 *   Neptune's measured colour and brightness (web/public/textures/CREDITS.md). The illustrative
 *   one is the contrast-stretched deep blue and a quarter as bright as its albedo says.
 * - **Earth: the illustrative map.** Blue Marble's colour is calibrated, but the file paints
 *   shaded sea-floor relief into the oceans and holds December's snow all year; the
 *   illustrative map, drawn 30% less saturated (SolarSystem.tsx), has neither.
 *
 * So the sets are not switched whole: every other body's two maps are the same file anyway.
 */
export const TRUE_COLOUR_DRAWN: ReadonlySet<string> = new Set(['mars', 'neptune']);

/** The set a body's map is drawn from. */
export function drawnTextureSet(body: Pick<BodyDefinition, 'id'>): TextureSetId {
  return TRUE_COLOUR_DRAWN.has(body.id) ? 'photometric' : 'illustrative';
}

/** The map drawn on a body, or null for one in flat colour. */
export function drawnTexture(body: Pick<BodyDefinition, 'id' | 'textures'>): TextureVariant | null {
  return body.textures?.[drawnTextureSet(body)] ?? null;
}
