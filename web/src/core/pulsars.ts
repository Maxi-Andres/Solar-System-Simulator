import type { BodyDefinition, BodyId, PulsarCatalog } from '@sss/tools/types';

import { blackbodyChromaticity } from '../scene/blackbody.ts';
import type { BeltFetchers } from './belt.ts';
import type { Searchable } from './beltNames.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { normalizeName } from './search.ts';
import { colorHex } from './starBodies.ts';
import { julianYearsSinceJ2000, KM_S_TO_PC_PER_YEAR, PARSEC_KM } from './stars3d.ts';
import type { StateVector } from './vec3.ts';

/**
 * The pulsars (D6a): every neutron star the ATNF Pulsar Catalogue can place, and the McGill
 * catalogue's magnetars, from pulsars.json (tools/src/pulsars/). Marked across the map and
 * the galaxy (scene/Pulsars.tsx); one gone to becomes a body of its real size.
 *
 * ## Where
 *
 * Each where its catalogue puts it -- its position, carried along its proper motion -- at the
 * distance psrcat's own rule picks, which the panel names: an independent measurement (its
 * cluster's, its remnant's, an absorption line's), a parallax, or, for most, its dispersion
 * measure through the YMW16 model of the Galaxy's electrons, the roughest of them. No
 * pulsar's radial velocity is measured but a few binaries', so none moves along the line of
 * sight.
 *
 * ## How big
 *
 * A neutron star's radius is measured for three, by NICER's X-ray pulse profiles of their
 * hot polar caps, and each is drawn at its own (NICER_RADII). Every other is drawn at
 * NOMINAL_RADIUS_KM, a convention, not a measurement: 12 km, within the errors of all
 * three. The mass likewise: the three's, or 1.4 solar masses, the canonical value -- used
 * for nothing but the body's gravity, which nothing here orbits.
 *
 * ## What colour
 *
 * A neutron star is hot: a young one's surface is near a million kelvin, and even a
 * billion-year-old pulsar's polar caps, heated by its own current, are as hot. The
 * surface temperature is measured for few, so every one is drawn in the colour of a
 * million-kelvin blackbody -- which is the colour of any blackbody past a hundred thousand
 * or so, the Rayleigh-Jeans tail's: a pale blue-violet white. Not how bright: at a million
 * kelvin a sphere of twelve kilometres' radius gives about a millionth of the Sun's visible
 * light, and the sphere is drawn at its colour at full brightness, as the stars' discs are.
 *
 * ## Spin
 *
 * Not drawn. A sphere turning shows nothing, and the beams a pulsar is known by are not
 * light one would see: radio, swept across us, from a region no measurement resolves.
 * The period is in the panel.
 */

/** A pulsar's body id, by its entry in pulsars.json. */
export function pulsarBodyId(k: number): BodyId {
  return `psr-${k}`;
}

/** The entry a pulsar body is, or null for any other body. */
export function pulsarIndexOf(id: BodyId | null): number | null {
  const match = id === null ? null : /^psr-(\d+)$/.exec(id);
  return match === null ? null : Number(match[1]);
}

/** A neutron star's radius and mass as NICER measured them, by J2000 name. */
export interface NeutronStarMeasurement {
  readonly radiusKm: number;
  readonly radiusUpKm: number;
  readonly radiusDownKm: number;
  readonly massSun: number;
  readonly reference: string;
}

/**
 * The three neutron stars whose radii are measured: NICER pulse-profile fits, the Amsterdam
 * group's (each paper's headline values, 16-84% intervals). A second team's analyses of the
 * same data (Miller et al. 2019, ApJL 887, L24; 2021, ApJL 918, L28) find J0030+0451 13.02
 * km and J0740+6620 13.7 km: within each other's errors.
 */
