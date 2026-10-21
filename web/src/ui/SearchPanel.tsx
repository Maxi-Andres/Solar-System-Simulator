import type { BodyId } from '@sss/tools/types';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { BELT_FAMILIES, httpBeltFetchers, type BeltSource } from '../core/belt.ts';
import { addBeltBody, beltBodyId } from '../core/beltBodies.ts';
import {
  searchable,
  searchNames,
  type NameIndex,
  type NameIndexSource,
  type Searchable,
} from '../core/beltNames.ts';
import { addCometBody, cometBodyId } from '../core/cometBodies.ts';
import type { CometSource } from '../core/comets.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  addBulkSatelliteBody,
  addSgpSatelliteBody,
  bulkSatelliteBodyId,
  sgpSatelliteBodyId,
} from '../core/satelliteBodies.ts';
import { chipShown, satelliteBodyChip } from '../core/satelliteGroups.ts';
import {
  BULK_WINDOW_DAYS,
  NAMED_WINDOW_DAYS,
  type LazySource,
  type SatelliteNameIndex,
  type Satellites,
  type SatelliteSource,
} from '../core/satellites.ts';
import { describeBody, layersFor, normalizeName, parentNameOf, searchBodies } from '../core/search.ts';
import { satelliteInstant } from '../core/teme.ts';
import type { SimClock } from '../core/time.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';
import { useViewStore } from '../state/store.ts';
import { craftUnavailability, satelliteUnavailability } from './BodyPicker.tsx';
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
 *
 * And Earth's satellites: the named ones are bodies already, found with the rest -- by
 * name, operator, or catalogue number ("25544", "1998-067A"). The others by CelesTrak's
 * name or number, after the comets: those on SGP4 first, then the dots, whose names are
 * fetched when the panel opens. Choosing one makes it a body (see satelliteBodies.ts).
 */

/** Results listed at once. More than fit on screen, fewer than make typing lag. */
const RESULT_LIMIT = 40;

/** Of those, at most this many from the belt's names, after the bodies. */
const NAME_LIMIT = 20;

/** And at most this many comets, between the two. */
const COMET_LIMIT = 10;

/** And at most this many satellites that are not bodies yet, after the comets. */
const SATELLITE_LIMIT = 12;

const ACCENT = '#3ddc84';

/** A result: a body in the store, or entry `k` of the belt's name index. */
type Result =
  | { readonly kind: 'body'; readonly id: BodyId }
  | { readonly kind: 'name'; readonly k: number }
  | { readonly kind: 'comet'; readonly k: number }
  /** Entry `k` of the SGP4 tier (sgp4.json). */
  | { readonly kind: 'sgp4'; readonly k: number }
  /** Bulk record `k`. */
  | { readonly kind: 'bulk'; readonly k: number };

