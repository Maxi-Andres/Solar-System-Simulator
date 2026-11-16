import type { ReactNode } from 'react';

import type { BodyId } from '@sss/tools/types';

import { SGR_A_ASTROMETRY, SGR_A_DISTANCE_PC } from '../../core/blackHoles.ts';
import { CF4_COSMOLOGY, hubbleDistanceMpc, mpcToLy, OBSERVABLE_RADIUS_MPC, PLANCK18 } from '../../core/cosmology.ts';
import type { EphemerisStore } from '../../core/ephemerisStore.ts';
import { GIANTS } from '../../core/localGroup.ts';
import { SPIRAL_ARMS, SUN_ABOVE_PLANE_PC, THIN_DISC } from '../../core/milkyWay.ts';
import { renderDemand } from '../../core/renderDemand.ts';
import { dateToJulianDay } from '../../core/time.ts';
import type { Vec3 } from '../../core/vec3.ts';
import { galacticDirection } from '../../scene/galactic.ts';
import { LOCAL_GROUP_VIEW } from '../../scene/LocalGroup.tsx';
import { GALAXY_VIEW } from '../../scene/MilkyWay.tsx';
import {
  GALAXY_FRAMING_KM,
  LOCAL_GROUP_FRAMING_KM,
  NEIGHBOURHOOD_FRAMING_KM,
  OBSERVABLE_UNIVERSE_FRAMING_KM,
} from '../../scene/scale.ts';
import { OBSERVABLE_UNIVERSE_VIEW } from '../../scene/supergalactic.ts';
import type { FramingView } from '../../state/store.ts';
import { useViewStore } from '../../state/store.ts';
import { anchorId } from './nav.ts';
import { ACCENT, BRIGHT, Cite, Items, MUTED, Prose, RULE, Strong, Sub, TEXT, Why } from './prose.tsx';
import type { AboutSection } from './section.ts';

/**
 * Where we are: our address in the universe as nested shells, Earth to the observable
 * universe, each with its size and our place in it; then every motion we are carried by,
 * each against what it is measured; then all of them at once, against the CMB, right now.
 *
 * Every number is either a published one (cited) or worked out here from the constants the
 * app itself draws with -- Sgr A*'s distance and motion on the sky (blackHoles.ts), the
 * spiral arms and the Sun's height (milkyWay.ts), Andromeda's distance (localGroup.ts), the
 * cosmology (cosmology.ts), Earth's radius and spin (the catalogue) -- so the About and the
 * scene cannot disagree.
 */

const LY_PER_PC = mpcToLy(1e-6);
/** km/s for one mas/yr at one kpc: an AU per year, in km/s. */
const KMS_PER_MAS_YR_KPC = 4.740470446;
const SECONDS_PER_MYR = 365.25 * 86_400 * 1e6;
const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;
const DEG = Math.PI / 180;

/** The Sun's velocity against the CMB (Planck Collaboration 2020, A&A 641, A1): the dipole. */
export const CMB_DIPOLE = { speedKmS: 369.82, lDeg: 264.021, bDeg: 48.253 } as const;

/** The Sun's motion against the local standard of rest, U V W, km/s (Schönrich, Binney & Dehnen 2010). */
export const SOLAR_MOTION_KMS = { u: 11.1, v: 12.24, w: 7.25 } as const;

/** The Local Group's velocity against the CMB (Kogut et al. 1993): 627 +- 22 km/s toward l 276, b 30. */
export const LOCAL_GROUP_CMB = { speedKmS: 627, errorKmS: 22, lDeg: 276, bDeg: 30 } as const;

/** Andromeda's radial velocity toward the Milky Way (van der Marel et al. 2012). */
export const M31_APPROACH_KMS = 109.3;

/** Mean orbital speeds from the semi-major axes and sidereal periods: Earth's about the Sun, the Moon's about Earth. */
const EARTH_ORBIT_KMS = (2 * Math.PI * 149_597_870.7) / (365.256363 * 86_400);
const MOON_ORBIT_KMS = (2 * Math.PI * 384_400) / (27.321661 * 86_400);

/**
 * Earth's equatorial radius, km, and rotation rate, degrees a day: the catalogue's (Archinal
 * et al. 2018), copied because tools/src/catalog.ts reads the disk and cannot be bundled; the
 * tests hold the two together.
 */
export const EARTH_ROTATION = { radiusEquatorialKm: 6378.1366, rotationRateDegPerDay: 360.9856235 } as const;

