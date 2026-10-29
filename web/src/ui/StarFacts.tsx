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
  systemDisplayName,
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

/** Whose parallax the distance is, in a word or two: the About has the sources in full. */
export function parallaxSource(flags: number): string {
  if ((flags & STAR3D_FLAG.LITERATURE_PARALLAX) !== 0) {
    return 'Published, system';
  }
  if ((flags & STAR3D_FLAG.HIPPARCOS_PARALLAX) !== 0) {
    return 'Hipparcos 2007';
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
      {systemDisplayName(facts.system) !== null && (
        <>
          <dt style={TERM}>System</dt>
          <dd style={VALUE}>{systemDisplayName(facts.system)}</dd>
        </>
      )}
      {facts.nearest !== null && (
        <>
          <dt style={TERM}>Nearest systems</dt>
          <dd style={VALUE}>{`no. ${facts.nearest}`}</dd>
        </>
      )}

      <div style={DIVIDER} />

      <dt style={TERM}>Proper motion</dt>
      <dd style={VALUE}>{`${now.properMotionArcsecPerYear.toFixed(3)}″ a year`}</dd>
      <dt style={TERM}>Radial velocity</dt>
      <dd style={VALUE}>
        {now.radialKmS === null ? 'not in the catalogue' : `${now.radialKmS > 0 ? '+' : ''}${now.radialKmS.toFixed(1)} km/s`}
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
      {/* Where each number comes from, a word or two each (the About has the long version). */}
      <div style={DIVIDER} />
      <dt style={TERM}>Distance from</dt>
      <dd style={VALUE}>{parallaxSource(flags)}</dd>
      <dt style={TERM}>Photometry</dt>
      <dd style={VALUE}>{gaiaPhotometry ? 'Gaia, transformed' : 'Johnson V, B−V'}</dd>
      {gcns && (
        <>
          <dt style={TERM}>Census</dt>
          <dd style={VALUE}>{within100 ? 'Gaia nearby stars' : 'Gaia, just past 100 pc'}</dd>
        </>
      )}
      {now.radialKmS !== null && component === null && (
        <>
          <dt style={TERM}>Radial velocity from</dt>
          <dd style={VALUE}>
            {(flags & STAR3D_FLAG.LITERATURE_RADIAL_VELOCITY) !== 0 ? 'Pulkovo 2006' : 'Gaia DR3'}
          </dd>
        </>
      )}
      <dt style={TERM}>Placed by</dt>
      <dd style={VALUE}>
        {component !== null
          ? 'Its measured orbit'
          : now.radialKmS === null
            ? 'Motion across the sky'
            : 'Motion in 3D'}
      </dd>
      <dt style={TERM}>Drawn as</dt>
      <dd style={VALUE}>{member !== null ? 'Disc, measured size' : 'Point'}</dd>
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
const DIVIDER: React.CSSProperties = {
  gridColumn: '1 / -1',
  height: 1,
  background: '#202020',
  margin: '0.4rem 0',
};
