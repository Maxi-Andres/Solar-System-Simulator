import type { BodyId } from '@sss/tools/types';
import { useEffect, useState } from 'react';

import {
  componentState,
  isProximaRecord,
  MASS_A_SUN,
  MASS_B_SUN,
  MASS_PROXIMA_SUN,
  matchComponent,
  RADIUS_A_SUN,
  RADIUS_B_SUN,
  RADIUS_PROXIMA_SUN,
} from '../core/alphaCentauri.ts';
import { starBodyFacts } from '../core/starBodies.ts';
import {
  apparentMagnitude,
  KM_S_PER_ARCSEC_PC_PER_YEAR,
  PARSEC_KM,
  STAR3D,
  STAR3D_FLAG,
  starNow,
  type StarDetails,
  type StarNow,
  type Stars3dSource,
} from '../core/stars3d.ts';
import { LIGHT_YEAR_KM } from '../scene/scale.ts';

/**
 * What the info panel says about a catalogue star made a body (starBodies.ts): how far it
 * is and how bright, from here and intrinsically; its colour and type; how it moves; and
 * where every one of those numbers comes from -- whose parallax, whose photometry -- which
 * for a star is most of what there is to know about how far to trust it.
 *
 * In place of the bodies' facts: a star has no orbit about the Sun to quote a speed on, and
 * no radius in these catalogues -- save Alpha Centauri's three, whose radii and masses are
 * measured, and whose A and B are placed on their orbit rather than on a straight line
 * (alphaCentauri.ts): for those the panel says what the scene does.
 */

type Member = 'A' | 'B' | 'Proxima';

/** Alpha Centauri's measured radius and mass, solar units, by member. */
const MEASURED: Record<Member, { readonly radius: number; readonly mass: number }> = {
  A: { radius: RADIUS_A_SUN, mass: MASS_A_SUN },
  B: { radius: RADIUS_B_SUN, mass: MASS_B_SUN },
  Proxima: { radius: RADIUS_PROXIMA_SUN, mass: MASS_PROXIMA_SUN },
};

/**
 * Where A or B is now and how it moves, read from its orbit about the pair's barycentre as
 * starNow reads a catalogue star's straight line: the radial velocity is the barycentre's,
 * measured (Kervella et al. 2016), plus the star's orbital motion along our line of sight.
 */
function componentNow(component: 'A' | 'B', absoluteV: number, jd: number): StarNow {
  const { position: r, velocity: v } = componentState(component, jd);
  const distanceKm = Math.hypot(r.x, r.y, r.z);
  const distancePc = distanceKm / PARSEC_KM;
  const radial = (r.x * v.x + r.y * v.y + r.z * v.z) / distanceKm;
  const speed = Math.hypot(v.x, v.y, v.z);
  const tangential = Math.sqrt(Math.max(0, speed * speed - radial * radial));
  return {
    distancePc,
    apparentV: apparentMagnitude(absoluteV, distancePc),
    properMotionArcsecPerYear: tangential / (KM_S_PER_ARCSEC_PC_PER_YEAR * distancePc),
    radialKmS: radial,
    speedKmS: speed,
  };
}

const LY_PER_PC = PARSEC_KM / LIGHT_YEAR_KM;

/** A distance as people say it for a star: light years, and parsecs beside. */
export function formatStarDistance(distancePc: number): string {
  const ly = distancePc * LY_PER_PC;
  const digits = ly < 10 ? 2 : ly < 100 ? 1 : 0;
  return `${ly.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })} ly · ${distancePc.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })} pc`;
}

/** Where the distance came from, in a reader's words. */
export function parallaxSource(flags: number): string {
  if ((flags & STAR3D_FLAG.LITERATURE_PARALLAX) !== 0) {
    return 'a published system parallax';
  }
  if ((flags & STAR3D_FLAG.HIPPARCOS_PARALLAX) !== 0) {
    return 'Hipparcos, new reduction (van Leeuwen 2007)';
  }
  return 'Gaia DR3';
}

