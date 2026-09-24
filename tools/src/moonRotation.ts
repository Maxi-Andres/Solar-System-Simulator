import type { PeriodicTerm, RotationalElements } from './types.ts';

/**
 * The moons' IAU rotational elements and shapes.
 *
 * Source: the IAU WGCCRE 2015 report (Archinal et al., Celest Mech Dyn Astr 130:22,
 * 2018) -- the same report the planets' values come from -- in the machine-readable
 * form JPL's NAIF group publishes it: the text planetary constants kernel
 * pck00011.tpc, naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/.
 *
 * **Every number below was read out of that file by a script, not typed.** The
 * planets' values were transcribed by hand and needed three corrections that only a
 * comparison against JPL found, one of them a 1.5 degree pole; twenty-one moons with up
 * to thirteen periodic terms each is not a transcription job. The script parsed the
 * kernel's data blocks, expanded each planetary system's shared list of angles into
 * the terms each moon actually weights, and dropped the terms whose three weights are
 * all zero. The result is checked against JPL in moonRotation.test.ts rather than
 * trusted.
 *
 * Nothing is dropped for being small, unlike the planets. Several of these terms are
 * large, and a model with some of its terms is not a model anyone published.
 *
 * Reading a term: `term(N0, N1, N2, ra, dec, w)` with N = N0 + N1*T + N2*T^2 degrees and
 * T in Julian centuries from J2000; then alpha0 += ra*sin(N), delta0 += dec*cos(N),
 * W += w*sin(N). The trailing comment is the angle's name in the report: E for the
 * Earth-Moon system, M Mars, J Jupiter, S Saturn, U Uranus, N Neptune.
 *
 * Radii are [a, b, c]: a along the prime meridian, which for a locked moon points at
 * its planet; b ninety degrees east; c along the pole.
 */

function term(
  angleDeg: number,
  rateDegPerCentury: number,
  accelDegPerCentury2: number,
  raSinCoeffDeg: number,
  decCosCoeffDeg: number,
  wSinCoeffDeg: number,
): PeriodicTerm {
  return {
    angleDeg,
    rateDegPerCentury,
    accelDegPerCentury2,
    raSinCoeffDeg,
    decCosCoeffDeg,
    wSinCoeffDeg,
  };
}

export interface MoonOrientation {
  readonly radiiKm: readonly [number, number, number];
  readonly rotation: RotationalElements;
}

