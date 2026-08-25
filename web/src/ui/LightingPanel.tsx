import { LIGHTING_MODES, useViewStore } from '../state/store.ts';
import { Panel } from './Panel.tsx';

/**
 * Lighting mode picker.
 *
 * The description under each mode says whether it is physical. That matters here:
 * only Natural is what a camera would actually record, and a viewer should not have
 * to guess which of the three is telling the truth.
 */
export function LightingPanel() {
  const lighting = useViewStore((state) => state.lighting);
  const setLighting = useViewStore((state) => state.setLighting);
  const closePanel = useViewStore((state) => state.closePanel);

  return (
    <Panel title="Lighting" onClose={closePanel} width="17rem">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        {LIGHTING_MODES.map((mode) => {
          const active = lighting === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => setLighting(mode.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                background: active ? '#181d1a' : 'transparent',
                border: 'none',
                borderRadius: '0.25rem',
                padding: '0.5rem 0.5rem',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <ModeGlyph mode={mode.id} active={active} />
              <span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    color: active ? '#fff' : '#a8a8a8',
                  }}
                >
                  {mode.label}
                </span>
                <span
                  style={{
                    display: 'block',
                    marginTop: '0.15rem',
                    fontSize: '0.68rem',
                    lineHeight: 1.45,
                    color: '#5e5e5e',
                  }}
                >
                  {mode.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/** A little sphere showing how much of it the mode leaves lit. */
function ModeGlyph({ mode, active }: { mode: string; active: boolean }) {
  const lit = active ? '#ffffff' : '#8a8a8a';
  const dark = active ? '#3a3a3a' : '#2a2a2a';

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '0.1rem' }}>
      <circle cx="12" cy="12" r="9" fill={mode === 'flood' ? lit : dark} />
      {mode === 'shadow' && <path d="M12 3a9 9 0 0 1 0 18Z" fill={lit} opacity="0.85" />}
      {mode === 'natural' && <path d="M12 3a9 9 0 0 1 0 18Z" fill={lit} />}
    </svg>
  );
}
