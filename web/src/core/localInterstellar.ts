/**
 * The Sun's surroundings in the interstellar medium, from what is measured of them
 * (scene/LocalInterstellar.tsx draws them; the Local Interstellar Medium layer):
 *
 * - **The Local Bubble**: the cavity of hot, thin gas the Sun sits in, some 100-300 pc across,
 *   blown by supernovae over the last 15 million years, walled by a shell of cold dusty gas.
 *   Drawn as the inner surface of that shell as Pelgrims et al. 2020 (A&A 636, A17) found it in
 *   the 3D dust map of Lallement et al. 2019 -- along each line of sight the first rise of the
 *   dust -- in their spherical-harmonic model to l_max = 6 (tools/src/localInterstellar/
 *   prepareLocalInterstellar.ts). Its edge is measured; it is drawn as a surface, which a
 *   shell's inner edge is not quite: the dust rises over tens of parsecs.
 * - **The Radcliffe Wave**: a 2.7-kpc chain of star-forming clouds -- Orion, Taurus, Perseus,
 *   Cepheus, Cygnus -- undulating above and below the plane (Alves et al. 2020, Nature 578, 237).
 *   Drawn as Konietzka et al. 2024's best-fit model (Nature 628, 62) and its clouds at their
 *   measured places.
 * - **The Local Interstellar Cloud**: the few-parsec cloud of warm, partly ionised gas the Sun
 *   is in now, at its edge. Drawn as the shape Linsky, Redfield & Tilipman 2019 (ApJ 886, 41)
 *   fit to the hydrogen columns towards 62 stars: nine spherical harmonics about a centre.
 *   The fit is a model -- a uniform density assumed, its residuals large (reduced chi^2 8.3).
 *
 * All in heliocentric Galactic Cartesian parsecs: x toward the Galactic centre, y toward
 * l = 90, z toward the north Galactic pole -- the frame scene/galactic.ts GALACTIC_BASIS turns
 * into the scene's.
 */

/** web/public/local-ism/local-ism.json, as tools/src/localInterstellar/prepareLocalInterstellar.ts writes it. */
export interface LocalIsmData {
  readonly bubble: {
    readonly source: string;
    /** The grid's spacing in l and b, degrees. */
    readonly stepDeg: number;
    /** Columns of longitude from l = 0, rows of latitude from b = -90 to +90. */
    readonly nLon: number;
    readonly nLat: number;
    /** The distance to the shell's inner surface, pc, row by row. */
    readonly radiiPc: readonly number[];
  };
  readonly wave: {
    readonly source: string;
    /** The best-fit model: x, y, z (pc) and its vertical velocity (km/s), along the wave. */
    readonly model: readonly (readonly [number, number, number, number])[];
    /** The clouds: name, position and spread, pc. */
    readonly clouds: readonly { readonly name: string; readonly xyz: readonly number[]; readonly spread: readonly number[] }[];
  };
}

const DEG = Math.PI / 180;

/** A unit vector for Galactic l and b, degrees, in heliocentric Galactic Cartesian axes. */
export function galacticUnit(lDeg: number, bDeg: number): [number, number, number] {
  const l = lDeg * DEG;
  const b = bDeg * DEG;
  return [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
}

/** The Local Bubble's inner surface toward (l, b), pc: the grid read bilinearly. */
export function bubbleRadiusPc(bubble: LocalIsmData['bubble'], lDeg: number, bDeg: number): number {
  const { stepDeg, nLon, nLat, radiiPc } = bubble;
  const fx = ((((lDeg % 360) + 360) % 360) / stepDeg);
  const fy = Math.min(nLat - 1, Math.max(0, (bDeg + 90) / stepDeg));
  const i0 = Math.floor(fx) % nLon;
  const i1 = (i0 + 1) % nLon;
  const j0 = Math.min(nLat - 2, Math.floor(fy));
  const tx = fx - Math.floor(fx);
  const ty = fy - j0;
  const at = (i: number, j: number) => radiiPc[j * nLon + i]!;
  return (
    (1 - ty) * ((1 - tx) * at(i0, j0) + tx * at(i1, j0)) + ty * ((1 - tx) * at(i0, j0 + 1) + tx * at(i1, j0 + 1))
  );
}

/** A closed surface as a mesh: positions (pc) and normals, three floats a vertex, and triangles. */
export interface SurfaceMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
}

