import { useSyncExternalStore } from 'react';

import {
  beltDensities,
  type BeltDensity,
  type BeltProgress,
  type BeltSource,
} from '../core/belt.ts';
import { LAYERS, useViewStore, type LayerDefinition } from '../state/store.ts';
import { Panel } from './Panel.tsx';

/**
 * Layer toggles.
 *
 * Layers that do not exist yet are listed and disabled, labelled with the phase that
 * brings them. Hiding them would be tidier and less honest: this way the panel says
 * plainly what the simulator covers today and what is still to come.
 *
 * Under Asteroids, while it is on, sits the belt's density: how many of its magnitude
 * tiers to load. See BeltDensityPicker.
 */
export function LayersPanel({ belt }: { readonly belt: BeltSource }) {
  const layers = useViewStore((state) => state.layers);
  const toggleLayer = useViewStore((state) => state.toggleLayer);
  const closePanel = useViewStore((state) => state.closePanel);

  return (
    <Panel title="Layers" onClose={closePanel}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {LAYERS.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            checked={layers[layer.id]}
            onToggle={() => toggleLayer(layer.id)}
          >
            {layer.id === 'asteroids' && layers.asteroids && (
              <>
                <BeltDensityPicker belt={belt} />
                <BeltNote />
              </>
            )}
          </LayerRow>
        ))}
      </div>
    </Panel>
  );
}

interface LayerRowProps {
  readonly layer: LayerDefinition;
  readonly checked: boolean;
  readonly onToggle: () => void;
  /** Settings of the layer's own, shown under its row. */
  readonly children?: React.ReactNode;
}

function LayerRow({ layer, checked, onToggle, children }: LayerRowProps) {
  const disabled = layer.pending !== null;

  return (
    <>
      {layer.startsGroup === true && (
        <div style={{ height: 1, background: '#242424', margin: '0.55rem 0' }} />
      )}
      <label
        className="ui-press"
        // The stylesheet keys the hover and press off this rather than off the input's
        // own disabled attribute, because the row is what the pointer is over.
        aria-disabled={disabled}
        style={{
          borderRadius: '0.2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.32rem 0',
          cursor: disabled ? 'default' : 'pointer',
          color: disabled ? '#4e4e4e' : '#d6d6d6',
          fontSize: '0.82rem',
        }}
      >
        <Checkbox checked={checked} disabled={disabled} onChange={onToggle} />
        <span>{layer.label}</span>
        {disabled && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.62rem',
              letterSpacing: '0.08em',
              color: '#3f3f3f',
              border: '1px solid #2a2a2a',
              borderRadius: '0.2rem',
              padding: '0.05rem 0.3rem',
              whiteSpace: 'nowrap',
            }}
          >
            {layer.pending}
          </span>
        )}
      </label>
      {children}
    </>
  );
}

/**
 * A count of asteroids as a person says it: two significant figures, in thousands or
 * millions. 83,841 is "84 thousand" and 1,575,460 "1.6 million".
 */
export function spokenCount(count: number): string {
  if (count < 1000) {
    return String(count);
  }
  const thousands = Number((count / 1000).toPrecision(2));
  return thousands < 1000
    ? `${thousands} thousand`
    : `${Number((count / 1e6).toPrecision(2))} million`;
}

/** Bytes as megabytes, to two significant figures from ten up: "3.0", "7.5", "18", "57". */
export function megabytes(bytes: number): string {
  const mb = bytes / 1e6;
  return mb < 10 ? mb.toFixed(1) : String(Math.round(mb));
}

/** One density choice's label: the count, and "All" on the one that is everything. */
export function densityLabel(density: BeltDensity, last: boolean): string {
  return `${last ? 'All ' : ''}${spokenCount(density.count)}`;
}

/**
 * The progress line, or null when there is nothing to say: everything asked for is
 * here. Counted in tiers and in megabytes, since the tiers are not the same size -- the
 * last is eight times the first, and "4 of 5" alone would say it is nearly done.
 */
export function progressText(progress: BeltProgress): string | null {
  if (progress.failed) {
    return 'Could not load the asteroids';
  }
  if (progress.loaded >= progress.wanted || progress.bytesWanted === 0) {
    return null;
  }
  return `Loading ${progress.loaded + 1} of ${progress.wanted} · ${megabytes(progress.bytesLoaded)} of ${megabytes(progress.bytesWanted)} MB`;
}

