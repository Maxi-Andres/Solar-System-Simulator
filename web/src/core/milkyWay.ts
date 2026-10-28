/**
 * The Milky Way past the star catalogue: a model built from published structure (D2b).
 *
 * **A model, and drawn as one.** Gaia maps the stars of the nearest few thousand light
 * years one by one; nothing maps the galaxy that way, and two thirds of it lies behind the
 * dust of its own centre as seen from here. What *is* measured is its shape: how the
 * stars thin out with distance from the centre and from the plane, where the bar lies and
 * how long it is, and where the spiral arms run, traced by the parallaxes of masers in
 * young star-forming regions. This module turns those numbers into points to draw -- a
 * sample of the shape, each point a stand-in for a cloud of millions of stars, never a
 * star. Inside the hundred-parsec census, where the real stars are, it draws nothing.
 *
 * ## Sources, read in the papers themselves (2026-10-28)
 *
 * - **Spiral arms.** Reid, Menten, Brunthaler et al. 2019, ApJ 885, 131, Table 2: seven
 *   arms as log-periodic spirals with one kink each,
 *
 *       ln(R / R_kink) = -(beta - beta_kink) tan psi,
 *
 *   beta the Galactocentric azimuth, zero toward the Sun and increasing in the direction
 *   of Galactic rotation, psi = psi< up to the kink and psi> past it, and a Gaussian
 *   width w(R_kink) + 42 pc/kpc (R - R_kink). The table's beta range is where parallaxes
 *   were measured. Past it the same spiral is carried on, fading (armTaper), as
 *   the paper's own figure carries its grey spirals: the far side of the galaxy has no
 *   parallaxes yet, and the picture should not pretend it does.
 * - **Discs, bulge and bar.** Bland-Hawthorn & Gerhard 2016, ARA&A 54, 529, the
 *   "best values" boxes of sections 4 and 5: thin disc scale length 2.6 kpc and height
 *   300 pc; thick disc 2.0 kpc and 900 pc; the box/peanut bulge at 27 degrees, 0.5 wide
 *   and 0.26 tall for its length, 180 pc thick; the long bar 5.0 kpc in half-length at
 *   28-33 degrees, 180 pc thick; the Sun 25 pc above the plane.
 * - **Dust.** Drimmel & Spergel 2001, ApJ 556, 181, Table 1, the disc component of their
 *   dust model fitted to COBE's far-infrared sky: exponential in radius with scale length
 *   2.26 kpc, sech^2 in height with scale 134.4 pc out to 4.40 kpc and flaring by
 *   14.8 pc per kpc beyond, and a hole inside half the Sun's radius. Their arms follow an
 *   older geometry; here the dust of the arms lies along Reid's arms, on their inner
 *   edges, where the dust lanes of trailing spirals are seen in every other galaxy.
 *
 * ## What is chosen, not measured
 *
 * How much light each population gives, the colours of the old ones, the clumping of the
 * arms into star-forming knots, and how dark the dust is drawn. They are set by eye
 * against photographs of barred spirals seen face-on and said to be so, here and in the
 * About panel. The knots are real in kind -- the arms are strings of OB associations and
 * HII regions, thousands of them -- but not in place: nothing here is a particular one.
 *
 * ## The centre's distance
 *
 * R0 is Reid's 8.15 kpc, because the arms were fitted with it: the masers' parallaxes are
 * distances from the Sun, and changing R0 under the fitted spirals would move the arms
 * off the stars that define them. GRAVITY's 8.275 kpc (2021) puts the centre 125 pc
 * farther; the black hole at it is D5's to place.
 *
 * ## Frame and units
 *
 * Positions are parsecs about the Sun in the galactic frame -- x toward the centre, y
 * toward l = 90 (the direction of rotation), z toward the north galactic pole -- the
 * frame galactic.ts places in the scene. Seen from the north pole the galaxy turns
 * clockwise, so a Galactocentric radius R and azimuth beta sit at
 *
 *     x = R0 - R cos(beta),   y = R sin(beta)
 *
 * which puts beta = 0 at the Sun and moves forward in beta along +y, as Reid defines it.
 * The plane passes 25 pc below the Sun and through the centre.
 */

/** Distance from the Sun to the Galactic centre in the model, pc (Reid et al. 2019). */
export const R0_PC = 8150;

