import type { BeltClass, BeltInfo, CometInfo, SatelliteInfo } from '@sss/tools/types';

import { beltTiers, type LoadedTier } from '../../core/belt.ts';
import type { EphemerisStore } from '../../core/ephemerisStore.ts';
import { BULK_WINDOW_DAYS, NAMED_WINDOW_DAYS } from '../../core/satellites.ts';

/**
 * The About text's paragraphs that are built from the data rather than written down:
 * counts, dates and measured figures read from the manifest and the catalogues, so they
 * follow every rebuild instead of going stale in the source. Moved here from
 * AboutPanel.tsx, which re-exports them.
 */

/**
 * How far either side of the build the close orbiters are followed, months. The
 * generator's CLOSE_ORBIT_WINDOW_MONTHS, restated: the web app does not import the tools'
 * configuration, and a test holds the two equal.
 */
export const CLOSE_ORBIT_MONTHS = 3;

/**
 * The small moons, as a paragraph. Counted from the data, because a moon JPL has nothing
 * for inside its window is left out of it -- Daphnis's ephemeris stops in 2018.
 */
export function smallMoonSentence(store: EphemerisStore): string {
  // Counted from the manifest: the moons themselves are fetched only system by system.
  const counts = Object.values(store.manifest.smallMoons ?? {});
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) {
    return '';
  }
  const sized = counts.reduce((sum, entry) => sum + entry.sized, 0);
  const saturn = store.smallMoonCount('saturn')?.count ?? 0;
  return `And ${spelled(total)} small moons: every other satellite JPL publishes, Saturn’s 128 discoveries of 2025 among them. Most are a few kilometres of dark rock on a wide, tilted, often backward orbit, and for most an orbit is all that is known — JPL gives a size for ${spelled(sized)}, and the rest are drawn as markers rather than as spheres of a size nobody has measured. Their tables hold JPL’s positions to a hundredth of their radius but never finer than a kilometre — and far out, as for the spacecraft, to ten microradians seen from the planet — since JPL itself places the faintest of them only to hundreds of kilometres; they cover three months either side of the build for the inner moons, which go round in hours, and a year for the rest; outside that they are propagated and marked approximate. A small moon’s orbit is drawn only while it is the focus — Saturn’s all together would be a tangle of ${saturn} — and they are off until the Small Moons layer is switched on. And they cost nothing until you go there: each planet’s are fetched the first time its system is entered.`;
}

/** The named small bodies about the Sun, counted and their drawn shapes named from the data. */
export function smallBodySentence(store: EphemerisStore): string {
  const small = store.bodies.filter((body) => body.sampling !== undefined && body.parent === null);
  const drawn = small.filter((body) => body.shapeDrawn !== false);
  const listed = (names: readonly string[]) =>
    names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  const round = listed(drawn.filter((body) => body.shapeModel === undefined).map((body) => body.name));
  const modelled = listed(drawn.filter((body) => body.shapeModel !== undefined).map((body) => body.name));
  const models =
    modelled === ''
      ? ' The irregular ones are markers until their shape models are in.'
      : ` ${modelled} are drawn from their mission teams’ own shape models — OSIRIS-REx’s, Hayabusa2’s, DART’s, New Horizons’ and Lucy’s — at true size, turned by the rotation of the very frame each model is published in, Bennu and Ryugu with their missions’ global maps draped on them and scaled to their measured albedo: Bennu reflects 4.4% of the light that falls on it. Ryugu’s model and map are ISAS/JAXA’s, converted and compressed here; its map’s images JAXA, University of Tokyo & collaborators’. Where a spin is known only near a flyby, the info panel says so. The rest, a tumbling peanut or a body no team has published a shape of, are markers.`;
  return `${capitalised(spelled(small.length))} named small bodies — the other dwarf planets, the largest asteroids, and the ones spacecraft here have visited or are flying to, Apophis for its 2029 pass inside the geostationary ring — from JPL’s own integrations rather than propagated elements, held to a kilometre everywhere because the craft fly beside them. Sizes, masses and spins from JPL’s Small-Body Database and the papers it cites. A shape is drawn only where one can be honestly: ${round} from their radii and rotation.${models}`;
}

