import { SphereGrid } from '../stars/build3d.ts';
import { LANIAKEA_FLAGS, LANIAKEA_METHODS, type LocalGroupCatalog, type LocalVolumeCatalog } from '../types.ts';
import { asuNumber, type AsuRow } from '../localVolume/asu.ts';
import { separationArcmin } from '../localVolume/hyperleda.ts';
import { MESSIER_BY_NGC, POPULAR, seededNormals, templateColour } from '../localVolume/localVolume.ts';
import {
  C_KM_S,
  comovingDistanceMpc,
  czCmb,
  icrsToGalactic,
  MODULUS_TO_FRACTION,
  modulusToPc,
  sceneAt,
  unitVector,
  type Vec3,
} from './frames.ts';
import type { LedaRecord } from './ledaPgc.ts';

/**
 * Laniakea and what lies about it, out to z ~ 0.1 -- 400 Mpc, 1.3 billion light years: every
 * galaxy Cosmicflows-4 measured a distance to and every galaxy of the 2MASS Redshift Survey,
 * once each, less those local-group.json and local-volume.json already draw, each on its sky
 * position at its distance, with its brightness, colour, size and shape.
 *
 * ## The catalogues
 *
 * - **Cosmicflows-4** (CF4; Tully et al. 2023, ApJ 944, 94; VizieR J/ApJ/944/94): 55,877
 *   galaxies with a measured distance, by eight methods -- the Tully-Fisher relation for
 *   spirals (12,222), the Fundamental Plane for early types (42,223: the SDSS's to z 0.1 in
 *   its footprint, Howlett et al. 2022, and 6dFGS's in the south, Springob et al. 2014), Type
 *   Ia and II supernovae, surface brightness fluctuations, the tip of the red giant branch,
 *   Cepheids, and NGC 4258's maser -- on one zero point, H0 = 74.6 km/s/Mpc. Each galaxy's
 *   distance modulus over all its methods (DM, e_DM), and the group it is in (1PGC, the PGC
 *   number of the group's dominant galaxy); and the 38,053 groups' weighted-mean moduli
 *   (DMzp, e_DMzp) and centres.
 * - **The 2MASS Redshift Survey** (2MRS; Huchra et al. 2012, ApJS 199, 26; VizieR
 *   J/ApJS/199/26): 44,599 galaxies brighter than K_s 11.75 over 91% of the sky, a redshift
 *   for 43,533, the 2MASS photometry (total K_s, corrected for the Galactic extinction in
 *   front), the radius of the K_s 20 mag/arcsec^2 isophote and the axis ratio.
 * - **Tully's 2MASS groups** (Tully 2015, AJ 149, 171; VizieR J/AJ/149/171): the 2MRS galaxies
 *   with their PGC numbers -- matched here to 2MRS by position (30") and K_s (to 0.05 mag; the
 *   two are the same photometry) -- and the "nest" each is in.
 * - **HyperLEDA** (ledaPgc.ts), by PGC number: the name, T type, B and V, the Galactic
 *   extinction, the D25 diameter, axis ratio, position angle and inclination.
 *
 * ## One entry a galaxy
 *
 * By PGC number: a CF4 galaxy is its own; a 2MRS galaxy is the PGC Tully gives it, else the
 * CF4 galaxy within 10" of it, else one of its own named by its 2MASS designation. Left out:
 *
 * - a galaxy local-group.json or local-volume.json draws (fromLocalCatalogues): within half
 *   an arcminute of one; or under the same name within two arcminutes (or half its size); or
 *   within a quarter of the larger one's diameter, with heliocentric velocities within 300
 *   km/s -- and for McConnachie's large dwarfs, within twice its half-light radius with the
 *   velocity agreeing. And M31 (PGC 2557), which the app draws itself. Their Virgo members
 *   with a measured half-light radius are what the sizes here are calibrated on (below);
 * - a 2MRS galaxy not in CF4 with no redshift, or one under 500 km/s in the CMB frame: it
 *   cannot be placed by its redshift (and the Local Volume's are local-volume.json's);
 * - 2MRS's quasars (ZCAT type -9: 3C 273, [HB89] 0759+651, ...), whose light is their
 *   nuclei's, not a galaxy's stars'.
 *
 * Kept, though they are within the Local Volume: the dwarfs found since the UNGC was compiled
 * (2013) that CF4 measured -- Centaurus A's, Pisces A, ... -- which local-volume.json does not
 * hold.
 *
 * ## Distance
 *
 * The scene places each at its comoving distance; a measured modulus gives the luminosity
 * distance, d_L = (1 + z) times that (frames.ts).
 *
 * - **Measured** (CF4): a galaxy whose CF4 group has members besides it is placed at the
 *   group's distance (DISTANCE_GROUP), the weighted mean of its members' -- a single TF or
 *   FP distance is uncertain by 20-25%, 20 Mpc at 100 Mpc, and a group's by far less; alone,
 *   at its own (DISTANCE_OWN). A group's centre is its members' mean direction, not the
 *   groups table's (readCf4Groups: the table puts 165 groups over 2 degrees from their members).
 *   A member projected farther from its group's centre than any group reaches, 7.0 Mpc
 *   (MAX_GROUP_RADIUS_PC: the largest second-turnaround radius among Tully's 2MASS groups),
 *   is not placed with it but by its own measure: CF4 lists a few galaxies tens of degrees
 *   from the rest of their group.
 * - **Linked**: a 2MRS galaxy not in CF4 whose 2MASS nest holds CF4 galaxies is placed at
 *   their CF4 group's distance (the one most of them are in; DISTANCE_LINKED).
 * - **By redshift** (DISTANCE_REDSHIFT, estimated): the CMB-frame redshift -- CF4's Vcmb, or
 *   2MRS's heliocentric cz moved to the CMB frame -- as a comoving distance at H0 74.6 and
 *   Omega_m 0.3. For a galaxy in a 2MASS nest with other galaxies here, the nest's mean
 *   redshift (GROUP_REDSHIFT): a rich cluster's members spread over +-1000 km/s, and placed
 *   each by its own they would string out along the line of sight, the "finger of god"
 *   pointing at the Sun that no cluster has. The error of a redshift distance is the
 *   galaxy's (or group's) peculiar velocity, a few hundred km/s, unknown here: left NaN.
 * - **Depth within a group** (DEPTH_DRAWN, estimated): a group's members share its distance,
 *   which would draw it as a sheet facing the Sun. Each is put in front of or behind it by a
 *   draw from a normal of sigma sqrt(<R^2> / 2), R its members' projected distances from the
 *   group's centre -- a spherical group's line-of-sight spread, as local-volume.json draws
 *   Virgo's -- seeded by the galaxy's name, so every run puts it in the same place.
 *
 * ## Brightness and colour
 *
 * Total apparent V, corrected for the Milky Way's extinction in front and not for the
 * galaxy's own dust, as local-volume.json's. A_V = A_B x 2.742 / 3.626 (Schlafly &
 * Finkbeiner 2011, ApJ 737, 103, Table 6, R_V 3.1).
 *
 * Only a HyperLEDA record of a galaxy (type G, or M, a multiple galaxy) is used: now and then
 * a PGC number's record is a star's (PGC 2944028 is HD 38841), and the galaxy is then known
 * by its 2MASS designation and photometry.
 *
 * 1. HyperLEDA's total V where it has one (V_MEASURED), and B-V from its B too -- if that
 *    B-V is a galaxy's, -0.1 to 1.3 (it is not, where a V was measured on a blend).
 * 2. Else its B, less A_B, less a B-V for the galaxy's type (templateColour: Fukugita et al.
 *    1995's, as the Local Volume's; COLOUR_ESTIMATED). Not behind more than A_B = 1 mag of
 *    dust, where the extinction map is least sure and K sees through.
 * 3. Else 2MRS's K_s plus a V-K_s for its type (V_FROM_K), measured on this run's galaxies
 *    that have both: the median of (B - A_B - (B-V)_type) - K_s over those with A_B < 0.2 and
 *    cz_CMB < 10,000 km/s, in bins of T type (vMinusK). An empirical colour rather than a
 *    template's, because 2MASS's total K misses some of a disc's faint outer light and the
 *    median takes that in.
 *
 * A V from B (1 or 2) that the galaxy's K_s contradicts by more than 1.5 mag -- over three
 * times the V-K_s scatter -- is a blend or a misidentified record, and K_s is used (3).
 *
 * A galaxy with no T type is given its distance method's class for its colour: the
 * Fundamental Plane is measured on early types only (T taken as -3), Tully-Fisher on spirals
 * (T 4); else the median colour of all types.
 *
 * ## Size and shape
 *
 * - **Half-light radius** on the major axis (always estimated): a fraction of the D25 radius,
 *   the fraction measured on the galaxies both this catalogue and local-volume.json's Virgo
 *   members with a measured half-light radius (the EVCC's) hold -- the median, early and
 *   late types apart (halfLightPerR25). Without a D25, from 2MRS's K_s 20 mag/arcsec^2
 *   isophote, scaled to a D25 radius by the median ratio of the two where both are known
 *   (d25PerK20; SIZE_FROM_K). In parsecs at the angular-diameter distance, d_C / (1 + z).
 * - **Axis ratio** HyperLEDA's (B, D25 isophote), else 2MRS's (J+H+K_s); **position angle**
 *   and **inclination** HyperLEDA's.
 *
 * ## The zone of avoidance
 *
 * 2MRS does not survey |b| < 5 deg, nor |b| < 8 deg within 30 deg of the Galactic centre
 * (Huchra et al. 2012): there the Milky Way's dust and stars hide what is behind. Nothing is
 * put there that was not observed; the few galaxies inside are CF4's or 2MRS's own, flagged
 * ZONE_OF_AVOIDANCE, and the web says why the sky is empty there.
 */

