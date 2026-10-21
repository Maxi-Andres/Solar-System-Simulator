import type { CraftShape } from '../types.ts';

/**
 * What each named satellite is drawn as up close, and which way it faces: the spacecraft's
 * rules (CraftShape, SHAPES in catalog.ts) applied to Earth's satellites. Researched and
 * measured 2026-10-21; every file is recorded in web/public/models/CREDITS.md.
 *
 * **Models.** NASA's own where one may be used: NASA 3D Resources (science.nasa.gov/
 * 3d-resources and its nasa/NASA-3D-Resources mirror), NASA's mission pages (the ISS's and
 * Hubble's, credited to NASA VTAD; GOES-R's), and JPL's mission sites for SMAP and GRACE-FO
 * (NASA VTAD's models). ESA's where ESA owns the craft, by its written permission for its
 * models generally: XMM-Newton and SMILE from the ESA SPICE Service's Cosmographia
 * packages, which are Sci-Fleet's models; CryoSat-2 from ESA's Visuals by Earth Online.
 * Every file is compressed only: no triangle is lost, and each one's bounds are its
 * source's (craftModels.test.ts).
 *
 * **Scale.** Most are in metres, each within 10% of a published dimension. Eight are in
 * arbitrary units, scaled by one published dimension against the same extent measured in
 * the file:
 *
 *   model        extent in the file           published                         metres/unit
 *   Swift        29.44 along y (height)       5.64 m tall (NASA, 18.5 ft)       0.19158
 *   Fermi        62.31 along z (arrays)       15 m wide deployed (NASA SVS)     0.24074
 *   SDO          37.04 along z (arrays)       6.25 m array span (NASA SDO)      0.16876
 *   MMS          2.0 across the octagon       3.5 m wide (NASA MMS)             1.75
 *   Terra        13,621.76 along x (bus)      6.8 m bus (NASA Terra)            0.00049920
 *   OCO-2        39.87 along z (arrays)       9 m tip to tip (JPL press kit)    0.22576
 *   GPM          431.90 along z (arrays)      11.6 m (NASA, NTRS 20080030251)   0.026858
 *   TDRS 1st gen 94.44 along x (arrays)       57 ft, 17.4 m (Gunter's; NASA     0.18424
 *                                            publishes none for the TRW craft)
 *
 * Swift's other figure, "17.75 feet wide", says not what it measures; scaled by its height
 * the model's arrays span 7.65 m. Fermi's LAT comes out 1.61 m across against 1.8 m, and
 * SDO's height 5.2 m against 4.5 m: both files run long there, kept as NASA made them.
 * MMS's model draws its 60 m wire booms 7 m long, as Wind's model draws its antennas: at
 * a few millimetres thick they would not show at any length. GPM's 11.6 m is NASA's
 * "11.6m x 6.5m x 5.0m" (the scan reads "1 1.6m"); the file is 7.2 m against the 6.5.
 *
 * **One model, two craft**, as the Voyagers and the Pioneers share one: Landsat 9 is
 * "largely a copy of Landsat 8" (USGS) and Landsat 8's model serves it; Sentinel-6B is the
 * second of "two identical satellites" (ESA, NASA); NOAA-20's "basic layout of the
 * spacecraft bus is the same ... as S-NPP" (Ball) and Suomi NPP's model serves it; the four
 * GOES-R series craft fly NASA's GOES-R model ("GOES-R,S,T", so GOES-19's CCOR-1
 * coronagraph is not drawn); TDRS-3, 5, 6 and 7 are TRW's first generation and fly NASA's
 * first-generation model, TDRS-8, 11, 12 and 13 Boeing's second and third (21 m across the
 * arrays both, the third "69 feet tip-to-tip") and fly the Boeing model. The MMS four are
 * alike by design; GRACE-FO's two differ only in which way they face each other.
 *
 * **Boxes**, where no model may be used, are NO MODEL boxes of published dimensions,
 * L x W x D in metres along the box's x, y and z:
 *
 *   Tiangong       16.6 x 55.7 x 4.2    Tianhe's axial length, Wentian's and Mengtian's
 *                                       wing span, the modules' diameter (CMSA, UNOOSA
 *                                       2023); the station's own overall size is unpublished
 *   NuSTAR         10.9 x 1.2 x 1.2     length with the mast extended, and width (JPL)
 *   IXPE           5.2 x 2.7 x 1.1      length deployed, array span, diameter (Weisskopf
 *                                       et al. 2022)
 *   IRIS           3.6 x 0.6 x 2.18     array tip to tip, one array's width, bus to
 *                                       telescope front (De Pontieu et al. 2014)
 *   Hinode         10 x 1.6 x 4         paddle span, body width and height (NAOJ, JAXA);
 *                                       NASA's model of it measures 1.1:1 where Hinode is
 *                                       4 m tall on 1.6 m, and is not used
 *   TIMED          1.2 x 11.73 x 2.72   deep, wide across the arrays, high (APL)
 *   PACE           1.5 x 1.5 x 3.2      the observatory as stowed (PACE project); the
 *                                       array, 2.54 x 4.39 m, is outside it, its deployed
 *                                       span unpublished
 *   SWOT           14.9 x 10 x 5        array span, KaRIn baseline, bus and payload height
 *                                       (JPL press kit)
 *   Jason-3        3.8 x 10 x 2         "3.8m x 10m x 2m with the solar panels deployed"
 *                                       (NOAA); NASA's Jason-2 model is not to its own scale
 *   Sentinel-2     3.4 x 1.8 x 2.35     long, wide, high (ESA); its array's span is
 *                                       unpublished, and ESA has published no model
 *   NOAA-21        4.3 x 10.7 x 2.1     14 by 7 ft, 35 ft with the array (NOAA): a
 *                                       different bus from NOAA-20's, Northrop Grumman's
 *   Envisat        26 x 10 x 5          in orbit, array included (ESA). ESA's model is
 *                                       not to scale -- its array 10.6 m long against 14 m,
 *                                       its ASAR 6.8 m against 10 m, while its array's
 *                                       width is the real 5 m -- and no uniform factor
 *                                       fits it, so it is not used
 *
 * **Spans** are the largest published dimension, which the body's radius stands for. Four
 * have none published overall, and take the model's own measured extent, as CAPSTONE's
 * does: Terra 13.0 m (bus and array mast), Landsat 12.3 m, Suomi NPP 9.0 m, GOES-R 15.3 m.
 *
 * **Attitude**, from the geometry and the instruments, since no file documents its axes:
 *
 *   - LVLH (`nadir`), the Earth observers, the weather and relay satellites and the ISS:
 *     the face with the Earth-looking instruments down, and along track the axis the
 *     craft's arrays or long body say -- an array that turns once an orbit to follow the
 *     Sun lies across the track, along the orbit normal; a GEO comsat's wings run north-
 *     south. Which end of that axis leads is not published for most, and is a choice,
 *     said in each entry. The ISS's is NASA's own: +X along the velocity, +Z nadir, +Y
 *     starboard (NTRS 20180005346, 20130011352), found on the model by its named modules.
 *   - Observatories pointed at targets no data here carries -- Hubble, Chandra, XMM-
 *     Newton, Swift, Fermi, NuSTAR, IXPE, SMILE -- are drawn by their power rule, arrays to
 *     the Sun, which each keeps within a few degrees (Hubble's primer, Chandra's POG,
 *     Swift's appendix, IXPE's paper); `facingNote` says the pointing is not known.
 *   - The Sun's observatories, SDO, IRIS and Hinode, point at it, which is known.
 *   - MMS spins about an axis "nearly aligned with Ecliptic North, but tipped around 3 deg
 *     towards the Sun" (NTRS 20160010499), drawn on the pole, as Wind's is.
 */

