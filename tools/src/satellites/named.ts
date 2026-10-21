/**
 * The satellites drawn by name and propagated with full SGP4 in the browser: the stations,
 * NASA's Earth-orbiting fleet and the observatories it shares, the weather satellites NASA
 * builds for NOAA, the relays they all talk through, and a few the eye knows. Every other
 * object is in the bulk or the SGP4 tier, under CelesTrak's name for it.
 *
 * Keyed by NORAD catalogue number, which never changes; the names CelesTrak carries
 * ("FGRST (GLAST)", "CSS (TIANHE)") are the catalogue's, and these are the ones people use.
 * Every number was checked present in CelesTrak's groups on 2026-10-21. One that is missing
 * from a run -- re-entered, or no longer in any group read -- is left out with a line in the
 * log, never drawn from stale elements.
 *
 * The operator is the agency that flies it, as it names itself; the launch date is not
 * here but taken from CelesTrak's SATCAT at build, so it cannot be mistyped.
 */

export interface NamedEntry {
  readonly id: string;
  readonly noradId: number;
  readonly name: string;
  readonly operator: string;
  /** What SGP4 does poorly for it, in the info panel's words; null where it is the right model. */
  readonly note: string | null;
}

const NASA = 'NASA';
const NOAA_NASA = 'NOAA, NASA';

/**
 * A very eccentric orbit, out to about a third of the way to the Moon (Chandra's apogee is
 * 133,000 km, MMS's about 150,000), where SGP4's deep-space theory carries the Sun's and
 * Moon's pull only in its truncated, averaged form. Measured for Chandra on 2026-10-21,
 * SGP4 from CelesTrak's element set against the Chandra X-ray Center's own trajectory (as
 * Horizons serves it, -151), every two hours over two days: 10 to 21 km for the 40 hours
 * around apogee, rising to 240 km through perigee, where it moves fastest. The same check
 * on the ISS -- whose Horizons trajectory is built from the same element sets -- agrees to
 * 10 m, so the gap is SGP4's, not the frame's.
 */
const HIGH_ORBIT_NOTE =
  'Highly eccentric orbit reaching a third of the way to the Moon. SGP4 models the pull ' +
  'of the Sun and Moon only approximately out there: for Chandra it is 10-20 km off the ' +
  "operator's own trajectory near apogee and a few hundred km off through perigee.";

