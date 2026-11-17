import { lineClosestApproach, type PublishedApproach, type StellarFlyby } from '../core/stellarFlybys.ts';

/**
 * A star's passage by the Sun, in its panel (core/stellarFlybys.ts): the published closest
 * approach and when, whose; the other estimates; and the path drawn, with what this app's
 * straight line gives -- said to be computed, and out of the clock's reach.
 */

const TERM: React.CSSProperties = { color: '#5e5e5e', fontSize: '0.7rem', whiteSpace: 'nowrap' };
const VALUE: React.CSSProperties = {
  margin: 0,
  color: '#c4c4c4',
  fontSize: '0.72rem',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
const DIVIDER: React.CSSProperties = { gridColumn: '1 / -1', height: 1, background: '#202020', margin: '0.4rem 0' };

const AU_PER_PC = 206_264.806;

/** "0.052 pc (10,700 AU)", the AU to three figures. */
function distance(pc: number, errorPc: number | null): string {
  const au = Number((pc * AU_PER_PC).toPrecision(3)).toLocaleString('en-US');
  const error = errorPc === null ? '' : ` ± ${Number(errorPc.toPrecision(1))}`;
  return `${Number(pc.toPrecision(3))}${error} pc (${au} AU)`;
}

/** "in 1.29 ± 0.02 million years", "80,500 ± 700 years ago". */
function when(years: number, error: number | null): string {
  const span = Math.abs(years);
  const text = (value: number): string =>
    span >= 1e6 ? `${Number((value / 1e6).toPrecision(3))}` : Number(value.toPrecision(3)).toLocaleString('en-US');
  const unit = span >= 1e6 ? ' million years' : ' years';
  const amount = `${text(span)}${error === null ? '' : ` ± ${text(error)}`}${unit}`;
  return years < 0 ? `${amount} ago` : `in ${amount}`;
}

function Estimate({ approach }: { readonly approach: PublishedApproach }) {
  return (
    <>
      <dt style={TERM}>Also</dt>
      <dd style={VALUE}>
        {`${distance(approach.closestPc, null)}, ${when(approach.years, null)}: ${approach.reference}`}
      </dd>
    </>
  );
}

export function FlybyFacts({ flyby }: { readonly flyby: StellarFlyby }) {
  const { published } = flyby;
  const line = lineClosestApproach(flyby);
  return (
    <>
      <div style={DIVIDER} />
      <dt style={TERM}>Closest to the Sun</dt>
      <dd style={VALUE}>{distance(published.closestPc, published.closestErrorPc)}</dd>
      <dt style={TERM}>When</dt>
      <dd style={VALUE}>{when(published.years, published.yearsError)}</dd>
      <dt style={TERM}>From</dt>
      <dd style={VALUE}>{`${published.reference}; ${published.basis}`}</dd>
      {flyby.others.map((approach) => (
        <Estimate key={approach.reference} approach={approach} />
      ))}
      <dt style={TERM}>Path drawn</dt>
      <dd style={VALUE}>
        {`A straight line, computed: ${distance(line.distancePc, null)}, ${when(line.years, null)}. Beyond the clock’s reach.`}
      </dd>
    </>
  );
}
