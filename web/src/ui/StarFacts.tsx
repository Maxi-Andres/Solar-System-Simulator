import type { BodyId } from '@sss/tools/types';
import { useEffect, useState } from 'react';

import { isProximaRecord, MASS_PROXIMA_SUN, RADIUS_PROXIMA_SUN } from '../core/alphaCentauri.ts';
import {
  matchOrbitingStar,
  orbitingStarParallax,
  orbitingStarSize,
  orbitingStarState,
  type OrbitingStar,
} from '../core/orbitingStars.ts';
import { planetarySystemOf, type PlanetarySystem } from '../core/planetarySystems.ts';
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

type Member = OrbitingStar | 'Proxima';

/** The measured radius and mass, solar units, of a star on its orbit, or of Proxima. */
function measuredSize(member: Member): { readonly radius: number; readonly mass: number } {
  if (member === 'Proxima') {
    return { radius: RADIUS_PROXIMA_SUN, mass: MASS_PROXIMA_SUN };
  }
  const size = orbitingStarSize(member);
  return { radius: size.radiusSun, mass: size.massSun };
}

/**
 * Where A or B is now and how it moves, read from its orbit about the pair's barycentre as
 * starNow reads a catalogue star's straight line: the radial velocity is the barycentre's,
 * measured (Kervella et al. 2016), plus the star's orbital motion along our line of sight.
 */