/**
 * A star-shaped surface about `centre` -- one distance in each direction, `radius(l, b)` -- as a
 * grid of `nLon` by `nLat` vertices, the poles' rows each one point many times; normals from the
 * triangles about each vertex.
 */
export function radialSurface(
  radius: (lDeg: number, bDeg: number) => number,
  nLon: number,
  nLat: number,
  centre: readonly [number, number, number] = [0, 0, 0],
): SurfaceMesh {
  const columns = nLon + 1;
  const positions = new Float32Array(columns * nLat * 3);
  for (let j = 0; j < nLat; j += 1) {
    const b = -90 + (180 * j) / (nLat - 1);
    for (let i = 0; i < columns; i += 1) {
      const l = (360 * i) / nLon;
      const u = galacticUnit(l, b);
      const r = radius(l, b);
      const at = (j * columns + i) * 3;
      positions[at] = centre[0] + r * u[0];
      positions[at + 1] = centre[1] + r * u[1];
      positions[at + 2] = centre[2] + r * u[2];
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < nLat - 1; j += 1) {
    for (let i = 0; i < nLon; i += 1) {
      const a = j * columns + i;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      // Outward-facing, counter-clockwise seen from outside.
      if (j > 0) indices.push(a, b, d);
      if (j < nLat - 2) indices.push(a, d, c);
    }
  }
  const normals = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const [ia, ib, ic] = [indices[t]! * 3, indices[t + 1]! * 3, indices[t + 2]! * 3];
    const e1 = [positions[ib]! - positions[ia]!, positions[ib + 1]! - positions[ia + 1]!, positions[ib + 2]! - positions[ia + 2]!];
    const e2 = [positions[ic]! - positions[ia]!, positions[ic + 1]! - positions[ia + 1]!, positions[ic + 2]! - positions[ia + 2]!];
    const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
    for (const v of [ia, ib, ic]) {
      normals[v] = normals[v]! + n[0]!;
      normals[v + 1] = normals[v + 1]! + n[1]!;
      normals[v + 2] = normals[v + 2]! + n[2]!;
    }
  }
  // The seam's two columns are one place: their normals summed.
  for (let j = 0; j < nLat; j += 1) {
    const first = j * columns * 3;
    const last = (j * columns + nLon) * 3;
    for (let k = 0; k < 3; k += 1) {
      const sum = normals[first + k]! + normals[last + k]!;
      normals[first + k] = sum;
      normals[last + k] = sum;
    }
  }
  // The poles: one point, its normal the direction out.
  for (const j of [0, nLat - 1]) {
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (let i = 0; i < columns; i += 1) {
      const at = (j * columns + i) * 3;
      sx += normals[at]!;
      sy += normals[at + 1]!;
      sz += normals[at + 2]!;
    }
    for (let i = 0; i < columns; i += 1) {
      const at = (j * columns + i) * 3;
      normals[at] = sx;
      normals[at + 1] = sy;
      normals[at + 2] = sz;
    }
  }
  for (let v = 0; v < normals.length; v += 3) {
    const n = Math.hypot(normals[v]!, normals[v + 1]!, normals[v + 2]!) || 1;
    normals[v] = normals[v]! / n;
    normals[v + 1] = normals[v + 1]! / n;
    normals[v + 2] = normals[v + 2]! / n;
  }
  return { positions, normals, indices: Uint32Array.from(indices) };
}

/** The Local Bubble's surface, at its grid's own spacing. */
export function bubbleSurface(bubble: LocalIsmData['bubble']): SurfaceMesh {
  return radialSurface((l, b) => bubbleRadiusPc(bubble, l, b), bubble.nLon, bubble.nLat);
}

// --- The Local Interstellar Cloud ---------------------------------------------------------------

/**
 * Linsky, Redfield & Tilipman 2019 (ApJ 886, 41), Table 3: the LIC's geometric centre about the
 * Sun, pc, and the nine coefficients a_l,m of real spherical harmonics y_l,m, normalised as in
 * Redfield & Linsky 2000 (ApJ 534, 825), Table 6, that give the distance from that centre to the
 * cloud's edge.
 */
export const LIC_CENTRE_PC: readonly [number, number, number] = [-0.8, 0.7, -0.4];
export const LIC_COEFFICIENTS = {
  '0,0': 4.708,
  '1,0': -0.519,
  '1,-1': 0.421,
  '1,1': -0.524,
  '2,0': 0.197,
  '2,-1': -0.36,
  '2,1': 0.172,
  '2,-2': -0.193,
  '2,2': 0.022,
} as const;