// ---------------------------------------------------------------------------------------
// The catalogues, read

export interface Cf4Galaxy {
  readonly pgc: number;
  readonly group: number;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly vCmb: number;
  readonly modulus: number;
  readonly modulusError: number;
  readonly methods: number;
}

export interface Cf4Group {
  readonly pgc1: number;
  readonly members: number;
  readonly modulus: number;
  readonly modulusError: number;
  readonly vCmb: number;
  readonly raDeg: number;
  readonly decDeg: number;
}

export interface TullyGalaxy {
  readonly pgc: number;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly kMag: number | null;
  readonly tType: number | null;
  readonly heliocentricKmS: number | null;
  readonly nest: number;
  readonly nestMembers: number;
  readonly nestPgc1: number;
  /** The nest's masses, 10^12 Msun at H0 = 100 (Tully's); its second-turnaround radius, Mpc at H0 = 100; sigma_p, km/s. */
  readonly nestVirialMass: number | null;
  readonly nestLuminosityMass: number | null;
  readonly nestR2t: number | null;
  readonly nestSigma: number | null;
}

export interface TwoMrsGalaxy {
  readonly id: string;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly lDeg: number;
  readonly bDeg: number;
  readonly kMag: number | null;
  readonly isophoteLogArcsec: number | null;
  readonly axisRatio: number | null;
  readonly type: string;
  readonly cz: number | null;
}

const CF4_METHOD_COLUMNS: readonly [string, number][] = [
  ['DMsnIa', LANIAKEA_METHODS.SNIa],
  ['DMtf', LANIAKEA_METHODS.TF],
  ['DMfp', LANIAKEA_METHODS.FP],
  ['DMsbf', LANIAKEA_METHODS.SBF],
  ['DMsnII', LANIAKEA_METHODS.SNII],
  ['DMtrgb', LANIAKEA_METHODS.TRGB],
  ['DMceph', LANIAKEA_METHODS.Cepheid],
  ['DMmas', LANIAKEA_METHODS.Maser],
];

const required = (row: AsuRow, column: string, what: string): number => {
  const value = asuNumber(row, column);
  if (value === null) {
    throw new Error(`${what} has no ${column}.`);
  }
  return value;
};

export function readCf4Galaxies(rows: readonly AsuRow[]): Cf4Galaxy[] {
  return rows.map((row) => {
    const pgc = required(row, 'PGC', 'A CF4 galaxy');
    const what = `CF4's PGC ${pgc}`;
    let methods = 0;
    for (const [column, bit] of CF4_METHOD_COLUMNS) {
      if (asuNumber(row, column) !== null) {
        methods |= bit;
      }
    }
    return {
      pgc,
      group: required(row, '1PGC', what),
      raDeg: required(row, 'RAJ2000', what),
      decDeg: required(row, 'DEJ2000', what),
      vCmb: required(row, 'Vcmb', what),
      modulus: required(row, 'DM', what),
      modulusError: required(row, 'e_DM', what),
      methods,
    };
  });
}

/** Degrees a CF4 group's catalogued centre may lie from its members' mean before it is reported. */
export const CF4_CENTRE_TOLERANCE_DEG = 2;

/**
 * CF4's groups, each centred on its members. The groups table's own centres (and its
 * galactic and supergalactic ones with them) put some groups -- 165 of 38,053 on VizieR in
 * November 2026, Fornax's among them -- degrees to tens of degrees from every galaxy table2
 * places in them; their moduli agree with their members'. So a group's centre is its
 * members' mean direction here, and its velocity their mean Vcmb; `moved` counts the groups
 * whose catalogued centre was over CF4_CENTRE_TOLERANCE_DEG away.
 */
export function readCf4Groups(rows: readonly AsuRow[], galaxies: readonly Cf4Galaxy[]): { groups: Map<number, Cf4Group>; moved: number } {
  const members = new Map<number, Cf4Galaxy[]>();
  for (const galaxy of galaxies) {
    const list = members.get(galaxy.group) ?? [];
    list.push(galaxy);
    members.set(galaxy.group, list);
  }
  let moved = 0;
  const groups = new Map(
    rows.map((row) => {
      const pgc1 = required(row, '1PGC', 'A CF4 group');
      const what = `CF4's group ${pgc1}`;
      const catalogued = { raDeg: required(row, 'RAJ2000', what), decDeg: required(row, 'DEJ2000', what) };
      const own = members.get(pgc1) ?? [];
      const centre = own.length === 0 ? catalogued : meanDirection(own);
      if (separationArcmin(centre.raDeg, centre.decDeg, catalogued.raDeg, catalogued.decDeg) > CF4_CENTRE_TOLERANCE_DEG * 60) {
        moved += 1;
      }
      return [
        pgc1,
        {
          pgc1,
          members: required(row, 'Ngal', what),
          modulus: required(row, 'DMzp', what),
          modulusError: required(row, 'e_DMzp', what),
          vCmb: own.length === 0 ? required(row, 'Vcmb', what) : own.reduce((sum, g) => sum + g.vCmb, 0) / own.length,
          raDeg: centre.raDeg,
          decDeg: centre.decDeg,
        },
      ];
    }),
  );
  return { groups, moved };
}

/** A T type from -5 to 10, or null (Tully's 99, ZCAT's 98 and its peculiar codes are not types). */
function tTypeOrNull(value: number | null): number | null {
  return value !== null && value >= -6 && value <= 10.5 ? value : null;
}

