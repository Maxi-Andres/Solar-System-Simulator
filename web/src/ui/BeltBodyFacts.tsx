import type { BodyId } from '@sss/tools/types';

import { BELT_FAMILIES } from '../core/belt.ts';
import { beltBodyFacts } from '../core/beltBodies.ts';
import { cometBodyFacts } from '../core/cometBodies.ts';

/**
 * The facts a belt asteroid made into a body has beyond any body's (see beltBodies.ts):
 * for the info panel, which shows them under the orbit when the focus is one, and nothing
 * otherwise. Its radius, GM and orbit the panel shows as it does for any body; what only
 * this knows is where the asteroid came from, and what its position is worth.
 */

const AU_KM = 149_597_870.7;

/** The orbit class as a person says it, then SBDB's code. */
function classLabel(code: string): string {
  const family = BELT_FAMILIES.find((candidate) => (candidate.classes as readonly string[]).includes(code));
  return family === undefined ? code : `${family.label} (${code})`;
}

function jdToDate(jd: number): string {
  return new Date((jd - 2440587.5) * 86_400_000).toISOString().slice(0, 10);
}

/** SBDB's comet classes, as a person says them. */
const COMET_CLASS_LABELS: Readonly<Record<string, string>> = {
  ETc: 'Encke-type',
  JFc: 'Jupiter-family',
  JFC: 'Jupiter-family',
  CTc: 'Chiron-type',
  HTC: 'Halley-type',
  PAR: 'Parabolic',
  HYP: 'Hyperbolic',
  COM: 'Comet',
};

/**
 * The same for a comet made a body from search (see cometBodies.ts): its class, its
 * perihelion, its magnitude parameters, and the honest note about its place.
 */
function CometFacts({ id }: { readonly id: BodyId }) {
  const facts = cometBodyFacts(id);
  if (facts === null) {
    return null;
  }
  const open = facts.eccentricity >= 1;
  return (
    <>
      <div style={{ gridColumn: '1 / -1', height: 1, background: '#242424', margin: '0.3rem 0' }} />
      <dt style={TERM}>Orbit class</dt>
      <dd style={VALUE}>{`${COMET_CLASS_LABELS[facts.orbitClass] ?? facts.orbitClass} (${facts.orbitClass})`}</dd>
      <dt style={TERM}>Perihelion</dt>
      <dd style={VALUE}>{`${(facts.perihelionKm / AU_KM).toFixed(4)} AU, ${jdToDate(facts.perihelionJd)}`}</dd>
      <dt style={TERM}>Eccentricity</dt>
      <dd style={VALUE}>{facts.eccentricity.toFixed(5)}</dd>
      <dt style={TERM}>Inclination</dt>
      <dd style={VALUE}>{`${facts.inclinationDeg.toFixed(3)}°`}</dd>
      <dt style={TERM}>Magnitude parameters</dt>
      <dd style={VALUE}>
        {facts.M1 === null ? 'Not given by SBDB' : `M1 ${facts.M1.toFixed(1)}, K1 ${facts.K1?.toFixed(1) ?? '--'}`}
      </dd>
      <dd style={NOTE}>
        Placed on its two-body {open ? (facts.eccentricity === 1 ? 'parabola' : 'hyperbola') : 'ellipse'}{' '}
        about the Sun from JPL’s Small-Body Database, so it is marked approximate: a comet
        that has passed a planet since its orbit was fitted, or that is outgassing, is off it
        — by tens of millions of kilometres for an old periodic comet like Halley.
        {open && ' An open orbit is not drawn yet.'} Its nucleus is not measured: the marker
        is a marker.
      </dd>
    </>
  );
}

export function BeltBodyFacts({ id }: { readonly id: BodyId }) {
  const facts = beltBodyFacts(id);
  if (facts === null) {
    return <CometFacts id={id} />;
  }
  return (
    <>
      <div style={{ gridColumn: '1 / -1', height: 1, background: '#242424', margin: '0.3rem 0' }} />
      <dt style={TERM}>Orbit class</dt>
      <dd style={VALUE}>{classLabel(facts.orbitClass)}</dd>
      {facts.designation !== null && (
        <>
          <dt style={TERM}>Designation</dt>
          <dd style={VALUE}>{facts.designation}</dd>
        </>
      )}
      <dt style={TERM}>Absolute magnitude</dt>
      <dd style={VALUE}>{`H ${facts.absoluteMagnitude.toFixed(2)}`}</dd>
      <dt style={TERM}>Semi-major axis</dt>
      <dd style={VALUE}>{`${(facts.semiMajorAxisKm / AU_KM).toFixed(4)} AU`}</dd>
      <dd style={NOTE}>
        Placed by two-body propagation of its osculating elements from JPL’s Small-Body
        Database, with nothing pulling it off them, so it is marked approximate. That drifts
        tens of thousands of kilometres a year from the elements’ epoch (here between{' '}
        {jdToDate(facts.elementEpochs.minJd)} and {jdToDate(facts.elementEpochs.maxJd)}), and
        most for an asteroid that passes close to a planet. Its size is not measured: the
        marker is a marker.
      </dd>
    </>
  );
}

// The info panel's own Row, restated so this file needs nothing from it.
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