export function StarFacts({
  id,
  jd,
  stars3d,
}: {
  readonly id: BodyId;
  readonly jd: number;
  readonly stars3d: Stars3dSource | null;
}) {
  const facts = starBodyFacts(id);
  const [details, setDetails] = useState<StarDetails | null>(null);

  // The identifiers and the parallax are in a file of their own, read four values at a
  // time only for a star whose panel is open.
  useEffect(() => {
    setDetails(null);
    if (facts === null || stars3d === null) {
      return;
    }
    let cancelled = false;
    stars3d
      .details(facts.tier, facts.index)
      .then((value) => {
        if (!cancelled) {
          setDetails(value);
        }
      })
      .catch((error: unknown) => {
        console.error(`Could not read the details of ${id}`, error);
      });
    return () => {
      cancelled = true;
    };
  }, [id, facts, stars3d]);

  if (facts === null) {
    return null;
  }
  const record = facts.record;
  const flags = record[STAR3D.flags]!;
  const at = { x: record[STAR3D.x]!, y: record[STAR3D.y]!, z: record[STAR3D.z]! };
  const component = matchComponent(at);
  const member: Member | null = component ?? (isProximaRecord(at) ? 'Proxima' : null);
  const now = component === null ? starNow(record, 0, jd) : componentNow(component, record[STAR3D.Mv]!, jd);
  const gaiaPhotometry = (flags & STAR3D_FLAG.GAIA_PHOTOMETRY) !== 0;
  const gcns = (flags & STAR3D_FLAG.GCNS) !== 0;
  const within100 = (flags & STAR3D_FLAG.GCNS_WITHIN_100PC) !== 0;

  return (
    <>
      <dt style={TERM}>Distance</dt>
      <dd style={VALUE}>{formatStarDistance(now.distancePc)}</dd>
      {details !== null && (
        <>
          <dt style={TERM}>Parallax</dt>
          <dd style={VALUE}>
            {details.parallaxErrorMas === null
              ? `${details.parallaxMas.toFixed(3)} mas`
              : `${details.parallaxMas.toFixed(3)} ± ${details.parallaxErrorMas.toFixed(3)} mas`}
          </dd>
        </>
      )}
      <dt style={TERM}>Apparent magnitude</dt>
      <dd style={VALUE}>{`V ${now.apparentV.toFixed(2)} from the Sun`}</dd>
      <dt style={TERM}>Absolute magnitude</dt>
      <dd style={VALUE}>{`M_V ${record[STAR3D.Mv]!.toFixed(2)}`}</dd>
      <dt style={TERM}>Colour index</dt>
      <dd style={VALUE}>{`B−V ${record[STAR3D.bv]!.toFixed(2)}`}</dd>
      {member !== null && (
        <>
          <dt style={TERM}>Radius</dt>
          <dd style={VALUE}>{`${MEASURED[member].radius.toFixed(4)} R☉`}</dd>
          <dt style={TERM}>Mass</dt>
          <dd style={VALUE}>{`${MEASURED[member].mass.toFixed(4)} M☉`}</dd>
        </>
      )}
      {facts.spectralType !== null && (
        <>
          <dt style={TERM}>Spectral type</dt>
          <dd style={VALUE}>{facts.spectralType}</dd>
        </>
      )}
      {facts.system !== null && (
        <>
          <dt style={TERM}>System</dt>
          <dd style={VALUE}>
            {facts.nearest === null ? facts.system : `${facts.system} · nearest no. ${facts.nearest}`}
          </dd>
        </>
      )}

      <div style={DIVIDER} />

      <dt style={TERM}>Proper motion</dt>
      <dd style={VALUE}>{`${now.properMotionArcsecPerYear.toFixed(3)}″ a year`}</dd>
      <dt style={TERM}>Radial velocity</dt>
      <dd style={VALUE}>
        {now.radialKmS === null ? 'not measured' : `${now.radialKmS > 0 ? '+' : ''}${now.radialKmS.toFixed(1)} km/s`}
      </dd>
      <dt style={TERM}>{now.radialKmS === null ? 'Speed across the sky' : 'Speed (Sun)'}</dt>
      <dd style={VALUE}>{`${now.speedKmS.toFixed(1)} km/s`}</dd>

      <div style={DIVIDER} />

      {details?.gaiaDr3 != null && (
        <>
          <dt style={TERM}>Gaia DR3</dt>
          <dd style={VALUE}>{details.gaiaDr3}</dd>
        </>
      )}
      {details?.hip != null && (
        <>
          <dt style={TERM}>Hipparcos</dt>
          <dd style={VALUE}>{`HIP ${details.hip}`}</dd>
        </>
      )}
      {facts.designations.length > 0 && (
        <>
          <dt style={TERM}>Also</dt>
          <dd style={VALUE}>{facts.designations.slice(0, 4).join(', ')}</dd>
        </>
      )}
      <dd style={NOTE}>
        {`Distance from ${parallaxSource(flags)}; brightness and colour ${
          gaiaPhotometry ? 'transformed from Gaia’s G and BP−RP' : 'from the sky catalogue’s own Johnson V and B−V'
        }, with no correction for interstellar dust. ${
          gcns
            ? `In the Gaia Catalogue of Nearby Stars${within100 ? ', inside its clean 100-parsec sample' : ', though its distance estimate puts it just past 100 parsecs'}. `
            : ''
        }${
          component !== null
            ? `Placed on its measured orbit about the pair's barycentre (Kervella et al. 2016), which moves on a straight line in all three dimensions; distance, speed and radial velocity here are that orbit's, now. Radius measured by interferometry (Kervella et al. 2017), and drawn: the disc is the star at its size.`
            : `Placed by its own straight-line motion from J2000, ${
                now.radialKmS === null
                  ? 'across the sky only: its motion along the line of sight was not measured, and is not invented'
                  : 'in all three dimensions'
              }. ${
                member === 'Proxima'
                  ? 'Radius from the relations for M dwarfs that Kervella et al. 2017 adopt (Mann et al. 2015), and drawn: the disc is the star at its size.'
                  : 'No radius is published here: the marker is a marker, and the light is drawn as a point.'
              }`
        }`}
      </dd>
    </>
  );
}

const TERM: React.CSSProperties = { color: '#5e5e5e', fontSize: '0.7rem', whiteSpace: 'nowrap' };
const VALUE: React.CSSProperties = {
  margin: 0,
  color: '#c4c4c4',
  fontSize: '0.72rem',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
const NOTE: React.CSSProperties = {
  gridColumn: '1 / -1',
  color: '#6a6a6a',
  fontSize: '0.64rem',
  lineHeight: 1.45,
  margin: '0.3rem 0 0',
};
const DIVIDER: React.CSSProperties = {
  gridColumn: '1 / -1',
  height: 1,
  background: '#202020',
  margin: '0.4rem 0',
};