/** The Sun's height above the plane, pc (Bland-Hawthorn & Gerhard 2016, 25 +- 5). */
export const SUN_ABOVE_PLANE_PC = 25;

/** Thin and thick disc, pc (Bland-Hawthorn & Gerhard 2016, section 5). */
export const THIN_DISC = { scaleLengthPc: 2600, scaleHeightPc: 300 } as const;
export const THICK_DISC = { scaleLengthPc: 2000, scaleHeightPc: 900 } as const;

/**
 * The box/peanut bulge (Bland-Hawthorn & Gerhard 2016, 4.2.1): angle 27 deg to the
 * Sun-centre line, axis ratios 0.5 from above and 0.26 edge-on, 180 pc thick at its
 * middle. The length follows from the last two: 180 / 0.26.
 */
export const BULGE = {
  angleDeg: 27,
  scaleZPc: 180,
  scaleXPc: 180 / 0.26,
  scaleYPc: (180 / 0.26) * 0.5,
} as const;

/**
 * The long bar (Bland-Hawthorn & Gerhard 2016, 4.3): half-length 5.0 kpc, at 28-33 deg
 * -- the middle taken -- and 180 pc thick. Its width in the plane is not among the best
 * values; a tenth of its length, the proportion of the bars of other galaxies seen face-on,
 * is this model's assumption and is named as one.
 */
export const LONG_BAR = {
  angleDeg: 30.5,
  halfLengthPc: 5000,
  scaleZPc: 180,
  widthPc: 500,
} as const;

/** The census the real stars fill: nothing of the model inside it (distanceRings.ts). */
export const CENSUS_RADIUS_PC = 100;

/** One spiral arm, Reid et al. 2019 Table 2. Angles in degrees, lengths in kpc. */
export interface SpiralArm {
  readonly name: string;
  readonly betaMinDeg: number;
  readonly betaMaxDeg: number;
  readonly betaKinkDeg: number;
  readonly rKinkKpc: number;
  readonly pitchBeforeDeg: number;
  readonly pitchAfterDeg: number;
  readonly widthKpc: number;
}

export const SPIRAL_ARMS: readonly SpiralArm[] = [
  { name: '3-kpc Arm', betaMinDeg: 15, betaMaxDeg: 18, betaKinkDeg: 15, rKinkKpc: 3.52, pitchBeforeDeg: -4.2, pitchAfterDeg: -4.2, widthKpc: 0.18 },
  { name: 'Norma Arm', betaMinDeg: 5, betaMaxDeg: 54, betaKinkDeg: 18, rKinkKpc: 4.46, pitchBeforeDeg: -1.0, pitchAfterDeg: 19.5, widthKpc: 0.14 },
  { name: 'Scutum–Centaurus Arm', betaMinDeg: 0, betaMaxDeg: 104, betaKinkDeg: 23, rKinkKpc: 4.91, pitchBeforeDeg: 14.1, pitchAfterDeg: 12.1, widthKpc: 0.23 },
  { name: 'Sagittarius–Carina Arm', betaMinDeg: 2, betaMaxDeg: 97, betaKinkDeg: 24, rKinkKpc: 6.04, pitchBeforeDeg: 17.1, pitchAfterDeg: 1.0, widthKpc: 0.27 },
  { name: 'Local Arm', betaMinDeg: -8, betaMaxDeg: 34, betaKinkDeg: 9, rKinkKpc: 8.26, pitchBeforeDeg: 11.4, pitchAfterDeg: 11.4, widthKpc: 0.31 },
  { name: 'Perseus Arm', betaMinDeg: -23, betaMaxDeg: 115, betaKinkDeg: 40, rKinkKpc: 8.87, pitchBeforeDeg: 10.3, pitchAfterDeg: 8.7, widthKpc: 0.35 },
  { name: 'Outer Arm', betaMinDeg: -16, betaMaxDeg: 71, betaKinkDeg: 18, rKinkKpc: 12.24, pitchBeforeDeg: 3.0, pitchAfterDeg: 9.4, widthKpc: 0.65 },
];

/** Width growth with radius, kpc per kpc (Reid et al. 2014, adopted in 2019). */
export const ARM_WIDTH_GROWTH = 0.042;

/**
 * How far past its measured range an arm is carried on, degrees of azimuth each way, and
 * how it fades there: a Gaussian in the azimuth past the last parallax, ARM_TAPER_DEG
 * wide, so an arm thins out into the disc rather than stopping at a cut -- a fifth of its
 * density 60 degrees on, a twentieth at 90. Only between ARM_MIN_R_KPC and ARM_MAX_R_KPC.
 */