/** What a named satellite is drawn as up close: its published span and its shape. */
export interface SatelliteLook {
  /** Largest deployed dimension, metres: what the body's radius stands for. */
  readonly spanM: number;
  readonly shape: CraftShape;
}

/** The panel's words for an observatory whose pointing is its own observing plan. */
const OBSERVATORY_NOTE =
  'Points at its targets on an observing plan not carried here: drawn with its solar arrays on the Sun, which it keeps within a few degrees of them.';

/** A NO MODEL box in LVLH: x along the track, z on Earth's centre. */
const NADIR_BOX = {
  model: null,
  metresPerUnit: 1,
  pointsAt: 'nadir',
  pointingPart: 'deck',
  pointingAxis: [0, 0, 1],
  rollAxis: [1, 0, 0],
} as const;

/** A NO MODEL box of an observatory: its broad face, the arrays, on the Sun. */
const SUN_BOX = {
  model: null,
  metresPerUnit: 1,
  pointsAt: 'sun',
  pointingPart: 'solar-arrays',
  pointingAxis: [0, 0, 1],
  rollAxis: [0, 1, 0],
  facingNote: OBSERVATORY_NOTE,
} as const;

/** A NO MODEL box of a solar observatory: its instruments, along z, on the Sun. */
const SOLAR_BOX = {
  model: null,
  metresPerUnit: 1,
  pointsAt: 'sun',
  pointingPart: 'instruments',
  pointingAxis: [0, 0, 1],
  rollAxis: [0, 1, 0],
} as const;