export function SearchPanel({
  store,
  clock,
  focus,
  belt,
  names,
  comets,
  satellites,
  satelliteNames,
}: {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly belt: BeltSource;
  readonly names: NameIndexSource;
  readonly comets: CometSource;
  readonly satellites: SatelliteSource;
  readonly satelliteNames: LazySource<SatelliteNameIndex>;
}) {
  const closePanel = useViewStore((state) => state.closePanel);
  const setFocus = useViewStore((state) => state.setFocus);
  const setLayer = useViewStore((state) => state.setLayer);
  const satelliteChips = useViewStore((state) => state.satelliteChips);
  const toggleSatelliteChip = useViewStore((state) => state.toggleSatelliteChip);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // The results change as the small moons arrive, and as the names do.
  const version = useStoreVersion(store);
  const nameIndex = useSyncExternalStore(names.subscribe, () => names.index);
  const cometData = useSyncExternalStore(comets.subscribe, () => comets.comets);
  const satelliteData = useSyncExternalStore(satellites.subscribe, () => satellites.value);
  const bulkNames = useSyncExternalStore(satelliteNames.subscribe, () => satelliteNames.value);
  // The SGP4 tier's names, made comparable once, when the satellites arrive.
  const sgpIndex = useMemo(() => (satelliteData === null ? null : sgpSearchIndex(satelliteData)), [satelliteData]);
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
    // The names wait on the satellites themselves, so this asks for both.
    void satelliteNames.request();
  }, [store, names, comets, satelliteNames]);

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
    const fromSatellites = satelliteResults(store, query, satelliteData, sgpIndex, bulkNames);
    return [...bodies, ...fromComets, ...fromSatellites, ...fromNames].slice(0, RESULT_LIMIT);
  }, [store, query, version, nameIndex, cometIndex, satelliteData, sgpIndex, bulkNames]);

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
  const unavailable = (result: Result): string | null => {
    if (result.kind === 'body') {
      const kind = store.body(result.id).kind;
      return kind === 'spacecraft'
        ? craftUnavailability(store, result.id, jd)
        : kind === 'satellite'
          ? satelliteUnavailability(store, result.id, jd)
          : null;
    }
    if ((result.kind === 'sgp4' || result.kind === 'bulk') && satelliteData !== null) {
      return satelliteResultUnavailability(satelliteData, result, jd);
    }
    return null;
  };

  const go = (id: BodyId): void => {
    const body = store.body(id);
    for (const layer of layersFor(body)) {
      setLayer(layer, true);
    }
    // A satellite needs its chip on too, or the app steps straight back to Earth.
    const chip = body.kind === 'satellite' ? satelliteBodyChip(id) : -1;
    if (chip >= 0 && !chipShown(satelliteChips, chip)) {
      toggleSatelliteChip(chip);
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
    if (result.kind === 'sgp4' || result.kind === 'bulk') {
      const id =
        satelliteData === null
          ? null
          : result.kind === 'sgp4'
            ? addSgpSatelliteBody(store, satelliteData, result.k, focus)
            : bulkNames === null
              ? null
              : addBulkSatelliteBody(store, satelliteData, bulkNames, result.k, focus);
      if (id !== null) {
        go(id);
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
        placeholder="Planet, moon, spacecraft, satellite…"
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
          const row = describeResult(
            store,
            result,
            nameIndex,
            cometData?.info.names ?? null,
            satelliteData,
            bulkNames,
          );
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
  satellites: Satellites | null,
  bulkNames: SatelliteNameIndex | null,
): { readonly glyph: string; readonly color: string; readonly name: string; readonly detail: string } {
  if (result.kind === 'body') {
    const body = store.body(result.id);
    return {
      glyph: body.kind === 'spacecraft' || body.kind === 'satellite' ? '◆' : '●',
      color: body.color,
      name: body.name,
      detail: describeBody(body, parentNameOf(store.bodies, body.parent)),
    };
  }
  if (result.kind === 'comet') {
    return { glyph: '·', color: '#9ecbe6', name: cometNames![result.k]!, detail: 'Comet' };
  }
  if (result.kind === 'sgp4') {
    const omm = satellites!.sgp4[result.k]!.omm;
    return {
      glyph: '·',
      color: '#f2e2b8',
      name: omm.OBJECT_NAME,
      detail: `Earth satellite · NORAD ${omm.NORAD_CAT_ID} · ${omm.OBJECT_ID}`,
    };
  }
  if (result.kind === 'bulk') {
    const names = bulkNames!.names;
    return {
      glyph: '·',
      color: '#f2e2b8',
      name: names.name[result.k]!,
      detail: `Earth satellite · NORAD ${names.noradId[result.k]} · ${names.cosparId[result.k]}`,
    };
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

/** The SGP4 tier, searchable: CelesTrak's name, and the COSPAR id as a second. */
function sgpSearchIndex(satellites: Satellites): Searchable & { readonly byNorad: ReadonlyMap<number, number> } {
  return {
    display: satellites.sgp4.map((satellite) => normalizeName(satellite.omm.OBJECT_NAME)),
    designation: satellites.sgp4.map((satellite) => normalizeName(satellite.omm.OBJECT_ID)),
    byNorad: new Map(satellites.sgp4.map((satellite, k) => [satellite.omm.NORAD_CAT_ID, k] as const)),
  };
}

/**
 * The satellites that match and are not bodies yet: a catalogue number exactly first, then
 * by name -- the SGP4 tier's, then the dots'.
 */
function satelliteResults(
  store: EphemerisStore,
  query: string,
  satellites: Satellites | null,
  sgpIndex: (Searchable & { readonly byNorad: ReadonlyMap<number, number> }) | null,
  bulkNames: SatelliteNameIndex | null,
): Result[] {
  if (satellites === null) {
    return [];
  }
  const out: Result[] = [];
  const seen = new Set<string>();
  const push = (kind: 'sgp4' | 'bulk', k: number): void => {
    const id = kind === 'sgp4' ? sgpSatelliteBodyId(satellites.sgp4[k]!.omm.NORAD_CAT_ID) : bulkSatelliteBodyId(k);
    if (!seen.has(id) && !store.isPropagatedBody(id)) {
      seen.add(id);
      out.push({ kind, k });
    }
  };
  const trimmed = query.trim();
  if (/^\d+$/.test(trimmed)) {
    const sgp = sgpIndex?.byNorad.get(Number(trimmed));
    if (sgp !== undefined) {
      push('sgp4', sgp);
    }
    const bulk = bulkNames?.byNorad.get(Number(trimmed));
    if (bulk !== undefined) {
      push('bulk', bulk);
    }
  }
  if (sgpIndex !== null) {
    for (const { k } of searchNames(sgpIndex, query, SATELLITE_LIMIT)) {
      push('sgp4', k);
    }
  }
  if (bulkNames !== null) {
    for (const { k } of searchNames(bulkNames, query, SATELLITE_LIMIT)) {
      push('bulk', k);
    }
  }
  return out.slice(0, SATELLITE_LIMIT);
}

/**
 * Why a satellite not yet a body cannot be chosen now: the clock is outside the days it
 * is drawn for -- its own elements' week for one on SGP4, the data's for a dot.
 */
function satelliteResultUnavailability(
  satellites: Satellites,
  result: { readonly kind: 'sgp4' | 'bulk'; readonly k: number },
  jdTdb: number,
): string | null {
  const { jdUtc } = satelliteInstant(jdTdb);
  if (result.kind === 'bulk') {
    return Math.abs(jdUtc - satellites.info.referenceJdUtc) <= BULK_WINDOW_DAYS ? null : 'no elements';
  }
  const epoch = Date.parse(`${satellites.sgp4[result.k]!.omm.EPOCH}Z`) / 86_400_000 + 2440587.5;
  return Math.abs(jdUtc - epoch) <= NAMED_WINDOW_DAYS ? null : 'no elements';
}