/** Julian day to a calendar date, YYYY-MM-DD; a day's precision is all prose needs. */
function jdToDate(jd: number): string {
  return new Date((jd - 2440587.5) * 86_400_000).toISOString().slice(0, 10);
}

/** How many of the loaded asteroids are in any of `classes`. */
function classTotal(tiers: readonly LoadedTier[], classes: readonly BeltClass[]): number {
  let total = 0;
  for (const tier of tiers) {
    for (const name of classes) {
      total += tier.classCounts[name] ?? 0;
    }
  }
  return total;
}

/**
 * Geometric albedo the prose turns an absolute magnitude into a size at. A middling
 * value: the dark C-types are at 0.05 and the stony S-types at 0.25, so any one size
 * for an H is a factor of 1.5 either way, and is said as "about".
 */
const PROSE_ALBEDO = 0.1;

/** Diameter in km for an absolute magnitude: D = 1329 km / sqrt(albedo) · 10^(-H/5). */
export function diameterKm(H: number, albedo = PROSE_ALBEDO): number {
  return (1329 / Math.sqrt(albedo)) * 10 ** (-H / 5);
}

/** "about 4 km", "about 1.7 km": whole kilometres from two up. */
function aboutKm(H: number): string {
  const km = diameterKm(H);
  return `about ${km >= 2 ? Math.round(km) : km.toFixed(1)} km`;
}

/**
 * The belt, as a paragraph: counted from the tiers in hand, as the moons are from their
 * files -- so with the first tier alone it is 84,000 asteroids and says what the rest are.
 */
export function beltSentence(info: BeltInfo, tiers: readonly LoadedTier[]): string {
  const groups = [
    [classTotal(tiers, ['MBA', 'IMB', 'OMB']), 'in the main belt'],
    [classTotal(tiers, ['TJN']), 'Jupiter Trojans, sharing its orbit 60° ahead and behind'],
    [classTotal(tiers, ['MCA']), 'Mars-crossers'],
    [classTotal(tiers, ['APO', 'ATE', 'AMO', 'IEO']), 'near-Earth asteroids'],
    [classTotal(tiers, ['CEN']), 'centaurs among the giant planets'],
    [classTotal(tiers, ['TNO']), 'beyond Neptune'],
  ] as const;
  const parts = groups
    .filter(([count]) => count > 0)
    .map(([count, what]) => `${count.toLocaleString('en-US')} ${what}`);
  const listed = parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
  const loaded = tiers.reduce((sum, tier) => sum + tier.tier.count, 0);
  const all = tiers.length >= beltTiers(info).length;
  const faintestH = tiers.at(-1)?.tier.faintestH ?? null;
  const reach =
    faintestH === null
      ? ''
      : ` brighter than absolute magnitude ${faintestH} — down to ${aboutKm(faintestH)} across at an albedo of ${PROSE_ALBEDO}`;
  const which = all
    ? `every one of the ${loaded.toLocaleString('en-US')} asteroids JPL’s Small-Body Database knows${reach}${reach === '' ? ',' : ' —'}`
    : `the ${loaded.toLocaleString('en-US')} brightest of the ${info.count.toLocaleString('en-US')} asteroids JPL’s Small-Body Database knows, every one${reach} —`;
  const rest = all
    ? ''
    : ' The rest are a setting under Asteroids in the Layers panel, a magnitude at a time, because the whole catalogue is a download of its own.';
  return `The asteroid belt: ${which} each on its own orbit, at its own place on it${listed === '' ? '' : `: ${listed}`}.${rest} The graphics card places them, solving Kepler’s equation for every one of them on every frame, so the whole belt turns with the clock at any speed: the inner edge goes round in a little over three years, the outer in six. The ${spelled(info.excluded.length)} drawn as bodies of their own are left out of it, so none is drawn twice.`;
}

/**
 * The satellites, as a paragraph: what places them, how well, and for how long. The
 * measured figures from the data when it is here; the rule alone before.
 */
