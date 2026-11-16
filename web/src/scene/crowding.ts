/**
 * When a catalogue's faint-galaxy floor stops meaning anything (G4).
 *
 * Every galaxy's point is drawn at least as a faint dot (LocalGroup.tsx FAINT_GALAXY_FLOOR): a
 * choice, so that a dwarf too faint for one exposure is still where it is. It marks one galaxy
 * -- and only while one galaxy can be told from the next on the screen. Pulled back far enough,
 * a catalogue's galaxies fall on the same pixels, and their floors, added up, were a glare:
 * Laniakea's 86,899 dots from 250 billion light years were a white blob with a halo hundreds of
 * pixels wide, where the true light of all of them is far under anything a screen can show
 * (its whole light dimmed by the distance squared). The floor is no light, so it must not add
 * up to one.
 *
 * So each catalogue's floor is kept while its galaxies are apart on the screen and taken away as
 * they crowd: by the mean separation, in pixels, of the nearer half of its galaxies -- those
 * within its half-count radius of the Sun, where it is densest -- as seen from the camera. Whole
 * while they are FLOOR_FULL_SEPARATION_PX apart or more, gone once FLOOR_GONE_SEPARATION_PX: a
 * dot of the floor's size (a sigma of 0.7 px) no longer stands for one galaxy there. Past that
 * each galaxy is its true light alone, which at billions of light years is nothing.
 *
 * From inside the catalogue, or near it, nothing changes: Laniakea's own views keep every dot.
 */

export const FLOOR_FULL_SEPARATION_PX = 2;
export const FLOOR_GONE_SEPARATION_PX = 1;

/** The median distance from the Sun of `count` points, pc: x, y, z each, about the Sun. */
export function halfCountRadiusPc(positionsPc: ArrayLike<number>, count: number, stride = 3): number {
  if (count === 0) return 0;
  const distances = new Float64Array(count);
  for (let k = 0; k < count; k += 1) {
    const at = k * stride;
    distances[k] = Math.hypot(positionsPc[at]!, positionsPc[at + 1]!, positionsPc[at + 2]!);
  }
  distances.sort();
  return distances[count >> 1]!;
}

/** How much of the floor is kept, 1 to 0, the camera `cameraFromSunPc` from the Sun. */
export function floorKept(halfRadiusPc: number, count: number, cameraFromSunPc: number, pixelsPerRadian: number): number {
  if (count < 2 || !(halfRadiusPc > 0) || cameraFromSunPc <= halfRadiusPc) return 1;
  const radiusPx = Math.atan(halfRadiusPc / cameraFromSunPc) * pixelsPerRadian;
  // count / 2 galaxies on a disc of that radius: one per pi r^2 / (count / 2) square pixels.
  const separationPx = radiusPx * Math.sqrt((2 * Math.PI) / count);
  const t = Math.min(1, Math.max(0, (separationPx - FLOOR_GONE_SEPARATION_PX) / (FLOOR_FULL_SEPARATION_PX - FLOOR_GONE_SEPARATION_PX)));
  return t * t * (3 - 2 * t);
}
