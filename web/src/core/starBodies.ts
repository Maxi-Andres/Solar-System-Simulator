import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { colorIndexToTemperature, starColor, surfaceLuminanceRelativeToSun } from '../scene/blackbody.ts';
import { measuredMassSun, measuredRadiusKm } from './alphaCentauri.ts';
import { brightStarOf } from './brightStars.ts';
import { matchOrbitingStar, orbitingStarSize, orbitingStarState } from './orbitingStars.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { STAR3D, STAR3D_FLOATS, starState, type StarNameIndex, type Stars3dSource } from './stars3d.ts';

/**
 * A catalogue star made into a body the camera can go to, as a comet or a belt asteroid is
 * (cometBodies.ts, beltBodies.ts): chosen from search, added to the store with no table,
 * placed every frame by its own linear space motion about the Sun -- the catalogue's
 * model, r(t) = r + v (t - J2000) -- and drawn by the star renderer, which already draws
 * its light. As a body it gains what a point lacks: a marker, a name on screen, a place
 * in the breadcrumb and the info panel.
 *
 * Kind 'star', the Sun's kind. A sphere only where a radius has been measured -- Alpha
 * Centauri's three so far (D3b) -- since none of the catalogues it comes from publishes
 * one; every other star is a marker at any range (`radiusPublished: false`), framed by a
 * nominal radius that is the Sun's -- a number for the camera to stand off by, and said to
 * be one.
 */

export function starBodyId(tier: number, index: number): BodyId {
  return `star-${tier}-${index}`;
}

export function parseStarBodyId(id: BodyId): { readonly tier: number; readonly index: number } | null {
  const match = /^star-(\d+)-(\d+)$/.exec(id);
  return match === null ? null : { tier: Number(match[1]), index: Number(match[2]) };
}

/** The nominal solar radius stellar radii are counted in, km (IAU 2015 B3). */
const SOLAR_RADIUS_KM = 695_700;

/**
 * True for a catalogue star made a body: a 3D star's record (`star-<tier>-<index>`), or an
 * Exoplanet Archive host placed from the Archive (`exo-host-<n>`, archiveSystems.ts
 * archiveHostBodyId) -- not the Sun, and not one of the stars about a black hole, which
 * come from their papers and not from a catalogue (blackHoles.ts).
 */
export function isCatalogueStar(body: BodyDefinition): boolean {
  return body.kind === 'star' && (parseStarBodyId(body.id) !== null || /^exo-host-\d+$/.test(body.id));
}

/**
 * The radius a star body is framed by, km: the Sun's. **Not a measurement** -- the
 * catalogues give none -- and the body says so (`radiusPublished: false`). Eight of them is
 * 0.037 AU, close enough that the star is the brightest thing on screen by far.
 */
export const STAR_FRAMING_RADIUS_KM = 695_700;

/** What the info panel says about a star body, from names.json and its record. */
export interface StarBodyFacts {
  readonly tier: number;
  readonly index: number;
  /** Its ten floats, kept: what the panel reads its distance, motion and photometry from. */
  readonly record: Float32Array;
  readonly iau: boolean;
  readonly designations: readonly string[];
  readonly system: string | null;
  readonly nearest: number | null;
  readonly spectralType: string | null;
}

const facts = new Map<BodyId, StarBodyFacts>();

export function starBodyFacts(id: BodyId): StarBodyFacts | null {
  return facts.get(id) ?? null;
}

