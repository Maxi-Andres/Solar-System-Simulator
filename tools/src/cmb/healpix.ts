/**
 * HEALPix in the NESTED ordering, the two conversions the CMB map needs (prepareCmb.ts): a
 * direction to the pixel holding it, and a pixel to its centre.
 *
 * HEALPix (Gorski et al. 2005, ApJ 622, 759) divides the sphere into 12 Nside^2 pixels of equal
 * area: twelve base faces -- four about each pole, four on the equator -- each split into an
 * Nside x Nside grid. NESTED numbers a face's grid along a Z-order curve, the bits of the
 * pixel's x and y interleaved. Both conversions below are the reference library's own (HEALPix
 * C++, healpix_base.cc, loc2pix and pix2loc, NEST branch), written out for TypeScript; the
 * tests check them against each other at every pixel of a small map and against the base
 * pixels' known centres.
 *
 * Coordinates are the library's: theta the colatitude, from the north pole, and phi the
 * longitude, both radians. For a map in Galactic coordinates (COORDSYS 'GALACTIC', as Planck's
 * are), theta = 90 deg - b and phi = l.
 */

/** Spreads the low 16 bits of `v` to the even bits: 0b1011 -> 0b1000101. */
function spreadBits(v: number): number {
  let x = v & 0xffff;
  x = (x | (x << 8)) & 0x00ff00ff;
  x = (x | (x << 4)) & 0x0f0f0f0f;
  x = (x | (x << 2)) & 0x33333333;
  x = (x | (x << 1)) & 0x55555555;
  return x >>> 0;
}

/** The inverse of spreadBits: the even bits of `v`, packed. */
function compressBits(v: number): number {
  let x = v & 0x55555555;
  x = (x | (x >>> 1)) & 0x33333333;
  x = (x | (x >>> 2)) & 0x0f0f0f0f;
  x = (x | (x >>> 4)) & 0x00ff00ff;
  x = (x | (x >>> 8)) & 0x0000ffff;
  return x;
}

function assertNside(nside: number): number {
  const order = Math.log2(nside);
  if (!Number.isInteger(order) || order < 0 || order > 13) {
    throw new Error(`Nside ${nside} is not a power of two up to 8192.`);
  }
  return order;
}

function xyf2nest(nside: number, ix: number, iy: number, face: number): number {
  return face * nside * nside + spreadBits(ix) + 2 * spreadBits(iy);
}

/**
 * The NESTED pixel holding the direction `z = cos(theta)`, `sinTheta`, `phi`. sinTheta is
 * passed rather than worked out from z, as the library does near the poles, where 1 - z loses
 * its digits.
 */
export function ang2pixNest(nside: number, z: number, sinTheta: number, phi: number): number {
  const order = assertNside(nside);
  const za = Math.abs(z);
  const twoPi = 2 * Math.PI;
  let p = phi % twoPi;
  if (p < 0) p += twoPi;
  // In [0, 4): which quarter of the sky, and how far across it.
  const tt = p / (Math.PI / 2);
  if (za <= 2 / 3) {
    // The equatorial belt.
    const temp1 = nside * (0.5 + tt);
    const temp2 = nside * (z * 0.75);
    const jp = Math.floor(temp1 - temp2); // the ascending edge line
    const jm = Math.floor(temp1 + temp2); // the descending one
    const ifp = jp >> order;
    const ifm = jm >> order;
    const face = ifp === ifm ? ifp | 4 : ifp < ifm ? ifp : ifm + 8;
    const ix = jm & (nside - 1);
    const iy = nside - (jp & (nside - 1)) - 1;
    return xyf2nest(nside, ix, iy, face);
  }
  // The polar caps.
  const ntt = Math.min(3, Math.floor(tt));
  const tp = tt - ntt;
  const tmp = (nside * sinTheta) / Math.sqrt((1 + za) / 3);
  const jp = Math.min(nside - 1, Math.floor(tp * tmp));
  const jm = Math.min(nside - 1, Math.floor((1 - tp) * tmp));
  return z >= 0 ? xyf2nest(nside, nside - jm - 1, nside - jp - 1, ntt) : xyf2nest(nside, jp, jm, ntt + 8);
}

/** Each base face's ring number (in units of Nside) and longitude index of its centre. */
const JRLL = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
const JPLL = [1, 3, 5, 7, 0, 2, 4, 6, 1, 3, 5, 7];

/** The centre of NESTED pixel `pix`: z = cos(theta) and phi, radians. */
export function pix2angNest(nside: number, pix: number): { z: number; phi: number } {
  assertNside(nside);
  const npface = nside * nside;
  const face = Math.floor(pix / npface);
  const within = pix - face * npface;
  const ix = compressBits(within);
  const iy = compressBits(within >>> 1);
  const jr = JRLL[face]! * nside - ix - iy - 1;
  let nr: number;
  let z: number;
  let kshift: number;
  if (jr < nside) {
    nr = jr;
    z = 1 - (nr * nr) / (3 * npface);
    kshift = 0;
  } else if (jr > 3 * nside) {
    nr = 4 * nside - jr;
    z = (nr * nr) / (3 * npface) - 1;
    kshift = 0;
  } else {
    nr = nside;
    z = ((2 * nside - jr) * 2) / (3 * nside);
    kshift = (jr - nside) & 1;
  }
  // Integer division, as the library's: the sum is even, so nothing is truncated.
  let jp = Math.trunc((JPLL[face]! * nr + ix - iy + 1 + kshift) / 2);
  if (jp > 4 * nside) jp -= 4 * nside;
  if (jp < 1) jp += 4 * nside;
  return { z, phi: (jp - (kshift + 1) * 0.5) * (Math.PI / 2 / nr) };
}
