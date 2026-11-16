import { tracked } from './loading.ts';
import { equatorialToEcliptic } from '../scene/orientation.ts';
import { vec3 } from './vec3.ts';

/**
 * The halo's stellar streams (Milky Way): the stars a globular cluster or a dwarf galaxy lost to
 * the Milky Way's tides, strung out along its orbit. Each one's track -- its mean path through
 * space -- from the galstreams library (Mateu 2023, MNRAS 520, 5225), as
 * tools/src/streams/prepareStreams.ts made web/public/streams/tracks.json from it: the track its
 * author recommends of every stream with an empirical one, each point its place about the Sun.
 *
 * ## Measured, and not
 *
 * - **Where on the sky** each runs: measured, a fit to its member stars.
 * - **How far**: along most of them measured too (DistanceKind 'track'); for about a third the
 *   library has one distance for the whole stream, its paper's mean ('mean'), so how it runs in
 *   depth is not known; one ('rough') from parallaxes the library flags as uncertain.
 * - **How wide**: on the sky, where galstreams gives a width; turned into parsecs at each point's
 *   distance. Not given for some (Palomar 5's, Orphan–Chenab's): drawn DEFAULT_WIDTH_PC wide.
 * - **How deep across**, along the line of sight: not measured; drawn as round as it is wide.
 * - **How bright**: a stream is far too faint to see -- tens of magnitudes per square arcsecond
 *   fainter than the night sky. Drawn as a faint trail of light so it can be found (STREAM_GAIN).
 */

/** How its distance is known (tools/src/streams/prepareStreams.ts). */
export type StreamDistanceKind = 'track' | 'mean' | 'rough';

export interface StreamTrack {
  readonly name: string;
  readonly distance: StreamDistanceKind;
  /** galstreams' name for it and for its track. */
  readonly galstreams: string;
  readonly track: string;
  readonly reference: string;
  /** Its width on the sky, degrees, or null where none is given. */
  readonly widthDeg: number | null;
  /** Its pieces, each a flat list of x, y, z, pc, ICRS equatorial about the Sun. */
  readonly pieces: readonly (readonly number[])[];
}

export interface StreamsFile {
  readonly source: string;
  readonly licence: string;
  readonly stepDeg: number;
  readonly streams: readonly StreamTrack[];
}

/** The width drawn where none is given, pc: a thin stream's, Palomar 5's tails about this. */
export const DEFAULT_WIDTH_PC = 100;

export function streamsUrl(base: string = import.meta.env.BASE_URL): string {
  return `${base}streams/tracks.json`;
}

let loading: Promise<StreamsFile | null> | null = null;

/** The tracks, fetched once when first asked for; null if they cannot be. */
export function loadStreams(): Promise<StreamsFile | null> {
  loading ??= tracked(
    'the stellar streams',
    fetch(streamsUrl())
      .then((response) => (response.ok ? (response.json() as Promise<StreamsFile>) : null))
      .catch(() => null),
  );
  return loading;
}

/** A point of a track, equatorial pc, in the scene's ecliptic frame, pc. */
export function toScene(x: number, y: number, z: number): [number, number, number] {
  const v = equatorialToEcliptic(vec3(x, y, z));
  return [v.x, v.y, v.z];
}

/**
 * A stream as the scene draws it: points scattered about its track, each with the Gaussian
 * radius it is drawn with, pc; and where its name goes.
 */
export interface StreamParticles {
  /** x, y, z, pc, scene frame about the Sun. */
  readonly positions: Float32Array;
  /** Each particle's Gaussian sigma, pc. */
  readonly sigmas: Float32Array;
  /** Each particle's stream, by index into the file's list. */
  readonly streamIndex: Uint16Array;
  /** Where each stream's name goes -- the middle of its longest piece -- and its two ends, scene pc. */
  readonly labels: readonly { readonly name: string; readonly at: [number, number, number]; readonly ends: [[number, number, number], [number, number, number]]; readonly numbered: boolean }[];
}

/** A small deterministic generator, so the scatter is the same each time. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Particles per width of track: enough that they overlap into a band -- each one's FWHM, 0.83
 * of the width, more than their spacing, half of it -- and no more: a wide stream's particles
 * are large on the screen, and at the galaxy's view they are most of what the layer costs.
 */