/** A linear colour at unit luminance as a CSS hex, brightest channel at full: a marker's colour. */
export function colorHex(linear: readonly [number, number, number]): string {
  const peak = Math.max(...linear, 1e-9);
  const encode = (value: number): string => {
    const v = value / peak;
    const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, srgb)) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${encode(linear[0])}${encode(linear[1])}${encode(linear[2])}`;
}

/**
 * The body a star record becomes: a marker in the star's own colour, and its name -- and,
 * for a star whose radius has been measured (Alpha Centauri's three, alphaCentauri.ts), a
 * sphere of that radius, drawn as the Sun's is (SolarSystem.tsx, starDiscExposure).
 */
export function starBodyDefinition(
  id: BodyId,
  name: string,
  bv: number,
  measuredRadiusKm: number | null = null,
  measuredMassSun: number | null = null,
): BodyDefinition {
  // A measured mass is what a planet's orbit about the star is drawn with (proximaPlanets.ts).
  const gm = measuredMassSun === null ? 0 : measuredMassSun * 1.3271244e11;
  const radius = measuredRadiusKm ?? STAR_FRAMING_RADIUS_KM;
  return {
    id,
    name,
    horizonsId: '',
    center: '500@10',
    elementsCenter: '500@10',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'star',
    radiusEquatorialKm: radius,
    radiusPolarKm: radius,
    gmKm3S2: gm,
    gmBodyOnlyKm3S2: gm,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: colorHex(starColor(bv)),
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
    radiusPublished: measuredRadiusKm !== null,
    shapeDrawn: measuredRadiusKm !== null,
  };
}

/** Each star body's disc exposure against the Sun's, and its colour index, where it has a disc. */
const discExposures = new Map<BodyId, number>();
const discColorIndices = new Map<BodyId, number>();

/**
 * Gives a star body that is not a 3D star's record -- an Exoplanet Archive host placed from
 * the Archive (archiveSystems.ts), a star about a black hole (blackHoles.ts) -- its disc's
 * colour index, and so its colour and brightness, as addStarBody gives a record's.
 */
export function setStarDisc(id: BodyId, colorIndex: number, temperatureK: number | null = null): void {
  // Its brightness from its published temperature where there is one: the colour relation
  // stops at 21,700 K, and a 31,000 K star's surface is 70 times the Sun's, not that one's 39.
  discExposures.set(id, surfaceLuminanceRelativeToSun(temperatureK ?? colorIndexToTemperature(colorIndex)));
  discColorIndices.set(id, colorIndex);
}

/** A star body's colour index, for its disc's colour: the Sun's 0.65 for any other body. */
export function starDiscColorIndex(id: BodyId): number {
  return discColorIndices.get(id) ?? 0.65;
}

/**
 * How bright a star body's disc is drawn against the Sun's: its surface luminance over
 * the Sun's, at the temperature its colour index gives (blackbody.ts) -- the same path its
 * colour takes, so the two cannot disagree. 1 for any other body.
 */
export function starDiscExposure(id: BodyId): number {
  return discExposures.get(id) ?? 1;
}

/** How many star bodies are kept once made: the stars of a short tour, with their names. */
export const STAR_BODIES_KEPT = 12;

/** The star bodies added and still in the store, oldest first. */
const added: BodyId[] = [];

/**
 * Star bodies that stay whatever else is gone to: Alpha Centauri's three and the stars of
 * the planetary systems, made bodies at start so they are named on the sky and can be gone
 * to from it (alphaCenBodies.ts, planetarySystems.ts).
 */
const pinned = new Set<BodyId>();

/**
 * Makes entry `k` of the star names a body in `store` and returns its id, reading its
 * record from its tier -- or on its own, if the tier is not in yet. The oldest go once
 * there are more than STAR_BODIES_KEPT, unless it is `keep`, the body the camera is on.
 * `massSun`, a star's published mass, is what its planets' orbits are drawn with, and
 * `radiusSun`, its measured radius, makes it a disc (planetarySystems.ts); Alpha
 * Centauri's three have theirs from alphaCentauri.ts.
 */
export async function addStarBody(
  store: EphemerisStore,
  source: Stars3dSource,
  names: StarNameIndex,
  k: number,
  keep: BodyId,
  pin = false,
  massSun: number | null = null,
  radiusSun: number | null = null,
): Promise<BodyId> {
  const { names: columns } = names;
  return addStarRecordBody(
    store,
    source,
    columns.tier[k]!,
    columns.index[k]!,
    {
      display: columns.display[k]!,
      iau: columns.iau[k] ?? false,
      designations: columns.designations[k] ?? [],
      system: columns.system[k] ?? null,
      nearest: columns.nearest[k] ?? null,
      spectralType: columns.spectralType[k] ?? null,
    },
    keep,
    pin,
    massSun,
    radiusSun,
  );
}

/**
 * The names some stars are shown by instead of names.json's, by a designation each carries:
 * where the IAU's proper name alone does not say which star it is. Its usual designation first --
 * the Bayer letter, the Flamsteed number, the catalogue name the Exoplanet Archive lists it by --
 * and the proper name after (Maxi, 2026-11-22, read "Toliman" and did not know it was Alpha
 * Centauri B). The proper name stays in the name, and the star's other designations are searched
 * too (search.ts), so "Toliman" and "alf Cen B" both find it.
 *
 * Which: Alpha Centauri A and B; every star the Exoplanet Archive lists as a host whose
 * names.json name is an IAU proper name few would know -- the NameExoWorlds names (Ran,
 * Helvetios, Copernicus, Chalawan, Titawin, the HD stars' Formosa to Macondo) and the
 * traditional ones as obscure (Tarf, Errai, Edasich, Muscida) -- each made a system when gone to
 * (archiveSystems.ts); and 40 Eridani A, Keid, and the Hyades' Chamukuy, curated stars. The famous
 * keep their own names alone: Hamal, Aldebaran, Pollux, Kochab, Mirach and Algieba among the
 * hosts, Sirius, Vega, Canopus, Betelgeuse, Polaris, Barnard's Star and Proxima everywhere. Made
 * from names.json and exoplanets.json on 2026-11-22, keyed by the HIP number where it has one.
 */
export const STAR_SHOWN_NAMES: ReadonlyMap<string, string> = new Map([
  ['alf Cen A', 'α Cen A (Rigil Kentaurus)'],
  ['alf Cen B', 'α Cen B (Toliman)'],
  ['HIP 74793', '11 UMi (Pherkad Minor)'],
  ['HIP 116076', '14 And (Veritate)'],
  ['HIP 103527', '18 Del (Musica)'],
  ['HIP 53721', '47 UMa (Chalawan)'],
  ['HIP 113357', '51 Peg (Helvetios)'],
  ['HIP 43587', '55 Cnc (Copernicus)'],
  ['HIP 73136', '8 UMi (Baekdu)'],
  ['HIP 2247', 'BD-17 63 (Felixvarela)'],
  ['HIP 104780', 'BD+14 4559 (Solaris)'],
  ['HIP 40526', 'β Cnc (Tarf)'],
  ['HIP 16537', 'ε Eri (Ran)'],
  ['HIP 20889', 'ε Tau (Ain)'],
  ['HIP 116727', 'γ Cep (Errai)'],
  ['HIP 76333', 'γ Lib (Zubenelhakrabi)'],
  ['HIP 114971', 'γ Psc (Yunyu)'],
  ['HIP 47780', 'GJ 367 (Añañuca)'],
  ['HIP 57087', 'GJ 436 (Noquisi)'],
  ['HIP 62452', 'GJ 486 (Gar)'],
  ['HIP 56508', 'HD 100655 (Formosa)'],
  ['HIP 56572', 'HD 100777 (Sagarmatha)'],
  ['HIP 57291', 'HD 102117 (Uklun)'],
  ['HIP 57370', 'HD 102195 (Flegetonte)'],
  ['HIP 57820', 'HD 102956 (Aniara)'],
  ['HIP 58952', 'HD 104985 (Tonatiuh)'],
  ['HIP 60644', 'HD 108147 (Tupã)'],
  ['HIP 61177', 'HD 109246 (Funi)'],
  ['HIP 63090', 'δ Vir (Minelauva)'],
  ['HIP 66047', 'HD 117618 (Dofida)'],
  ['HIP 66192', 'HD 118203 (Liesma)'],
  ['HIP 9353', 'HD 12235 (Zibbatu)'],
  ['HIP 72339', 'HD 130322 (Mönch)'],
  ['HIP 72845', 'HD 131496 (Arcalís)'],
  ['HIP 74961', 'HD 136418 (Nikawiy)'],
  ['HIP 76351', 'HD 137388 (Karaka)'],
  ['HIP 79219', 'HD 145457 (Kamuy)'],
  ['HIP 80687', 'HD 148427 (Timir)'],
  ['HIP 80838', 'HD 149026 (Ogma)'],
  ['HIP 81022', 'HD 149143 (Rosalíadecastro)'],
  ['HIP 83547', 'HD 153950 (Rapeto)'],
  ['HIP 84787', 'HD 156411 (Inquill)'],
  ['HIP 86796', 'μ Ara (Cervantes)'],
  ['HIP 12191', 'HD 16175 (Buna)'],
  ['HIP 88414', 'HD 164604 (Pincoya)'],
  ['HIP 90004', 'HD 168746 (Alasia)'],
  ['HIP 13192', 'HD 17156 (Nushagak)'],
  ['HIP 91852', 'HD 173416 (Xihe)'],
  ['HIP 94645', 'HD 179949 (Gumala)'],
  ['HIP 95124', 'HD 181342 (Belel)'],
  ['HIP 95262', 'HD 181720 (Sika)'],
  ['HIP 13993', 'HD 18742 (Ayeyarwady)'],
  ['HIP 99711', 'HD 192263 (Phoenicia)'],
  ['HIP 99894', 'HD 192699 (Chechia)'],
  ['HIP 106824', 'HD 205739 (Sāmaya)'],
  ['HIP 108375', 'HD 208487 (Itonda)'],
  ['HIP 15578', 'HD 20868 (Intan)'],
  ['HIP 110813', 'HD 212771 (Lionrock)'],
  ['HIP 114322', 'HD 218566 (Ebla)'],
  ['HIP 116084', 'HD 221287 (Poerava)'],
  ['HIP 118319', 'HD 224693 (Axólotl)'],
  ['HIP 17096', 'HD 23079 (Tupi)'],
  ['HIP 22491', 'HD 30856 (Mouhoun)'],
  ['HIP 24003', 'HD 32518 (Mago)'],
  ['HIP 26380', 'HD 38283 (Bubup)'],
  ['HIP 3479', 'HD 4208 (Cocibolca)'],
  ['HIP 29550', 'HD 43197 (Amadioha)'],
  ['HIP 30860', 'HD 45350 (Lucilinburhuc)'],
  ['HIP 30905', 'HD 45652 (Lusitânia)'],
  ['HIP 31895', 'HD 48265 (Nosaxa)'],
  ['HIP 32916', 'HD 49674 (Nervia)'],
  ['HIP 33719', 'HD 52265 (Citalá)'],
  ['HIP 37284', 'HD 63454 (Ceibo)'],
  ['HIP 38041', 'HD 63765 (Tapecue)'],
  ['HIP 5054', 'HD 6434 (Nenque)'],
  ['HIP 40687', 'HD 68988 (Násti)'],
  ['HIP 5529', 'HD 7199 (Emiw)'],
  ['HIP 42446', 'HD 73534 (Gakyid)'],
  ['HIP 43674', 'HD 75898 (Stribor)'],
  ['HIP 46471', 'HD 81688 (Intercrus)'],
  ['HIP 47087', 'HD 82886 (Illyrian)'],
  ['HIP 47202', 'HD 83443 (Kalausi)'],
  ['HIP 48235', 'HD 85390 (Natasha)'],
  ['HIP 6643', 'HD 8574 (Bélénos)'],
  ['HIP 52521', 'HD 93083 (Macondo)'],
  ['HIP 53524', 'HD 95086 (Aiolos)'],
  ['HIP 55664', 'HD 99109 (Shama)'],
  ['HIP 12961', 'HIP 12961 (Koeia)'],
  ['HIP 65426', 'HIP 65426 (Matza)'],
  ['HIP 79431', 'HIP 79431 (Sharjah)'],
  ['HIP 75458', 'ι Dra (Edasich)'],
  ['HIP 116805', 'κ And (Kaffalmusalsala)'],
  ['HIP 115211', 'L 168-9 (Danfeng)'],
  ['HIP 117883', 'LTT 9779 (Uúba)'],
  ['HIP 48455', 'μ Leo (Rasalas)'],
  ['HIP 82545', 'μ² Sco (Pipirima)'],
  ['HIP 41704', 'ο UMa (Muscida)'],
  ['HIP 67275', 'τ Boo (Tepiamenit)'],
  ['HIP 7513', 'υ And (Titawin)'],
  ['WASP-80', 'WASP-80 (Petra)'],
  ['HIP 97938', 'ξ Aql (Libertas)'],
  ['HIP 19849', '40 Eri A (Keid)'],
  ['HIP 20894', 'θ² Tau (Chamukuy)'],
]);

/** The name a star body is shown by: names.json's `display`, or the one STAR_SHOWN_NAMES gives it. */
export function starShownName(display: string, designations: readonly string[]): string {
  for (const designation of designations) {
    const shown = STAR_SHOWN_NAMES.get(designation);
    if (shown !== undefined) return shown;
  }
  return display;
}

/** What names.json says of a star -- or, for one it does not name, what is known of it. */
export interface StarEntry {
  readonly display: string;
  readonly iau: boolean;
  readonly designations: readonly string[];
  readonly system: string | null;
  readonly nearest: number | null;
  readonly spectralType: string | null;
}

/**
 * Makes record `index` of tier `tier` a body, named by `entry`: addStarBody's work, for a
 * star found by its record rather than by its name -- an Exoplanet Archive host, most of
 * which names.json does not list (archiveSystems.ts). If the star is a body already it is
 * kept as it is, and only moved to the front of the queue.
 */
export async function addStarRecordBody(
  store: EphemerisStore,
  source: Stars3dSource,
  tier: number,
  index: number,
  entry: StarEntry,
  keep: BodyId,
  pin = false,
  massSun: number | null = null,
  radiusSun: number | null = null,
): Promise<BodyId> {
  const id = starBodyId(tier, index);
  if (!store.isPropagatedBody(id)) {
    const record = new Float32Array(await source.record(tier, index));
    if (record.length !== STAR3D_FLOATS) {
      throw new Error(`Star ${id} has no record.`);
    }
    facts.set(id, {
      tier,
      index,
      record,
      iau: entry.iau,
      designations: entry.designations,
      system: entry.system,
      nearest: entry.nearest,
      spectralType: entry.spectralType,
    });
    // Exact: the linear motion is how the catalogue is meant to be read, not a fallback
    // from something better, so the interface does not call it APPROXIMATE. Alpha
    // Centauri A and B are the exception: they follow their measured orbit instead
    // (alphaCentauri.ts), which a straight line from 1991 has long since left.
    const at = { x: record[STAR3D.x]!, y: record[STAR3D.y]!, z: record[STAR3D.z]! };
    const component = matchOrbitingStar(at);
    const size = component === null ? null : orbitingStarSize(component);
    // A famous star whose measured size is its own, round, at the catalogue's distance (brightStars.ts).
    const disc = brightStarOf(entry.designations)?.disc ?? null;
    const radiusKm =
      (size === null ? null : size.radiusSun * SOLAR_RADIUS_KM) ??
      measuredRadiusKm(at) ??
      (radiusSun === null ? null : radiusSun * SOLAR_RADIUS_KM) ??
      (disc === null ? null : disc.radiusSun * SOLAR_RADIUS_KM);
    if (radiusKm !== null) {
      discExposures.set(id, surfaceLuminanceRelativeToSun(colorIndexToTemperature(record[STAR3D.bv]!)));
      discColorIndices.set(id, record[STAR3D.bv]!);
    }
    store.addPropagatedBody(
      starBodyDefinition(
        id,
        starShownName(entry.display, entry.designations),
        record[STAR3D.bv]!,
        radiusKm,
        size?.massSun ?? measuredMassSun(at) ?? massSun ?? disc?.massSun ?? null,
      ),
      null,
      component === null ? (jd) => starState(record, 0, jd) : (jd) => orbitingStarState(component, jd),
      { exact: true },
    );
  }
  const at = added.indexOf(id);
  if (at >= 0) {
    added.splice(at, 1);
  }
  added.push(id);
  if (pin) {
    pinned.add(id);
  }
  while (added.filter((candidate) => !pinned.has(candidate)).length > STAR_BODIES_KEPT) {
    const oldest = added.findIndex(
      (candidate) => candidate !== keep && candidate !== id && !pinned.has(candidate),
    );
    if (oldest < 0) {
      break;
    }
    const [gone] = added.splice(oldest, 1);
    store.removePropagatedBody(gone!);
    facts.delete(gone!);
    discExposures.delete(gone!);
    discColorIndices.delete(gone!);
  }
  return id;
}
