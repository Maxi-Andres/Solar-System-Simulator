/**
 * How fast things move across the screen, for live mode's frame rate (renderDemand.ts).
 *
 * At real time the scene asks for a frame only once something on it has moved a quarter of a
 * pixel, so every frame it works out how fast the fastest thing it draws is moving, as an
 * angle: radians of the view per simulated second. These are the pieces -- each an upper
 * bound, cheap enough to take for every body every frame. A bound too high costs frames;
 * one too low would cost smoothness, so where the geometry is uncertain they err high.
 *
 * Everything is relative to the camera, which rides with the focused body: the floating
 * origin puts the focus at the origin and the camera at a fixed offset from it, so a body's
 * velocity about the focus is its velocity about the camera.
 */

/**
 * The angular speed of a point at `p` km from the camera moving at `v` km/s relative to it:
 * the transverse part of the velocity over the distance, |p x v| / |p|^2, radians a second.
 */
export function transverseRate(px: number, py: number, pz: number, vx: number, vy: number, vz: number): number {
  const d2 = px * px + py * py + pz * pz;
  if (!(d2 > 0)) {
    return 0;
  }
  const cx = py * vz - pz * vy;
  const cy = pz * vx - px * vz;
  const cz = px * vy - py * vx;
  return Math.sqrt(cx * cx + cy * cy + cz * cz) / d2;
}

/**
 * The angular speed of a turning surface's fastest visible point: the equator's `speedKmS`
 * at the nearest the surface comes to the camera, `distanceKm - radiusKm` -- floored at a
 * thousandth of the radius, for a camera standing on it.
 */
export function surfaceRate(speedKmS: number, radiusKm: number, distanceKm: number): number {
  return Math.abs(speedKmS) / Math.max(distanceKm - radiusKm, radiusKm * 1e-3);
}

/** Degrees a day to radians a second. */
export function degPerDayToRadPerSec(degPerDay: number): number {
  return (degPerDay * Math.PI) / 180 / 86_400;
}

/**
 * The shells a swarm of satellites is bounded in, km from the planet's centre: no orbit
 * inside the first, none of note past the last -- Earth's farthest high orbits reach the
 * Moon's distance, and nothing it tracks orbits beyond.
 */
const SWARM_SHELLS_KM = [6_500, 8_000, 12_000, 20_000, 30_000, 45_000, 70_000, 120_000, 250_000, 500_000, 1_000_000];

/**
 * The fastest a satellite of a swarm round a planet `distanceKm` from the camera can cross
 * the view, radians a second, whichever satellite it is: in each shell none moves faster than
 * escape speed at its inner radius, sqrt(2 mu / r), and none is nearer the camera than the
 * shell's nearest edge. Infinite with the camera inside the swarm, where one may pass at
 * any distance. `extraKmS` is the planet's own speed about the camera.
 */
export function swarmRate(distanceKm: number, muKm3S2: number, extraKmS = 0): number {
  let rate = 0;
  for (let i = 0; i + 1 < SWARM_SHELLS_KM.length; i += 1) {
    const inner = SWARM_SHELLS_KM[i]!;
    const outer = SWARM_SHELLS_KM[i + 1]!;
    const gap = distanceKm > outer ? distanceKm - outer : distanceKm < inner ? inner - distanceKm : 0;
    if (gap <= 0) {
      return Infinity;
    }
    rate = Math.max(rate, (Math.sqrt((2 * muKm3S2) / inner) + extraKmS) / gap);
  }
  return rate;
}

/** Pixels per radian at the centre of a view `heightPx` tall with a vertical field `fovDeg`. */
export function pixelsPerRadian(heightPx: number, fovDeg: number): number {
  return heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
}
