import { LAYERS, useViewStore, type LayerDefinition } from '../state/store.ts';
import { Panel } from './Panel.tsx';

/**
 * Layer toggles.
 *
 * Layers that do not exist yet are listed and disabled, labelled with the phase that
 * brings them. Hiding them would be tidier and less honest: this way the panel says
 * plainly what the simulator covers today and what is still to come.
 */
export function LayersPanel() {
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
          />
        ))}
      </div>
    </Panel>
  );
}

interface LayerRowProps {
  readonly layer: LayerDefinition;
  readonly checked: boolean;
  readonly onToggle: () => void;
}

function LayerRow({ layer, checked, onToggle }: LayerRowProps) {
  const disabled = layer.pending !== null;

  return (
    <>
      {layer.startsGroup === true && (
        <div style={{ height: 1, background: '#242424', margin: '0.55rem 0' }} />
      )}
      <label
        style={{
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
    </>
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
