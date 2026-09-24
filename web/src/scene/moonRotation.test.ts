import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { CATALOG } from '@sss/tools/catalog';

import { loadEphemerisStore, type EphemerisStore, type Fetcher } from '../core/ephemerisStore.ts';
import { dateToTdb } from '../core/time.ts';
import {
  bodyOrientation,
  directionToGeographic,
  iauElementsAt,
  obliquityToOrbit,
  planetographicLatitude,
} from './orientation.ts';

/**
 * The moons' rotation, against JPL Horizons.
 *
 * Two questions, asked separately so that neither answer can hide the other:
 *
 *   - **Where does the axis point?** Horizons' own north-pole RA and Dec for each moon
 *     (QUANTITIES='32'). That is the pole with nothing else in the way: no latitude
 *     convention, no shape, no light time worth the name.
 *   - **Which face is turned where?** The sub-planet point -- where the planet stands
 *     overhead -- seen from the planet's own centre (QUANTITIES='14', CENTER at the
 *     planet). For a locked moon it sits near longitude zero by the IAU's own
 *     definition, so it pins W, and the light time across is a second or less.
 *
 * The sub-solar latitude the planets were checked with is deliberately not used. On a
 * body as far from round as Phobos -- 13 x 11.4 x 9.1 km -- a "latitude" depends on which
 * surface point is meant, and trying it compared definitions rather than poles: it came
 * out anywhere from 0.2 to 17 degrees apart while the pole itself agreed to a ten-
 * thousandth.
 *
 * Captured 2026-09-24, for four dates across the moons' window.
 */

const DATES = ['2026-01-15', '2026-05-10', '2026-09-01', '2027-02-20'] as const;

/** Horizons' north pole of each moon, [RA, Dec] in degrees, ICRF. */
const JPL_POLE: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  moon: [[271.35718, 68.05495], [271.66165, 67.97561], [272.03653, 67.8697], [272.61091, 67.69587]],
  phobos: [[317.19867, 51.83872], [316.03753, 52.41401], [316.00103, 53.31325], [317.95264, 53.94122]],
  deimos: [[313.92533, 54.32035], [313.92451, 54.38449], [313.98416, 54.4178], [314.08958, 54.53174]],
  io: [[268.11816, 64.49559], [268.10871, 64.4865], [268.09387, 64.47895], [268.06369, 64.47149]],
  europa: [[267.16814, 64.7567], [267.21059, 64.78122], [267.25636, 64.80428], [267.33192, 64.83649]],
  ganymede: [[268.08304, 64.36173], [268.07526, 64.36144], [268.06744, 64.36123], [268.05546, 64.36107]],
  callisto: [[268.17645, 64.75949], [268.17618, 64.75894], [268.17701, 64.75842], [268.18011, 64.75796]],
  mimas: [[47.84316, 82.22193], [27.19441, 83.32991], [44.58132, 84.98323], [38.58724, 82.00672]],
  enceladus: [[40.65063, 83.51896], [40.65051, 83.51895], [40.6504, 83.51893], [40.65023, 83.51891]],
  tethys: [[34.63614, 84.37191], [38.02728, 84.56799], [41.79386, 84.60127], [46.96532, 84.34374]],
  dione: [[40.65063, 83.51896], [40.65051, 83.51895], [40.6504, 83.51893], [40.65023, 83.51891]],
  rhea: [[43.42877, 83.49164], [43.39555, 83.47244], [43.3533, 83.45365], [43.27233, 83.42586]],
  titan: [[39.4827, 83.4279], [39.4827, 83.4279], [39.4827, 83.4279], [39.4827, 83.4279]],
  iapetus: [[317.13175, 74.73238], [317.11932, 74.72878], [317.10699, 74.72522], [317.0884, 74.71983]],
  miranda: [[253.46929, -13.26016], [253.27943, -13.69522], [253.14094, -14.14403], [253.0299, -14.84215]],
  ariel: [[257.15834, -15.00201], [257.15805, -15.00276], [257.15777, -15.0035], [257.15734, -15.00462]],
  umbriel: [[257.22664, -15.05009], [257.22638, -15.05108], [257.22612, -15.05207], [257.22574, -15.05356]],
  titania: [[257.24832, -14.88176], [257.24738, -14.88249], [257.24646, -14.88321], [257.24507, -14.88431]],
  oberon: [[257.5566, -15.19784], [257.55927, -15.19429], [257.56181, -15.1907], [257.56546, -15.18515]],
  triton: [[304.18216, 20.64058], [304.25059, 20.65068], [304.3184, 20.66083], [304.42063, 20.67641]],
  charon: [[132.993, -6.163], [132.993, -6.163], [132.993, -6.163], [132.993, -6.163]],
};

/**
 * Horizons' sub-planet point, [longitude, latitude] in degrees, in the IAU's convention:
 * longitude runs opposite the rotation -- west-positive for a prograde rotator, east-
 * positive for a retrograde one -- except on the Moon, which like Earth is east-positive
 * by tradition.
 */