/** Earth's spin at the equator, m/s, and its sidereal day, s. */
export function earthSpin(): { readonly equatorMs: number; readonly siderealDayS: number; readonly radiusKm: number } {
  const siderealDayS = (360 / EARTH_ROTATION.rotationRateDegPerDay) * 86_400;
  const radiusKm = EARTH_ROTATION.radiusEquatorialKm;
  return { equatorMs: ((2 * Math.PI * radiusKm) / siderealDayS) * 1000, siderealDayS, radiusKm };
}

/**
 * The Sun's speed about Sgr A*: Sgr A*'s motion across our sky (Gordon et al. 2023) at its
 * distance (GRAVITY 2024). Sgr A* is at rest at the centre to a few km/s, so its apparent
 * motion is ours, reflected -- the circular speed and the Sun's own lead on it together.
 */
export function sunAboutCentreKmS(): number {
  const mu = Math.hypot(SGR_A_ASTROMETRY.pmRaMasPerYear, SGR_A_ASTROMETRY.pmDecMasPerYear);
  return KMS_PER_MAS_YR_KPC * (SGR_A_DISTANCE_PC / 1000) * mu;
}

/** The circular speed at the Sun -- the Sun's speed less its own lead V -- and a lap at it, Myr. */
export function galacticYear(): { readonly circularKmS: number; readonly lapMyr: number } {
  const circularKmS = sunAboutCentreKmS() - SOLAR_MOTION_KMS.v;
  return { circularKmS, lapMyr: (2 * Math.PI * SGR_A_DISTANCE_PC * PARSEC_KM) / circularKmS / SECONDS_PER_MYR };
}

/** The Local Arm as Reid et al. 2019 traced it with parallaxes: its length along the spiral and its width, light years. */
export function localArm(): { readonly lengthLy: number; readonly widthLy: number } {
  const arm = SPIRAL_ARMS.find((entry) => entry.name === 'Local Arm')!;
  // One pitch for the whole arm: ds = R dbeta / cos psi, R = R_kink exp(-(beta - beta_kink) tan psi).
  const tan = Math.tan(arm.pitchBeforeDeg * DEG);
  const radius = (betaDeg: number) => arm.rKinkKpc * Math.exp(-(betaDeg - arm.betaKinkDeg) * DEG * tan);
  const lengthKpc = (radius(arm.betaMinDeg) - radius(arm.betaMaxDeg)) / (Math.cos(arm.pitchBeforeDeg * DEG) * tan);
  return { lengthLy: lengthKpc * 1000 * LY_PER_PC, widthLy: arm.widthKpc * 1000 * LY_PER_PC };
}

/** The Sun's velocity against the CMB, km/s, in the scene's ecliptic frame. */
export function sunAgainstCmb(): Vec3 {
  const d = galacticDirection(CMB_DIPOLE.lDeg, CMB_DIPOLE.bDeg);
  return { x: d.x * CMB_DIPOLE.speedKmS, y: d.y * CMB_DIPOLE.speedKmS, z: d.z * CMB_DIPOLE.speedKmS };
}

/**
 * How fast Earth goes against the CMB over a year: the dipole plus Earth's orbit, as vectors.
 * The orbit lies in the ecliptic and the dipole points 11 degrees south of it, so the two
 * add most and cancel most at opposite ends of the year.
 */
export function yearlyCmbRange(): { readonly min: number; readonly max: number } {
  const v = CMB_DIPOLE.speedKmS;
  const along = Math.hypot(sunAgainstCmb().x, sunAgainstCmb().y) / v;
  const e = EARTH_ORBIT_KMS;
  return { min: Math.sqrt(v * v + e * e - 2 * v * e * along), max: Math.sqrt(v * v + e * e + 2 * v * e * along) };
}

/** Earth against the CMB at `jd`, from Earth's own velocity about the Solar System's barycentre; null without it. */
export function earthAgainstCmb(store: EphemerisStore, jd: number): number | null {
  let velocity: Vec3;
  try {
    const state = store.stateInRoot('earth', jd);
    if (state === null) {
      return null;
    }
    velocity = state.velocity;
  } catch {
    return null;
  }
  const sun = sunAgainstCmb();
  return Math.hypot(sun.x + velocity.x, sun.y + velocity.y, sun.z + velocity.z);
}