/**
 * The ISS: NASA VTAD's model, metres, 111.99 m along the truss against the 109 m NASA
 * gives end to end. By its named nodes: Harmony (z +15.0) and Kibo forward, Zvezda
 * (z -25.8) aft, so ISS +X is model +z; the S0 truss (y +4.2) sits on Destiny (y 0), at
 * the zenith, with Poisk above and Pirs below, so ISS +Z, nadir, is model -y; the S
 * segments at -x are starboard, ISS +Y. Its configuration is of about 2020: Pirs still
 * docked, before Nauka, Prichal and the roll-out arrays of 2021-2023.
 */
const ISS_SHAPE: CraftShape = {
  model: 'iss.glb',
  pivot: [-0.0565, 1.99719, 3.53098],
  metresPerUnit: 1,
  boxM: null,
  pointsAt: 'nadir',
  pointingPart: 'body-axes',
  pointingAxis: [0, -1, 0],
  rollAxis: [0, 0, 1],
};

const LANDSAT: SatelliteLook = {
  // 12.26 m along z in the file, bus and the 9.8 m array; nothing overall is published.
  spanM: 12.3,
  shape: {
    model: 'landsat-8.glb',
    pivot: [-1.79054, -0.11171, -0.01573],
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'nadir',
    pointingPart: 'instruments',
    // OLI and TIRS, the grey boxes, on +y; the array angles away from them, toward -y.
    pointingAxis: [0, 1, 0],
    // The array at the +z end trails: a choice, its side not published.
    rollAxis: [0, 0, -1],
  },
};

const SENTINEL_6_SHAPE: CraftShape = {
  model: 'sentinel-6.glb',
  pivot: [-0.08232, -0.06233, -0.05093],
  metresPerUnit: 1,
  boxM: null,
  pointsAt: 'nadir',
  pointingPart: 'instruments',
  // The Poseidon-4 altimeter's dish on -y, the roof of arrays on +y.
  pointingAxis: [0, -1, 0],
  // Along its length; the radiometer's end, +x, leading is a choice.
  rollAxis: [1, 0, 0],
};

const SUOMI_NPP_SHAPE: CraftShape = {
  model: 'suomi-npp.glb',
  pivot: [-0.27631, -0.737, 0.42419],
  metresPerUnit: 1,
  boxM: null,
  pointsAt: 'nadir',
  pointingPart: 'instruments',
  // VIIRS's rotating telescope, the dark drum, under -y; the array runs along z, across
  // the track, turning about it to the Sun.
  pointingAxis: [0, -1, 0],
  rollAxis: [1, 0, 0],
};