const JPL_SUB_PLANET: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  moon: [[359.648911, 6.701951], [352.997879, 1.749137], [355.515088, -5.607588], [1.455861, -0.322075]],
  phobos: [[1.455079, 0.002199], [358.09118, 0.00384], [2.78304, -0.011452], [2.441873, 0.000433]],
  deimos: [[0.010329, 0.007869], [359.996602, -0.017792], [359.95308, -0.011059], [359.98954, 0.011992]],
  io: [[359.920438, 0.001246], [0.323514, 0.002294], [0.005634, -0.00056], [0.85568, -0.005564]],
  europa: [[2.191305, 0.000896], [0.515029, 0.00355], [2.098509, 0.000165], [0.662435, -0.003629]],
  ganymede: [[2.436281, 0.000363], [2.410489, 0.000274], [2.498387, 0.001092], [2.38374, 0.001724]],
  callisto: [[358.860867, 0.003538], [359.418556, 0.006443], [359.968495, 0.004853], [358.723571, 0.00331]],
  mimas: [[351.191803, -0.103887], [353.697292, 0.001631], [350.021012, 0.181424], [350.381055, 0.067878]],
  enceladus: [[4.438095, 0.020408], [4.954775, 0.024328], [4.864058, 0.015177], [3.961106, 0.002152]],
  tethys: [[0.739601, -0.371888], [0.739039, -0.329121], [0.764128, 0.113321], [0.756201, 0.832627]],
  dione: [[0.854075, 0.045324], [0.839831, 0.042008], [0.488302, 0.001232], [0.735041, -0.035409]],
  rhea: [[2.8909, 0.040019], [2.671317, -0.043625], [2.797692, 0.016383], [2.836052, 0.038262]],
  titan: [[0.565742, 0.313167], [356.514221, -0.100078], [354.683131, -0.33378], [357.865118, 0.045512]],
  iapetus: [[1.887688, 0.052103], [4.6118, -0.070343], [0.022124, 0.075867], [2.908832, 0.049291]],
  miranda: [[0.887323, -0.263627], [0.974573, 0.023496], [0.681769, -0.309392], [0.774763, 0.244859]],
  ariel: [[0.791559, -0.172487], [0.893602, 0.246484], [0.841054, 0.024264], [0.855355, -0.242845]],
  umbriel: [[0.727067, 0.210752], [0.563313, -0.013123], [1.35819, 0.002039], [0.493016, 0.009172]],
  titania: [[0.790102, -0.258685], [1.044846, -0.075078], [1.079718, 0.077895], [0.91502, -0.242739]],
  oberon: [[0.924514, 0.014611], [0.688999, 0.056912], [1.030207, -0.00905], [1.027146, 0.246832]],
  triton: [[2.747683, -0.010247], [2.777628, 0.006283], [2.749354, -0.010813], [2.758256, 0.002711]],
  charon: [[1.514036, 0.077335], [1.514498, 0.076534], [1.523612, 0.06763], [1.523162, 0.040994]],
};

const DEG = Math.PI / 180;

function unit(raDeg: number, decDeg: number): [number, number, number] {
  return [
    Math.cos(decDeg * DEG) * Math.cos(raDeg * DEG),
    Math.cos(decDeg * DEG) * Math.sin(raDeg * DEG),
    Math.sin(decDeg * DEG),
  ];
}

function angleDeg(a: readonly number[], b: readonly number[]): number {
  const dot = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  return Math.acos(Math.min(1, Math.max(-1, dot))) / DEG;
}

function separationDeg(a: number, b: number): number {
  const raw = (((a - b) % 360) + 360) % 360;
  return Math.abs(raw > 180 ? raw - 360 : raw);
}

const moons = CATALOG.filter((body) => body.kind === 'moon');

describe("the moons' poles, against JPL", () => {
  it('points every one of the twenty-one axes where JPL does, to a hundredth of a degree', () => {
    for (const body of moons) {
      DATES.forEach((date, index) => {
        const ours = iauElementsAt(dateToTdb(new Date(`${date}T00:00:00Z`)), body);
        const [ra, dec] = JPL_POLE[body.id]![index]!;

        // Measured worst: 0.0021 deg, the Moon, whose IAU pole is itself a series fit.
        expect(
          angleDeg(unit(ours.raDeg, ours.decDeg), unit(ra, dec)),
          `${body.id} ${date}`,
        ).toBeLessThan(0.01);
      });
    }
  });

  it("needs every periodic term: Mimas's pole wanders twenty degrees in four months", () => {
    // Its largest term runs a full circle in a year and swings the pole's right
    // ascension by 13.6 degrees at a declination of 83.5. JPL's own values move 20
    // degrees of right ascension between January and May; dropped, the pole would
    // stand still.
    const mimas = moons.find((body) => body.id === 'mimas')!;
    const still = { ...mimas, rotation: { ...mimas.rotation!, periodicTerms: [] } };
    const [ra, dec] = JPL_POLE['mimas']![1]!;
    const jd = dateToTdb(new Date('2026-05-10T00:00:00Z'));
    const withTerms = iauElementsAt(jd, mimas);
    const without = iauElementsAt(jd, still);

    expect(angleDeg(unit(withTerms.raDeg, withTerms.decDeg), unit(ra, dec))).toBeLessThan(0.01);
    expect(angleDeg(unit(without.raDeg, without.decDeg), unit(ra, dec))).toBeGreaterThan(0.5);
  });
});

