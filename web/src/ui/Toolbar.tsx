import { useCallback, useEffect, useState } from 'react';

import { useViewStore, type PanelId } from '../state/store.ts';

/**
 * The vertical toolbar on the right, matching the NASA Eyes layout: info, layers,
 * zoom, lighting, fullscreen, readout.
 *
 * Icons are inline SVG paths written by hand, not an icon font, sprite sheet or
 * third-party set — nothing to install and nothing to attribute. They follow the
 * common 24x24 / 1.6 stroke / round-cap convention so they sit together, and they
 * inherit colour from CSS.
 */

const ZOOM_STEP = 1.35;

export function Toolbar() {
  const openPanel = useViewStore((state) => state.openPanel);
  const togglePanel = useViewStore((state) => state.togglePanel);
  const nudgeZoom = useViewStore((state) => state.nudgeZoom);

  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = (): void => {
      setFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement === null) {
      void document.documentElement.requestFullscreen().catch(() => {
        // Denied by the browser or unsupported; nothing to recover from.
      });
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        right: '0.9rem',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
      }}
    >
      <ToolButton
        title="About this simulator"
        active={openPanel === 'about'}
        onClick={() => togglePanel('about')}
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 7.6v.6" />
      </ToolButton>

      <ToolButton
        title="Focused body"
        active={openPanel === 'body'}
        onClick={() => togglePanel('body')}
      >
        <circle cx="12" cy="12" r="4.5" />
        <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-22 12 12)" />
      </ToolButton>

      <ToolButton
        title="Layers"
        active={openPanel === 'layers'}
        onClick={() => togglePanel('layers')}
      >
        <path d="M12 4 3 9l9 5 9-5-9-5Z" />
        <path d="M3 14l9 5 9-5" />
      </ToolButton>

      <ToolGroup>
        <ToolButton title="Zoom in" onClick={() => nudgeZoom(1 / ZOOM_STEP)} bare>
          <path d="M12 6v12" />
          <path d="M6 12h12" />
        </ToolButton>
        <ToolButton title="Zoom out" onClick={() => nudgeZoom(ZOOM_STEP)} bare>
          <path d="M6 12h12" />
        </ToolButton>
      </ToolGroup>

      <ToolButton
        title="Lighting"
        active={openPanel === 'lighting'}
        onClick={() => togglePanel('lighting')}
      >
        <circle cx="12" cy="12" r="8" fill="currentColor" stroke="none" />
      </ToolButton>

      <ToolButton
        title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        onClick={toggleFullscreen}
      >
        {fullscreen ? (
          // Arrows pointing inward: the action is to shrink back down.
          <>
            <path d="M10 4v6H4" />
            <path d="M14 20v-6h6" />
            <path d="M4 4l6 6" />
            <path d="M20 20l-6-6" />
          </>
        ) : (
          <>
            <path d="M4 9V4h5" />
            <path d="M20 15v5h-5" />
            <path d="M4 4l6 6" />
            <path d="M20 20l-6-6" />
          </>
        )}
      </ToolButton>

      <ToolButton
        title="Ephemeris readout"
        active={openPanel === 'readout'}
        onClick={() => togglePanel('readout')}
      >
        <path d="M6 4v6M6 14v6" />
        <path d="M12 4v3M12 11v9" />
        <path d="M18 4v9M18 17v3" />
        <path d="M4 12h4M10 9h4M16 15h4" />
      </ToolButton>
    </div>
  );
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(18,18,20,0.88)',
        border: '1px solid #2a2a2a',
        borderRadius: '0.35rem',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

interface ToolButtonProps {
  readonly title: string;
  readonly onClick: () => void;
  readonly active?: boolean;
  /** Inside a group: no border or background of its own. */
  readonly bare?: boolean;
  readonly children: React.ReactNode;
}

function ToolButton({ title, onClick, active = false, bare = false, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      style={{
        width: '2.35rem',
        height: '2.35rem',
        display: 'grid',
        placeItems: 'center',
        background: bare ? 'transparent' : 'rgba(18,18,20,0.88)',
        border: bare ? 'none' : `1px solid ${active ? '#3ddc84' : '#2a2a2a'}`,
        borderRadius: bare ? 0 : '0.35rem',
        color: active ? '#3ddc84' : '#b0b0b0',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}

/** Panel ids the toolbar can open, exported for the panel container to switch on. */
export const TOOLBAR_PANELS: readonly PanelId[] = [
  'about',
  'body',
  'layers',
  'lighting',
  'readout',
];
