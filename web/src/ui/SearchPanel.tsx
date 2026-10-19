import type { BodyId } from '@sss/tools/types';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { describeBody, layersFor, parentNameOf, searchBodies } from '../core/search.ts';
import type { SimClock } from '../core/time.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';
import { useViewStore } from '../state/store.ts';
import { craftUnavailability } from './BodyPicker.tsx';
import { Panel } from './Panel.tsx';

/**
 * Search: type part of a name, pick the body, go there.
 *
 * Opened from the toolbar or with "/" or Ctrl+K anywhere (see Toolbar.tsx). Arrows move
 * through the results, Enter goes to the highlighted one, Escape closes.
 *
 * Every small moon is searchable, not only those of systems already visited: opening the
 * panel fetches the five planets' small-moon lists, 500 KB in all, once. Without that,
 * typing "Pan" would find nothing until Saturn had been entered, which is exactly when
 * nobody needs a search. They arrive as bodies like any others, hidden while their layer
 * is off; choosing one turns the layer on.
 */

/** Results listed at once. More than fit on screen, fewer than make typing lag. */
const RESULT_LIMIT = 40;

const ACCENT = '#3ddc84';

export function SearchPanel({
  store,
  clock,
  focus,
}: {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
}) {
  const closePanel = useViewStore((state) => state.closePanel);
  const setFocus = useViewStore((state) => state.setFocus);
  const setLayer = useViewStore((state) => state.setLayer);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // The results change as the small moons arrive.
  const version = useStoreVersion(store);

  useEffect(() => {
    input.current?.focus();
    for (const planet of Object.keys(store.manifest.smallMoons ?? {})) {
      void store.loadSmallMoons(planet);
    }
  }, [store]);

  const results = useMemo(
    () => (void version, searchBodies(store.bodies, query, RESULT_LIMIT)),
    [store, query, version],
  );

  // A new query starts at the top.
  useEffect(() => {
    setSelected(0);
  }, [query]);

  // Keep the highlighted row in view while the arrows move it.
  useEffect(() => {
    const row = list.current?.children[selected] as HTMLElement | undefined;
    row?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  // Read when typed, not ticked: a craft greyed out stays so until the next keystroke,
  // which is far more often than the clock moves one past a launch date.
  const jd = clock.tdbJulianDay;
  const unavailable = (id: BodyId): string | null =>
    store.body(id).kind === 'spacecraft' ? craftUnavailability(store, id, jd) : null;

  const choose = (id: BodyId): void => {
    if (unavailable(id) !== null) {
      return;
    }
    for (const layer of layersFor(store.body(id))) {
      setLayer(layer, true);
    }
    setFocus(id);
    closePanel();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      const result = results[selected];
      if (result !== undefined) {
        choose(result.body.id);
      }
    } else if (event.key === 'Escape') {
      closePanel();
    }
  };

  return (
    <Panel title="Search" onClose={closePanel} width="17rem">
      <input
        ref={input}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Planet, moon, asteroid, spacecraft…"
        aria-label="Search bodies"
        aria-controls="search-results"
        spellCheck={false}
        autoComplete="off"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: '#0b0b0d',
          border: `1px solid ${query === '' ? '#2a2a2a' : '#3a3a3a'}`,
          borderRadius: '0.3rem',
          color: '#e8e8e8',
          fontFamily: 'inherit',
          fontSize: '0.8rem',
          padding: '0.45rem 0.55rem',
          outline: 'none',
        }}
      />

      {query.trim() !== '' && results.length === 0 && (
        <p style={{ color: '#6a6a6a', fontSize: '0.72rem', margin: '0.7rem 0 0' }}>
          Nothing by that name here.
        </p>
      )}

      <ul
        ref={list}
        id="search-results"
        role="listbox"
        aria-label="Results"
        style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}
      >
        {results.map(({ body }, index) => {
          const reason = unavailable(body.id);
          const active = index === selected;
          return (
            <li
              key={body.id}
              role="option"
              aria-selected={active}
              aria-disabled={reason !== null}
              onMouseEnter={() => setSelected(index)}
              onClick={() => choose(body.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.45rem',
                borderRadius: '0.25rem',
                cursor: reason === null ? 'pointer' : 'default',
                background: active ? '#1b1b1f' : 'transparent',
                opacity: reason === null ? 1 : 0.45,
              }}
            >
              <span aria-hidden="true" style={{ color: body.color, fontSize: '0.6rem' }}>
                {body.kind === 'spacecraft' ? '◆' : '●'}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    color: body.id === focus ? ACCENT : '#e0e0e0',
                    fontSize: '0.78rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {body.name}
                </span>
                <span style={{ display: 'block', color: '#6a6a6a', fontSize: '0.64rem' }}>
                  {describeBody(body, parentNameOf(store.bodies, body.parent))}
                  {reason !== null && ` · ${reason}`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