export const NICER_RADII: Readonly<Record<string, NeutronStarMeasurement>> = {
  'J0030+0451': {
    radiusKm: 12.71,
    radiusUpKm: 1.14,
    radiusDownKm: 1.19,
    massSun: 1.34,
    reference: 'Riley et al. 2019, ApJL 887, L21',
  },
  'J0740+6620': {
    radiusKm: 12.39,
    radiusUpKm: 1.3,
    radiusDownKm: 0.98,
    massSun: 2.072,
    reference: 'Riley et al. 2021, ApJL 918, L27',
  },
  'J0437-4715': {
    radiusKm: 11.36,
    radiusUpKm: 0.95,
    radiusDownKm: 0.63,
    massSun: 1.418,
    reference: 'Choudhury et al. 2024, ApJL 971, L20',
  },
};

/** The radius every other neutron star is drawn at, km: a convention (see the header). */
export const NOMINAL_RADIUS_KM = 12;
/** And the mass, solar: the canonical 1.4. */
export const NOMINAL_MASS_SUN = 1.4;

/** The temperature whose colour every neutron star is drawn in (see the header). */
export const NEUTRON_STAR_COLOR_K = 1e6;

/** The Sun's GM, km^3/s^2 (IAU 2015 B3 nominal). */
const GM_SUN = 1.3271244e11;

