import type { RecordHolder } from './recordHolders.ts';

/**
 * Three famous galaxies Laniakea's catalogue does not have: neither Cosmicflows-4 nor the 2MASS
 * Redshift Survey lists them under any name, so they are not among its 86,899 points of light.
 * Made bodies here, as the record-holders are (recordHolders.ts registers them: a mark, a name, a
 * panel, the search) but drawn with Laniakea's structures, in its layer and its fade -- they are
 * a few hundred million light years off, not at the edge of the observable universe.
 *
 * ## Where each is
 *
 * At NED's position, and at the comoving distance of NED's redshift moved into the CMB's frame
 * (cmbFrame.ts) in Cosmicflows-4's cosmology, H0 74.6 -- as Laniakea's galaxies placed by their
 * redshifts are (tools/src/laniakea/frames.ts), so each sits among its neighbours there. NED
 * lists no distance measured any other way for any of the three (checked 2026-11-17): the
 * redshift is all there is, and a galaxy's own motion of a few hundred km/s is in it, a few Mpc.
 *
 * Each is a mark, its light not drawn: the catalogue's photometry and shapes, which the volumes
 * are drawn from, are not there for it.
 */

const NOT_IN_LANIAKEA = 'Not in Cosmicflows-4 or 2MRS: a mark at its redshift’s distance, its light not drawn; NED lists no distance measured any other way.';

export const FAMOUS_GALAXIES: readonly RecordHolder[] = [
  {
    key: 'hoags-object',
    name: 'Hoag’s Object',
    otherNames: ['Hoag\'s Object', 'Hoags Object', 'PGC 54559', 'PRC D-51'],
    kind: 'galaxy',
    record: 'A ring galaxy: a round core in a nearly perfect ring',
    z: 0.042423,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'Its optical spectrum (NED)',
    raDeg: 229.31005,
    decDeg: 21.58554,
    position: 'NED',
    reference: 'Hoag 1950, AJ 55, 170; NED',
    note: `Found by Arthur Hoag on a 1950 plate, who wondered whether it was a planetary nebula. How its ring formed is not settled: no companion is seen. ${NOT_IN_LANIAKEA}`,
    nearby: true,
  },
  {
    key: 'mayalls-object',
    name: 'Mayall’s Object',
    otherNames: ['Mayall\'s Object', 'Mayalls Object', 'Arp 148', 'VV 32'],
    kind: 'galaxy',
    record: 'Two galaxies just after one passed through the other: a ring and its intruder',
    z: 0.034524,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'Its optical spectrum (NED)',
    raDeg: 165.97478,
    decDeg: 40.84998,
    position: 'NED, the pair’s',
    reference: 'Arp 1966, ApJS 14, 1 (Arp 148); NED',
    note: `Found by Nicholas Mayall at Lick Observatory in 1940; number 148 in Arp’s atlas of peculiar galaxies. ${NOT_IN_LANIAKEA}`,
    nearby: true,
  },
  {
    key: 'cartwheel-galaxy',
    name: 'Cartwheel Galaxy',
    otherNames: ['Cartwheel', 'ESO 350-40', 'ESO 350-G040', 'PGC 2248'],
    kind: 'galaxy',
    record: 'A ring galaxy: a collision’s wave of new stars spreading outward',
    z: 0.030187,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'Its optical spectrum (NED)',
    raDeg: 9.4214,
    decDeg: -33.71631,
    position: 'NED',
    reference: 'Higdon 1995, ApJ 455, 524; NED',
    note: `Found by Fritz Zwicky in 1941. A smaller galaxy fell through its disc; its stars now form in the ring, most in its southern part (Higdon 1995). ${NOT_IN_LANIAKEA}`,
    nearby: true,
  },
];