function speedNow(store: EphemerisStore, a: BodyId, b: BodyId, jd: number): number | null {
  try {
    return store.speedRelativeTo(a, b, jd);
  } catch {
    return null;
  }
}

const n = (value: number, digits = 0) =>
  value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
/** A rounded figure for a size in light years: 26,992 is "27,000", 2.48 million "2.5 million". */
const round = (value: number, significant = 2) => Number(value.toPrecision(significant));

/** A jump to the app's own view of a shell: what the breadcrumb does. */
function goTo(focus: BodyId, km?: number, view?: FramingView): void {
  const state = useViewStore.getState();
  if (km !== undefined) {
    state.requestFraming(km, view);
  }
  state.setFocus(focus);
  state.closePanel();
  renderDemand.request();
}

/** One shell of the address. */
function Shell({
  id,
  number,
  name,
  size,
  go,
  children,
}: {
  id: string;
  number: number;
  name: string;
  size: ReactNode;
  go?: () => void;
  children: ReactNode;
}) {
  return (
    <li
      id={anchorId('address', `shell-${id}`)}
      style={{
        listStyle: 'none',
        margin: '0 0 0.9rem',
        padding: '0.6rem 0.8rem 0.55rem',
        border: `1px solid ${RULE}`,
        borderLeft: `3px solid rgba(159,195,224,${0.25 + number * 0.07})`,
        borderRadius: '0.3rem',
        color: TEXT,
        fontSize: '0.84rem',
        lineHeight: 1.65,
        scrollMarginTop: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ color: MUTED, fontSize: '0.7rem', fontWeight: 600 }}>{number}</span>
        <span style={{ color: BRIGHT, fontWeight: 600 }}>{name}</span>
        <span style={{ color: MUTED, fontSize: '0.76rem' }}>{size}</span>
        {go !== undefined && (
          <button
            type="button"
            className="about-link"
            onClick={go}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              fontSize: '0.72rem',
              color: ACCENT,
              cursor: 'pointer',
            }}
          >
            go there
          </button>
        )}
      </div>
      <div>{children}</div>
    </li>
  );
}