export function readTullyGalaxies(rows: readonly AsuRow[]): TullyGalaxy[] {
  return rows.flatMap((row) => {
    const ra = asuNumber(row, '_RA.icrs');
    const dec = asuNumber(row, '_DE.icrs');
    if (ra === null || dec === null) {
      return [];
    }
    const pgc = required(row, 'PGC', "A Tully 2015 galaxy");
    return [
      {
        pgc,
        raDeg: ra,
        decDeg: dec,
        kMag: asuNumber(row, 'Kmag'),
        tType: tTypeOrNull(asuNumber(row, 'MType')),
        heliocentricKmS: asuNumber(row, 'HV'),
        nest: asuNumber(row, 'Nest') ?? 0,
        nestMembers: asuNumber(row, 'Nmb') ?? 1,
        nestPgc1: asuNumber(row, 'PGC1') ?? pgc,
        nestVirialMass: asuNumber(row, 'Mvir'),
        nestLuminosityMass: asuNumber(row, 'Mlum'),
        nestR2t: asuNumber(row, 'R2t'),
        nestSigma: asuNumber(row, 'sigP'),
      },
    ];
  });
}

export function readTwoMrs(rows: readonly AsuRow[]): TwoMrsGalaxy[] {
  return rows.map((row) => {
    const id = row['ID'] ?? '';
    const what = `2MRS's ${id}`;
    return {
      id,
      raDeg: required(row, 'RAJ2000', what),
      decDeg: required(row, 'DEJ2000', what),
      lDeg: required(row, 'GLON', what),
      bDeg: required(row, 'GLAT', what),
      kMag: asuNumber(row, 'Ktmag'),
      isophoteLogArcsec: asuNumber(row, 'Riso'),
      axisRatio: asuNumber(row, 'b/a'),
      type: row['type'] ?? '',
      cz: asuNumber(row, 'cz'),
    };
  });
}

/** The T type 2MRS's ZCAT code begins with ("3A2s" is 3, "-5" is -5), or null (98 is unknown). */
export function zcatTType(code: string): number | null {
  const m = /^\s*(-?\d+)/.exec(code);
  return m === null ? null : tTypeOrNull(Number(m[1]));
}

// ---------------------------------------------------------------------------------------
// Names

/** Famous galaxies past the Local Volume, by the name built here: the names the literature uses. */
const POPULAR_FAR: Readonly<Record<string, readonly string[]>> = {
  'NGC 1275': ['Perseus A'],
  'NGC 1316': ['Fornax A'],
  'NGC 1365': ['Great Barred Spiral Galaxy'],
  'NGC 4038': ['Antennae Galaxies'],
  'NGC 4039': ['Antennae Galaxies'],
  'NGC 4676A': ['The Mice'],
  'NGC 4676B': ['The Mice'],
  'ESO 350-40': ['Cartwheel Galaxy'],
  'UGC 10214': ['Tadpole Galaxy'],
  'PGC 54559': ["Hoag's Object"],
  'PGC 63932': ['Cygnus A'],
};

/**
 * HyperLEDA's objname spaced and without padding: "NGC0224" NGC 224, "UGC12889" UGC 12889,
 * "ESO137-006" ESO 137-6, "PGC000004" PGC 4, "MCG-05-33-002" MCG -5-33-2; a Messier galaxy by
 * its Messier number, with its NGC name and common names among the others.
 */
export function ledaDisplayName(objname: string): { name: string; otherNames: string[] } {
  const raw = objname.trim();
  let m: RegExpExecArray | null;
  if ((m = /^(NGC|IC|UGC|PGC|UGCA|DDO|CGCG|KUG|MRK|IRAS|VV|ARP)0*(\d+)([A-Z]?)$/.exec(raw)) !== null) {
    const prefix = m[1] === 'MRK' ? 'Mrk' : m[1] === 'ARP' ? 'Arp' : m[1]!;
    const name = `${prefix} ${m[2]}${m[3]}`;
    const messier = prefix === 'NGC' && m[3] === '' ? MESSIER_BY_NGC[Number(m[2])] : undefined;
    const popular = [...(POPULAR[name] ?? []), ...(POPULAR_FAR[name] ?? [])];
    return messier === undefined ? { name, otherNames: popular } : { name: `M${messier}`, otherNames: [name, ...popular] };
  }
  if ((m = /^ESO0*(\d+)-0*(\d+)([A-Z]?)$/.exec(raw)) !== null) {
    const name = `ESO ${m[1]}-${m[2]}${m[3]}`;
    return { name, otherNames: [...(POPULAR_FAR[name] ?? [])] };
  }
  if ((m = /^MCG([+-])0*(\d+)-0*(\d+)-0*(\d+)$/.exec(raw)) !== null) {
    return { name: `MCG ${m[1]}${m[2]}-${m[3]}-${m[4]}`, otherNames: [] };
  }
  return { name: raw, otherNames: [] };
}

// ---------------------------------------------------------------------------------------
// The match

/** Arcseconds a 2MRS galaxy may lie from Tully's position of it, and how far their K_s may differ. */
export const TULLY_MATCH_ARCSEC = 30;
export const TULLY_MATCH_K = 0.05;
/** Arcseconds a 2MRS galaxy may lie from a CF4 galaxy's centre to be the same. */
export const CF4_MATCH_ARCSEC = 10;
const ARCSEC = Math.PI / 180 / 3600;

/** The entry a 2MRS galaxy is: a PGC number, or null for one of its own. */
export function matchTwoMrs(mrs: readonly TwoMrsGalaxy[], tully: readonly TullyGalaxy[], cf4: readonly Cf4Galaxy[]): { pgc: (number | null)[]; byTully: number; byCf4: number } {
  const tullyGrid = new SphereGrid<TullyGalaxy>(TULLY_MATCH_ARCSEC * ARCSEC * 2);
  for (const t of tully) {
    tullyGrid.add(unitVector(t.raDeg, t.decDeg), t);
  }
  const cf4Grid = new SphereGrid<Cf4Galaxy>(CF4_MATCH_ARCSEC * ARCSEC * 2);
  for (const c of cf4) {
    cf4Grid.add(unitVector(c.raDeg, c.decDeg), c);
  }
  const taken = new Set<number>();
  let byTully = 0;
  let byCf4 = 0;
  const pgc = mrs.map((galaxy) => {
    const u = unitVector(galaxy.raDeg, galaxy.decDeg);
    const t = tullyGrid
      .near(u, TULLY_MATCH_ARCSEC * ARCSEC)
      .find(({ item }) => item.kMag !== null && galaxy.kMag !== null && Math.abs(item.kMag - galaxy.kMag) <= TULLY_MATCH_K + 1e-9 && !taken.has(item.pgc));
    if (t !== undefined) {
      taken.add(t.item.pgc);
      byTully += 1;
      return t.item.pgc;
    }
    const c = cf4Grid.near(u, CF4_MATCH_ARCSEC * ARCSEC).find(({ item }) => !taken.has(item.pgc));
    if (c !== undefined) {
      taken.add(c.item.pgc);
      byCf4 += 1;
      return c.item.pgc;
    }
    return null;
  });
  return { pgc, byTully, byCf4 };
}

// ---------------------------------------------------------------------------------------
// Left out: what G1 and G2 draw