const DATA_ROOT = join(import.meta.dirname, '../../public');
const diskFetcher: Fetcher = async (path) =>
  JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown;

async function tryLoad(): Promise<EphemerisStore | null> {
  try {
    return await loadEphemerisStore(diskFetcher, '/');
  } catch {
    return null;
  }
}

const store = await tryLoad();
const describeWithData = store === null ? describe.skip : describe;

/** Where the planet stands overhead, in the IAU convention JPL reports it in. */
async function subPlanetPoint(id: string, date: string): Promise<[number, number] | null> {
  const s = store!;
  const jd = dateToTdb(new Date(`${date}T00:00:00Z`));
  if (!s.isExactAt(jd, [id])) {
    return null;
  }
  await s.whenLoadedAt(jd, [id]);
  const body = s.body(id);
  const toPlanet = s.stateRelativeTo(body.parent!, id, jd)!;
  const { longitudeDeg, latitudeDeg } = directionToGeographic(toPlanet.position, jd, body);
  const east = ((longitudeDeg % 360) + 360) % 360;
  // Opposite the rotation, taken from the sign of the body's own period -- which is
  // exactly what caught the retrograde moons being entered as prograde. The Moon is
  // east-positive by tradition, as Earth is.
  const convention = body.rotationPeriodHours > 0 && id !== 'moon' ? (360 - east) % 360 : east;
  return [convention, planetographicLatitude(latitudeDeg, body)];
}

describeWithData("the moons' faces, against JPL", () => {
  it('turns every moon to the face JPL says its planet sees, to a fiftieth of a degree', async () => {
    for (const body of moons) {
      for (const [index, date] of DATES.entries()) {
        const ours = await subPlanetPoint(body.id, date);
        if (ours === null) {
          // Outside the moon's two-year window; see moons.test.ts on recapturing.
          continue;
        }
        const [lon, lat] = JPL_SUB_PLANET[body.id]![index]!;

        // Measured worst: 0.007 deg of longitude, the Moon; 0.004 of latitude, Phobos.
        // Latitude goes through the planets' planetographic conversion: near the
        // equator, where a locked moon's planet always stands, that is good even on a
        // triaxial body.
        expect(separationDeg(ours[0], lon), `${body.id} ${date} longitude`).toBeLessThan(0.02);
        expect(Math.abs(ours[1] - lat), `${body.id} ${date} latitude`).toBeLessThan(0.01);
      }
    }
  });

  it('keeps the long axis on the planet, which is what being locked means', async () => {
    // Independent of the numbers above. The prime meridian is the long axis, and tides
    // hold it within a few degrees of the planet: the Moon's optical libration is the
    // largest, about 8 degrees, from its 5.5% eccentric orbit. Mimas swings 9 degrees
    // here, dragged back and forth by its resonance with Tethys.
    for (const body of moons) {
      for (const date of DATES) {
        const ours = await subPlanetPoint(body.id, date);
        if (ours !== null) {
          expect(separationDeg(ours[0], 0), `${body.id} ${date}`).toBeLessThan(10);
        }
      }
    }
  });

  it("points the drawn mesh's long axis at the planet, not just the numbers", async () => {
    // The renderer stretches the sphere along local x by a and along local z by b, and
    // bodyOrientation puts local -x on the image's first column -- the prime meridian,
    // for a body with no map. So the stretched axis in the scene is the orientation
    // applied to -x, and for a locked moon it must look at the planet.
    const s = store!;
    for (const id of ['phobos', 'mimas', 'io', 'miranda']) {
      const body = s.body(id);
      const jd = dateToTdb(new Date('2026-05-10T00:00:00Z'));
      if (!s.isExactAt(jd, [id])) {
        continue;
      }
      await s.whenLoadedAt(jd, [id]);
      const longAxis = new THREE.Vector3(-1, 0, 0).applyQuaternion(bodyOrientation(jd, body, 0));
      const toPlanet = s.stateRelativeTo(body.parent!, id, jd)!.position;
      const planetward = new THREE.Vector3(toPlanet.x, toPlanet.y, toPlanet.z).normalize();

      // Mimas's resonance swings it furthest, about 9 degrees.
      expect(longAxis.angleTo(planetward) / DEG, id).toBeLessThan(10);
    }
  });

  it("reproduces the Moon's 6.67 degree obliquity from its pole and its orbit", () => {
    // The catalog's figure, the IAU pole and r x v from DE440 have nothing tying them
    // together except being descriptions of the same Moon.
    const s = store!;
    const jd = dateToTdb(new Date('2026-06-01T00:00:00Z'));
    const moon = s.body('moon');
    const state = s.stateRelativeTo('moon', 'earth', jd)!;
    const measured = obliquityToOrbit(jd, moon, state.position, state.velocity);

    expect(Math.abs(measured - moon.axialTiltDeg!)).toBeLessThan(0.2);
  });
});