export const ARM_EXTENSION_DEG = 90;
export const ARM_TAPER_DEG = 35;
export const ARM_MIN_R_KPC = 2.5;
export const ARM_MAX_R_KPC = 16;

/** The weight an arm keeps at an azimuth: 1 where it was measured, tapering past it. */
export function armTaper(arm: SpiralArm, betaDeg: number): number {
  const outside = Math.max(arm.betaMinDeg - betaDeg, betaDeg - arm.betaMaxDeg, 0);
  return Math.exp(-0.5 * (outside / ARM_TAPER_DEG) ** 2);
}

/** The dust disc, Drimmel & Spergel 2001 Table 1. */
export const DUST_DISC = {
  scaleLengthPc: 2260,
  scaleHeightPc: 134.4,
  flarePcPerKpc: 14.8,
  flareFromKpc: 4.4,
} as const;

/** Star-forming knots strung along the arms, and how far their light spreads, pc. */
export const ARM_KNOTS = 2400;
export const KNOT_RADIUS_PC = 70;

const DEG = Math.PI / 180;

/** Galactocentric radius of an arm at an azimuth, kpc. */
export function armRadiusKpc(arm: SpiralArm, betaDeg: number): number {
  const pitch = betaDeg <= arm.betaKinkDeg ? arm.pitchBeforeDeg : arm.pitchAfterDeg;
  return arm.rKinkKpc * Math.exp(-(betaDeg - arm.betaKinkDeg) * DEG * Math.tan(pitch * DEG));
}

/** The arm's Gaussian width at a radius, kpc. */
export function armWidthKpc(arm: SpiralArm, radiusKpc: number): number {
  return Math.max(0.05, arm.widthKpc + ARM_WIDTH_GROWTH * (radiusKpc - arm.rKinkKpc));
}

/** A Galactocentric radius and azimuth as a point about the Sun, galactic frame, pc. */
export function galactocentricToSun(radiusPc: number, betaDeg: number, zPc = 0): [number, number, number] {
  const beta = betaDeg * DEG;
  const x = R0_PC - radiusPc * Math.cos(beta);
  const y = radiusPc * Math.sin(beta);
  return [x, y, zPc + planeHeightPc(x)];
}

/**
 * Where the plane is, pc above the Sun's height, at a distance x toward the centre: 25 pc
 * below the Sun, rising to the centre's own height there. Sagittarius A* is at
 * b = -0.046 deg, 6.5 pc below the Sun's horizon at R0. A tilt of a seventh of a degree,
 * which is BHG's "the plane passes through Sgr A* and 25 pc below the Sun".
 */
export function planeHeightPc(xPc: number): number {
  const centreZ = R0_PC * Math.tan(-0.046 * DEG);
  return -SUN_ABOVE_PLANE_PC + ((centreZ + SUN_ABOVE_PLANE_PC) * xPc) / R0_PC;
}

/** The Galactic centre about the Sun, galactic frame, pc. */
export function galacticCentrePc(): [number, number, number] {
  return [R0_PC, 0, planeHeightPc(R0_PC)];
}

/** What each sampled point stands for. */
export const POPULATION = {
  thinDisc: 0,
  thickDisc: 1,
  arm: 2,
  bulge: 3,
  bar: 4,
  knot: 5,
  hii: 6,
} as const;

/**
 * Each population's share of the points, the colour it is drawn in, and the size and light
 * of each of its points.
 *
 * **The shares are of light, roughly, not of mass, and they are this model's choice.** The
 * papers give masses; what a picture shows is light, and young arm stars outshine their
 * mass many times over -- which is why spiral galaxies photographed in visible light show
 * their arms at all. Set by eye against photographs of barred spirals seen face-on, and
 * named as that.
 *
 * Colour comes from a B-V typical of each population, through the same blackbody path as
 * every star here -- blue-white for the young arm stars, bluer still in the knots where
 * the O and B stars are, the warm white of an old disc, the orange of the bulge's giants
 * -- except for the HII regions, whose light is not a star's: it is hydrogen's emission
 * lines, and `colorIndex` null says so (MilkyWay.tsx works out their colour from H-alpha
 * and H-beta). The old populations are drawn as wide, faint points, so they read as the
 * smooth light they are; the knots as small bright ones.
 */