export const PARTICLES_PER_WIDTH = 2;
/** sqrt(1/2): a scatter and a size of sigma times this each add, in quadrature, to sigma. */
const SPLIT = Math.SQRT1_2;
/** And at most this many per segment of the track, so a wide one does not cost more than it shows. */
const MAX_PER_SEGMENT = 24;

/**
 * Its full width at a point, pc: its width on the sky at the point's distance, or the default.
 * galstreams' widths are its papers' own measures, mostly a Gaussian's spread across it: drawn as
 * a band that wide, its profile a Gaussian of half that as its sigma.
 */
export function widthPc(stream: StreamTrack, distancePc: number): number {
  return stream.widthDeg === null ? DEFAULT_WIDTH_PC : distancePc * Math.tan((stream.widthDeg * Math.PI) / 180);
}

/** Every stream's particles, in one set of arrays: one draw for all of them. */
export function streamParticles(file: StreamsFile): StreamParticles {
  const positions: number[] = [];
  const sigmas: number[] = [];
  const owners: number[] = [];
  const labels: StreamParticles['labels'][number][] = [];
  const random = mulberry32(20231);
  const gaussian = () => {
    const u = Math.max(random(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
  };
  file.streams.forEach((stream, index) => {
    let longest: readonly number[] | null = null;
    let longestPc = -1;
    for (const piece of stream.pieces) {
      let length = 0;
      // The share of a particle carried to the next segment: a stream wider than a segment is
      // long gets one every half width, not one a segment, each of them large on the screen.
      // Half a particle to start, so even a piece shorter than half its width gets one.
      let carry = 0.5;
      for (let i = 3; i < piece.length; i += 3) {
        const [ax, ay, az] = toScene(piece[i - 3]!, piece[i - 2]!, piece[i - 1]!);
        const [bx, by, bz] = toScene(piece[i]!, piece[i + 1]!, piece[i + 2]!);
        const segment = Math.hypot(bx - ax, by - ay, bz - az);
        length += segment;
        const width = (widthPc(stream, Math.hypot(ax, ay, az)) + widthPc(stream, Math.hypot(bx, by, bz))) / 2;
        // The band's profile across it a Gaussian of half the width as its sigma, split between
        // the particles' scatter and their own size, so it is smooth and not a string of beads.
        const sigma = width / 2;
        const wanted = (PARTICLES_PER_WIDTH * segment) / Math.max(width, 1) + carry;
        const count = Math.min(MAX_PER_SEGMENT, Math.floor(wanted));
        carry = wanted - Math.floor(wanted);
        for (let k = 0; k < count; k += 1) {
          // One in each of `count` equal stretches of the segment: even along it, not in clumps.
          const t = (k + random()) / count;
          // Scattered across the track as its stars are: a Gaussian of its width, every way.
          positions.push(
            ax + (bx - ax) * t + gaussian() * sigma * SPLIT,
            ay + (by - ay) * t + gaussian() * sigma * SPLIT,
            az + (bz - az) * t + gaussian() * sigma * SPLIT,
          );
          sigmas.push(sigma * SPLIT);
          owners.push(index);
        }
      }
      if (length > longestPc) {
        longestPc = length;
        longest = piece;
      }
    }
    if (longest !== null) {
      const mid = Math.floor(longest.length / 6) * 3;
      const last = longest.length - 3;
      labels.push({
        name: stream.name,
        at: toScene(longest[mid]!, longest[mid + 1]!, longest[mid + 2]!),
        ends: [toScene(longest[0]!, longest[1]!, longest[2]!), toScene(longest[last]!, longest[last + 1]!, longest[last + 2]!)],
        // Ibata et al.'s numbered candidates, "C-7", "New-12", "Gaia-3": named only up close.
        numbered: /^(C|New|Gaia)-\d+$/.test(stream.name),
      });
    }
  });
  return {
    positions: new Float32Array(positions),
    sigmas: new Float32Array(sigmas),
    streamIndex: new Uint16Array(owners),
    labels,
  };
}
