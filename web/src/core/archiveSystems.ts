import type { BodyId } from '@sss/tools/types';

import { temperatureToColorIndex } from '../scene/blackbody.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { archiveSystem, archiveSystemKey, type ExoplanetArchive } from './exoplanetArchive.ts';
import { addPlanets, registerPlanetarySystem, registeredSystem, type PlanetarySystem } from './planetarySystems.ts';
import { addStarRecordBody, setStarDisc, starBodyDefinition } from './starBodies.ts';
import { julianYearsSinceJ2000, KM_S_TO_PC_PER_YEAR, PARSEC_KM, type Stars3dSource } from './stars3d.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * An Exoplanet Archive system made real when it is gone to (D4b): its star a body with
 * the Archive's radius and mass, its planets on their orbits about it -- as the curated
 * systems are at start (planetarySystems.ts), but one at a time, on demand, for any of the
 * 4,800.
 *
 * ## The star
 *
 * Where the host is one of the 3D stars (exoplanets.json gives its record), it becomes that
 * star's body, so the point that was drawn is the star gone to, and it moves as its record
 * does. Its size and mass are the Archive's (`st_rad`, `st_mass`): published values,
 * mostly from spectroscopy and stellar models rather than an interferometer, and the panel
 * says whose. With a radius it is a disc, as the curated stars are.
 *
 * Any other host -- past the 100-pc census and fainter than the sky's V 8 -- is a body of
 * its own (`exo-host-<k>`), on the straight line the Archive's position, distance and
 * motion give (exoplanets/buildExoplanets.ts), coloured by its effective temperature. No
 * point is drawn for it among the stars: none of the catalogues the stars come from has it
 * placed. So it is a disc, close up, and its marker on the map; the panel says it is
 * placed from the Archive. The same holds for every host while exoplanets.json and the 3D
 * stars are from different runs, when the records it names may be other stars'.
 *
 * Hosts stay bodies once made, pinned as the curated stars are: a system gone to is a
 * system one may go back to, and its planets need it.
 */

/** A host's body id where it is not one of the 3D stars. */
export function archiveHostBodyId(host: number): BodyId {
  return `exo-host-${host}`;
}

/** The nominal solar radius, km (IAU 2015 B3). */
const SOLAR_RADIUS_KM = 695_700;
/** The Sun's GM, km^3/s^2 (IAU 2015 B3 nominal), as starBodies.ts takes a mass. */
const GM_SUN = 1.3271244e11;

/** Whether the hosts' 3D records can be trusted: exoplanets.json was matched against these 3D stars. */
export async function recordsAgree(archive: ExoplanetArchive, stars3d: Stars3dSource | null): Promise<boolean> {
  if (stars3d === null || archive.catalog.stars3dQueriedAt === null) {
    return false;
  }
  const info = await stars3d.info();
  if (info === null || info.queriedAt !== archive.catalog.stars3dQueriedAt) {
    if (info !== null) {
      console.warn(
        'exoplanets.json was matched against other 3D stars than these: every host is placed from the Archive.',
      );
    }
    return false;
  }
  return true;
}

/** A host's state about the Sun at `jd`, km and km/s, from exoplanets.json's straight line. */
export function archiveHostState(archive: ExoplanetArchive, h: number, jd: number): StateVector | null {
  const { hosts } = archive.catalog;
  const x = hosts.x[h];
  const y = hosts.y[h];
  const z = hosts.z[h];
  if (x == null || y == null || z == null) {
    return null;
  }
  const vx = hosts.vx[h] ?? 0;
  const vy = hosts.vy[h] ?? 0;
  const vz = hosts.vz[h] ?? 0;
  const motion = julianYearsSinceJ2000(jd) * KM_S_TO_PC_PER_YEAR;
  return {
    position: { x: (x + vx * motion) * PARSEC_KM, y: (y + vy * motion) * PARSEC_KM, z: (z + vz * motion) * PARSEC_KM },
    velocity: { x: vx, y: vy, z: vz },
  };
}

/** The unit direction from the Sun to a host at J2000; null where it is not placed. */
function directionTo(archive: ExoplanetArchive, h: number): Vec3 | null {
  const { hosts } = archive.catalog;
  const x = hosts.x[h];
  const y = hosts.y[h];
  const z = hosts.z[h];
  if (x == null || y == null || z == null) {
    return null;
  }
  const length = Math.hypot(x, y, z);
  return { x: x / length, y: y / length, z: z / length };
}

/**
 * Makes host `h` and its planets bodies, if they are not yet, and returns the system with
 * its star's body id; null for a host that cannot be placed. `keep` is the body the camera
 * is on, which the star queue must not drop (starBodies.ts).
 */
export async function ensureArchiveSystem(
  store: EphemerisStore,
  archive: ExoplanetArchive,
  h: number,
  stars3d: Stars3dSource | null,
  keep: BodyId,
): Promise<{ readonly system: PlanetarySystem; readonly host: BodyId } | null> {
  const { catalog } = archive;
  const { hosts } = catalog;
  const done = registeredSystem(archiveSystemKey(h));
  if (done !== null && store.isPropagatedBody(done.host)) {
    return done;
  }
  const toward = directionTo(archive, h);
  if (toward === null) {
    return null;
  }
  const tier = hosts.tier[h]!;
  const index = hosts.index[h]!;
  const fromRecord = tier >= 0 && index >= 0 && stars3d !== null && (await recordsAgree(archive, stars3d));
  const system = archiveSystem(catalog, h, !fromRecord);
  const massSun = system.hostMassSun > 0 ? system.hostMassSun : null;
  let host: BodyId;
  if (fromRecord && stars3d !== null) {
    host = await addStarRecordBody(
      store,
      stars3d,
      tier,
      index,
      {
        display: hosts.name[h]!,
        iau: false,
        // Its Gaia and HIP numbers the panel reads from the star's own details: not twice.
        designations: (hosts.designations[h] ?? []).filter((name) => !/^(Gaia DR3|HIP) /.test(name)),
        system: null,
        nearest: null,
        spectralType: hosts.spectralType[h] ?? null,
      },
      keep,
      true,
      massSun,
      system.hostRadiusSun,
    );
  } else {
    host = archiveHostBodyId(h);
    if (!store.isPropagatedBody(host)) {
      const teff = hosts.teffK[h];
      // B-V from the effective temperature, so the colour takes every other star's path; a
      // star the Archive gives no temperature takes the Sun's 0.65, and its panel says so.
      const colorIndex = teff == null ? 0.65 : temperatureToColorIndex(teff);
      const radius = system.hostRadiusSun;
      if (radius !== null) {
        setStarDisc(host, colorIndex);
      }
      store.addPropagatedBody(
        starBodyDefinition(host, hosts.name[h]!, colorIndex, radius === null ? null : radius * SOLAR_RADIUS_KM, massSun),
        null,
        (jd) => archiveHostState(archive, h, jd)!,
        { exact: true },
      );
    }
  }
  registerPlanetarySystem(system, host, toward);
  if (massSun !== null) {
    addPlanets(store, host, system.planets, massSun * GM_SUN);
  }
  return { system, host };
}