export const NAMED_SATELLITES: readonly NamedEntry[] = [
  // Crewed stations.
  { id: 'iss', noradId: 25544, name: 'International Space Station', operator: 'NASA, Roscosmos, ESA, JAXA, CSA', note: null },
  { id: 'tiangong', noradId: 48274, name: 'Tiangong', operator: 'CMSA', note: null },

  // Observatories.
  { id: 'hubble', noradId: 20580, name: 'Hubble Space Telescope', operator: 'NASA, ESA', note: null },
  { id: 'chandra', noradId: 25867, name: 'Chandra X-ray Observatory', operator: NASA, note: HIGH_ORBIT_NOTE },
  { id: 'xmm-newton', noradId: 25989, name: 'XMM-Newton', operator: 'ESA', note: HIGH_ORBIT_NOTE },
  { id: 'swift', noradId: 28485, name: 'Swift', operator: NASA, note: null },
  { id: 'fermi', noradId: 33053, name: 'Fermi Gamma-ray Space Telescope', operator: NASA, note: null },
  { id: 'nustar', noradId: 38358, name: 'NuSTAR', operator: NASA, note: null },
  { id: 'ixpe', noradId: 49954, name: 'IXPE', operator: 'NASA, ASI', note: null },
  { id: 'sdo', noradId: 36395, name: 'Solar Dynamics Observatory', operator: NASA, note: null },
  { id: 'iris', noradId: 39197, name: 'IRIS', operator: NASA, note: null },
  { id: 'hinode', noradId: 29479, name: 'Hinode', operator: 'JAXA', note: null },
  { id: 'timed', noradId: 26998, name: 'TIMED', operator: NASA, note: null },
  { id: 'mms-1', noradId: 40482, name: 'MMS 1', operator: NASA, note: HIGH_ORBIT_NOTE },
  { id: 'mms-2', noradId: 40483, name: 'MMS 2', operator: NASA, note: HIGH_ORBIT_NOTE },
  { id: 'mms-3', noradId: 40484, name: 'MMS 3', operator: NASA, note: HIGH_ORBIT_NOTE },
  { id: 'mms-4', noradId: 40485, name: 'MMS 4', operator: NASA, note: HIGH_ORBIT_NOTE },
  { id: 'smile', noradId: 69123, name: 'SMILE', operator: 'ESA, CAS', note: HIGH_ORBIT_NOTE },

  // Earth science.
  { id: 'terra', noradId: 25994, name: 'Terra', operator: NASA, note: null },
  { id: 'aqua', noradId: 27424, name: 'Aqua', operator: NASA, note: null },
  { id: 'aura', noradId: 28376, name: 'Aura', operator: NASA, note: null },
  { id: 'landsat-8', noradId: 39084, name: 'Landsat 8', operator: 'NASA, USGS', note: null },
  { id: 'landsat-9', noradId: 49260, name: 'Landsat 9', operator: 'NASA, USGS', note: null },
  { id: 'grace-fo-1', noradId: 43476, name: 'GRACE-FO 1', operator: 'NASA, GFZ', note: null },
  { id: 'grace-fo-2', noradId: 43477, name: 'GRACE-FO 2', operator: 'NASA, GFZ', note: null },
  { id: 'smap', noradId: 40376, name: 'SMAP', operator: NASA, note: null },
  { id: 'pace', noradId: 58928, name: 'PACE', operator: NASA, note: null },
  { id: 'icesat-2', noradId: 43613, name: 'ICESat-2', operator: NASA, note: null },
  { id: 'swot', noradId: 54754, name: 'SWOT', operator: 'NASA, CNES', note: null },
  { id: 'oco-2', noradId: 40059, name: 'OCO-2', operator: NASA, note: null },
  { id: 'gpm', noradId: 39574, name: 'GPM Core Observatory', operator: 'NASA, JAXA', note: null },
  { id: 'jason-3', noradId: 41240, name: 'Jason-3', operator: 'NOAA, EUMETSAT, CNES, NASA', note: null },
  { id: 'sentinel-6a', noradId: 46984, name: 'Sentinel-6 Michael Freilich', operator: 'ESA, EUMETSAT, NASA, NOAA', note: null },
  { id: 'sentinel-6b', noradId: 66514, name: 'Sentinel-6B', operator: 'ESA, EUMETSAT, NASA, NOAA', note: null },
  { id: 'sentinel-2a', noradId: 40697, name: 'Sentinel-2A', operator: 'ESA', note: null },
  { id: 'sentinel-2b', noradId: 42063, name: 'Sentinel-2B', operator: 'ESA', note: null },
  { id: 'cryosat-2', noradId: 36508, name: 'CryoSat-2', operator: 'ESA', note: null },

  // Weather: the polar orbiters and the geostationary GOES that NASA builds for NOAA.
  { id: 'suomi-npp', noradId: 37849, name: 'Suomi NPP', operator: NOAA_NASA, note: null },
  { id: 'noaa-20', noradId: 43013, name: 'NOAA-20', operator: NOAA_NASA, note: null },
  { id: 'noaa-21', noradId: 54234, name: 'NOAA-21', operator: NOAA_NASA, note: null },
  { id: 'goes-16', noradId: 41866, name: 'GOES-16', operator: NOAA_NASA, note: null },
  { id: 'goes-17', noradId: 43226, name: 'GOES-17', operator: NOAA_NASA, note: null },
  { id: 'goes-18', noradId: 51850, name: 'GOES-18', operator: NOAA_NASA, note: null },
  { id: 'goes-19', noradId: 60133, name: 'GOES-19', operator: NOAA_NASA, note: null },

  // NASA's Tracking and Data Relay Satellites, every one still in the catalogue's active set.
  { id: 'tdrs-3', noradId: 19548, name: 'TDRS-3', operator: NASA, note: null },
  { id: 'tdrs-5', noradId: 21639, name: 'TDRS-5', operator: NASA, note: null },
  { id: 'tdrs-6', noradId: 22314, name: 'TDRS-6', operator: NASA, note: null },
  { id: 'tdrs-7', noradId: 23613, name: 'TDRS-7', operator: NASA, note: null },
  { id: 'tdrs-8', noradId: 26388, name: 'TDRS-8', operator: NASA, note: null },
  { id: 'tdrs-11', noradId: 39070, name: 'TDRS-11', operator: NASA, note: null },
  { id: 'tdrs-12', noradId: 39504, name: 'TDRS-12', operator: NASA, note: null },
  { id: 'tdrs-13', noradId: 42915, name: 'TDRS-13', operator: NASA, note: null },

  // Dead, and the largest thing in low orbit that nobody controls.
  { id: 'envisat', noradId: 27386, name: 'Envisat', operator: 'ESA', note: null },
];

/**
 * Objects in CelesTrak's groups that the run draws as bodies of their own, from Horizons,
 * and so leaves out here. TESS above all: it flies a 13.7-day orbit in 2:1 resonance with
 * the Moon, out to 375,000 km, where the Moon's pull is not a perturbation but half the
 * dynamics. SGP4's deep-space theory, built for orbits of a day or less, is not a model of
 * that -- its element set is also refreshed only monthly (30 days old on 2026-10-21) -- and
 * JPL's reconstructed trajectory is in the catalog as `tess`.
 */
export const EXCLUDED_NORAD_IDS: ReadonlyMap<number, string> = new Map([[43435, 'tess']]);