/** A galaxy local-group.json or local-volume.json holds, as the match sees it. */
export interface LocalGalaxy {
  readonly catalogue: 'local-group' | 'local-volume';
  readonly name: string;
  readonly names: readonly string[];
  readonly raDeg: number;
  readonly decDeg: number;
  readonly unit: Vec3;
  /** Diameter, arcmin: the UNGC's Holmberg, or 3 half-light diameters (the EVCC's). */
  readonly sizeArcmin: number;
  /** McConnachie's half-light radius, arcmin; 0 for the Local Volume's. */
  readonly halfLightArcmin: number;
  readonly velocity: number | null;
  /** A measured half-light radius on the major axis, arcmin (the EVCC's): a calibrator. */
  readonly measuredHalfLightArcmin: number | null;
}

export function localGalaxies(lg: LocalGroupCatalog, lv: LocalVolumeCatalog): LocalGalaxy[] {
  const out: LocalGalaxy[] = [];
  for (let i = 0; i < lg.count; i += 1) {
    const rh = lg.halfLightArcmin[i] ?? null;
    out.push({
      catalogue: 'local-group',
      name: lg.name[i]!,
      names: [lg.name[i]!, ...lg.otherNames[i]!],
      raDeg: lg.raDeg[i]!,
      decDeg: lg.decDeg[i]!,
      unit: unitVector(lg.raDeg[i]!, lg.decDeg[i]!),
      sizeArcmin: rh === null ? 0 : 6 * rh,
      halfLightArcmin: rh ?? 0,
      velocity: lg.radialVelocityKmS[i] ?? null,
      measuredHalfLightArcmin: null,
    });
  }
  for (let i = 0; i < lv.count; i += 1) {
    const half = lv.halfLightArcmin[i] ?? null;
    out.push({
      catalogue: 'local-volume',
      name: lv.name[i]!,
      names: [lv.name[i]!, ...lv.otherNames[i]!],
      raDeg: lv.raDeg[i]!,
      decDeg: lv.decDeg[i]!,
      unit: unitVector(lv.raDeg[i]!, lv.decDeg[i]!),
      sizeArcmin: lv.diameterArcmin[i] ?? (half === null ? 0 : 6 * half),
      halfLightArcmin: 0,
      velocity: lv.radialVelocityKmS[i] ?? null,
      measuredHalfLightArcmin: lv.sample[i] === 'evcc' && !lv.halfLightEstimated[i] ? half : null,
    });
  }
  return out;
}

/** M31, which the app draws itself (local-group.json does not list it). */
const DRAWN_BY_THE_APP = new Set([2557]);

/**
 * The local galaxy this candidate is, or null: see the header's rules. `names` are the
 * candidate's names as built here; `sizeArcmin` its D25.
 */
export function fromLocalCatalogues(
  candidate: { raDeg: number; decDeg: number; names: readonly string[]; sizeArcmin: number | null; velocity: number | null },
  locals: readonly LocalGalaxy[],
): LocalGalaxy | null {
  const u = unitVector(candidate.raDeg, candidate.decDeg);
  let best: { local: LocalGalaxy; separation: number } | null = null;
  for (const local of locals) {
    const cos = u[0] * local.unit[0] + u[1] * local.unit[1] + u[2] * local.unit[2];
    // Nothing is matched farther than 3 degrees (McConnachie's largest dwarfs aside, below).
    if (cos < 0.9986 && local.halfLightArcmin < 90) {
      continue;
    }
    const separation = separationArcmin(candidate.raDeg, candidate.decDeg, local.raDeg, local.decDeg);
    const sameVelocity = candidate.velocity === null || local.velocity === null || Math.abs(candidate.velocity - local.velocity) < 300;
    const size = Math.max(candidate.sizeArcmin ?? 0, local.sizeArcmin);
    const same =
      separation < 0.5 ||
      (candidate.names.some((name) => local.names.includes(name)) && separation < Math.max(2, 0.5 * size)) ||
      (separation < 0.25 * size && sameVelocity) ||
      (local.halfLightArcmin > 0 && separation < 2 * local.halfLightArcmin && sameVelocity && candidate.velocity !== null && local.velocity !== null);
    if (same && (best === null || separation < best.separation)) {
      best = { local, separation };
    }
  }
  return best?.local ?? null;
}

// ---------------------------------------------------------------------------------------
// Calibrations

/** T-type bins for V - K_s. */
export const V_MINUS_K_BINS: readonly { readonly bin: string; readonly tMin: number; readonly tMax: number }[] = [
  { bin: 'E', tMin: -Infinity, tMax: -3.5 },
  { bin: 'S0', tMin: -3.5, tMax: -0.5 },
  { bin: 'Sa-Sab', tMin: -0.5, tMax: 2.5 },
  { bin: 'Sb-Sbc', tMin: 2.5, tMax: 4.5 },
  { bin: 'Sc-Sd', tMin: 4.5, tMax: 7.5 },
  { bin: 'Sm-Im', tMin: 7.5, tMax: Infinity },
];
const MIN_COLOUR_CALIBRATORS = 20;
/** A_B past which B is not used for V (the extinction map is least sure there; K sees through). */
export const MAX_EXTINCTION_B_FOR_B = 1;
/** Calibrators' limits: little dust, and near enough that K-corrections hardly differ. */
const CALIBRATION_MAX_AB = 0.2;
const CALIBRATION_MAX_CZ = 10000;

export const A_V_PER_A_B = 2.742 / 3.626;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function rms(values: readonly number[], centre: number): number {
  return Math.sqrt(values.reduce((sum, v) => sum + (v - centre) ** 2, 0) / values.length);
}

/** One galaxy as the calibrations see it. */
export interface ColourCalibrator {
  readonly tType: number;
  readonly vFromB: number;
  readonly kMag: number;
}

export interface VMinusK {
  readonly bin: string;
  readonly tMin: number;
  readonly tMax: number;
  readonly value: number;
  readonly calibrators: number;
  readonly scatter: number;
}

/**
 * V - K_s by T-type bin: the median over the calibrators in each, and over all of them for
 * a galaxy of no type ("all"). A bin with fewer than MIN_COLOUR_CALIBRATORS takes "all"'s.
 */
export function calibrateVMinusK(calibrators: readonly ColourCalibrator[]): VMinusK[] {
  if (calibrators.length < MIN_COLOUR_CALIBRATORS) {
    throw new Error(`Only ${calibrators.length} galaxies with both a B and a K_s to calibrate V - K_s on; expected thousands.`);
  }
  const all = calibrators.map((c) => c.vFromB - c.kMag);
  const allValue = median(all);
  const out: VMinusK[] = V_MINUS_K_BINS.map(({ bin, tMin, tMax }) => {
    const values = calibrators.filter((c) => c.tType >= tMin && c.tType < tMax).map((c) => c.vFromB - c.kMag);
    if (values.length < MIN_COLOUR_CALIBRATORS) {
      return { bin, tMin, tMax, value: allValue, calibrators: values.length, scatter: Number.NaN };
    }
    const value = median(values);
    return { bin, tMin, tMax, value, calibrators: values.length, scatter: rms(values, value) };
  });
  out.push({ bin: 'all', tMin: -Infinity, tMax: Infinity, value: allValue, calibrators: all.length, scatter: rms(all, allValue) });
  return out;
}

export function vMinusKFor(table: readonly VMinusK[], tType: number | null): number {
  const row = tType === null ? undefined : table.find((r) => r.bin !== 'all' && tType >= r.tMin && tType < r.tMax);
  return (row ?? table.find((r) => r.bin === 'all')!).value;
}

export interface SizeCalibrator {
  readonly tType: number | null;
  readonly halfLightArcmin: number;
  readonly r25Arcmin: number;
}

export interface HalfLightRatio {
  readonly bin: string;
  readonly tMin: number;
  readonly tMax: number;
  readonly value: number;
  readonly calibrators: number;
  readonly scatterDex: number;
}

