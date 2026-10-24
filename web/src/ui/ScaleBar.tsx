import { useCallback, type RefObject } from 'react';

/**
 * The scale bar, bottom right: a bracket and its length.
 *
 * React draws it once; the scene writes its width, label and tooltip every frame they
 * change (see ScaleBarProbe), as it writes the labels' positions -- a zoom is sixty
 * changes a second, and none of them is worth a render.
 */

/** The bar's parts, for the scene to write into. */
export interface ScaleBarElements {
  readonly root: HTMLElement;
  readonly bar: HTMLElement;
  readonly label: HTMLElement;
}

export function ScaleBar({
  elements,
  focusName,
}: {
  readonly elements: RefObject<ScaleBarElements | null>;
  /** Named in the tooltip: the bar measures at the focus's distance. */
  readonly focusName: string;
}) {
  // One callback for the three nodes: the root, which holds the other two, mounts last.
  const attach = useCallback(
    (root: HTMLDivElement | null) => {
      if (root === null) {
        elements.current = null;
        return;
      }
      const bar = root.querySelector<HTMLElement>('[data-scale-bar]');
      const label = root.querySelector<HTMLElement>('[data-scale-label]');
      elements.current = bar === null || label === null ? null : { root, bar, label };
    },
    [elements],
  );

  return (
    <div
      ref={attach}
      role="img"
      aria-label="Scale"
      data-focus={focusName}
      style={{
        position: 'absolute',
        right: '1.25rem',
        bottom: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '0.3rem',
        pointerEvents: 'auto',
        cursor: 'default',
      }}
    >
      <span
        data-scale-label
        style={{
          color: '#a8a8a8',
          fontSize: '0.66rem',
          letterSpacing: '0.12em',
          whiteSpace: 'nowrap',
          textShadow: '0 0 6px rgba(0,0,0,0.95)',
        }}
      />
      <span
        data-scale-bar
        style={{
          display: 'block',
          height: '5px',
          width: '0px',
          borderLeft: '1px solid #8a8a8a',
          borderRight: '1px solid #8a8a8a',
          borderBottom: '1px solid #8a8a8a',
        }}
      />
    </div>
  );
}