export const MOON_ORIENTATION: Readonly<Record<string, MoonOrientation>> = {
  moon: {
    radiiKm: [1737.4, 1737.4, 1737.4],
    rotation: {
      poleRaDeg: 269.9949,
      poleDecDeg: 66.5392,
      poleRaRateDegPerCentury: 0.0031,
      poleDecRateDegPerCentury: 0.013,
      primeMeridianDeg: 38.3213,
      rotationRateDegPerDay: 13.17635815,
      primeMeridianAccelDegPerDay2: -1.4e-12,
      periodicTerms: [
        term(125.045, -1935.5364525, 0, -3.8787, 1.5419, 3.561), // E1
        term(250.089, -3871.072905, 0, -0.1204, 0.0239, 0.1208), // E2
        term(260.008, 475263.3328725, 0, 0.07, -0.0278, -0.0642), // E3
        term(176.625, 487269.629985, 0, -0.0172, 0.0068, 0.0158), // E4
        term(357.529, 35999.0509575, 0, 0, 0, 0.0252), // E5
        term(311.589, 964468.49931, 0, 0.0072, -0.0029, -0.0066), // E6
        term(134.963, 477198.869325, 0, 0, 0.0009, -0.0047), // E7
        term(276.617, 12006.300765, 0, 0, 0, -0.0046), // E8
        term(34.226, 63863.5132425, 0, 0, 0, 0.0028), // E9
        term(15.134, -5806.6093575, 0, -0.0052, 0.0008, 0.0052), // E10
        term(119.743, 131.84064, 0, 0, 0, 0.004), // E11
        term(239.961, 6003.1503825, 0, 0, 0, 0.0019), // E12
        term(25.053, 473327.79642, 0, 0.0043, -0.0009, -0.0044), // E13
      ],
    },
  },
  phobos: {
    radiiKm: [13, 11.4, 9.1],
    rotation: {
      poleRaDeg: 317.67071657,
      poleDecDeg: 52.88627266,
      poleRaRateDegPerCentury: -0.10844326,
      poleDecRateDegPerCentury: -0.06134706,
      primeMeridianDeg: 35.1877444,
      rotationRateDegPerDay: 1128.84475928,
      primeMeridianAccelDegPerDay2: 9.536137031212154e-9,
      periodicTerms: [
        term(190.72646643, 15917.10818695, 0, -1.78428399, -1.07516537, 1.42421769), // M1
        term(21.4689247, 31834.27934054, 0, 0.02212824, 0.00668626, -0.02273783), // M2
        term(332.86082793, 19139.89694742, 0, -0.01028251, -0.0064874, 0.00410711), // M3
        term(394.93256437, 38280.79631835, 0, -0.00475595, 0.00281576, 0.00631964), // M4
        term(189.6327156, 41215158.1842005, 12.711923222, 0, 0, -1.143), // M5
      ],
    },
  },
  deimos: {
    radiiKm: [7.8, 6, 5.1],
    rotation: {
      poleRaDeg: 316.65705808,
      poleDecDeg: 53.50992033,
      poleRaRateDegPerCentury: -0.10518014,
      poleDecRateDegPerCentury: -0.05979094,
      primeMeridianDeg: 79.39932954,
      rotationRateDegPerDay: 285.16188899,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(121.46893664, 660.22803474, 0, 3.09217726, 1.83936004, -2.73954829), // M6
        term(231.05028581, 660.9912354, 0, 0.22980637, 0.1432532, -0.39968606), // M7
        term(251.37314025, 1320.50145245, 0, 0.06418655, 0.01911409, -0.06563259), // M8
        term(217.98635955, 38279.9612555, 0, 0.02533537, -0.0148259, -0.0291294), // M9
        term(196.19729402, 19139.83628608, 0, 0.00778695, 0.0019243, 0.0169916), // M10
      ],
    },
  },
  io: {
    radiiKm: [1829.4, 1819.4, 1815.7],
    rotation: {
      poleRaDeg: 268.05,
      poleDecDeg: 64.5,
      poleRaRateDegPerCentury: -0.009,
      poleDecRateDegPerCentury: 0.003,
      primeMeridianDeg: 200.39,
      rotationRateDegPerDay: 203.4889538,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(283.9, 4850.7, 0, 0.094, 0.04, -0.085), // J3
        term(355.8, 1191.3, 0, 0.024, 0.011, -0.022), // J4
      ],
    },
  },
  europa: {
    radiiKm: [1562.6, 1560.3, 1559.5],
    rotation: {
      poleRaDeg: 268.08,
      poleDecDeg: 64.51,
      poleRaRateDegPerCentury: -0.009,
      poleDecRateDegPerCentury: 0.003,
      primeMeridianDeg: 36.022,
      rotationRateDegPerDay: 101.3747235,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(355.8, 1191.3, 0, 1.086, 0.468, -0.98), // J4
        term(119.9, 262.1, 0, 0.06, 0.026, -0.054), // J5
        term(229.8, 64.3, 0, 0.015, 0.007, -0.014), // J6
        term(352.25, 2382.6, 0, 0.009, 0.002, -0.008), // J7
      ],
    },
  },
  ganymede: {
    radiiKm: [2631.2, 2631.2, 2631.2],
    rotation: {
      poleRaDeg: 268.2,
      poleDecDeg: 64.57,
      poleRaRateDegPerCentury: -0.009,
      poleDecRateDegPerCentury: 0.003,
      primeMeridianDeg: 44.064,
      rotationRateDegPerDay: 50.3176081,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(355.8, 1191.3, 0, -0.037, -0.016, 0.033), // J4
        term(119.9, 262.1, 0, 0.431, 0.186, -0.389), // J5
        term(229.8, 64.3, 0, 0.091, 0.039, -0.082), // J6
      ],
    },
  },
  callisto: {
    radiiKm: [2410.3, 2410.3, 2410.3],
    rotation: {
      poleRaDeg: 268.72,
      poleDecDeg: 64.83,
      poleRaRateDegPerCentury: -0.009,
      poleDecRateDegPerCentury: 0.003,
      primeMeridianDeg: 259.51,
      rotationRateDegPerDay: 21.5710715,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(119.9, 262.1, 0, -0.068, -0.029, 0.061), // J5
        term(229.8, 64.3, 0, 0.59, 0.254, -0.533), // J6
        term(113.35, 6070, 0, 0.01, -0.004, -0.009), // J8
      ],
    },
  },
  mimas: {
    radiiKm: [207.8, 196.7, 190.6],
    rotation: {
      poleRaDeg: 40.66,
      poleDecDeg: 83.52,
      poleRaRateDegPerCentury: -0.036,
      poleDecRateDegPerCentury: -0.004,
      primeMeridianDeg: 333.46,
      rotationRateDegPerDay: 381.994555,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(177.4, -36505.5, 0, 13.56, -1.53, -13.48), // S3
        term(316.45, 506.2, 0, 0, 0, -44.85), // S5
      ],
    },
  },
  enceladus: {
    radiiKm: [256.6, 251.4, 248.3],
    rotation: {
      poleRaDeg: 40.66,
      poleDecDeg: 83.52,
      poleRaRateDegPerCentury: -0.036,
      poleDecRateDegPerCentury: -0.004,
      primeMeridianDeg: 6.32,
      rotationRateDegPerDay: 262.7318996,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
  },
  tethys: {
    radiiKm: [538.4, 528.3, 526.3],
    rotation: {
      poleRaDeg: 40.66,
      poleDecDeg: 83.52,
      poleRaRateDegPerCentury: -0.036,
      poleDecRateDegPerCentury: -0.004,
      primeMeridianDeg: 8.95,
      rotationRateDegPerDay: 190.6979085,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(300, -7225.9, 0, 9.66, -1.09, -9.6), // S4
        term(316.45, 506.2, 0, 0, 0, 2.23), // S5
      ],
    },
  },
  dione: {
    radiiKm: [563.4, 561.3, 559.6],
    rotation: {
      poleRaDeg: 40.66,
      poleDecDeg: 83.52,
      poleRaRateDegPerCentury: -0.036,
      poleDecRateDegPerCentury: -0.004,
      primeMeridianDeg: 357.6,
      rotationRateDegPerDay: 131.5349316,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
  },
  rhea: {
    radiiKm: [765, 763.1, 762.4],
    rotation: {
      poleRaDeg: 40.38,
      poleDecDeg: 83.55,
      poleRaRateDegPerCentury: -0.036,
      poleDecRateDegPerCentury: -0.004,
      primeMeridianDeg: 235.16,
      rotationRateDegPerDay: 79.6900478,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(345.2, -1016.3, 0, 3.1, -0.35, -3.08), // S6
      ],
    },
  },
  titan: {
    radiiKm: [2575.15, 2574.78, 2574.47],
    rotation: {
      poleRaDeg: 39.4827,
      poleDecDeg: 83.4279,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      primeMeridianDeg: 186.5855,
      rotationRateDegPerDay: 22.5769768,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
  },
  iapetus: {
    radiiKm: [745.7, 745.7, 712.1],
    rotation: {
      poleRaDeg: 318.16,
      poleDecDeg: 75.03,
      poleRaRateDegPerCentury: -3.949,
      poleDecRateDegPerCentury: -1.143,
      primeMeridianDeg: 355.2,
      rotationRateDegPerDay: 4.5379572,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
  },
  miranda: {
    radiiKm: [240.4, 234.2, 232.9],
    rotation: {
      poleRaDeg: 257.43,
      poleDecDeg: -15.08,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      primeMeridianDeg: 30.7,
      rotationRateDegPerDay: -254.6906892,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(102.23, -2024.22, 0, 4.41, 4.25, 1.15), // U11
        term(316.41, 2863.96, 0, 0, 0, -1.27), // U12
        term(204.46, -4048.44, 0, -0.04, -0.02, -0.09), // U17
        term(632.82, 5727.92, 0, 0, 0, 0.15), // U18
      ],
    },
  },
  ariel: {
    radiiKm: [581.1, 577.9, 577.7],
    rotation: {
      poleRaDeg: 257.43,
      poleDecDeg: -15.1,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      primeMeridianDeg: 156.22,
      rotationRateDegPerDay: -142.8356681,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(316.41, 2863.96, 0, 0, 0, 0.05), // U12
        term(304.01, -51.94, 0, 0.29, 0.28, 0.08), // U13
      ],
    },
  },
  umbriel: {
    radiiKm: [584.7, 584.7, 584.7],
    rotation: {
      poleRaDeg: 257.43,
      poleDecDeg: -15.1,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      primeMeridianDeg: 108.05,
      rotationRateDegPerDay: -86.8688923,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(316.41, 2863.96, 0, 0, 0, -0.09), // U12
        term(308.71, -93.17, 0, 0.21, 0.2, 0.06), // U14
      ],
    },
  },
  titania: {
    radiiKm: [788.9, 788.9, 788.9],
    rotation: {
      poleRaDeg: 257.43,
      poleDecDeg: -15.1,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      primeMeridianDeg: 77.74,
      rotationRateDegPerDay: -41.3514316,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(340.82, -75.32, 0, 0.29, 0.28, 0.08), // U15
      ],
    },
  },
  oberon: {
    radiiKm: [761.4, 761.4, 761.4],
    rotation: {
      poleRaDeg: 257.43,
      poleDecDeg: -15.1,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      primeMeridianDeg: 6.77,
      rotationRateDegPerDay: -26.7394932,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(259.14, -504.81, 0, 0.16, 0.16, 0.04), // U16
      ],
    },
  },
  triton: {
    radiiKm: [1352.6, 1352.6, 1352.6],
    rotation: {
      poleRaDeg: 299.36,
      poleDecDeg: 41.17,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      primeMeridianDeg: 296.53,
      rotationRateDegPerDay: -61.2572637,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [
        term(177.85, 52.316, 0, -32.35, 22.55, 22.25), // N7
        term(355.7, 104.632, 0, -6.28, 2.1, 6.73), // 3N7
        term(533.55, 156.948, 0, -2.08, 0.55, 2.05), // 4N7
        term(711.4, 209.264, 0, -0.74, 0.16, 0.74), // 5N7
        term(889.25, 261.58, 0, -0.28, 0.05, 0.28), // 6N7
        term(1067.1, 313.896, 0, -0.11, 0.02, 0.11), // 7N7
        term(1244.95, 366.212, 0, -0.07, 0.01, 0.05), // 8N7
        term(1422.8, 418.528, 0, -0.02, 0, 0.02), // 9N7
        term(1600.65, 470.844, 0, -0.01, 0, 0.01), // #16
      ],
    },
  },
  charon: {
    radiiKm: [606, 606, 606],
    rotation: {
      poleRaDeg: 132.993,
      poleDecDeg: -6.163,
      poleRaRateDegPerCentury: 0,
      poleDecRateDegPerCentury: 0,
      primeMeridianDeg: 122.695,
      rotationRateDegPerDay: 56.3625225,
      primeMeridianAccelDegPerDay2: 0,
      periodicTerms: [],
    },
  },
};