/**
 * The fit's own axes, which the paper does not state: the polar axis toward the Galactic
 * centre (+x), the azimuth measured from the south Galactic pole (-z) toward l = 90 (+y), and
 * a_l,m with m > 0 taken with the cosine. Of the 768 ways of laying the nine functions on the
 * Galactic axes, this one gives back the paper's own model distances to the cloud's edge
 * (Table 2, d_edge model) best -- to a median of 0.06 pc for 62 stars, worst 0.7 pc; that
 * Redfield & Linsky 2000 fit their models in this orientation among others is in their Sect. 2.1
 * (core/localInterstellar.test.ts).
 */
function licAngles(dx: number, dy: number, dz: number): { theta: number; phi: number } {
  const q0 = -dz;
  const q1 = dy;
  const q2 = dx;
  const n = Math.hypot(q0, q1, q2) || 1;
  return { theta: Math.acos(Math.max(-1, Math.min(1, q2 / n))), phi: Math.atan2(q1, q0) };
}

/** The distance from the LIC's centre to its edge in the direction (dx, dy, dz), pc. */
export function licRadiusPc(dx: number, dy: number, dz: number): number {
  const { theta, phi } = licAngles(dx, dy, dz);
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const pi = Math.PI;
  const a = LIC_COEFFICIENTS;
  // m > 0 with the cosine, m < 0 with the sine: see licAngles.
  return (
    a['0,0'] * Math.sqrt(1 / (4 * pi)) +
    a['1,0'] * Math.sqrt(3 / (4 * pi)) * c +
    a['1,1'] * Math.sqrt(3 / (4 * pi)) * s * Math.cos(phi) +
    a['1,-1'] * Math.sqrt(3 / (4 * pi)) * s * Math.sin(phi) +
    a['2,0'] * Math.sqrt(5 / (16 * pi)) * (3 * c * c - 1) +
    a['2,1'] * Math.sqrt(15 / (4 * pi)) * s * c * Math.cos(phi) +
    a['2,-1'] * Math.sqrt(15 / (4 * pi)) * s * c * Math.sin(phi) +
    a['2,2'] * Math.sqrt(15 / (16 * pi)) * s * s * Math.cos(2 * phi) +
    a['2,-2'] * Math.sqrt(15 / (16 * pi)) * s * s * Math.sin(2 * phi)
  );
}

/** The LIC's surface about its centre, pc from the Sun. */
export function licSurface(nLon = 72, nLat = 37): SurfaceMesh {
  return radialSurface(
    (l, b) => {
      const [x, y, z] = galacticUnit(l, b);
      return licRadiusPc(x, y, z);
    },
    nLon,
    nLat,
    LIC_CENTRE_PC,
  );
}

/** How far from the Sun, along a line of sight (l, b), the LIC ends: the paper's d_edge, pc. */
export function licEdgeFromSunPc(lDeg: number, bDeg: number): number {
  const u = galacticUnit(lDeg, bDeg);
  const at = (t: number) => {
    const d = [t * u[0] - LIC_CENTRE_PC[0], t * u[1] - LIC_CENTRE_PC[1], t * u[2] - LIC_CENTRE_PC[2]] as const;
    return Math.hypot(d[0], d[1], d[2]) - licRadiusPc(d[0], d[1], d[2]);
  };
  let low = 0;
  let high = 0.02;
  while (high < 20 && at(high) < 0) {
    low = high;
    high += 0.02;
  }
  for (let k = 0; k < 40; k += 1) {
    const mid = (low + high) / 2;
    if (at(mid) < 0) low = mid;
    else high = mid;
  }
  return low;
}

/** The Radcliffe Wave's middle model point, pc: where its name goes. */
export function waveMiddle(wave: LocalIsmData['wave']): readonly [number, number, number] {
  const p = wave.model[Math.floor(wave.model.length / 2)]!;
  return [p[0], p[1], p[2]];
}

/** Whether the data read is what the app expects: a grid that fills its size, a wave with points. */
export function isLocalIsmData(value: unknown): value is LocalIsmData {
  const data = value as LocalIsmData | null;
  return (
    data !== null &&
    typeof data === 'object' &&
    Array.isArray(data.bubble?.radiiPc) &&
    data.bubble.radiiPc.length === data.bubble.nLon * data.bubble.nLat &&
    Array.isArray(data.wave?.model) &&
    data.wave.model.length > 1 &&
    Array.isArray(data.wave.clouds)
  );
}