export function satelliteAccuracySentence(info: SatelliteInfo | null): string {
  const leo = info?.accuracy.find((row) => row.regime === 'leo') ?? null;
  const geo = info?.accuracy.find((row) => row.regime === 'geo') ?? null;
  const at = (row: typeof leo, days: number): string | null => {
    if (row === null) {
      return null;
    }
    const k = row.days.findIndex((day) => day >= days);
    return k < 0 ? null : `${Math.round(row.medianKm[k]!)} km (95%: ${Math.round(row.p95Km[k]!)} km)`;
  };
  const leoText = at(leo, BULK_WINDOW_DAYS);
  const geoText = at(geo, BULK_WINDOW_DAYS);
  const measured =
    leoText === null || geoText === null
      ? ''
      : ` Measured on each day’s own elements, the dots are off SGP4 by a median ${leoText} in low orbit at ${BULK_WINDOW_DAYS} days, and ${geoText} at the geostationary ring, where the Moon and Sun pull hardest.`;
  return (
    `Earth’s satellites are placed from the US Space Force’s element sets, which are not positions but the mean elements of one model, SGP4, fitted to radar and optical tracking. The named satellites, and a few hundred the simpler model cannot follow — Molniya and transfer orbits, Starlinks still raising their orbits — are run through SGP4 itself, which is how the elements are meant to be read: good to a kilometre or two near their epoch, drifting as drag does after it. The tens of thousands of others are dots placed by the graphics card from SGP4’s secular terms alone, J3 included and the short-period wobbles left out.` +
    measured +
    ` SGP4 answers in its own frame, true equator and mean equinox of the date, turned here into the ecliptic of J2000 through the 1976 precession and the 1980 nutation: against JPL Horizons’ International Space Station, built from the same element set, the station lands within 10 metres. The elements are only good for days: a named satellite is drawn within ${NAMED_WINDOW_DAYS} days of its own — the ISS’s, run back a week, is already 38 km off — and the dots within ${BULK_WINDOW_DAYS} days of the day the data was built; outside that they are not drawn at all. Every dot is a convention, a pixel or so whatever the distance: the ISS is 109 m across, a fifth of a pixel from a thousand kilometres. Satellites are off until the Satellites layer is switched on, and cost nothing before.`
  );
}

/** How many comets of `info` are on each kind of conic, from their class counts. */
function openCount(info: CometInfo): { readonly parabolic: number; readonly hyperbolic: number } {
  return { parabolic: info.classCounts.PAR ?? 0, hyperbolic: info.classCounts.HYP ?? 0 };
}

/** The comets: what they are drawn from, what the dots say, and what is approximate. */
export function cometAccuracySentence(info: CometInfo): string {
  const { parabolic, hyperbolic } = openCount(info);
  return (
    `The ${info.count.toLocaleString('en-US')} comets SBDB lists, each on its own two-body conic about the Sun — ${parabolic.toLocaleString('en-US')} on parabolas and ${hyperbolic.toLocaleString('en-US')} on hyperbolas among them, interstellar 3I/ATLAS at e = 6.14 — worked out in double precision with universal variables, so an orbit at e = 0.999 and one at 1.001 are handled by the same equation rather than two that each break near the other. Propagated, not looked up, like the belt: a comet that has passed a planet, or one whose orbit SBDB fitted decades ago, is off its real path by more than any rounding here, and outgassing pushes every active comet off a pure conic too. Each dot is a convention: a pixel or two, brighter and larger as the comet’s own magnitude rises toward the Sun — SBDB’s M1 + K1·log₁₀ r, seen from one AU — and where SBDB gives no magnitude parameters, as for half of them, a typical comet’s at the same distance stands in, so none goes missing from the map. Comets are off until the Comets layer is switched on, and cost nothing before.` +
    // The famous ones are not in the cloud but bodies of their own (famousComets.ts in tools/).
    ((info.excluded?.length ?? 0) > 0
      ? ` The ${info.excluded!.length} comets people look for by name — Halley, Encke, 67P, Hale-Bopp, the two interstellar ones and more — are not among the dots: they are bodies of their own, placed from JPL’s numerical integration of each orbit, planets’ pull and outgassing included, to within a kilometre of JPL’s numbers across the whole window.`
      : '')
  );
}

