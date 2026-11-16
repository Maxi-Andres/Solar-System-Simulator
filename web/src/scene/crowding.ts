import { CMB_FROM_LY } from './cmb.ts';
import { LIGHT_YEAR_KM, PARSEC_KM } from './scale.ts';

/**
 * What a catalogue's faint-galaxy floor adds up to as the catalogue crowds on the screen (G4).
 *
 * Every galaxy's point is drawn at least as a faint dot (LocalGroup.tsx FAINT_GALAXY_FLOOR): a
 * choice, so that a dwarf too faint for one exposure is still where it is. Pulled back far
 * enough, a catalogue's galaxies fall on the same pixels, and their floors, added up whole, were
 * a glare: Laniakea's 86,899 dots from 250 billion light years were a white blob with a halo
 * hundreds of pixels wide, where the true light of all of them is far under anything a screen
 * can show. Taken away outright instead as they closed to a pixel apart, the catalogue went with
 * them -- Laniakea's from a 200-million-light-year scale bar, the SDSS's from a billion -- while
 * it was still a cloud hundreds of pixels across: its true light at billions of light years is
 * nothing, and the floor was all there was of it.
 *
 * So the floor is a surface brightness, not a count. While the nearer half of a catalogue's
 * galaxies -- those within its half-count radius of the Sun, where it is densest -- are
 * FLOOR_FULL_SEPARATION_PX apart or more on the screen, each dot is whole; closer, each is
 * (separation / that)^2 of itself, so the dots on a patch of the screen add up to what they do at
 * that spacing however many fall on it: the catalogue a patch of its own shape and texture,
 * never a slab. The patch goes as it shrinks to a speck -- its half-count radius from
 * SPECK_FULL_PX to SPECK_GONE_PX on the screen, where it says nothing the Sun's own mark does
 * not -- and, whatever its size, as the camera leaves the web for the observable universe: whole
 * to MAP_FULL_LY from the Sun, gone at CMB_FROM_LY, where the last-scattering sphere starts to be
 * drawn. A survey mapped billions of light years deep is still a few hundred pixels across from
 * there; the map yields to the sphere it sits at the centre of.
 *
 * From inside the catalogue, or near it, nothing changes: Laniakea's own views keep every dot.
 */

export const FLOOR_FULL_SEPARATION_PX = 2;
/** A catalogue's half-count radius on the screen, device pixels: whole above the first, gone under the second. */
export const SPECK_FULL_PX = 24;
export const SPECK_GONE_PX = 12;
/** The camera's distance from the Sun, light years: the map whole to the first, gone at the second, smoothly in the logarithm between. */
export const MAP_FULL_LY = 30e9;
export const MAP_GONE_LY = CMB_FROM_LY;

const LIGHT_YEAR_PC = LIGHT_YEAR_KM / PARSEC_KM;

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

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

/** How much of any map of the web is drawn, 1 to 0, the camera `cameraFromSunPc` from the Sun (see above). */
export function mapShown(cameraFromSunPc: number): number {
  const ly = cameraFromSunPc / LIGHT_YEAR_PC;
  if (!(ly > MAP_FULL_LY)) return 1;
  return 1 - smooth((Math.log(ly) - Math.log(MAP_FULL_LY)) / (Math.log(MAP_GONE_LY) - Math.log(MAP_FULL_LY)));
}

/** The radius on the screen, device pixels, of a sphere of `radiusPc` about the Sun; Infinity from inside it. */
function radiusOnScreenPx(radiusPc: number, cameraFromSunPc: number, pixelsPerRadian: number): number {
  return cameraFromSunPc <= radiusPc ? Infinity : Math.atan(radiusPc / cameraFromSunPc) * pixelsPerRadian;
}

/**
 * How much of a catalogue's floor is drawn at all, 1 to 0: gone as it shrinks to a speck and as
 * the camera leaves the web (see above). CosmicWeb.tsx's galaxies take this alone, their
 * crowding measured cell by cell on the screen instead (screenCrowding.ts).
 */
export function floorShown(halfRadiusPc: number, cameraFromSunPc: number, pixelsPerRadian: number): number {
  const map = mapShown(cameraFromSunPc);
  if (!(halfRadiusPc > 0)) return map;
  const r = radiusOnScreenPx(halfRadiusPc, cameraFromSunPc, pixelsPerRadian);
  return map * smooth((r - SPECK_GONE_PX) / (SPECK_FULL_PX - SPECK_GONE_PX));
}

/** The mean separation on the screen, device pixels, of the nearer half of `count` galaxies; Infinity from inside it. */
export function floorSeparationPx(halfRadiusPc: number, count: number, cameraFromSunPc: number, pixelsPerRadian: number): number {
  if (count < 2 || !(halfRadiusPc > 0)) return Infinity;
  // count / 2 galaxies on a disc of that radius: one per pi r^2 / (count / 2) square pixels.
  return radiusOnScreenPx(halfRadiusPc, cameraFromSunPc, pixelsPerRadian) * Math.sqrt((2 * Math.PI) / count);
}