const MIN_SIZE_CALIBRATORS = 10;

function ratioRow(bin: string, tMin: number, tMax: number, ratios: readonly number[]): HalfLightRatio {
  const value = median(ratios);
  const scatterDex = Math.sqrt(ratios.reduce((sum, r) => sum + Math.log10(r / value) ** 2, 0) / ratios.length);
  return { bin, tMin, tMax, value, calibrators: ratios.length, scatterDex };
}

/**
 * The half-light radius over the D25 radius: early types (T < 0) and late (T >= 0) apart,
 * each from its own calibrators if it has MIN_SIZE_CALIBRATORS, else from all of them. Fewer
 * than that in all means the catalogues have changed under it: the run stops.
 */
export function calibrateHalfLight(calibrators: readonly SizeCalibrator[]): HalfLightRatio[] {
  if (calibrators.length < MIN_SIZE_CALIBRATORS) {
    throw new Error(`Only ${calibrators.length} galaxies with a D25 here and a measured half-light radius in local-volume.json; expected over a hundred.`);
  }
  const ratio = (c: SizeCalibrator) => c.halfLightArcmin / c.r25Arcmin;
  const all = ratioRow('all', -Infinity, Infinity, calibrators.map(ratio));
  const early = calibrators.filter((c) => c.tType !== null && c.tType < 0).map(ratio);
  const late = calibrators.filter((c) => c.tType !== null && c.tType >= 0).map(ratio);
  return [
    early.length >= MIN_SIZE_CALIBRATORS ? ratioRow('early (T < 0)', -Infinity, 0, early) : { ...all, bin: 'early (T < 0)', tMin: -Infinity, tMax: 0, calibrators: early.length },
    late.length >= MIN_SIZE_CALIBRATORS ? ratioRow('late (T >= 0)', 0, Infinity, late) : { ...all, bin: 'late (T >= 0)', tMin: 0, tMax: Infinity, calibrators: late.length },
    all,
  ];
}

export function halfLightRatioFor(table: readonly HalfLightRatio[], tType: number | null): number {
  const row = tType === null ? undefined : table.find((r) => r.bin !== 'all' && tType >= r.tMin && tType < r.tMax);
  return (row ?? table.find((r) => r.bin === 'all')!).value;
}

// ---------------------------------------------------------------------------------------
// The build

/** A galaxy as the build assembles it. */
interface Entry {
  readonly key: string;
  readonly pgc: number | null;
  readonly cf4: Cf4Galaxy | null;
  mrs: TwoMrsGalaxy | null;
  tully: TullyGalaxy | null;
}

export interface LaniakeaParts {
  readonly cf4: readonly Cf4Galaxy[];
  readonly cf4Groups: ReadonlyMap<number, Cf4Group>;
  readonly mrs: readonly TwoMrsGalaxy[];
  readonly tully: readonly TullyGalaxy[];
  readonly leda: ReadonlyMap<number, LedaRecord>;
  readonly locals: readonly LocalGalaxy[];
}

/** One galaxy as written. */
export interface PlacedGalaxy {
  readonly name: string;
  readonly otherNames: readonly string[];
  readonly pgc: number;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly position: Vec3;
  readonly distancePc: number;
  readonly luminosityDistancePc: number;
  readonly distanceErrorPc: number;
  readonly ownDistancePc: number;
  readonly z: number;
  readonly absV: number;
  readonly vMag: number;
  readonly bv: number;
  readonly halfLightPc: number;
  readonly axisRatio: number;
  readonly positionAngleDeg: number;
  readonly inclinationDeg: number;
  readonly tType: number;
  readonly kMag: number;
  readonly methods: number;
  readonly flags: number;
  readonly group: number;
}

export interface PlacedGroup {
  readonly source: 'cf4' | '2mass';
  readonly id: number;
  name: string;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly position: Vec3;
  readonly distancePc: number;
  readonly luminosityDistancePc: number;
  readonly distanceErrorPc: number | null;
  readonly distanceEstimated: boolean;
  readonly members: number;
  readonly catalogueMembers: number;
  readonly depthSigmaPc: number | null;
}

export interface LaniakeaBuild {
  readonly galaxies: PlacedGalaxy[];
  readonly groups: PlacedGroup[];
  readonly vMinusK: VMinusK[];
  readonly halfLight: HalfLightRatio[];
  readonly d25PerK20: { value: number; calibrators: number; scatterDex: number };
  readonly counts: Record<string, number>;
  readonly excluded: { local: string[]; drawnByTheApp: number; quasars: number; noRedshift: number; tooNear: number; duplicatePgc: number };
}

/** In the 2MRS zone of avoidance: |b| < 5, or < 8 within 30 degrees of the Galactic centre. */
export const ZONE_OF_AVOIDANCE = { absBDeg: 5, absBNearCentreDeg: 8, nearCentreLDeg: 30 } as const;

export function inZoneOfAvoidance(lDeg: number, bDeg: number): boolean {
  const nearCentre = lDeg < ZONE_OF_AVOIDANCE.nearCentreLDeg || lDeg > 360 - ZONE_OF_AVOIDANCE.nearCentreLDeg;
  return Math.abs(bDeg) < (nearCentre ? ZONE_OF_AVOIDANCE.absBNearCentreDeg : ZONE_OF_AVOIDANCE.absBDeg);
}

/** HyperLEDA object types whose record is a galaxy's: G, and M, a multiple galaxy. */
const GALAXY_TYPES = new Set(['G', 'M']);

/** ZCAT's type -9, which 2MRS gives its quasars (3C 273, [HB89] 0759+651, ...). */
export function isQuasar(zcatType: string): boolean {
  return /^\s*-9(\D|$)/.test(zcatType);
}

/** Magnitudes a V from B may differ from K_s's before K_s is trusted instead. */
export const MAX_V_DISAGREEMENT = 1.5;
/** The B-V a galaxy's integrated light can have, corrected for the dust in front: outside it, HyperLEDA's V is not used. */
export const MIN_GALAXY_BV = -0.1;
export const MAX_GALAXY_BV = 1.3;

/**
 * The farthest a galaxy may lie from its group's centre, projected, to be placed with it: the
 * largest second-turnaround radius among Tully's 2MASS groups, 5.2 Mpc at his H0 100 (Tully
 * 2015), 7.0 Mpc at 74.6.
 */
export const MAX_GROUP_RADIUS_PC = 5.225e6 * (100 / 74.6);

/** A redshift-placed galaxy under this CMB-frame velocity is not placed: the Hubble law says nothing so near. */
export const MIN_REDSHIFT_KM_S = 500;

/** The heliocentric cz of a CMB-frame one, inverting czCmb (to a km/s). */
function czHelioFromCmb(raDeg: number, decDeg: number, cmb: number): number {
  let helio = cmb;
  for (let i = 0; i < 3; i += 1) {
    helio += cmb - czCmb(raDeg, decDeg, helio);
  }
  return helio;
}

/** Mean direction of a set of points on the sky. */
function meanDirection(points: readonly { raDeg: number; decDeg: number }[]): { raDeg: number; decDeg: number } {
  const sum: Vec3 = [0, 0, 0];
  for (const p of points) {
    const u = unitVector(p.raDeg, p.decDeg);
    sum[0] += u[0];
    sum[1] += u[1];
    sum[2] += u[2];
  }
  const r = Math.hypot(sum[0], sum[1]);
  return { raDeg: ((Math.atan2(sum[1], sum[0]) * 180) / Math.PI + 360) % 360, decDeg: (Math.atan2(sum[2], r) * 180) / Math.PI };
}