function componentNow(component: OrbitingStar, absoluteV: number, jd: number): StarNow {
  const { position: r, velocity: v } = orbitingStarState(component, jd);
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

  // A host placed from the Exoplanet Archive, not one of the 3D stars: what the Archive says.
  const system = planetarySystemOf(id);
  if (facts === null) {
    return system?.archive === undefined ? null : <ArchiveHostFacts system={system} />;
  }
  const record = facts.record;
  const flags = record[STAR3D.flags]!;
  const at = { x: record[STAR3D.x]!, y: record[STAR3D.y]!, z: record[STAR3D.z]! };
  const component = matchOrbitingStar(at);
  const member: Member | null = component ?? (isProximaRecord(at) ? 'Proxima' : null);
  // A planetary system's star: its measured radius and published mass (planetarySystems.ts),
  // or the Exoplanet Archive's (archiveSystems.ts).
  const host = system;
  const measured: { readonly radius: number | null; readonly mass: number } | null =
    member !== null
      ? measuredSize(member)
      : host === null
        ? null
        : { radius: host.hostRadiusSun, mass: host.hostMassSun };
  const now = component === null ? starNow(record, 0, jd) : componentNow(component, record[STAR3D.Mv]!, jd);
  const gaiaPhotometry = (flags & STAR3D_FLAG.GAIA_PHOTOMETRY) !== 0;
  const gcns = (flags & STAR3D_FLAG.GCNS) !== 0;
  const within100 = (flags & STAR3D_FLAG.GCNS_WITHIN_100PC) !== 0;

  return (
    <>
      <dt style={TERM}>Distance</dt>
      <dd style={VALUE}>{formatStarDistance(now.distancePc)}</dd>
      {component !== null ? (
        <>
          <dt style={TERM}>Parallax</dt>
          <dd style={VALUE}>{`${orbitingStarParallax(component).mas.toFixed(2)} mas, the pair's`}</dd>
        </>
      ) : details !== null && (
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
      {measured?.radius != null && (
        <>
          <dt style={TERM}>Radius</dt>
          <dd style={VALUE}>{`${formatSolar(measured.radius)} R☉`}</dd>
        </>
      )}
      {measured !== null && measured.mass > 0 && (
        <>
          <dt style={TERM}>Mass</dt>
          <dd style={VALUE}>{`${formatSolar(measured.mass)} M☉`}</dd>
        </>
      )}
      {host?.archive !== undefined && <PlanetsRow system={host} />}
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
      <dd style={VALUE}>{component !== null ? orbitingStarParallax(component).source : parallaxSource(flags)}</dd>
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
      {host?.archive !== undefined && <ArchiveSources system={host} />}
      <dt style={TERM}>Drawn as</dt>
      <dd style={VALUE}>
        {measured?.radius == null ? 'Point' : host?.archive !== undefined ? 'Disc, Archive radius' : 'Disc, measured size'}
      </dd>
    </>
  );
}

/** A stellar radius or mass as the Archive quotes it: three significant figures at most. */
function formatSolar(value: number): string {
  return Number(value.toPrecision(3)).toString();
}

/** How many planets the Archive lists, and how many have an orbit to draw. */
function PlanetsRow({ system }: { readonly system: PlanetarySystem }) {
  const listed = system.archive?.listed ?? system.planets.length;
  const drawn = system.planets.length;
  return (
    <>
      <dt style={TERM}>Planets</dt>
      <dd style={VALUE}>{drawn === listed ? `${listed}` : `${listed}, ${drawn} with an orbit`}</dd>
    </>
  );
}

/** Where an Archive host's size and mass come from, a word or two each. */
function ArchiveSources({ system }: { readonly system: PlanetarySystem }) {
  return (
    <>
      {system.hostRadiusReference !== null && (
        <>
          <dt style={TERM}>Radius from</dt>
          <dd style={VALUE}>{system.hostRadiusReference}</dd>
        </>
      )}
      <dt style={TERM}>Mass from</dt>
      <dd style={VALUE}>{system.hostMassReference}</dd>
      <dt style={TERM}>Planets from</dt>
      <dd style={VALUE}>NASA Exoplanet Archive</dd>
    </>
  );
}

/**
 * A host placed from the Exoplanet Archive (archiveSystems.ts): none of the star catalogues
 * here has it, so everything said of it is the Archive's.
 */
function ArchiveHostFacts({ system }: { readonly system: PlanetarySystem }) {
  const archive = system.archive!;
  return (
    <>
      {archive.distancePc !== null && (
        <>
          <dt style={TERM}>Distance</dt>
          <dd style={VALUE}>{formatStarDistance(archive.distancePc)}</dd>
        </>
      )}
      {system.hostRadiusSun !== null && (
        <>
          <dt style={TERM}>Radius</dt>
          <dd style={VALUE}>{`${formatSolar(system.hostRadiusSun)} R☉`}</dd>
        </>
      )}
      {system.hostMassSun > 0 && (
        <>
          <dt style={TERM}>Mass</dt>
          <dd style={VALUE}>{`${formatSolar(system.hostMassSun)} M☉`}</dd>
        </>
      )}
      <dt style={TERM}>Temperature</dt>
      <dd style={VALUE}>{archive.teffK === null ? 'unknown: Sun-coloured' : `${Math.round(archive.teffK)} K`}</dd>
      {archive.spectralType !== null && (
        <>
          <dt style={TERM}>Spectral type</dt>
          <dd style={VALUE}>{archive.spectralType}</dd>
        </>
      )}
      <PlanetsRow system={system} />
      {archive.stars > 1 && (
        <>
          <dt style={TERM}>Stars</dt>
          <dd style={VALUE}>{archive.stars}</dd>
        </>
      )}
      {archive.designations.length > 0 && (
        <>
          <dt style={TERM}>Also</dt>
          <dd style={VALUE}>{archive.designations.slice(0, 3).join(', ')}</dd>
        </>
      )}

      <div style={DIVIDER} />
      <dt style={TERM}>Distance from</dt>
      <dd style={VALUE}>NASA Exoplanet Archive</dd>
      <ArchiveSources system={system} />
      <dt style={TERM}>Placed by</dt>
      <dd style={VALUE}>{archive.moving ? 'Archive position and motion' : 'Archive position, no motion'}</dd>
      <dt style={TERM}>Drawn as</dt>
      <dd style={VALUE}>{system.hostRadiusSun === null ? 'Marker' : 'Disc, Archive radius'}</dd>
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