/** How much of each dot's floor is kept, 1 to 0, the camera `cameraFromSunPc` from the Sun (see above). */
export function floorKept(halfRadiusPc: number, count: number, cameraFromSunPc: number, pixelsPerRadian: number): number {
  const separationPx = floorSeparationPx(halfRadiusPc, count, cameraFromSunPc, pixelsPerRadian);
  const share = Math.min(1, (separationPx / FLOOR_FULL_SEPARATION_PX) ** 2);
  return share * floorShown(halfRadiusPc, cameraFromSunPc, pixelsPerRadian);
}

/**
 * Fewer dots rather than fainter ones, under FLOOR_THIN: a dot of the floor much dimmer than that
 * -- a twelfth of its 40 of 255, at the least weight a neighbourless galaxy's dot has (Laniakea.tsx
 * FLOOR_LEAST) -- falls under what the glow buffer keeps (glowBuffer.ts GLOW_FLOOR) and is not
 * drawn at all, and the patch lost most of its light where the galaxies were most alone. So a dot
 * kept less than FLOOR_THIN is drawn at FLOOR_THIN or not at all, kept / FLOOR_THIN of them chosen
 * by a hash of the galaxy's index: the same light on the patch, and the same dots frame to frame.
 * GLSL; `index` the instance's.
 */
export const FLOOR_THIN = 1 / 12;
export const FLOOR_THIN_GLSL = /* glsl */ `
float floorThinned(float kept, int index) {
  if (kept >= ${FLOOR_THIN.toFixed(6)}) return kept;
  uint h = uint(index) * 2654435761u;
  h ^= h >> 15u;
  h *= 2246822519u;
  h ^= h >> 13u;
  return float(h & 0xffffffu) / 16777216.0 < kept / ${FLOOR_THIN.toFixed(6)} ? ${FLOOR_THIN.toFixed(6)} : 0.0;
}
`;

/**
 * The same for a catalogue of lines (CosmicWeb.tsx's filaments), each a constant few pixels wide
 * however far: pulled back, they fall on one another, and their light, added, is a slab and not
 * a web. By how far apart they lie on the screen: the nearer half of the catalogue's length --
 * within its half-length radius of the Sun -- seen from the camera as a patch of its footprint's
 * share of the disc (skyShare^(2/3) of it, as a cone of that share of the sphere's volume would
 * be), crossed by that length foreshortened by pi/4 on average: their separation is the patch's
 * area over that length, in pixels. Whole while `fullPx` apart or more (CosmicWeb.tsx gives each
 * catalogue its own); closer, each line is (separation / that)^2 of itself, so their light on the
 * patch falls as they close up -- a line's light there goes as its length, the lines' as the
 * inverse of their separation -- down to half that spacing; closer still, each line as much
 * dimmer again as they are nearer, so their light on the patch holds at what it is at half:
 * a faint patch of the survey's shape, its texture the lines', rather than a slab or nothing.
 * And gone as the camera leaves the web (mapShown), as the dots are.
 */

/** The lines' mean separation on the screen, pixels (see above); Infinity from inside the half-length radius. */
export function lineSeparationPx(
  halfRadiusPc: number,
  halfLengthPc: number,
  skyShare: number,
  cameraFromSunPc: number,
  pixelsPerRadian: number,
): number {
  if (!(halfRadiusPc > 0) || !(halfLengthPc > 0) || cameraFromSunPc <= halfRadiusPc) return Infinity;
  const r = Math.atan(halfRadiusPc / cameraFromSunPc) * pixelsPerRadian;
  const areaPx = Math.PI * r * r * Math.cbrt(skyShare * skyShare);
  const lengthPx = (halfLengthPc / cameraFromSunPc) * pixelsPerRadian * (Math.PI / 4);
  return areaPx / lengthPx;
}

/** How much of the lines is kept, 1 to 0 (see above), whole while `fullPx` apart. */
export function lineKept(
  halfRadiusPc: number,
  halfLengthPc: number,
  skyShare: number,
  cameraFromSunPc: number,
  pixelsPerRadian: number,
  fullPx: number,
): number {
  const separationPx = lineSeparationPx(halfRadiusPc, halfLengthPc, skyShare, cameraFromSunPc, pixelsPerRadian);
  const share = separationPx >= fullPx ? 1 : separationPx >= fullPx / 2 ? (separationPx / fullPx) ** 2 : separationPx / (2 * fullPx);
  return share * mapShown(cameraFromSunPc);
}