export function buildLaniakeaGalaxies(parts: LaniakeaParts): LaniakeaBuild {
  const counts: Record<string, number> = {};
  const bump = (key: string, by = 1) => {
    counts[key] = (counts[key] ?? 0) + by;
  };

  // --- One entry a galaxy.
  const entries = new Map<string, Entry>();
  for (const cf4 of parts.cf4) {
    entries.set(`pgc:${cf4.pgc}`, { key: `pgc:${cf4.pgc}`, pgc: cf4.pgc, cf4, mrs: null, tully: null });
  }
  const tullyByPgc = new Map(parts.tully.map((t) => [t.pgc, t]));
  const match = matchTwoMrs(parts.mrs, parts.tully, parts.cf4);
  counts['2mrsMatchedByTully'] = match.byTully;
  counts['2mrsMatchedToCf4ByPosition'] = match.byCf4;
  let duplicatePgc = 0;
  parts.mrs.forEach((mrs, i) => {
    const pgc = match.pgc[i] ?? null;
    const key = pgc === null ? `2mass:${mrs.id}` : `pgc:${pgc}`;
    const existing = entries.get(key);
    if (existing !== undefined) {
      if (existing.mrs !== null) {
        duplicatePgc += 1;
        return;
      }
      existing.mrs = mrs;
      existing.tully = pgc === null ? null : (tullyByPgc.get(pgc) ?? null);
      return;
    }
    entries.set(key, { key, pgc, cf4: null, mrs, tully: pgc === null ? null : (tullyByPgc.get(pgc) ?? null) });
  });
  for (const entry of entries.values()) {
    if (entry.tully === null && entry.pgc !== null) {
      entry.tully = tullyByPgc.get(entry.pgc) ?? null;
    }
  }

  // --- Who is left out; the size calibrators met on the way.
  const excludedLocal: string[] = [];
  const sizeCalibrators: SizeCalibrator[] = [];
  let drawnByTheApp = 0;
  let quasars = 0;
  let noRedshift = 0;
  let tooNear = 0;
  interface Kept {
    readonly entry: Entry;
    readonly leda: LedaRecord | null;
    readonly raDeg: number;
    readonly decDeg: number;
    readonly name: string;
    readonly otherNames: string[];
    readonly cmbKmS: number;
    readonly tType: number | null;
  }
  const kept: Kept[] = [];
  for (const entry of entries.values()) {
    if (entry.pgc !== null && DRAWN_BY_THE_APP.has(entry.pgc)) {
      drawnByTheApp += 1;
      continue;
    }
    const record = entry.pgc === null ? null : (parts.leda.get(entry.pgc) ?? null);
    // HyperLEDA's record of a PGC number is a star, now and then (PGC 2944028 is HD 38841):
    // only a galaxy's (G, or M, a multiple galaxy) lends its name and photometry.
    const leda = record !== null && GALAXY_TYPES.has(record.type) ? record : null;
    if (record !== null && leda === null) {
      bump('HyperLEDA record not a galaxy');
    }
    if (entry.mrs !== null && entry.cf4 === null && isQuasar(entry.mrs.type)) {
      quasars += 1;
      continue;
    }
    const raDeg = entry.cf4?.raDeg ?? entry.mrs!.raDeg;
    const decDeg = entry.cf4?.decDeg ?? entry.mrs!.decDeg;
    const named = leda !== null ? ledaDisplayName(leda.name) : entry.mrs !== null ? { name: `2MASX J${entry.mrs.id}`, otherNames: [] } : { name: `PGC ${entry.pgc}`, otherNames: [] };
    const pgcName = entry.pgc === null ? [] : [`PGC ${entry.pgc}`];
    const otherNames = [...new Set([...named.otherNames, ...pgcName, ...(entry.mrs !== null && named.name !== `2MASX J${entry.mrs.id}` ? [`2MASX J${entry.mrs.id}`] : [])])].filter((n) => n !== named.name);
    const helio = entry.mrs?.cz ?? entry.tully?.heliocentricKmS ?? (entry.cf4 === null ? null : czHelioFromCmb(raDeg, decDeg, entry.cf4.vCmb));
    const d25Arcmin = leda?.logD25 == null ? null : 0.1 * 10 ** leda.logD25;
    const tType = tTypeOrNull(leda?.tType ?? null) ?? entry.tully?.tType ?? (entry.mrs === null ? null : zcatTType(entry.mrs.type));
    const local = fromLocalCatalogues({ raDeg, decDeg, names: [named.name, ...otherNames], sizeArcmin: d25Arcmin, velocity: helio }, parts.locals);
    if (local !== null) {
      excludedLocal.push(`${named.name} = ${local.name}`);
      if (local.measuredHalfLightArcmin !== null && d25Arcmin !== null) {
        sizeCalibrators.push({ tType, halfLightArcmin: local.measuredHalfLightArcmin, r25Arcmin: d25Arcmin / 2 });
      }
      continue;
    }
    const cmbKmS = entry.cf4?.vCmb ?? (helio === null ? null : czCmb(raDeg, decDeg, helio));
    if (cmbKmS === null) {
      noRedshift += 1;
      continue;
    }
    if (entry.cf4 === null && cmbKmS < MIN_REDSHIFT_KM_S) {
      tooNear += 1;
      continue;
    }
    kept.push({ entry, leda, raDeg, decDeg, name: named.name, otherNames, cmbKmS, tType });
  }

  // --- The calibrations.
  const colourCalibrators: ColourCalibrator[] = [];
  const k20Ratios: number[] = [];
  for (const g of kept) {
    const k = g.entry.mrs?.kMag ?? null;
    const { leda } = g;
    if (leda !== null && leda.bMag !== null && leda.extinctionB !== null && k !== null && g.tType !== null) {
      if (leda.extinctionB < CALIBRATION_MAX_AB && g.cmbKmS < CALIBRATION_MAX_CZ) {
        colourCalibrators.push({ tType: g.tType, vFromB: leda.bMag - leda.extinctionB - templateColour(g.tType, '')!, kMag: k });
      }
    }
    const iso = g.entry.mrs?.isophoteLogArcsec ?? null;
    if (leda?.logD25 != null && iso !== null) {
      k20Ratios.push((0.1 * 10 ** leda.logD25 * 30) / 10 ** iso);
    }
  }
  const vMinusK = calibrateVMinusK(colourCalibrators);
  const halfLight = calibrateHalfLight(sizeCalibrators);
  if (k20Ratios.length < MIN_SIZE_CALIBRATORS) {
    throw new Error(`Only ${k20Ratios.length} galaxies with both a D25 and a 2MASS isophote.`);
  }
  const d25PerK20Value = median(k20Ratios);
  const d25PerK20 = {
    value: d25PerK20Value,
    calibrators: k20Ratios.length,
    scatterDex: Math.sqrt(k20Ratios.reduce((sum, r) => sum + Math.log10(r / d25PerK20Value) ** 2, 0) / k20Ratios.length),
  };
  const allColour = median(kept.flatMap((g) => (g.tType === null ? [] : [templateColour(g.tType, '')!])));

  // --- The groups each is placed with.
  const tullyByNest = new Map<number, TullyGalaxy[]>();
  for (const t of parts.tully) {
    if (t.nest > 0) {
      const list = tullyByNest.get(t.nest) ?? [];
      list.push(t);
      tullyByNest.set(t.nest, list);
    }
  }
  const cf4ByPgc = new Map(parts.cf4.map((c) => [c.pgc, c]));
  /** The CF4 group a nest's CF4 galaxies are mostly in, or null. */
  const nestCf4Group = new Map<number, number | null>();
  const cf4GroupOfNest = (nest: number): number | null => {
    if (nestCf4Group.has(nest)) {
      return nestCf4Group.get(nest)!;
    }
    const tally = new Map<number, number>();
    for (const t of tullyByNest.get(nest) ?? []) {
      const c = cf4ByPgc.get(t.pgc);
      if (c !== undefined) {
        tally.set(c.group, (tally.get(c.group) ?? 0) + 1);
      }
    }
    let best: number | null = null;
    for (const [group, n] of tally) {
      const size = (g: number) => parts.cf4Groups.get(g)?.members ?? 0;
      if (best === null || n > tally.get(best)! || (n === tally.get(best)! && size(group) > size(best))) {
        best = group;
      }
    }
    nestCf4Group.set(nest, best);
    return best;
  };
  /** The members within MAX_GROUP_RADIUS_PC of their centre (the CF4 group's, else theirs), judged twice. */
  const withinGroup = (members: readonly Kept[], cf4Group: Cf4Group | undefined): Kept[] => {
    const z = (cf4Group?.vCmb ?? members.reduce((sum, m) => sum + m.cmbKmS, 0) / members.length) / C_KM_S;
    const angularPc =
      cf4Group === undefined ? comovingDistanceMpc(z) * 1e6 / (1 + z) : modulusToPc(cf4Group.modulus) / (1 + z) ** 2;
    const near = (centre: { raDeg: number; decDeg: number }) =>
      members.filter((m) => ((separationArcmin(centre.raDeg, centre.decDeg, m.raDeg, m.decDeg) / 60) * Math.PI) / 180 * angularPc <= MAX_GROUP_RADIUS_PC);
    const first = near(cf4Group ?? meanDirection(members));
    if (first.length === members.length || first.length === 0) {
      return first;
    }
    return near(meanDirection(first));
  };
  const placement = new Map<string, Kept[]>();
  const placementOf = new Map<Kept, string>();
  for (const g of kept) {
    let key: string | null = null;
    if (g.entry.cf4 !== null) {
      // A dozen CF4 galaxies name a group the groups table does not hold: they stand alone.
      key = parts.cf4Groups.has(g.entry.cf4.group) ? `cf4:${g.entry.cf4.group}` : null;
      if (key === null) {
        bump('CF4 group not in the groups table');
      }
    } else if (g.entry.tully !== null && g.entry.tully.nest > 0) {
      const group = cf4GroupOfNest(g.entry.tully.nest);
      key = group !== null && parts.cf4Groups.has(group) ? `cf4:${group}` : `2mass:${g.entry.tully.nest}`;
    }
    if (key !== null) {
      const list = placement.get(key) ?? [];
      list.push(g);
      placement.set(key, list);
      placementOf.set(g, key);
    }
  }

  const groups: PlacedGroup[] = [];
  const groupIndex = new Map<string, number>();
  const groupDistance = new Map<string, { luminosityPc: number; comovingPc: number; errorPc: number | null; z: number; estimated: boolean; raDeg: number; decDeg: number; sigmaPc: number | null }>();
  for (const [key, all] of placement) {
    const [source, idText] = key.split(':') as ['cf4' | '2mass', string];
    // A member farther from its group's centre than any group reaches is not placed with it
    // (MAX_GROUP_RADIUS_PC): CF4 puts a few galaxies tens of degrees from the rest of their
    // group. Judged at the group's provisional distance, then again about the rest's centre.
    const members = withinGroup(all, source === 'cf4' ? parts.cf4Groups.get(Number(idText)) : undefined);
    for (const m of all) {
      if (!members.includes(m)) {
        placementOf.delete(m);
        bump("too far from their group's centre");
      }
    }
    const dissolve = () => {
      for (const m of members) {
        placementOf.delete(m);
      }
    };
    const id = Number(idText);
    let raDeg: number;
    let decDeg: number;
    let z: number;
    let luminosityPc: number;
    let errorPc: number | null;
    let estimated: boolean;
    let catalogueMembers: number;
    if (source === 'cf4') {
      const group = parts.cf4Groups.get(id);
      if (group === undefined) {
        throw new Error(`CF4 galaxy ${members[0]!.name} is in group ${id}, which CF4's groups table does not hold.`);
      }
      // A group of one in CF4 with nobody linked to it is no group: its galaxy stands alone.
      if (members.length === 0 || (group.members < 2 && members.length < 2)) {
        dissolve();
        continue;
      }
      ({ raDeg, decDeg } = members.length < all.length ? meanDirection(members) : group);
      z = group.vCmb / C_KM_S;
      luminosityPc = modulusToPc(group.modulus);
      errorPc = luminosityPc * MODULUS_TO_FRACTION * group.modulusError;
      estimated = false;
      catalogueMembers = group.members;
    } else {
      if (members.length < 2) {
        dissolve();
        continue;
      }
      ({ raDeg, decDeg } = meanDirection(members));
      z = members.reduce((sum, m) => sum + m.cmbKmS, 0) / members.length / C_KM_S;
      luminosityPc = (1 + z) * comovingDistanceMpc(z) * 1e6;
      errorPc = null;
      estimated = true;
      catalogueMembers = members[0]!.entry.tully!.nestMembers;
    }
    const comovingPc = luminosityPc / (1 + z);
    let sigmaPc: number | null = null;
    if (members.length >= 2) {
      const radians = members.map((m) => (separationArcmin(raDeg, decDeg, m.raDeg, m.decDeg) / 60) * (Math.PI / 180));
      const projected = radians.map((r) => (r * comovingPc) / (1 + z));
      sigmaPc = Math.sqrt(projected.reduce((sum, r) => sum + r * r, 0) / projected.length / 2);
    }
    groupDistance.set(key, { luminosityPc, comovingPc, errorPc, z, estimated, raDeg, decDeg, sigmaPc });
    groupIndex.set(key, groups.length);
    groups.push({
      source,
      id,
      name: '',
      raDeg,
      decDeg,
      position: sceneAt(raDeg, decDeg, comovingPc),
      distancePc: comovingPc,
      luminosityDistancePc: luminosityPc,
      distanceErrorPc: errorPc,
      distanceEstimated: estimated,
      members: members.length,
      catalogueMembers,
      depthSigmaPc: sigmaPc,
    });
  }

  // --- Each galaxy, placed.
  const galaxies: PlacedGalaxy[] = kept.map((g) => {
    const { entry, leda } = g;
    let flags = 0;
    if (entry.cf4 !== null) {
      flags |= LANIAKEA_FLAGS.CF4;
    }
    if (entry.mrs !== null) {
      flags |= LANIAKEA_FLAGS.TWO_MRS;
    }
    const key = placementOf.get(g);
    const placed = key === undefined ? undefined : groupDistance.get(key);
    let comovingPc: number;
    let errorPc = Number.NaN;
    let z = g.cmbKmS / C_KM_S;
    if (placed !== undefined) {
      z = placed.z;
      comovingPc = placed.comovingPc;
      errorPc = placed.errorPc ?? Number.NaN;
      if (entry.cf4 !== null) {
        flags |= parts.cf4Groups.get(entry.cf4.group)!.members >= 2 ? LANIAKEA_FLAGS.DISTANCE_GROUP : LANIAKEA_FLAGS.DISTANCE_OWN;
      } else if (key!.startsWith('cf4:')) {
        flags |= LANIAKEA_FLAGS.DISTANCE_LINKED;
      } else {
        flags |= LANIAKEA_FLAGS.DISTANCE_REDSHIFT | LANIAKEA_FLAGS.GROUP_REDSHIFT;
      }
      if (placed.sigmaPc !== null) {
        comovingPc = Math.max(0.05 * comovingPc, comovingPc + placed.sigmaPc * seededNormals(`${g.name} ${entry.key}`)());
        flags |= LANIAKEA_FLAGS.DEPTH_DRAWN;
      }
    } else if (entry.cf4 !== null) {
      const luminosityPc = modulusToPc(entry.cf4.modulus);
      comovingPc = luminosityPc / (1 + z);
      errorPc = luminosityPc * MODULUS_TO_FRACTION * entry.cf4.modulusError;
      flags |= LANIAKEA_FLAGS.DISTANCE_OWN;
    } else {
      comovingPc = comovingDistanceMpc(z) * 1e6;
      flags |= LANIAKEA_FLAGS.DISTANCE_REDSHIFT;
    }
    const luminosityPc = (1 + z) * comovingPc;
    const { lDeg, bDeg } = entry.mrs !== null ? { lDeg: entry.mrs.lDeg, bDeg: entry.mrs.bDeg } : icrsToGalactic(g.raDeg, g.decDeg);
    if (inZoneOfAvoidance(lDeg, bDeg)) {
      flags |= LANIAKEA_FLAGS.ZONE_OF_AVOIDANCE;
    }

    // Brightness and colour.
    const methods = entry.cf4?.methods ?? 0;
    const classT = g.tType ?? (methods & LANIAKEA_METHODS.FP && !(methods & LANIAKEA_METHODS.TF) ? -3 : methods & LANIAKEA_METHODS.TF ? 4 : null);
    const typeColour = classT === null ? allColour : templateColour(classT, '')!;
    const kMag = entry.mrs?.kMag ?? entry.tully?.kMag ?? null;
    const ab = leda?.extinctionB ?? null;
    const vFromK = kMag === null ? null : kMag + vMinusKFor(vMinusK, classT);
    let vMag = Number.NaN;
    let bv = typeColour;
    const measuredV = leda?.vMag != null && leda.bMag !== null && ab !== null ? leda.vMag - ab * A_V_PER_A_B : null;
    const measuredBv = measuredV === null ? null : leda!.bMag! - ab! - measuredV;
    const fromB = leda?.bMag != null && ab !== null && ab <= MAX_EXTINCTION_B_FOR_B ? leda.bMag - ab - typeColour : null;
    // A V from B that 2MASS's K_s contradicts by more than MAX_V_DISAGREEMENT -- three and
    // more times the V-K_s scatter -- is a blend or a misidentified record: K_s is used.
    const agrees = (v: number) => vFromK === null || Math.abs(v - vFromK) <= MAX_V_DISAGREEMENT;
    if (measuredV !== null && measuredBv !== null && ab! <= MAX_EXTINCTION_B_FOR_B && measuredBv >= MIN_GALAXY_BV && measuredBv <= MAX_GALAXY_BV && agrees(measuredV)) {
      vMag = measuredV;
      bv = measuredBv;
      flags |= LANIAKEA_FLAGS.V_MEASURED;
    } else if (fromB !== null && agrees(fromB)) {
      vMag = fromB;
      flags |= LANIAKEA_FLAGS.COLOUR_ESTIMATED;
    } else if (kMag !== null) {
      if (fromB !== null) {
        bump('V from K: B disagreed');
      }
      vMag = vFromK!;
      flags |= LANIAKEA_FLAGS.V_FROM_K | LANIAKEA_FLAGS.COLOUR_ESTIMATED;
    } else if (leda?.bMag != null && ab !== null) {
      // Behind thick dust with no K: B is all there is.
      vMag = leda.bMag - ab - typeColour;
      flags |= LANIAKEA_FLAGS.COLOUR_ESTIMATED;
    } else {
      flags |= LANIAKEA_FLAGS.COLOUR_ESTIMATED;
    }
    const absV = Number.isFinite(vMag) ? vMag - 5 * Math.log10(luminosityPc / 10) : Number.NaN;

    // Size and shape.
    const angularPc = comovingPc / (1 + z);
    let r25Arcmin: number | null = leda?.logD25 == null ? null : (0.1 * 10 ** leda.logD25) / 2;
    const iso = entry.mrs?.isophoteLogArcsec ?? null;
    if (r25Arcmin === null && iso !== null) {
      r25Arcmin = (d25PerK20.value * 10 ** iso) / 60;
      flags |= LANIAKEA_FLAGS.SIZE_FROM_K;
    }
    const halfLightArcmin = r25Arcmin === null ? null : halfLightRatioFor(halfLight, classT) * r25Arcmin;
    const halfLightPc = halfLightArcmin === null ? Number.NaN : ((halfLightArcmin / 60) * Math.PI) / 180 * angularPc;
    const axisRatio = leda?.logR25 != null ? 10 ** -leda.logR25 : (entry.mrs?.axisRatio ?? Number.NaN);
    const pa = leda?.positionAngleDeg == null ? Number.NaN : ((leda.positionAngleDeg % 180) + 180) % 180;

    const index = key === undefined ? undefined : groupIndex.get(key);
    return {
      name: g.name,
      otherNames: g.otherNames,
      pgc: entry.pgc ?? 0,
      raDeg: g.raDeg,
      decDeg: g.decDeg,
      position: sceneAt(g.raDeg, g.decDeg, comovingPc),
      distancePc: comovingPc,
      luminosityDistancePc: luminosityPc,
      distanceErrorPc: errorPc,
      ownDistancePc: entry.cf4 === null ? Number.NaN : modulusToPc(entry.cf4.modulus),
      z: g.cmbKmS / C_KM_S,
      absV,
      vMag,
      bv,
      halfLightPc,
      axisRatio,
      positionAngleDeg: pa,
      inclinationDeg: leda?.inclinationDeg ?? Number.NaN,
      tType: g.tType ?? Number.NaN,
      kMag: kMag ?? Number.NaN,
      methods,
      flags,
      group: index ?? -1,
    };
  });

  // Most luminous first, those with no V last.
  const order = galaxies.map((_, i) => i).sort((a, b) => {
    const va = galaxies[a]!.absV;
    const vb = galaxies[b]!.absV;
    if (Number.isNaN(va) || Number.isNaN(vb)) {
      return Number.isNaN(va) ? (Number.isNaN(vb) ? 0 : 1) : -1;
    }
    return va - vb;
  });
  const sorted = order.map((i) => galaxies[i]!);
  // A group is named for its most luminous member here.
  for (const galaxy of sorted) {
    if (galaxy.group >= 0 && groups[galaxy.group]!.name === '') {
      groups[galaxy.group]!.name = galaxy.name;
    }
  }
  for (const [flag, bit] of Object.entries(LANIAKEA_FLAGS)) {
    counts[flag] = sorted.filter((g) => (g.flags & bit) !== 0).length;
  }
  for (const [method, bit] of Object.entries(LANIAKEA_METHODS)) {
    counts[`method ${method}`] = sorted.filter((g) => (g.methods & bit) !== 0).length;
  }
  counts['no V'] = sorted.filter((g) => Number.isNaN(g.absV)).length;
  counts['no size'] = sorted.filter((g) => Number.isNaN(g.halfLightPc)).length;
  counts['position angle'] = sorted.filter((g) => !Number.isNaN(g.positionAngleDeg)).length;
  counts['T type'] = sorted.filter((g) => !Number.isNaN(g.tType)).length;
  bump('excluded: local catalogues', excludedLocal.length);
  return {
    galaxies: sorted,
    groups,
    vMinusK,
    halfLight,
    d25PerK20,
    counts,
    excluded: { local: excludedLocal, drawnByTheApp, quasars, noRedshift, tooNear, duplicatePgc },
  };
}