export interface PopulationLook {
  readonly share: number;
  readonly colorIndex: number | null;
  readonly radiusPc: number;
  readonly gain: number;
}

export const POPULATIONS: readonly PopulationLook[] = [
  { share: 0.4, colorIndex: 0.75, radiusPc: 260, gain: 0.35 },
  { share: 0.07, colorIndex: 0.95, radiusPc: 360, gain: 0.25 },
  { share: 0.17, colorIndex: -0.05, radiusPc: 130, gain: 1.3 },
  { share: 0.12, colorIndex: 1.15, radiusPc: 180, gain: 1.0 },
  { share: 0.06, colorIndex: 1.05, radiusPc: 170, gain: 0.8 },
  { share: 0.14, colorIndex: -0.25, radiusPc: 55, gain: 2.5 },
  { share: 0.04, colorIndex: null, radiusPc: 45, gain: 3.0 },
];

/** A sample of the model: positions about the Sun, galactic frame, pc; and populations. */
export interface MilkyWaySample {
  readonly positions: Float32Array;
  readonly populations: Uint8Array;
  readonly count: number;
}

/** mulberry32: a small seeded generator, so the galaxy is the same on every load. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Samples the model: `count` points, deterministic for a seed.
 *
 * Every draw is the textbook one for its density: a radius R e^(-R/h) by summing two
 * exponentials (a Gamma of shape 2, the surface density times the ring's circumference),
 * a height e^(-|z|/h) as a signed exponential, an ellipsoidal exponential bulge as a
 * Gamma(3) radius in a random direction, and an arm point as an azimuth weighted by the
 * disc's density along it, scattered by the arm's Gaussian width. A point that lands in the
 * census, or an arm point the rejection turns down, is drawn again from the same
 * population, so `count` is what comes back and the shares are POPULATIONS's.
 */