const GOES_R: SatelliteLook = {
  // 15.26 m along z in the file, bus and array; NOAA's 6.1 x 5.6 x 3.9 m is as stowed.
  spanM: 15.3,
  shape: {
    model: 'goes-r.glb',
    pivot: [0.16609, -0.32306, 0.33443],
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'nadir',
    pointingPart: 'instruments',
    // ABI and GLM on the bench at +y; the thruster at -y; the wing along z, north-south.
    pointingAxis: [0, 1, 0],
    // East-west; which side leads is a choice.
    rollAxis: [1, 0, 0],
  },
};

const TDRS_FIRST: SatelliteLook = {
  spanM: 17.4,
  shape: {
    model: 'tdrs-gen1.glb',
    pivot: [-0.14437, 4.64984, 0.17437],
    // 94.44 units across the arrays; 57 ft, 17.4 m. The single-access dishes come out
    // 4.4 m against the 4.9 m quoted with that figure.
    metresPerUnit: 0.18424,
    boxM: null,
    pointsAt: 'nadir',
    pointingPart: 'antennas',
    // The two gold dishes, the link dish and the multiple-access array all open to +y;
    // the wings run along x, north-south, so the dishes lie east and west, along track.
    pointingAxis: [0, 1, 0],
    rollAxis: [0, 0, 1],
  },
};

const TDRS_BOEING: SatelliteLook = {
  // "68 feet, 10 inches (21 meters) long by 43 feet, five inches (13 meters) wide":
  // the file is 21.12 by 13.11 m.
  spanM: 21,
  shape: {
    model: 'tdrs-gen2.glb',
    pivot: [-0.00218, 1.55962, -0.24082],
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'nadir',
    pointingPart: 'antennas',
    pointingAxis: [0, 1, 0],
    rollAxis: [0, 0, 1],
  },
};

const MMS: SatelliteLook = {
  // The octagon, as Wind is framed by its drum: the booms are not the craft.
  spanM: 3.5,
  shape: {
    model: 'mms.glb',
    pivot: [0.00133, 0.13607, -0.0031],
    // 2.0 units across the octagon; 3.5 m. Its 1.2 m height comes out 1.05 m.
    metresPerUnit: 1.75,
    boxM: null,
    pointsAt: 'ecliptic-south',
    pointingPart: 'spin-axis',
    // The axis is the craft's; which end is north is not determinable, -y south a choice.
    pointingAxis: [0, -1, 0],
    rollAxis: [1, 0, 0],
  },
};

const GRACE_FO: SatelliteLook = {
  spanM: 3.123,
  shape: {
    model: 'grace-fo.glb',
    pivot: [-0.00005, -0.29443, -0.01421],
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'nadir',
    pointingPart: 'deck',
    // Cells on the top and sides, +y; the flat bottom, -y, to Earth.
    pointingAxis: [0, -1, 0],
    // The K-band horn, +z, faces the other satellite 220 km away: forward for the
    // trailing one, aft for the leader. Which is which is not here; both drawn horn first.
    rollAxis: [0, 0, 1],
  },
};

const SENTINEL_2: SatelliteLook = { spanM: 3.4, shape: { ...NADIR_BOX, boxM: [3.4, 1.8, 2.35] } };

const OBSERVATORY = { facingNote: OBSERVATORY_NOTE } as const;