/**
 * How much of the belt to load: every prefix of its tiers, from the brightest 84,000 to
 * the whole catalogue, each labelled with its count and its download, both read from
 * belt.json. Every prefix rather than a chosen few: each tier is one magnitude fainter
 * and roughly doubles what is drawn, so each is a real step, and which one a machine can
 * carry is the viewer's to find out.
 *
 * Shown once belt.json is in -- which is once the layer has been on -- and only when the
 * data has more than one tier: B2a's has nothing to choose between.
 */
function BeltDensityPicker({ belt }: { readonly belt: BeltSource }) {
  const view = useSyncExternalStore(belt.subscribe, () => belt.view);
  const progress = useSyncExternalStore(belt.subscribe, () => belt.progress);
  const chosen = useViewStore((state) => state.beltTiers);
  const setBeltTiers = useViewStore((state) => state.setBeltTiers);

  const densities = view.info === null ? [] : beltDensities(view.info);
  const status = progressText(progress);
  if (densities.length < 2 && status === null) {
    return null;
  }
  // More than the data has means all of it: a choice made against a bigger catalogue.
  const selected = Math.min(chosen, densities.length);

  const current = densities[selected - 1] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', margin: '0.05rem 0 0.35rem 1.65rem' }}>
      {densities.length >= 2 && current !== null && (
        // One line, not one row per choice: bars that rise and fill up to the density
        // chosen, like a signal meter -- each tier is a magnitude fainter and about twice
        // the count, so a taller bar is honestly "more" -- and beside them what that
        // choice is, in asteroids and in download.
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            role="radiogroup"
            aria-label="Asteroid density"
            style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '1rem' }}
          >
            {densities.map((density, index) => {
              const filled = density.tiers <= selected;
              const label = `${densityLabel(density, index === densities.length - 1)}, ${megabytes(density.bytes)} MB`;
              return (
                <button
                  key={density.tiers}
                  type="button"
                  role="radio"
                  aria-checked={density.tiers === selected}
                  aria-label={label}
                  title={
                    density.faintestH === null
                      ? `${label}: every asteroid in the catalogue`
                      : `${label}: every asteroid brighter than absolute magnitude ${density.faintestH}`
                  }
                  onClick={() => setBeltTiers(density.tiers)}
                  style={{
                    width: '0.55rem',
                    // The tallest bar fills the row; the shortest is a third of it.
                    height: `${34 + (66 * index) / Math.max(densities.length - 1, 1)}%`,
                    padding: 0,
                    border: 'none',
                    borderRadius: '1px',
                    background: filled ? '#4a86ff' : '#2e2e2e',
                    cursor: 'pointer',
                  }}
                />
              );
            })}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#a8a8a8', whiteSpace: 'nowrap' }}>
            {densityLabel(current, selected === densities.length)}
            <span style={{ color: '#5e5e5e' }}> · {megabytes(current.bytes)} MB</span>
          </span>
        </div>
      )}
      {status !== null && (
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.25rem 0 0',
            fontSize: '0.64rem',
            color: progress.failed ? '#e06c5a' : '#6a6a6a',
          }}
        >
          <span>{status}</span>
          {progress.failed && (
            <button
              type="button"
              className="ui-press"
              onClick={() => void belt.retry()}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: '1px solid #2a2a2a',
                borderRadius: '0.2rem',
                color: '#a8a8a8',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.62rem',
                padding: '0.05rem 0.35rem',
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * What the belt's dots are, said where they are switched on: the cloud of a million
 * asteroids is a map of their positions, not a picture. At their real size and light
 * almost none would show from anywhere this view goes, so nobody should take the dots
 * for what the eye would see. The About panel has the long version.
 */
function BeltNote() {
  return (
    <p
      style={{
        margin: '0 0 0.4rem 1.65rem',
        fontSize: '0.64rem',
        lineHeight: 1.45,
        color: '#6a6a6a',
      }}
    >
      Not to scale: each dot marks where an asteroid is. Seen for real, almost none would be
      visible.
    </p>
  );
}

function Checkbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <span style={{ position: 'relative', display: 'inline-grid', placeItems: 'center' }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{
          appearance: 'none',
          width: '1.05rem',
          height: '1.05rem',
          margin: 0,
          borderRadius: '0.2rem',
          border: `1px solid ${disabled ? '#2e2e2e' : checked ? '#4a86ff' : '#4a4a4a'}`,
          background: checked && !disabled ? '#4a86ff' : 'transparent',
          cursor: disabled ? 'default' : 'pointer',
        }}
      />
      {checked && !disabled && (
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ position: 'absolute', pointerEvents: 'none' }}
          aria-hidden="true"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
  );
}