/** One motion: how fast, against what, and where it heads. */
function Motion({ speed, title, against, children }: { speed: string; title: string; against: string; children: ReactNode }) {
  return (
    <li style={{ color: TEXT, fontSize: '0.84rem', lineHeight: 1.7, marginBottom: '0.8rem' }}>
      <span style={{ color: BRIGHT, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{speed}</span>
      {' · '}
      <Strong>{title}</Strong>
      <span style={{ color: MUTED }}>{`, against ${against}`}</span>
      {'. '}
      {children}
    </li>
  );
}

export const addressSection: AboutSection = {
  id: 'address',
  tab: 'Where we are',
  title: 'Our cosmic address',
  blurb: 'Where we are, shell by shell, from Earth to the edge of what can be seen, and how fast each shell carries us.',
  subsections: [
    { id: 'shells', label: 'The address, shell by shell' },
    { id: 'motions', label: 'How fast, and against what' },
    { id: 'now', label: 'All of it at once' },
  ],
  Body: ({ data }) => {
    const spin = earthSpin();
    const buenosAires = spin.equatorMs * Math.cos(34.6 * DEG);
    const sidereal = spin.siderealDayS;
    const siderealH = Math.floor(sidereal / 3600);
    const siderealM = Math.floor((sidereal % 3600) / 60);
    const siderealS = sidereal % 60;
    const centreLy = SGR_A_DISTANCE_PC * LY_PER_PC;
    const aboveLy = SUN_ABOVE_PLANE_PC * LY_PER_PC;
    const arm = localArm();
    const sunSpeed = sunAboutCentreKmS();
    const year = galacticYear();
    const lsr = Math.hypot(SOLAR_MOTION_KMS.u, SOLAR_MOTION_KMS.v, SOLAR_MOTION_KMS.w);
    const m31Ly = GIANTS.find((galaxy) => galaxy.key === 'm31')!.distancePc * LY_PER_PC;
    const discLy = 15_000 * LY_PER_PC;
    const discShare = 1 - (1 + 15_000 / THIN_DISC.scaleLengthPc) * Math.exp(-15_000 / THIN_DISC.scaleLengthPc);
    const observableLy = mpcToLy(OBSERVABLE_RADIUS_MPC);
    const hubbleSphereLy = mpcToLy(hubbleDistanceMpc(PLANCK18));
    const edgeOverC = (PLANCK18.h0 * OBSERVABLE_RADIUS_MPC) / 299_792.458;
    const range = yearlyCmbRange();
    const jd = dateToJulianDay(new Date());
    const now = earthAgainstCmb(data.store, jd);
    const orbitNow = speedNow(data.store, 'earth', 'sun', jd);
    const moonNow = speedNow(data.store, 'moon', 'earth', jd);
    const virgoMpc = 16.5;
    return (
      <>
        <Sub section="address" id="shells">
          The address, shell by shell
        </Sub>
        <Prose>
          Ten nested shells, each one holding the last. The sizes are rough where the thing has no sharp edge, and
          said so. “Go there” takes the camera to the app’s own view of the shell, as the breadcrumb does.
        </Prose>
        <ul style={{ margin: '0 0 1.1rem', padding: 0 }}>
          <Shell
            id="earth"
            number={1}
            name="Earth"
            size={`${n(2 * spin.radiusKm)} km across at the equator`}
            go={() => goTo('earth')}
          >
            You are on its surface, on a ball of rock and iron, under a skin of air most of which lies within 10 km
            of the ground.
            <Cite k="archinal2018" />
          </Shell>
          <Shell id="solar-system" number={2} name="The Solar System" size="planets to 30 AU; the Sun’s wind to about 120 AU" go={() => goTo('sun')}>
            Earth is the third planet, 1 AU from the Sun. Neptune, the last, is 30 AU out; the Sun’s wind blows a
            bubble, the heliosphere, that Voyager 1 left in August 2012 at 121.6 AU.
            <Cite k="stone2013" /> The Sun’s pull reaches much further, through the hypothesised Oort cloud.
          </Shell>
          <Shell
            id="neighbourhood"
            number={3}
            name="The Solar Neighbourhood and the Local Bubble"
            size="about 1,000 light years across"
            go={() => goTo('sun', NEIGHBOURHOOD_FRAMING_KM)}
          >
            The nearest star, Proxima Centauri, is 4.2 light years away. We sit near the middle of the Local Bubble,
            a cavity of thin, hot gas some 1,000 light years wide blown out by supernovae over the last 14 million
            years; new stars are forming on its walls.
            <Cite k="zucker2022" /> The app’s star census is complete to 326 light years (100 parsecs).
            <Cite k="gcns" />
          </Shell>
          <Shell id="local-arm" number={4} name="The Local (Orion) Arm" size={`about ${n(round(arm.lengthLy))} light years traced, ${n(round(arm.widthLy, 1))} wide`}>
            A short spiral arm between the bigger Sagittarius–Carina Arm, toward the centre, and the Perseus Arm,
            outward. Its star-forming regions are measured by parallax along {n(round(arm.lengthLy))} light years;
            the Sun lies in it.
            <Cite k="reid2019" />
          </Shell>
          <Shell
            id="milky-way"
            number={5}
            name="The Milky Way"
            size={`${Math.round(discShare * 100)}% of its disc’s stars within ${n(round(discLy))} light years of the centre`}
            go={() => goTo('sun', GALAXY_FRAMING_KM, GALAXY_VIEW)}
          >
            The Sun is {n(round(centreLy))} light years from the centre (GRAVITY’s {n(SGR_A_DISTANCE_PC / 1000, 2)}{' '}
            kpc)
            <Cite k="gravity2024" /> and about {n(round(aboveLy))} light years ({SUN_ABOVE_PLANE_PC} pc) above the
            disc’s mid-plane.
            <Cite k="blandHawthorn2016" /> The disc has no edge: its stars thin out steadily outward, by about
            two thirds every {n(round(THIN_DISC.scaleLengthPc * LY_PER_PC))} light years.
          </Shell>
          <Shell
            id="local-group"
            number={6}
            name="The Local Group"
            size="about 10 million light years across"
            go={() => goTo('sun', LOCAL_GROUP_FRAMING_KM, LOCAL_GROUP_VIEW)}
          >
            One of its two giants is ours. The other, Andromeda, is {n(round(m31Ly / 1e6))} million light years away
            <Cite k="li2021" />; around the two, Triangulum and about a hundred dwarfs.
            <Cite k="mcconnachie2012" />
          </Shell>
          <Shell id="local-sheet" number={7} name="The Local Sheet and the Local Volume" size="the Local Volume: 11 Mpc, 36 million light years, around us">
            The Local Group lies in a thin, flat spread of galaxies, the Local Sheet, with the nearly empty Local
            Void on one side.
            <Cite k="tully2008" /> The Local Volume is the census of galaxies within 11 Mpc of us, the catalogue the
            app draws them from.
            <Cite k="karachentsev2013" />
          </Shell>
          <Shell id="local-supercluster" number={8} name="The Virgo (Local) Supercluster" size="roughly 100 million light years">
            A flattened spread of groups with the Virgo Cluster at its heart, {n(round(virgoMpc * 1e6 * LY_PER_PC / 1e6))}{' '}
            million light years away
            <Cite k="mei2007" />; we are out on its edge. De Vaucouleurs saw it in 1953 as a band of galaxies across
            the sky.
            <Cite k="devaucouleurs1953" /> It has no sharp boundary, so its size is a rough one.
          </Shell>
          <Shell id="laniakea" number={9} name="Laniakea" size="about 520 million light years across, 10¹⁷ Suns">
            Our basin of attraction: every galaxy whose motion drains toward the same place, the Great Attractor
            region at its heart, about a hundred thousand big galaxies in all. We are near its outskirts.
            <Cite k="tully2014" /> Newer reconstructions put the Milky Way, by a small margin, in the larger basin of
            the Shapley Supercluster instead, and the app draws both.
            <Cite k={['dupuyCourtois2023', 'valade2024']} />
          </Shell>
          <Shell
            id="observable-universe"
            number={10}
            name="The observable universe"
            size={`${n(round(observableLy / 1e9, 3), 1)} billion light years in radius`}
            go={() => goTo('sun', OBSERVABLE_UNIVERSE_FRAMING_KM, OBSERVABLE_UNIVERSE_VIEW)}
          >
            Everything whose light has had time to reach us, in Planck 2018’s cosmology.
            <Cite k="planck2020params" /> We are at its centre, because everyone is at the centre of their own. What
            lies past it, nobody can see.
          </Shell>
        </ul>

        <Sub section="address" id="motions">
          How fast, and against what
        </Sub>
        <Prose>
          A speed means nothing without saying against what. Sitting still, you are moving in all of these at once,
          from smallest to largest:
        </Prose>
        <Items>
          <Motion speed={`${n(spin.equatorMs)} m/s`} title="Earth’s spin" against="Earth’s centre">
            At the equator, {n(spin.equatorMs * 3.6)} km/h; less toward the poles, as the cosine of
            the latitude: {n(buenosAires)} m/s ({n(buenosAires * 3.6)} km/h) in Buenos Aires, nothing at a pole. One
            turn against the stars takes {siderealH} h {siderealM} min {n(siderealS, 1)} s, the sidereal day: four
            minutes short of the 24 hours the Sun takes to come round, because Earth has moved a little along its
            orbit meanwhile.
            <Cite k="archinal2018" />
          </Motion>
          <Motion speed={`${n(moonNow ?? MOON_ORBIT_KMS, 2)} km/s`} title="The Moon about Earth" against="Earth">
            {moonNow === null ? 'On average' : `Right now; ${n(MOON_ORBIT_KMS, 2)} on average`}: a lap in 27.3 days,
            384,400 km out.
            <Cite k="horizons" />
          </Motion>
          <Motion speed={`${n(orbitNow ?? EARTH_ORBIT_KMS, 2)} km/s`} title="Earth about the Sun" against="the Sun">
            {orbitNow === null ? 'On average' : `Right now; ${n(EARTH_ORBIT_KMS, 2)} on average`}: 30.3 at
            perihelion in early January, 29.3 at aphelion in early July. 940 million km a year, 107,000 km/h.
            <Cite k="horizons" />
          </Motion>
          <Motion speed={`${n(lsr, 1)} km/s`} title="The Sun among its neighbours" against="the local standard of rest, the mean motion of the stars around us">
            {`${SOLAR_MOTION_KMS.u} km/s toward the Galactic centre, ${SOLAR_MOTION_KMS.v} ahead in the direction of rotation and ${SOLAR_MOTION_KMS.w} up out of the disc: toward the solar apex, in Hercules.`}
            <Cite k="schoenrich2010" />
          </Motion>
          <Motion speed={`${n(sunSpeed)} km/s`} title="The Sun about the Galactic centre" against="Sgr A*, at rest at the centre">
            Read off Sgr A*’s drift across our sky, {n(Math.hypot(SGR_A_ASTROMETRY.pmRaMasPerYear, SGR_A_ASTROMETRY.pmDecMasPerYear), 2)}{' '}
            milliarcseconds a year
            <Cite k="gordon2023" />, at its {n(SGR_A_DISTANCE_PC)} pc
            <Cite k="gravity2024" />: that drift is our motion, reflected. Less the Sun’s own {SOLAR_MOTION_KMS.v} km/s
            lead, the galaxy turns at {n(year.circularKmS)} km/s here, and one lap takes about{' '}
            {n(round(year.lapMyr))} million years. One lap ago, dinosaurs were new.
            <Why>
              The 230 or 250 million years often quoted come from older, smaller speeds; the GRAVITY- and VLBA-era
              numbers give a shorter year.
            </Why>
          </Motion>
          <Motion speed={`${M31_APPROACH_KMS} km/s`} title="Andromeda and the Milky Way" against="each other">
            Closing, along the line between them.
            <Cite k="vdMarel2012" /> Whether they then merge depends on their sideways motion, measured less well:
            the latest estimate gives about even odds within 10 billion years.
            <Cite k="sawala2025" />
          </Motion>
          <Motion speed={`${LOCAL_GROUP_CMB.speedKmS} ± ${LOCAL_GROUP_CMB.errorKmS} km/s`} title="The Local Group" against="the CMB, the frame of the universe’s oldest light">
            Toward the constellation Hydra (galactic l {LOCAL_GROUP_CMB.lDeg}°, b {LOCAL_GROUP_CMB.bDeg}°).
            <Cite k="kogut1993" /> This is the flow the Flow Lines layer draws: the pull of the denser regions ahead,
            the Great Attractor and, beyond it, the Shapley Supercluster, about 30° from where we are heading; and the
            push of the empty Local Void behind.
            <Cite k={['tully2008', 'tully2014']} />
          </Motion>
          <Motion speed={`${CMB_DIPOLE.speedKmS} km/s`} title="The Sun" against="the CMB">
            The CMB is a few thousandths of a degree warmer ahead of us than behind: Planck measured the Sun’s
            motion from that, to ±0.11 km/s, toward galactic l {CMB_DIPOLE.lDeg}°, b {CMB_DIPOLE.bDeg}°, in Crater, at the edge of Leo.
            <Cite k="planck2020" /> Slower than the Local Group: our lap round the galaxy points partly against the
            group’s motion.
          </Motion>
          <Motion speed={`${n(PLANCK18.h0, 2)}–${n(CF4_COSMOLOGY.h0, 1)} km/s per Mpc`} title="The expansion" against="distance">
            Not a motion through space but space growing: a galaxy at Virgo’s {virgoMpc} Mpc would recede at{' '}
            {n(round(virgoMpc * PLANCK18.h0, 2))} to {n(round(virgoMpc * CF4_COSMOLOGY.h0, 2))} km/s from it alone,
            depending on which of the two measured rates is right
            <Cite k={['planck2020params', 'tully2023']} />; inside the Local Group gravity has won and nothing is
            expanding apart. The distance to anything past {n(round(hubbleSphereLy / 1e9, 3), 1)} billion light years
            grows faster than light, and to the observable universe’s edge {n(edgeOverC, 1)} times faster: no law is
            broken, nothing is moving through space that fast.
          </Motion>
        </Items>

        <Sub section="address" id="now">
          All of it at once
        </Sub>
        <Prose>
          {now === null ? (
            <>
              Against the CMB you are moving at between <Strong>{n(range.min)}</Strong> and{' '}
              <Strong>{n(range.max)} km/s</Strong> over a year,
            </>
          ) : (
            <>
              <Strong>Right now you are moving at about {n(now)} km/s relative to the CMB</Strong>, between{' '}
              {n(range.min)} and {n(range.max)} over a year,
            </>
          )}{' '}
          as Earth’s orbit adds to the Sun’s {CMB_DIPOLE.speedKmS} km/s in one season and takes from it in the other;
          Earth’s spin moves it by under half a km/s more.
        </Prose>
        <Prose>
          The motions are not added up as numbers. Each is a speed in a direction, and they point different ways:
          added as arrows, head to tail, they partly cancel. Added as plain numbers the figures above would come to
          well over a thousand km/s; the arrows come to under 400. Planck’s dipole already holds all of them from the Sun outward — our lap
          round the galaxy, the galaxy’s fall within the Local Group, the group’s flow toward Shapley — measured in one
          go, against the one frame the universe offers.
        </Prose>
      </>
    );
  },
};
