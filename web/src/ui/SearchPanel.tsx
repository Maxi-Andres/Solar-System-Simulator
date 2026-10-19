import type { BodyId } from '@sss/tools/types';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { BELT_FAMILIES, httpBeltFetchers, type BeltSource } from '../core/belt.ts';
import { addBeltBody, beltBodyId } from '../core/beltBodies.ts';
import { searchable, searchNames, type NameIndex, type NameIndexSource } from '../core/beltNames.ts';
import { addCometBody, cometBodyId } from '../core/cometBodies.ts';
import type { CometSource } from '../core/comets.ts';
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
 *
 * And the belt's notable asteroids (step B2c): opening the panel fetches their name index
 * too, once (see beltNames.ts). They are listed after the bodies that match, since a
 * body is a better answer than a dot; choosing one makes it a body of its own -- reading
 * just its record, if its tier is not loaded -- and goes to it (see beltBodies.ts).
 *
 * And the comets, by the names in comets.json, fetched with them when the panel opens;
 * listed before the belt's names, since there are few of them and people look for them
 * by name. Choosing one makes it a body the same way (see cometBodies.ts).
 */

/** Results listed at once. More than fit on screen, fewer than make typing lag. */
const RESULT_LIMIT = 40;

/** Of those, at most this many from the belt's names, after the bodies. */
const NAME_LIMIT = 20;

/** And at most this many comets, between the two. */
const COMET_LIMIT = 10;

const ACCENT = '#3ddc84';

/** A result: a body in the store, or entry `k` of the belt's name index. */
type Result =
  | { readonly kind: 'body'; readonly id: BodyId }
  | { readonly kind: 'name'; readonly k: number }
  | { readonly kind: 'comet'; readonly k: number };

export function SearchPanel({
  store,
  clock,
  focus,
  belt,
  names,
  comets,
}: {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly belt: BeltSource;
  readonly names: NameIndexSource;
  readonly comets: CometSource;
}) {
  const closePanel = useViewStore((state) => state.closePanel);
  const setFocus = useViewStore((state) => state.setFocus);
  const setLayer = useViewStore((state) => state.setLayer);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // The results change as the small moons arrive, and as the names do.
  const version = useStoreVersion(store);
  const nameIndex = useSyncExternalStore(names.subscribe, () => names.index);
  const cometData = useSyncExternalStore(comets.subscribe, () => comets.comets);
  // Four thousand names made comparable once, when the comets arrive.
  const cometIndex = useMemo(
    () => (cometData === null ? null : searchable(cometData.info.names)),
    [cometData],
  );

  useEffect(() => {
    input.current?.focus();
    for (const planet of Object.keys(store.manifest.smallMoons ?? {})) {
      void store.loadSmallMoons(planet);
    }
    void names.request();
    void comets.request();
  }, [store, names, comets]);

  const results = useMemo((): Result[] => {
    void version;
    const bodies: Result[] = searchBodies(store.bodies, query, RESULT_LIMIT).map(({ body }) => ({
      kind: 'body',
      id: body.id,
    }));
    // A comet or a name already a body is listed as the body, once.
    const fromComets: Result[] =
      cometIndex === null
        ? []
        : searchNames(cometIndex, query, COMET_LIMIT)
            .filter(({ k }) => !store.isPropagatedBody(cometBodyId(k)))
            .map(({ k }) => ({ kind: 'comet', k }));
    const fromNames: Result[] =
      nameIndex === null
        ? []
        : searchNames(nameIndex, query, NAME_LIMIT)
            .filter(({ k }) => !store.isPropagatedBody(beltBodyId(nameIndex.names.tier[k]!, nameIndex.names.index[k]!)))
            .map(({ k }) => ({ kind: 'name', k }));
    return [...bodies, ...fromComets, ...fromNames].slice(0, RESULT_LIMIT);
  }, [store, query, version, nameIndex, cometIndex]);

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
  const unavailable = (result: Result): string | null =>
    result.kind === 'body' && store.body(result.id).kind === 'spacecraft'
      ? craftUnavailability(store, result.id, jd)
      : null;

  const go = (id: BodyId): void => {
    for (const layer of layersFor(store.body(id))) {
      setLayer(layer, true);
    }
    setFocus(id);
    closePanel();
  };

  const choose = (result: Result): void => {
    if (unavailable(result) !== null) {
      return;
    }
    if (result.kind === 'body') {
      go(result.id);
      return;
    }
    if (result.kind === 'comet') {
      if (cometData !== null) {
        go(addCometBody(store, cometData, result.k, focus));
      }
      return;
    }
    if (nameIndex === null) {
      return;
    }
    addBeltBody(store, nameIndex, result.k, httpBeltFetchers, belt.view.tiers, focus, import.meta.env.BASE_URL)
      .then(go)
      .catch((error: unknown) => {
        console.error(`Could not go to ${nameIndex.names.display[result.k]}`, error);
      });
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
        choose(result);
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
        {results.map((result, index) => {
          const reason = unavailable(result);
          const active = index === selected;
          const row = describeResult(store, result, nameIndex, cometData?.info.names ?? null);
          return (
            <li
              key={result.kind === 'body' ? result.id : `${result.kind}-${result.k}`}
              role="option"
              aria-selected={active}
              aria-disabled={reason !== null}
              onMouseEnter={() => setSelected(index)}
              onClick={() => choose(result)}
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
              <span aria-hidden="true" style={{ color: row.color, fontSize: '0.6rem' }}>
                {row.glyph}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    color: result.kind === 'body' && result.id === focus ? ACCENT : '#e0e0e0',
                    fontSize: '0.78rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.name}
                </span>
                <span style={{ display: 'block', color: '#6a6a6a', fontSize: '0.64rem' }}>
                  {row.detail}
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

/** A result's row: its glyph and colour, its name, and the line under it. */
function describeResult(
  store: EphemerisStore,
  result: Result,
  nameIndex: NameIndex | null,
  cometNames: readonly string[] | null,
): { readonly glyph: string; readonly color: string; readonly name: string; readonly detail: string } {
  if (result.kind === 'body') {
    const body = store.body(result.id);
    return {
      glyph: body.kind === 'spacecraft' ? '◆' : '●',
      color: body.color,
      name: body.name,
      detail: describeBody(body, parentNameOf(store.bodies, body.parent)),
    };
  }
  if (result.kind === 'comet') {
    return { glyph: '·', color: '#9ecbe6', name: cometNames![result.k]!, detail: 'Comet' };
  }
  const names = nameIndex!.names;
  const orbitClass = nameIndex!.info.classes[names.classIndex[result.k]!];
  const family = BELT_FAMILIES.find((candidate) => orbitClass !== undefined && candidate.classes.includes(orbitClass));
  const designation = names.designation[result.k];
  return {
    // A dot: what it is on screen until chosen.
    glyph: '·',
    color: '#b3ada3',
    name: names.display[result.k]!,
    detail: ['Asteroid', family?.label, designation ?? undefined].filter((part) => part !== undefined).join(' · '),
  };
}