export const LOOKS = {
  iss: { spanM: 109, shape: ISS_SHAPE },
  tiangong: { spanM: 55.7, shape: { ...NADIR_BOX, boxM: [16.6, 55.7, 4.2] } },

  hubble: {
    spanM: 13.3,
    shape: {
      model: 'hubble.glb',
      pivot: [-0.08553, 0.30902, 0.03398],
      // The tube 13.5 m from the aft bulkhead to the light shield's rim against NASA's
      // 13.3 m, its aft shroud 4.5 m across against 4.2 m.
      metresPerUnit: 1,
      boxM: null,
      pointsAt: 'sun',
      pointingPart: 'solar-arrays',
      // The arrays' cells face -z (the struts are on +z); the optical axis, V1, is +y,
      // the aperture door at its top. The Sun is kept in the V1-V3 half-plane, arrays
      // on it (HST Primer).
      pointingAxis: [0, 0, -1],
      rollAxis: [0, 1, 0],
      ...OBSERVATORY,
    },
  },
  chandra: {
    spanM: 19.5,
    shape: {
      model: 'chandra.glb',
      pivot: [-0.56283, -0.05438, -0.00006],
      // 13.78 m long and 19.51 m across the arrays: "13.8 m x 19.5 m" (CXC).
      metresPerUnit: 1,
      boxM: null,
      pointsAt: 'sun',
      pointingPart: 'solar-arrays',
      // The wings run along z, both faces dark: which carries the cells is not
      // determinable, +y a choice. The telescope lies along x.
      pointingAxis: [0, 1, 0],
      rollAxis: [1, 0, 0],
      ...OBSERVATORY,
    },
  },
  xmmNewton: {
    spanM: 16,
    shape: {
      model: 'xmm-newton.glb',
      pivot: [-0.01263, -0.15592, 0.51298],
      modelOwner: 'ESA',
      // 15.92 m across the arrays and 10.10 m long: "10 metres", "16 metres span" (ESA).
      metresPerUnit: 1,
      boxM: null,
      pointsAt: 'sun',
      pointingPart: 'solar-arrays',
      // The three mirror apertures open to +z, the tube runs back to -z; the wings run
      // along x, their cell side not determinable, -y a choice.
      pointingAxis: [0, -1, 0],
      rollAxis: [0, 0, 1],
      ...OBSERVATORY,
    },
  },
  swift: {
    spanM: 5.64,
    shape: {
      model: 'swift.glb',
      pivot: [-0.03898, 0.68065, 1.3283],
      metresPerUnit: 0.19158,
      boxM: null,
      pointsAt: 'sun',
      pointingPart: 'solar-arrays',
      // The cells face +z (grey backs on -z); BAT's mask, XRT and UVOT look along +y.
      pointingAxis: [0, 0, 1],
      rollAxis: [0, 1, 0],
      ...OBSERVATORY,
    },
  },
  fermi: {
    spanM: 15,
    shape: {
      model: 'fermi.glb',
      pivot: [0.99319, -1.29455, 0.00046],
      metresPerUnit: 0.24074,
      boxM: null,
      pointsAt: 'sun',
      pointingPart: 'solar-arrays',
      // The wings run along z with their cells, as the file has them, on +y, the LAT's
      // side; in its sky survey Fermi rolls about the LAT's axis to keep them on the Sun.
      pointingAxis: [0, 1, 0],
      rollAxis: [0, 0, 1],
      ...OBSERVATORY,
    },
  },
  nustar: { spanM: 10.9, shape: { ...SUN_BOX, boxM: [10.9, 1.2, 1.2] } },
  ixpe: { spanM: 5.2, shape: { ...SUN_BOX, boxM: [5.2, 2.7, 1.1] } },
  sdo: {
    spanM: 6.25,
    shape: {
      model: 'sdo.glb',
      pivot: [0.77648, 0.89256, -0.10249],
      metresPerUnit: 0.16876,
      boxM: null,
      pointsAt: 'sun',
      pointingPart: 'instruments',
      // AIA's four telescopes, HMI and EVE at +y, the fixed arrays' cells too; the arrays
      // along z, the high-gain antennas' booms along x.
      pointingAxis: [0, 1, 0],
      rollAxis: [0, 0, 1],
    },
  },
  iris: { spanM: 3.6, shape: { ...SOLAR_BOX, boxM: [3.6, 0.6, 2.18] } },
  hinode: { spanM: 10, shape: { ...SOLAR_BOX, boxM: [10, 1.6, 4] } },
  timed: { spanM: 11.73, shape: { ...NADIR_BOX, boxM: [1.2, 11.73, 2.72] } },
  mms1: MMS,
  mms2: MMS,
  mms3: MMS,
  mms4: MMS,
  smile: {
    spanM: 9.8,
    shape: {
      model: 'smile.glb',
      pivot: [-0.01798, -1.76822, -0.40922],
      modelOwner: 'ESA',
      // 4.85 x 3.52 x 9.82 m: "4.8 x 9.8 x 3.5 m (deployed in orbit)" (ESA).
      metresPerUnit: 1,
      boxM: null,
      pointsAt: 'sun',
      pointingPart: 'solar-arrays',
      // The wings run along z, their blue cells on -x.
      pointingAxis: [-1, 0, 0],
      rollAxis: [0, 1, 0],
      facingNote:
        'Points its imagers at Earth’s magnetosphere on a plan not carried here: drawn with its solar arrays on the Sun.',
    },
  },

  terra: {
    // The file's 26,053.87 units along z, bus and array mast, scaled: nothing overall
    // is published.
    spanM: 13,
    shape: {
      model: 'terra.glb',
      pivot: [455.05355, -227.07693, -1558.60756],
      // 13,621.76 units along the bus; "6.8 m long" (NASA). The array comes out 5.1 m
      // wide against the 5.08 m TRW gives (NTRS 20000118221).
      metresPerUnit: 0.0004992,
      boxM: null,
      pointsAt: 'nadir',
      pointingPart: 'instruments',
      // The high-gain antenna's mast rises from +y, toward the zenith and TDRS; the wing
      // runs along z, across the track; the 6.8 m bus along it, +x leading a choice.
      pointingAxis: [0, -1, 0],
      rollAxis: [1, 0, 0],
    },
  },
  aqua: {
    spanM: 16.7,
    shape: {
      model: 'aqua.glb',
      pivot: [-0.04538, -0.79673, -0.42464],
      // 9.40 x 17.78 x 5.08 m against "4.8 m x 16.7 m x 8 m" deployed (NASA): the long
      // axis within 7%.
      metresPerUnit: 1,
      boxM: null,
      pointsAt: 'nadir',
      pointingPart: 'instruments',
      // The file is in the spacecraft's own frame: Aura's press kit, on the same bus,
      // gives +X along the velocity, +Z nadir and the array on -Y, as the file has it.
      pointingAxis: [0, 0, 1],
      rollAxis: [1, 0, 0],
    },
  },
  aura: {
    spanM: 17.37,
    shape: {
      model: 'aura.glb',
      pivot: [0.65031, -0.59775, 0.355],
      // 8.73 x 18.70 x 3.44 m against "4.70 x 17.37 x 6.91 m" deployed (press kit): the
      // long axis within 8%; the other two are not as the kit has them.
      metresPerUnit: 1,
      boxM: null,
      pointsAt: 'nadir',
      pointingPart: 'instruments',
      // +X velocity, +Z nadir, the array along -Y (press kit p. 29), as the file has it.
      pointingAxis: [0, 0, 1],
      rollAxis: [1, 0, 0],
    },
  },
  landsat8: LANDSAT,
  landsat9: LANDSAT,
  graceFo1: GRACE_FO,
  graceFo2: GRACE_FO,
  smap: {
    spanM: 9.7,
    shape: {
      model: 'smap.glb',
      pivot: [-0.01814, 4.94499, 0.01956],
      // 9.52 m along y, bus to reflector, against "9.7 by 7.1 by 6.8 meters" (JPL).
      metresPerUnit: 1,
      boxM: null,
      pointsAt: 'nadir',
      pointingPart: 'instruments',
      // The 6 m reflector spins about the bus's axis, y, above it; fed from the bus, it
      // looks past it at Earth 40 degrees off nadir, so the bus is the nadir end, -y.
      // The array faces -z, which on its dawn-dusk orbit is across the track, at the Sun.
      pointingAxis: [0, -1, 0],
      rollAxis: [1, 0, 0],
    },
  },
  pace: { spanM: 3.2, shape: { ...NADIR_BOX, boxM: [1.5, 1.5, 3.2] } },
  icesat2: {
    spanM: 10,
    shape: {
      model: 'icesat-2.glb',
      pivot: [1.04104, 0.17198, 0.63503],
      // NASA 3D Resources' (C): 3.80 x 2.48 x 10.06 m, "12.5 feet tall with an 8.2-foot-
      // by-6.2-foot base ... increases the 6.2-foot dimension to 32.8 feet" (NASA). The
      // lighter (A) and (B) draw the array 27% short.
      metresPerUnit: 1,
      boxM: null,
      pointsAt: 'nadir',
      pointingPart: 'instruments',
      // ATLAS, its telescope and radiator, at the +x end of the bus; the array, which
      // turns about its length, runs along z, across the track; +y leading a choice.
      pointingAxis: [1, 0, 0],
      rollAxis: [0, 1, 0],
    },
  },
  swot: { spanM: 14.9, shape: { ...NADIR_BOX, boxM: [14.9, 10, 5] } },
  oco2: {
    spanM: 9,
    shape: {
      model: 'oco-2.glb',
      pivot: [0.00333, 5.85193, 0.85772],
      metresPerUnit: 0.22576,
      boxM: null,
      pointsAt: 'nadir',
      pointingPart: 'instruments',
      // The spectrometer's telescope at the +y end of the bus; the wings along z.
      pointingAxis: [0, 1, 0],
      rollAxis: [1, 0, 0],
    },
  },
  gpm: {
    spanM: 11.6,
    shape: {
      model: 'gpm.glb',
      pivot: [-0.28626, 2.39725, 1.00343],
      metresPerUnit: 0.026858,
      boxM: null,
      pointsAt: 'nadir',
      pointingPart: 'instruments',
      // GMI's reflector on its mast at +y, looking down past the bus; the radar, DPR, on
      // the -y face. The arrays along z; +x leading a choice.
      pointingAxis: [0, -1, 0],
      rollAxis: [1, 0, 0],
    },
  },
  jason3: { spanM: 10, shape: { ...NADIR_BOX, boxM: [3.8, 10, 2] } },
  sentinel6a: { spanM: 5.13, shape: SENTINEL_6_SHAPE },
  // "5.82 meters long (including the AMR-C instrument)" (NASA): the model is the first's.
  sentinel6b: { spanM: 5.82, shape: SENTINEL_6_SHAPE },
  sentinel2a: SENTINEL_2,
  sentinel2b: SENTINEL_2,
  cryosat2: {
    spanM: 4.6,
    shape: {
      model: 'cryosat-2.glb',
      pivot: [-0.0581, 0.39911, 0.0376],
      modelOwner: 'ESA',
      // 4.74 x 2.57 x 1.91 m: "4.6 m x 2.34 m x 2.2 m" (ESA).
      metresPerUnit: 1,
      boxM: null,
      pointsAt: 'nadir',
      pointingPart: 'instruments',
      // SIRAL's two dishes under -y, the roof of cells over +y; the nose with the star
      // trackers at +z, leading a choice.
      pointingAxis: [0, -1, 0],
      rollAxis: [0, 0, 1],
    },
  },

  // 8.96 m along z in the file; NASA gives the arrays as 8 m and no overall size.
  suomiNpp: { spanM: 9, shape: SUOMI_NPP_SHAPE },
  // "3.2 x 3.4 x 10.4 meters" after deployment (Ball): the model, NPP's, is 8.96 m.
  noaa20: { spanM: 10.4, shape: SUOMI_NPP_SHAPE },
  noaa21: { spanM: 10.7, shape: { ...NADIR_BOX, boxM: [4.3, 10.7, 2.1] } },
  goes16: GOES_R,
  goes17: GOES_R,
  goes18: GOES_R,
  goes19: GOES_R,

  tdrs3: TDRS_FIRST,
  tdrs5: TDRS_FIRST,
  tdrs6: TDRS_FIRST,
  tdrs7: TDRS_FIRST,
  tdrs8: TDRS_BOEING,
  tdrs11: TDRS_BOEING,
  tdrs12: TDRS_BOEING,
  tdrs13: TDRS_BOEING,

  envisat: { spanM: 26, shape: { ...NADIR_BOX, boxM: [26, 10, 5] } },
} as const satisfies Record<string, SatelliteLook>;
