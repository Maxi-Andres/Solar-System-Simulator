import type { BodyId, PulsarDistanceMethod } from '@sss/tools/types';

import type { DistanceMode, EphemerisStore } from '../core/ephemerisStore.ts';
import {
  characteristicAgeYears,
  formatPeriod,
  neutronStarSize,
  pulsarOf,
  surfaceFieldGauss,
} from '../core/pulsars.ts';
import { PARSEC_KM } from '../scene/scale.ts';
import { Panel } from './Panel.tsx';
import { formatStarDistance } from './StarFacts.tsx';

/**
 * The info panel for a pulsar gone to (pulsars.ts): short rows, each a number and where it
 * is from. How the distance is chosen, what the spin says and what is drawn by convention
 * are the About's to explain.
 */

/** How each distance is got, in a word or two. */
const METHOD: Readonly<Record<PulsarDistanceMethod, string>> = {
  independent: 'measured',
  parallax: 'parallax',
  bounded: 'DM, bounded',
  dm: 'DM model (YMW16)',
  magnetar: 'McGill',
};

/**
 * The ATNF's companion codes, as words. A "T" marks a system of three or more: J0337+1715's
 * two white dwarfs, B1620-26's white dwarf and planet, B1257+12's planets.
 */
const COMPANION: Readonly<Record<string, string>> = {
  He: 'helium white dwarf',
  CO: 'carbon-oxygen white dwarf',
  ONeMg: 'oxygen-neon white dwarf',
  MS: 'main-sequence star',
  NS: 'neutron star',
  UL: 'ultra-light',
  HeT: 'helium white dwarf, and more',
  ULT: 'ultra-light, several',
};

/** The ATNF's TYPE codes, as words. */
const TYPES: Readonly<Record<string, string>> = {
  HE: 'seen at high energies',
  NRAD: 'no radio pulses',
  AXP: 'magnetar',
  XINS: 'isolated, thermal X-rays',
  RRAT: 'rotating radio transient',
};

function formatAge(years: number): string {
  if (years >= 1e9) {
    return `${Number((years / 1e9).toPrecision(3))} billion years`;
  }
  if (years >= 1e6) {
    return `${Number((years / 1e6).toPrecision(3))} million years`;
  }
  return `${Number(years.toPrecision(3)).toLocaleString('en-US')} years`;
}

function formatGauss(gauss: number): string {
  const exponent = Math.floor(Math.log10(gauss));
  return `${(gauss / 10 ** exponent).toFixed(1)}×10${superscript(exponent)} G`;
}

function superscript(n: number): string {
  const digits = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  return String(n)
    .split('')
    .map((c) => (c === '-' ? '⁻' : digits[Number(c)]))
    .join('');
}

export function PulsarPanel({
  store,
  focus,
  jd,
  distanceMode,
  onClose,
}: {
  store: EphemerisStore;
  focus: BodyId;
  jd: number;
  distanceMode: DistanceMode;
  onClose: () => void;
}) {
  const found = pulsarOf(focus);
  if (found === null) {
    return null;
  }
  const { catalog, k } = found;
  const p = catalog.pulsars;
  const body = store.body(focus);
  const fromSun = store.distanceBetween(focus, 'sun', jd, distanceMode);
  const period = p.periodS[k] ?? null;
  const pdot = p.periodDerivative[k] ?? null;
  const field = surfaceFieldGauss(period, pdot);
  const age = characteristicAgeYears(period, pdot);
  const size = neutronStarSize(catalog, k);
  const ref = p.distanceRef[k];
  const names = [p.jName[k], p.bName[k]].filter((name) => name != null && `PSR ${name}` !== p.name[k]);
  const types = p.types[k]!.filter((code) => code !== 'AXP').map((code) => TYPES[code] ?? code);
  const companion = p.companion[k];
  return (
    <Panel title={body.name} onClose={onClose} width="17.5rem">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: body.color, fontSize: '0.9rem' }}>●</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', color: '#5a5a5a', textTransform: 'uppercase' }}>
          {p.magnetar[k] ? (p.candidate[k] ? 'magnetar candidate' : 'magnetar') : 'pulsar'}
        </span>
      </div>
      <div style={{ height: 1, background: '#242424', margin: '0.7rem 0' }} />
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.28rem 0.7rem' }}>
        {names.length > 0 && <Row label="Also">{names.join(' · ')}</Row>}
        <Row label="Distance">
          {fromSun === null ? '--' : `${p.distanceApproximate[k] ? '~' : ''}${formatStarDistance(fromSun / PARSEC_KM)}`}
        </Row>
        <Row label="From">{METHOD[p.distanceMethod[k]!]}</Row>
        {ref != null && <Row label="Source">{catalog.references[ref]}</Row>}
        <Divider />
        <Row label="Spin period">{period === null ? 'Unmeasured' : formatPeriod(period)}</Row>
        {period !== null && <Row label="Turns a second">{Number((1 / period).toPrecision(4)).toLocaleString('en-US')}</Row>}
        {pdot !== null && <Row label="Slowing">{`${pdot.toExponential(2)} s/s`}</Row>}
        {age !== null && <Row label="Spin-down age">{formatAge(age)}</Row>}
        {field !== null && <Row label="Field (dipole est.)">{formatGauss(field)}</Row>}
        {p.binaryPeriodDays[k] != null && (
          <Row label="Orbit">{`${Number(p.binaryPeriodDays[k]!.toPrecision(4))} days`}</Row>
        )}
        {companion != null && <Row label="Companion">{COMPANION[companion] ?? companion}</Row>}
        {p.globularCluster[k] != null && <Row label="In cluster">{p.globularCluster[k]}</Row>}
        {p.remnant[k] != null && <Row label="In remnant">{p.remnant[k]}</Row>}
        {types.length > 0 && <Row label="Seen">{types.join(' · ')}</Row>}
        <Divider />
        <Row label="Radius">
          {size.measured === null
            ? `${size.radiusKm} km, assumed`
            : `${size.radiusKm} +${size.measured.radiusUpKm} −${size.measured.radiusDownKm} km`}
        </Row>
        {size.measured !== null && (
          <>
            <Row label="Mass">{`${size.measured.massSun} M☉`}</Row>
            <Row label="">{size.measured.reference}</Row>
          </>
        )}
        <Row label="Listed by">
          {p.jName[k] == null ? 'McGill' : p.magnetar[k] && !p.name[k]!.startsWith('PSR') ? 'ATNF · McGill' : 'ATNF'}
        </Row>
      </dl>
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={{ color: '#5e5e5e', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{label}</dt>
      <dd
        style={{
          margin: 0,
          color: '#c4c4c4',
          fontSize: '0.72rem',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {children}
      </dd>
    </>
  );
}

function Divider() {
  return <div style={{ gridColumn: '1 / -1', height: 1, background: '#202020', margin: '0.4rem 0' }} />;
}
