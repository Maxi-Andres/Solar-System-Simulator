import { GIANTS } from './localGroup.ts';
import type { StreamTrack } from './streams.ts';

/**
 * Andromeda's Giant Stellar Stream (Ibata et al. 2001, Nature 412, 49): the stars a dwarf
 * galaxy lost falling through Andromeda, strung out six degrees to its south-east -- drawn in
 * the Stellar Streams layer with the Milky Way's (streams.ts), a track of its own beside
 * galstreams' tracks, which are the Milky Way's alone.
 *
 * ## Measured
 *
 * - **Its track**: the 19 subfields of Conn et al. 2016 (MNRAS 458, 3282, Table 1) along it, each
 *   at its centre (xi, eta) on the tangent plane about Andromeda's centre, and at its distance
 *   from the tip of its red giant branch in PAndAS's images -- the inner end 756 kpc away, in
 *   front of Andromeda, the far end 870, 97 kpc behind it and 128 from its centre: it falls away from us about 20 kpc a
 *   degree, as McConnachie et al. 2003 (MNRAS 343, 1335) first found. Where they give two
 *   answers (their dagger-star rows), the one that follows the stream's trend, which they adopt.
 * - **How far, against Andromeda**: their distances are on their own scale, Andromeda at 773
 *   kpc by the same method; each is scaled by the app's Andromeda (Li et al. 2021, 761 kpc) over
 *   theirs, so the stream lies about Andromeda where they measure it, not 12 kpc behind it.
 * - **How wide**: 0.5 deg full width at half maximum across it on the sky (Fardal et al. 2006,
 *   MNRAS 366, 1012, from McConnachie et al.'s fields), about 7 kpc: drawn that wide, as
 *   galstreams' widths are (streams.ts widthPc).
 *
 * Not measured: its depth across the line of sight (drawn as round as it is wide), and its
 * light against the halo streams' -- drawn as faint as they are (scene/Streams.tsx).
 *
 * arXiv: Conn et al. 2016, 1603.00528; McConnachie et al. 2003, astro-ph/0305160; Fardal et al.
 * 2006, astro-ph/0501241.
 */

/** Conn et al. 2016 Table 1: subfield, xi and eta, deg, and distance, kpc. */
export const GSS_FIELDS: readonly (readonly [string, number, number, number])[] = [
  ['GSS1', -0.39, -0.988, 756],
  ['GSS1.5', -0.219, -1.225, 762],
  ['GSS2', -0.047, -1.462, 760],
  ['GSS2.5', 0.125, -1.699, 778],
  ['GSS3', 0.297, -1.937, 787],
  ['GSS3.5', 0.469, -2.174, 795],
  ['GSS4', 0.641, -2.411, 800],
  ['GSS4.5', 0.812, -2.648, 776],
  ['GSS5', 0.984, -2.885, 821],
  ['GSS5.5', 1.156, -3.121, 836],
  ['GSS6', 1.328, -3.358, 859],
  ['GSS6.5', 1.5, -3.594, 825],
  ['GSS7', 1.671, -3.83, 826],
  ['GSS7.5', 1.843, -4.066, 873],
  ['GSS8', 2.015, -4.302, 871],
  ['GSS8.5', 2.186, -4.537, 853],
  ['GSS9', 2.358, -4.772, 844],
  ['GSS9.5', 2.53, -5.007, 847],
  ['GSS10', 2.701, -5.242, 870],
];

/** Andromeda's distance on Conn et al.'s scale, kpc. */
export const CONN_M31_KPC = 773;
/** Its width across, deg: Fardal et al. 2006's FWHM. */
export const GSS_WIDTH_DEG = 0.5;

const DEG = Math.PI / 180;

/** A point on the tangent plane about (ra0, dec0), deg, to its right ascension and declination, deg (the gnomonic projection's inverse). */
export function fromTangentPlane(xiDeg: number, etaDeg: number, ra0Deg: number, dec0Deg: number): { readonly raDeg: number; readonly decDeg: number } {
  const xi = xiDeg * DEG;
  const eta = etaDeg * DEG;
  const dec0 = dec0Deg * DEG;
  const denominator = Math.cos(dec0) - eta * Math.sin(dec0);
  const ra = ra0Deg * DEG + Math.atan2(xi, denominator);
  const dec = Math.atan2(Math.sin(dec0) + eta * Math.cos(dec0), Math.hypot(xi, denominator));
  return { raDeg: ((ra / DEG) % 360 + 360) % 360, decDeg: dec / DEG };
}

/** The stream as a track the Stellar Streams layer draws: one piece, equatorial pc about the Sun. */
export function m31StreamTrack(): StreamTrack {
  const andromeda = GIANTS[0]!;
  const rescale = andromeda.distancePc / (CONN_M31_KPC * 1000);
  const piece: number[] = [];
  for (const [, xi, eta, kpc] of GSS_FIELDS) {
    const { raDeg, decDeg } = fromTangentPlane(xi, eta, andromeda.raDeg, andromeda.decDeg);
    const d = kpc * 1000 * rescale;
    const ra = raDeg * DEG;
    const dec = decDeg * DEG;
    piece.push(d * Math.cos(dec) * Math.cos(ra), d * Math.cos(dec) * Math.sin(ra), d * Math.sin(dec));
  }
  return {
    name: 'Giant Stellar Stream',
    distance: 'track',
    galstreams: '',
    track: 'Conn et al. 2016',
    reference: 'Conn et al. 2016, MNRAS 458, 3282',
    widthDeg: GSS_WIDTH_DEG,
    pieces: [piece],
  };
}