/** What the belt's positions are worth, and why its dots are the size they are. */
export function beltAccuracySentence(info: BeltInfo): string {
  const { minJd, maxJd } = info.elementEpochs;
  const epoch =
    jdToDate(minJd) === jdToDate(maxJd)
      ? `their epoch, ${jdToDate(minJd)}`
      : `their epochs, ${jdToDate(minJd)} to ${jdToDate(maxJd)}`;
  return `The belt’s asteroids are propagated, not looked up: each moves on the two-body ellipse of its osculating elements, with nothing to pull it off — no Jupiter, no Mars. Measured against JPL’s own integrations for Ceres, Vesta and Eros, that drifts 40,000 to 190,000 km a year either side of ${epoch}, and up to about a degree of its orbit ten years out; an asteroid that passes close to a planet drifts most, as Apophis would, which is one reason it and the other named bodies are drawn from JPL’s integrations instead. Nor is the cloud what anyone would see: it is a map of where the asteroids are. With your own eyes, from anywhere in this view, you would see almost none of them — only Vesta, at its best, is ever a naked-eye point from Earth. The dots are a convention, as the planets’ markers are: a pixel or so whatever the distance, a little larger and stronger for the brighter ones, and past the 15th magnitude a single pixel each, every magnitude given half the light of the one before however many asteroids are in it — an exposure, not their real light, which barely falls magnitude to magnitude because their numbers grow almost as fast as each gets fainter, and drawn that way a million and a half of them are a sheet — because a few-kilometre asteroid is under a hundredth of a pixel even from a million kilometres away. Its place is real; its size on screen is not. From afar the same convention goes one step further: as a population of them crowds onto fewer pixels — the main belt from thirty AU puts twenty of its million and a half on each — its dots are drawn fainter, by just enough to keep the pixels they cover from filling in, though the largest never fade below a point; and once its whole ring has shrunk to a smudge a dozen pixels in radius it fades out, as a moon does onto its planet, so the inner belt never paints over the Sun. A legibility convention, and nothing about the asteroids.`;
}

/** The spacecraft in this data. Counted, because a craft with no data in the window is left out of it. */
export function craftCount(store: EphemerisStore): number {
  return store.bodies.filter((body) => body.kind === 'spacecraft').length;
}

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** A count in words, as prose spells one; digits from a hundred on. */
export function spelled(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 100) {
    return n.toLocaleString('en-US');
  }
  if (n < 20) {
    return ONES[n]!;
  }
  const tens = TENS[Math.floor(n / 10)]!;
  return n % 10 === 0 ? tens : `${tens}-${ONES[n % 10]!}`;
}

export function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A jump this size or larger is named in the About text; smaller ones are counted. */
export const NOTABLE_JUMP_KM = 1000;

/**
 * The jumps in this data's spacecraft paths, as a sentence.
 *
 * Read from the manifest rather than written down, because JPL revises its trajectories
 * and the jumps move with them: between two runs a week apart Psyche's went from 239,513
 * km on 1 December 2026 to 1,622,330 km on 1 February 2027, and Europa Clipper's 954 km
 * handover was replaced by three others. A sentence typed into the source would have
 * been wrong by the next deploy.
 */
export function seamSentence(store: EphemerisStore): string {
  const notable = Object.entries(store.manifest.paths)
    .flatMap(([id, info]) => info.seams.map((seam) => ({ name: store.body(id).name, ...seam })))
    .filter((seam) => seam.jumpKm >= NOTABLE_JUMP_KM)
    .sort((a, b) => b.jumpKm - a.jumpKm);
  const largest = notable[0];
  if (largest === undefined) {
    return `In this data none jumps by ${NOTABLE_JUMP_KM.toLocaleString('en-US')} km or more.`;
  }
  const date = new Date((largest.startJd - 2440587.5) * 86_400_000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const size = `${Math.round(largest.jumpKm).toLocaleString('en-US')} km`;
  return notable.length === 1
    ? `In this data one jump is over ${NOTABLE_JUMP_KM.toLocaleString('en-US')} km: ${largest.name}’s, ${size} on ${date}.`
    : `In this data ${notable.length} are over ${NOTABLE_JUMP_KM.toLocaleString('en-US')} km, the largest ${largest.name}’s: ${size} on ${date}.`;
}