export function sampleMilkyWay(count: number, seed = 20261028): MilkyWaySample {
  const random = generator(seed);
  const positions = new Float32Array(count * 3);
  const populations = new Uint8Array(count);
  const exponential = (): number => -Math.log(1 - random());
  const signedExponential = (scale: number): number =>
    (random() < 0.5 ? -1 : 1) * scale * exponential();
  const gaussian = (): number => {
    const u = 1 - random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
  };
  const thresholds: number[] = [];
  let sum = 0;
  for (const population of POPULATIONS) {
    sum += population.share;
    thresholds.push(sum);
  }

  const armWeights = SPIRAL_ARMS.map((arm) => arm.betaMaxDeg - arm.betaMinDeg + 2 * ARM_EXTENSION_DEG);
  const armTotal = armWeights.reduce((a, b) => a + b, 0);

  const disc = (scaleLengthPc: number, scaleHeightPc: number): [number, number, number] => {
    const radius = scaleLengthPc * (exponential() + exponential());
    return galactocentricToSun(radius, random() * 360, signedExponential(scaleHeightPc));
  };

  const ellipsoid = (
    angleDeg: number,
    sx: number,
    sy: number,
    sz: number,
    radial: () => number,
  ): [number, number, number] => {
    const cz = 2 * random() - 1;
    const phi = 2 * Math.PI * random();
    const s = Math.sqrt(1 - cz * cz);
    const r = radial();
    return barFrame(angleDeg, r * s * Math.cos(phi) * sx, r * s * Math.sin(phi) * sy, r * cz * sz);
  };

  // An arm point: an azimuth along a chosen arm, weighted by the disc's density there and
  // by how far past its parallaxes it is, scattered across the arm by its width times
  // `spread`, moved `shift` widths outward, in a layer `heightPc` thick.
  const arm = (spread = 1, shift = 0, heightPc = 100): [number, number, number] | null => {
    let pick = random() * armTotal;
    let index = 0;
    while (index < SPIRAL_ARMS.length - 1 && pick > armWeights[index]!) {
      pick -= armWeights[index]!;
      index += 1;
    }
    const spiral = SPIRAL_ARMS[index]!;
    const beta =
      spiral.betaMinDeg - ARM_EXTENSION_DEG + random() * (spiral.betaMaxDeg - spiral.betaMinDeg + 2 * ARM_EXTENSION_DEG);
    const radiusKpc = armRadiusKpc(spiral, beta);
    if (radiusKpc < ARM_MIN_R_KPC || radiusKpc > ARM_MAX_R_KPC) {
      return null;
    }
    // The arm's stars thin out with the disc's: R e^(-R/h) per unit azimuth, as a
    // rejection against its peak, at R = h.
    const scale = THIN_DISC.scaleLengthPc / 1000;
    const weight = (radiusKpc / scale) * Math.exp(1 - radiusKpc / scale) * armTaper(spiral, beta);
    if (random() > weight) {
      return null;
    }
    const width = armWidthKpc(spiral, radiusKpc) * 1000;
    const radiusPc = radiusKpc * 1000 + (shift + gaussian() * spread) * width;
    // Young stars: a thin layer, a third of the old disc's.
    return galactocentricToSun(
      radiusPc,
      beta + (gaussian() * spread * width) / (radiusKpc * 1000) / DEG,
      signedExponential(heightPc),
    );
  };

  // The knots: places along the arms where the young stars bunch, each with a brightness
  // drawn from a log-normal -- a few big complexes and many small ones, as the HII region
  // catalogues have them. Points of the knot and HII populations gather round them.
  const knots: [number, number, number][] = [];
  const knotWeights: number[] = [];
  while (knots.length < ARM_KNOTS) {
    const point = arm(0.7, 0, 60);
    if (point === null) continue;
    knots.push(point);
    knotWeights.push(Math.exp(1.1 * gaussian()));
  }
  const knotCumulative: number[] = [];
  let knotSum = 0;
  for (const weight of knotWeights) {
    knotSum += weight;
    knotCumulative.push(knotSum);
  }
  const knot = (radiusPc: number): [number, number, number] => {
    const target = random() * knotSum;
    let low = 0;
    let high = knotCumulative.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (knotCumulative[middle]! < target) low = middle + 1;
      else high = middle;
    }
    const [x, y, z] = knots[low]!;
    return [x + gaussian() * radiusPc, y + gaussian() * radiusPc, z + gaussian() * radiusPc * 0.4];
  };

  // One population drawn per point, and that population drawn again until it lands --
  // so the shares come out as POPULATIONS states them, rejections and all.
  const draw = (population: number): [number, number, number] | null => {
    switch (population) {
      case POPULATION.thinDisc:
        return disc(THIN_DISC.scaleLengthPc, THIN_DISC.scaleHeightPc);
      case POPULATION.thickDisc:
        return disc(THICK_DISC.scaleLengthPc, THICK_DISC.scaleHeightPc);
      case POPULATION.arm:
        return arm();
      case POPULATION.bulge:
        // An exponential ellipsoid, e^(-m): the radius m is a Gamma of shape 3.
        return ellipsoid(BULGE.angleDeg, BULGE.scaleXPc, BULGE.scaleYPc, BULGE.scaleZPc, () => exponential() + exponential() + exponential());
      case POPULATION.knot:
        return knot(KNOT_RADIUS_PC);
      case POPULATION.hii:
        return knot(KNOT_RADIUS_PC * 0.6);
      default:
        // Thinning toward its ends, as a bar's light does: a triangular profile along it.
        return barFrame(
          LONG_BAR.angleDeg,
          (random() - random()) * LONG_BAR.halfLengthPc,
          gaussian() * LONG_BAR.widthPc * 0.5,
          signedExponential(LONG_BAR.scaleZPc),
        );
    }
  };

  for (let written = 0; written < count; written += 1) {
    const pick = random();
    let population = thresholds.findIndex((threshold) => pick < threshold);
    if (population < 0) population = POPULATIONS.length - 1;
    let point = draw(population);
    while (point === null || Math.hypot(point[0], point[1], point[2]) < CENSUS_RADIUS_PC) {
      point = draw(population);
    }
    positions[written * 3] = point[0];
    positions[written * 3 + 1] = point[1];
    positions[written * 3 + 2] = point[2];
    populations[written] = population;
  }
  return { positions, populations, count };
}

/**
 * The dust, as points that darken rather than shine (MilkyWay.tsx): `count` of them,
 * deterministic for a seed, about the Sun in the galactic frame, pc.
 *
 * Two thirds are the disc of Drimmel & Spergel 2001 -- exponential in radius, sech^2 in
 * height with its flare, and their central hole, which below half the Sun's radius
 * replaces the exponential with a Gaussian fall to the centre. The rest lies in the
 * arms' dust lanes: along each arm, on its inner side, in a band half the arm's width,
 * in a layer as thin as the disc's.
 */