/** The catalogue, and its pulsars as a search index: by name, then by J and B names. */
export interface PulsarArchive {
  readonly catalog: PulsarCatalog;
  readonly search: Searchable;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Checks pulsars.json has one entry per pulsar in every column. */
export function parsePulsarCatalog(raw: unknown): PulsarCatalog {
  if (!isRecord(raw) || !isRecord(raw['pulsars']) || !Array.isArray(raw['references'])) {
    throw new Error('pulsars.json is not a catalogue of pulsars.');
  }
  const table = raw['pulsars'];
  const count = table['count'];
  if (typeof count !== 'number') {
    throw new Error("pulsars.json's pulsars have no count.");
  }
  for (const [column, values] of Object.entries(table)) {
    if (column !== 'count' && (!Array.isArray(values) || values.length !== count)) {
      throw new Error(`pulsars.json's ${column} does not have one entry each.`);
    }
  }
  return raw as unknown as PulsarCatalog;
}

export function indexPulsars(catalog: PulsarCatalog): PulsarArchive {
  const { pulsars } = catalog;
  return {
    catalog,
    search: {
      display: pulsars.name.map(normalizeName),
      // "PSR J0534+2200", "J0534+2200", "B0531+21": all of them, as people write them.
      designation: pulsars.name.map((_, k) =>
        normalizeName(
          [pulsars.jName[k], pulsars.bName[k], pulsars.jName[k] === null ? null : `PSR ${pulsars.jName[k]}`]
            .filter((name) => name !== null)
            .join(' '),
        ),
      ),
    },
  };
}

/** Reads pulsars.json; null where the published data has none. */
export async function loadPulsarArchive(fetchers: BeltFetchers, basePath = '/'): Promise<PulsarArchive | null> {
  const raw = await fetchers.json(`${basePath}data/pulsars.json`);
  if (raw === null) {
    console.warn('The published data has no pulsars.json: the pulsars are not shown.');
    return null;
  }
  return indexPulsars(parsePulsarCatalog(raw));
}

/** A pulsar's state about the Sun at `jd`, km and km/s: its straight line. */
export function pulsarState(catalog: PulsarCatalog, k: number, jd: number): StateVector {
  const p = catalog.pulsars;
  const motion = julianYearsSinceJ2000(jd) * KM_S_TO_PC_PER_YEAR;
  return {
    position: {
      x: (p.x[k]! + p.vx[k]! * motion) * PARSEC_KM,
      y: (p.y[k]! + p.vy[k]! * motion) * PARSEC_KM,
      z: (p.z[k]! + p.vz[k]! * motion) * PARSEC_KM,
    },
    velocity: { x: p.vx[k]!, y: p.vy[k]!, z: p.vz[k]! },
  };
}

/** What a pulsar's sphere is drawn with: NICER's radius and mass, or the convention. */
export function neutronStarSize(catalog: PulsarCatalog, k: number): {
  readonly radiusKm: number;
  readonly massSun: number;
  readonly measured: NeutronStarMeasurement | null;
} {
  const jName = catalog.pulsars.jName[k];
  const measured = jName == null ? null : (NICER_RADII[jName] ?? null);
  return {
    radiusKm: measured?.radiusKm ?? NOMINAL_RADIUS_KM,
    massSun: measured?.massSun ?? NOMINAL_MASS_SUN,
    measured,
  };
}

/** The colour a neutron star and its marker are drawn in. */
export const NEUTRON_STAR_COLOR = colorHex(blackbodyChromaticity(NEUTRON_STAR_COLOR_K));

/** A pulsar as a body: a sphere of its radius, unlit, in a million-kelvin blackbody's colour. */
export function neutronStarDefinition(id: BodyId, name: string, radiusKm: number, massSun: number): BodyDefinition {
  const gm = massSun * GM_SUN;
  return {
    id,
    name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'neutron-star',
    radiusEquatorialKm: radiusKm,
    radiusPolarKm: radiusKm,
    gmKm3S2: gm,
    gmBodyOnlyKm3S2: gm,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: NEUTRON_STAR_COLOR,
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

/** The pulsars made bodies, and their catalogue: what the panel reads a body's facts from. */
let madeFrom: PulsarCatalog | null = null;

/** The catalogue entry and catalogue of a pulsar body, or null for any other body. */
export function pulsarOf(id: BodyId | null): { readonly catalog: PulsarCatalog; readonly k: number } | null {
  const k = pulsarIndexOf(id);
  return k === null || madeFrom === null || k >= madeFrom.pulsars.count ? null : { catalog: madeFrom, k };
}

/**
 * Makes pulsar `k` a body, if it is not yet, and returns its id. Kept once made, as the
 * Archive's hosts are: a pulsar gone to is one that may be gone back to.
 */
export function ensurePulsarBody(store: EphemerisStore, archive: PulsarArchive, k: number): BodyId {
  const id = pulsarBodyId(k);
  madeFrom = archive.catalog;
  if (!store.isPropagatedBody(id)) {
    const { radiusKm, massSun } = neutronStarSize(archive.catalog, k);
    store.addPropagatedBody(
      neutronStarDefinition(id, archive.catalog.pulsars.name[k]!, radiusKm, massSun),
      null,
      (jd) => pulsarState(archive.catalog, k, jd),
      { exact: true },
    );
  }
  return id;
}

/** How far from a neutron star the camera stands when going to it: ten radii, the sphere whole. */
export function pulsarFramingKm(radiusKm: number): number {
  return 10 * radiusKm;
}

// ---------------------------------------------------------------------------------------
// What the spin says

/** A spin period as it is said: milliseconds below a second. */
export function formatPeriod(periodS: number): string {
  return periodS < 1 ? `${Number((periodS * 1000).toPrecision(3))} ms` : `${Number(periodS.toPrecision(3))} s`;
}

/**
 * The magnetic field at the surface, gauss, of a dipole spinning down by radiating:
 * B = 3.2e19 sqrt(P Pdot) -- with P in seconds -- for a neutron star of radius 10 km and
 * moment of inertia 1e45 g cm^2 whose field is perpendicular to its spin (Lorimer & Kramer
 * 2005, Handbook of Pulsar Astronomy). The ATNF catalogue's BSURF, worked out as psrcat
 * works it out (defineParams.c). An estimate
 * from a model, not a measurement of the field; none where the period does not lengthen.
 */
export function surfaceFieldGauss(periodS: number | null, periodDerivative: number | null): number | null {
  if (periodS === null || periodDerivative === null || !(periodDerivative > 0)) {
    return null;
  }
  return 3.2e19 * Math.sqrt(periodS * periodDerivative);
}

/**
 * The characteristic age, years: P / (2 Pdot), what the spin-down would take from a much
 * faster birth at a constant braking index of 3 (Lorimer & Kramer 2005). The ATNF's AGE.
 * An estimate: the Crab's is 1,257 years, and the supernova that made it was seen in 1054.
 * None where the period does not lengthen -- a pulsar in a cluster can seem to spin up, as
 * the cluster's pull accelerates it toward us.
 */
export function characteristicAgeYears(periodS: number | null, periodDerivative: number | null): number | null {
  if (periodS === null || periodDerivative === null || !(periodDerivative > 0)) {
    return null;
  }
  return periodS / (2 * periodDerivative) / (365.25 * 86_400);
}
