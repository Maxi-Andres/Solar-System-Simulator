import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { inAlphaCen } from '../core/alphaCenBodies.ts';
import { blackHoleSystemOf } from '../core/blackHoles.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { fictionShipOf } from '../core/fiction.ts';
import { galaxyOf } from '../core/localGroup.ts';
import { volumeRegion } from '../core/localVolume.ts';
import { planetarySystemOf, systemFramingKm } from '../core/planetarySystems.ts';
import { recordHolderOf } from '../core/recordHolders.ts';
import { isCatalogueStar, STAR_FRAMING_RADIUS_KM } from '../core/starBodies.ts';
import { alphaCenLadder, sunLadder, systemLadder, type LevelId, type Rung } from '../state/levels.ts';
import { focusFramingOf } from '../state/store.ts';

/**
 * Every focus's ladder, as the Sun's (state/levels.ts sunLadder): the levels the breadcrumb shows
 * above it, inner to outer, each at the distance its crumb frames it from -- so zooming out from
 * anything walks the breadcrumb up through its own ancestry, and zooming in walks it back down
 * (Maxi, 2026-11-22: "relativo a donde estás"). Read against the camera's distance from the focus,
 * the boundary between two rungs at their geometric mean, with the Sun's hysteresis
 * (levels.ts ladderLevel).
 *
 * - A body of a star system -- the Solar System's, Alpha Centauri's, a planetary system's, a
 *   fictional world at one of them -- starts at that system's star framed as a body, eight of its
 *   radii, then the system as its breadcrumb entry frames it, then the Solar Neighbourhood and on
 *   out. A star of no system the same, without the system's rung.
 * - A black hole's system, a pulsar, a cluster, a remnant, a nebula: itself as it is framed, then
 *   the Milky Way and on out -- the breadcrumb shows them no Solar Neighbourhood.
 * - A galaxy of the Local Group: then the Local Group; of the Local Volume, the Local Volume; of
 *   the Virgo Cluster or of Laniakea's catalogue, the Nearby Universe; a record-holder, the
 *   Observable Universe alone.
 *
 * The Solar Neighbourhood and every level beyond are centred on the Sun, and measured here from
 * the focus all the same: their rungs are 50 light years and up, their boundaries at 0.3 light
 * years and up, so a focus 4.4 light years out (Alpha Centauri) or a few hundred (a planetary
 * system of the Archive) moves a boundary by a part in ten or less -- inside the hysteresis -- and
 * the far levels by nothing that shows. Laniakea and the Virgo Cluster are on no ladder, as on the
 * Sun's: their centres are not the Sun nor the focus, and they are selected by their crumbs alone.
 *
 * A planet with moons is no rung, nor a moon's planet for a fictional moon (Pandora's Polyphemus):
 * a rung is a breadcrumb level, a panel of its own, and a planet has none -- it is a body, gone to
 * by its crumb, and its moons are inside the system's first boundary anyway (Jupiter's farthest,
 * 0.16 AU out, against the Solar System's 2.6).
 */

/** The kinds the breadcrumb puts out in the galaxy, with no Solar Neighbourhood (BodyPicker.tsx inGalaxy). */
const IN_THE_GALAXY: ReadonlySet<BodyDefinition['kind']> = new Set([
  'neutron-star',
  'globular-cluster',
  'supernova-remnant',
  'nebula',
  'deep-sky',
]);

/** The rung `level` heads, and every one outer than it, of the Sun's ladder. */
function outerFrom(level: LevelId): readonly Rung[] {
  const ladder = sunLadder();
  return ladder.slice(ladder.findIndex((rung) => rung.level === level));
}

/** `own`, the focus framed as itself, then the rungs beyond it that are farther out than it. */
function ladder(ownKm: number, rest: readonly Rung[]): readonly Rung[] {
  return [{ level: null, km: ownKm }, ...rest.filter((rung) => rung.km > ownKm)];
}

/** What a body is framed from as itself: the framing it asks for, or eight of its radii. */
function ownFramingKm(body: BodyDefinition): number {
  return focusFramingOf(body.id)?.km ?? 8 * body.radiusEquatorialKm;
}

/**
 * `focus`'s ladder. Made once per focus (the watch keeps it), not per frame: it allocates.
 */
export function focusLadder(store: Pick<EphemerisStore, 'body'>, focus: BodyId): readonly Rung[] {
  const body = store.body(focus);
  if (recordHolderOf(focus) !== null) {
    return ladder(ownFramingKm(body), outerFrom('observable-universe'));
  }
  const galaxy = galaxyOf(focus);
  if (body.kind === 'structure' || galaxy?.laniakeaIndex !== undefined) {
    return ladder(ownFramingKm(body), outerFrom('nearby-universe'));
  }
  if (body.kind === 'galaxy') {
    const region = volumeRegion(galaxy);
    return ladder(
      ownFramingKm(body),
      outerFrom(region === 'virgo' ? 'nearby-universe' : region !== null ? 'local-volume' : 'local-group'),
    );
  }
  const blackHole = blackHoleSystemOf(focus);
  if (blackHole !== null) {
    return ladder(blackHole.framingKm, outerFrom('milky-way'));
  }
  if (IN_THE_GALAXY.has(body.kind)) {
    return ladder(ownFramingKm(body), outerFrom('milky-way'));
  }
  // A star system's: Alpha Centauri, a planetary system, then the Solar System's own, the Sun's.
  if (inAlphaCen(store, focus)) {
    return [...alphaCenLadder(), ...outerFrom('solar-neighbourhood')];
  }
  const system = planetarySystemOf(focus);
  if (system !== null) {
    const starRadiusKm = system.hostRadiusSun === null ? STAR_FRAMING_RADIUS_KM : system.hostRadiusSun * 695_700;
    return [...systemLadder('planetary-system', starRadiusKm, systemFramingKm(system)), ...outerFrom('solar-neighbourhood')];
  }
  if (isCatalogueStar(body)) {
    return ladder(8 * body.radiusEquatorialKm, outerFrom('solar-neighbourhood'));
  }
  // A world about a star of no system the app draws -- Erid and Vulcan about 40 Eridani A
  // (core/fiction.ts) -- has its star's ladder: the star framed as a body, then the neighbourhood.
  if (body.parent !== null) {
    const star = store.body(body.parent);
    if (isCatalogueStar(star)) {
      return ladder(8 * star.radiusEquatorialKm, outerFrom('solar-neighbourhood'));
    }
  }
  // A fictional ship goes between the stars (core/hailMary.ts): a body of no system, as a lone star is.
  if (fictionShipOf(focus) !== null) {
    return ladder(ownFramingKm(body), outerFrom('solar-neighbourhood'));
  }
  return sunLadder();
}

/** Whether `level` is a rung of `rungs`: a loop, not a closure, for the frame loop. */
export function onLadder(rungs: readonly Rung[], level: LevelId): boolean {
  for (let k = 0; k < rungs.length; k += 1) {
    if (rungs[k]!.level === level) return true;
  }
  return false;
}