export function sampleDust(count: number, seed = 20261029): Float32Array {
  const random = generator(seed);
  const positions = new Float32Array(count * 3);
  const gaussian = (): number => {
    const u = 1 - random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
  };
  const sech2 = (scale: number): number => scale * Math.atanh(Math.min(0.999999, Math.max(-0.999999, 2 * random() - 1)));
  const armWeights = SPIRAL_ARMS.map((arm) => arm.betaMaxDeg - arm.betaMinDeg + 2 * ARM_EXTENSION_DEG);
  const armTotal = armWeights.reduce((a, b) => a + b, 0);
  const halfSun = 0.5 * R0_PC;

  const disc = (): [number, number, number] | null => {
    const radius = DUST_DISC.scaleLengthPc * (-Math.log(1 - random()) - Math.log(1 - random()));
    if (radius < halfSun) {
      // Their hole: rho(0.5 R0) exp(-((r/R0 - 0.5) / 0.25)^2) inside, against the
      // exponential the draw above follows there.
      const inside = Math.exp(-(((radius / R0_PC - 0.5) / 0.25) ** 2));
      const exponential = Math.exp(-(radius - halfSun) / DUST_DISC.scaleLengthPc);
      if (random() > inside / exponential) return null;
    }
    const flare = Math.max(0, radius / 1000 - DUST_DISC.flareFromKpc) * DUST_DISC.flarePcPerKpc;
    return galactocentricToSun(radius, random() * 360, sech2(DUST_DISC.scaleHeightPc + flare));
  };

  const lane = (): [number, number, number] | null => {
    let pick = random() * armTotal;
    let index = 0;
    while (index < SPIRAL_ARMS.length - 1 && pick > armWeights[index]!) {
      pick -= armWeights[index]!;
      index += 1;
    }
    const spiral = SPIRAL_ARMS[index]!;
    const beta = spiral.betaMinDeg - ARM_EXTENSION_DEG + random() * (spiral.betaMaxDeg - spiral.betaMinDeg + 2 * ARM_EXTENSION_DEG);
    const radiusKpc = armRadiusKpc(spiral, beta);
    if (radiusKpc < ARM_MIN_R_KPC || radiusKpc > ARM_MAX_R_KPC) return null;
    const scale = DUST_DISC.scaleLengthPc / 1000;
    if (random() > (radiusKpc / scale) * Math.exp(1 - radiusKpc / scale) * armTaper(spiral, beta)) return null;
    const width = armWidthKpc(spiral, radiusKpc) * 1000;
    // Inside the arm: toward the centre by 0.7 of its width, half as wide.
    const radiusPc = radiusKpc * 1000 + (-0.7 + 0.5 * gaussian()) * width;
    return galactocentricToSun(radiusPc, beta + (gaussian() * width) / (radiusKpc * 1000) / DEG, sech2(DUST_DISC.scaleHeightPc * 0.7));
  };

  for (let written = 0; written < count; written += 1) {
    const fromDisc = random() < 2 / 3;
    let point = fromDisc ? disc() : lane();
    while (point === null || Math.hypot(point[0], point[1], point[2]) < CENSUS_RADIUS_PC) {
      point = fromDisc ? disc() : lane();
    }
    positions[written * 3] = point[0];
    positions[written * 3 + 1] = point[1];
    positions[written * 3 + 2] = point[2];
  }
  return positions;
}

/**
 * A point in a bar's own axes -- along it, across it, up -- about the Sun. The bar's near
 * end is at positive longitudes: from the centre, along it is toward the Sun and toward
 * l = 90 at once, (-cos a, sin a).
 */
function barFrame(angleDeg: number, along: number, across: number, up: number): [number, number, number] {
  const a = angleDeg * DEG;
  const x = R0_PC - along * Math.cos(a) - across * Math.sin(a);
  const y = along * Math.sin(a) - across * Math.cos(a);
  return [x, y, up + planeHeightPc(x)];
}

/** Where each arm's name goes: the middle of its measured stretch, about the Sun, pc. */
export function armLabelPoints(): { readonly name: string; readonly position: [number, number, number] }[] {
  return SPIRAL_ARMS.map((arm) => {
    const beta = (arm.betaMinDeg + arm.betaMaxDeg) / 2;
    return { name: arm.name, position: galactocentricToSun(armRadiusKpc(arm, beta) * 1000, beta) };
  });
}
