import type { BodyDefinition, BodyId } from '@sss/tools/types';
import { useEffect, useRef, useState } from 'react';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { renderDemand } from '../core/renderDemand.ts';
import {
  ALPHA_CEN_FRAMING_KM,
  ALPHA_CEN_MEMBERS,
  ALPHA_CEN_SYSTEM,
  alphaCenMember,
  type AlphaCenKey,
} from '../core/alphaCenBodies.ts';
import { allPlanetarySystems, planetarySystemOf } from '../core/planetarySystems.ts';
import { BLACK_HOLE_SYSTEMS, blackHoleSystemOf, type BlackHoleSystem } from '../core/blackHoles.ts';
import { isCatalogueStar } from '../core/starBodies.ts';
import type { Signal } from '../core/signal.ts';
import type { SimClock } from '../core/time.ts';
import { useSignal } from '../core/useSignal.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';
import { isShown, isSmallMoon, SMALL_MOON_LAYER } from '../scene/floatingOrigin.ts';
import { GALAXY_VIEW } from '../scene/MilkyWay.tsx';
import { GALAXY_FRAMING_KM, NEIGHBOURHOOD_FRAMING_KM } from '../scene/scale.ts';
import { useViewStore } from '../state/store.ts';
import { Presence, useClosing } from './Presence.tsx';

/**
 * The breadcrumb, and the list of bodies that drops down from it.
 *
 * It replaced a wall of buttons. Ten planets were already two rows of them; with the
 * moons it became three, and the row that mattered -- the one you were in -- was the
 * hardest to find. Now the breadcrumb is all that stays on screen, saying where you are,
 * and the list is one click away, in the order the Solar System has it: the Sun, then
 * every planet outward, each with its moons folded underneath. The system you are in
 * starts unfolded, because those are the moons you are most likely to want next.
 *
 * Every tier of the breadcrumb is itself a way up: from Io, "Jupiter" goes to Jupiter,
 * "Solar System" to the Sun.
 *
 * Two levels sit above the Solar System since the light years (step D1). **Solar
 * Neighbourhood** goes to the Sun and stands the camera fifty light years out, among the
 * nearest stars (NEIGHBOURHOOD_FRAMING_KM). **Milky Way** goes to the Sun and stands the
 * camera 180,000 light years out (GALAXY_FRAMING_KM), where the galaxy model of D2b is
 * seen whole. It was a name and not a place until that model existed.
 *
 * Milky Way has a list of its own beside it: the black holes (D5, blackHoles.ts) -- Sgr A*
 * at the centre, Gaia BH1 and BH3 -- each framed with the star on its orbit. In one of
 * their systems the breadcrumb is Milky Way and the black hole: none of them is in the
 * neighbourhood the Solar Neighbourhood frames.
 *
 * The spacecraft come last, in a section of their own rather than folded under the
 * bodies they happen to be near. One that does not exist at the clock's instant -- not
 * launched yet, or past the end of its trajectory -- is listed but cannot be chosen,
 * and says which: there is nowhere to put the camera.
 *
 * The named Earth satellites after them, folded under one heading: a hundred rows would
 * otherwise be most of the list. One outside the days its elements are good for is listed
 * and cannot be chosen, as a craft before launch.
 */

const ACCENT = '#3ddc84';

export interface BodyPickerProps {
  readonly store: EphemerisStore;
  readonly focus: BodyId;
  readonly onFocus: (id: BodyId) => void;
  /** Body kinds switched on in the layers panel; the list shows only those. */
  readonly visibleKinds: ReadonlySet<string>;
  /** The clock: a spacecraft can only be chosen while it exists. */
  readonly clock: SimClock;
  /**
   * The readout beat. Only the open list listens, to keep the craft it greys out in step
   * with the clock; the breadcrumb has nothing on it that moves with time.
   */
  readonly readout: Signal;
  /**
   * Alpha Centauri as a place to go (D3b): its three stars by name, and how to go to one
   * -- made a body first if it is not one yet -- optionally framed from farther out.
   * Null while the 3D stars are not part of the published data.
   */
  readonly alphaCen: AlphaCenNavigator | null;
  /**
   * The nearby stars with planets (D4a, planetarySystems.ts), and how to go to one, framed
   * as a system. Null while the 3D stars are not part of the published data.
   */
  readonly planetSystems: PlanetSystemsNavigator | null;
}

/** Going to a planetary system from the breadcrumb: its star, framed with its planets. */
export interface PlanetSystemsNavigator {
  readonly go: (key: string) => void;
}

/** Going to Alpha Centauri's stars from the breadcrumb. */
export interface AlphaCenNavigator {
  readonly names: Readonly<Record<AlphaCenKey, string>>;
  readonly go: (key: AlphaCenKey, framingKm?: number) => void;
}

export function BodyPicker({
  store,
  focus,
  onFocus,
  visibleKinds,
  clock,
  readout,
  alphaCen,
  planetSystems,
}: BodyPickerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const focusBody = store.body(focus);
  const parent = focusBody.parent === null ? null : store.body(focusBody.parent);
  // Alpha Centauri's own level, when one of its stars or their planets is in focus.
  const inAlphaCen = alphaCenMember(focus) !== null || (parent !== null && alphaCenMember(parent.id) !== null);
  // Or a planetary system's, when its star or a planet of it is.
  const planetSystem = planetarySystemOf(focus);
  // Or a black hole's, with the star about it.
  const blackHoleSystem = blackHoleSystemOf(focus);
  // A star other than the Sun is in the neighbourhood, not in the Solar System; nor is
  // anything of Alpha Centauri's or another star's, nor a black hole's.
  const inSolarSystem =
    !isCatalogueStar(focusBody) && !inAlphaCen && planetSystem === null && blackHoleSystem === null;
  const requestFraming = useViewStore((state) => state.requestFraming);
  const toNeighbourhood = (): void => {
    // Asked for before the focus moves, so the camera rig takes it with the new focus.
    requestFraming(NEIGHBOURHOOD_FRAMING_KM);
    onFocus('sun');
    // With the Sun already in focus nothing else changed, and nothing else asks for a frame.
    renderDemand.request();
  };
  const toGalaxy = (): void => {
    requestFraming(GALAXY_FRAMING_KM, GALAXY_VIEW);
    onFocus('sun');
    renderDemand.request();
  };

  // The star systems one can go to, under Solar Neighbourhood's own caret.
  const [systemsOpen, setSystemsOpen] = useState(false);
  // The black holes, under Milky Way's.
  const [blackHolesOpen, setBlackHolesOpen] = useState(false);
  const toBlackHole = (system: BlackHoleSystem): void => {
    // Asked for before the focus moves, as the neighbourhood's is: the system whole.
    requestFraming(system.framingKm, system.view);
    onFocus(system.id);
    renderDemand.request();
  };

  // Closes on a click anywhere else and on Escape, like any menu.
  useEffect(() => {
    if (!open && !systemsOpen && !blackHolesOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) {
        setOpen(false);
        setSystemsOpen(false);
        setBlackHolesOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        setSystemsOpen(false);
        setBlackHolesOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, systemsOpen, blackHolesOpen]);

  const choose = (id: BodyId): void => {
    onFocus(id);
    setOpen(false);
  };
  const chooseMember = (key: AlphaCenKey): void => {
    alphaCen?.go(key);
    setOpen(false);
  };

  return (
    <div ref={root} style={{ position: 'absolute', top: '1rem', left: '1.25rem' }}>
      <nav
        aria-label="Where you are"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          letterSpacing: '0.22em',
          fontSize: '0.78rem',
          textTransform: 'uppercase',
          flexWrap: 'wrap',
        }}
      >
        <Crumb onClick={toGalaxy} outer>
          Milky Way
        </Crumb>
        <button
          type="button"
          aria-label="Black holes"
          aria-haspopup="listbox"
          aria-expanded={blackHolesOpen}
          title="Go to a black hole"
          onClick={() => {
            setBlackHolesOpen((value) => !value);
            setSystemsOpen(false);
            setOpen(false);
          }}
          style={{ ...crumbStyle, color: OUTER_CRUMB, display: 'inline-flex', alignItems: 'center' }}
        >
          <Caret open={blackHolesOpen} />
        </button>
        <Separator />
        {blackHoleSystem === null && (
          <>
            <Crumb onClick={toNeighbourhood} outer>
              Solar Neighbourhood
            </Crumb>
            <button
              type="button"
              aria-label="Star systems"
              aria-haspopup="listbox"
              aria-expanded={systemsOpen}
              title="Go to a star system"
              onClick={() => {
                setSystemsOpen((value) => !value);
                setBlackHolesOpen(false);
                setOpen(false);
              }}
              style={{ ...crumbStyle, color: OUTER_CRUMB, display: 'inline-flex', alignItems: 'center' }}
            >
              <Caret open={systemsOpen} />
            </button>
            <Separator />
          </>
        )}
        {inSolarSystem && (
          <>
            <Crumb onClick={() => onFocus('sun')}>Solar System</Crumb>
            <Separator />
          </>
        )}
        {inAlphaCen && alphaCen !== null && (
          <>
            <Crumb onClick={() => alphaCen.go('A', ALPHA_CEN_FRAMING_KM)}>{ALPHA_CEN_SYSTEM}</Crumb>
            <Separator />
          </>
        )}
        {/* The system, unless it is called by the name of the star in focus. */}
        {planetSystem !== null && planetSystems !== null && planetSystem.name !== focusBody.name && (
          <>
            <Crumb onClick={() => planetSystems.go(planetSystem.key)}>{planetSystem.name}</Crumb>
            <Separator />
          </>
        )}
        {/* A planet's star, unless the system is called by the star's own name. */}
        {parent !== null && !(planetSystem !== null && parent.name === planetSystem.name) && (
          <>
            <Crumb onClick={() => onFocus(parent.id)}>{parent.name}</Crumb>
            <Separator />
          </>
        )}
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value);
            setSystemsOpen(false);
            setBlackHolesOpen(false);
          }}
          style={{
            ...crumbStyle,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          {focusBody.name}
          <Caret open={open} />
        </button>
      </nav>

      <Presence show={systemsOpen}>
        <SystemList
          inSolarSystem={inSolarSystem}
          inAlphaCen={inAlphaCen}
          inPlanetSystem={planetSystem?.key ?? null}
          onPlanetSystem={
            planetSystems === null
              ? null
              : (key) => {
                  planetSystems.go(key);
                  setSystemsOpen(false);
                }
          }
          onSolarSystem={() => {
            onFocus('sun');
            setSystemsOpen(false);
          }}
          onAlphaCen={
            alphaCen === null
              ? null
              : () => {
                  alphaCen.go('A', ALPHA_CEN_FRAMING_KM);
                  setSystemsOpen(false);
                }
          }
        />
      </Presence>

      <Presence show={blackHolesOpen}>
        <BlackHoleList
          active={blackHoleSystem?.id ?? null}
          onChoose={(system) => {
            toBlackHole(system);
            setBlackHolesOpen(false);
          }}
        />
      </Presence>

      <Presence show={open}>
        <BodyList
          store={store}
          focus={focus}
          visibleKinds={visibleKinds}
          clock={clock}
          readout={readout}
          onChoose={choose}
          alphaCen={alphaCen}
          onChooseMember={chooseMember}
          onChooseSystem={(key) => {
            planetSystems?.go(key);
            setOpen(false);
          }}
          onChooseBlackHole={(system) => {
            toBlackHole(system);
            setOpen(false);
          }}
        />
      </Presence>
    </div>
  );
}

const crumbStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: '0.15rem 0.1rem',
  margin: 0,
  font: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit',
  color: '#c8c8c8',
  cursor: 'pointer',
  borderRadius: '0.2rem',
};

/** The levels above the Solar System, a shade quieter than the ones you move between most. */
const OUTER_CRUMB = '#8e8e8e';

function Crumb({
  children,
  onClick,
  outer = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  outer?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} style={outer ? { ...crumbStyle, color: OUTER_CRUMB } : crumbStyle}>
      {children}
    </button>
  );
}

function Separator() {
  return (
    <span aria-hidden="true" style={{ color: '#4a4a4a' }}>
      &rsaquo;
    </span>
  );
}

/** A small chevron that turns when the list is open. */
function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 160ms ease',
      }}
    >
      <path d="M1.5 3.5 L5 7 L8.5 3.5" fill="none" stroke="#8a8a8a" strokeWidth="1.4" />
    </svg>
  );
}

/** Why a spacecraft cannot be chosen right now, or null when it can. */
export function craftUnavailability(store: EphemerisStore, id: BodyId, jd: number): string | null {
  const span = store.coverage(id);
  if (span === null) {
    return 'no data';
  }
  if (jd < span.startJd) {
    return `from ${calendarYear(span.startJd)}`;
  }
  if (jd > span.stopJd) {
    return `until ${calendarYear(span.stopJd)}`;
  }
  return null;
}

/**
 * Why a named satellite cannot be chosen right now, or null when it can: the clock is
 * outside the days around its element epoch it is drawn in (see NAMED_WINDOW_DAYS).
 */
export function satelliteUnavailability(store: EphemerisStore, id: BodyId, jd: number): string | null {
  return store.isCoveredAt(id, jd) ? null : 'no elements';
}

/** Where a spacecraft is, for grouping the list: what it moves with. */
export type CraftGroup = 'interplanetary' | 'near-earth' | 'planets' | 'surface';

/** The groups in the order they are listed, with their headings. */
export const CRAFT_GROUPS: readonly { readonly id: CraftGroup; readonly label: string }[] = [
  { id: 'interplanetary', label: 'Interplanetary' },
  { id: 'near-earth', label: 'Near Earth' },
  { id: 'planets', label: 'At other planets' },
  { id: 'surface', label: 'On the surface' },
];

/**
 * Which group a craft is listed under, from what it hangs off in the frame tree: nothing
 * for one in orbit about the Sun, Earth or the Moon for one that moves with Earth -- the
 * Lagrange-point observatories, the lunar missions -- and another planet otherwise. A
 * craft standing on a body is apart from all of them.
 */
export function craftGroup(store: EphemerisStore, body: BodyDefinition): CraftGroup {
  if ((body.mission?.site ?? null) !== null) {
    return 'surface';
  }
  if (body.parent === null) {
    return 'interplanetary';
  }
  const nearEarth = body.parent === 'earth' || store.body(body.parent).parent === 'earth';
  return nearEarth ? 'near-earth' : 'planets';
}

/** The calendar year a Julian day falls in, near enough for a label. */
function calendarYear(jd: number): number {
  return new Date((jd - 2440587.5) * 86_400_000).getUTCFullYear();
}

function BodyList({
  store,
  focus,
  visibleKinds,
  clock,
  readout,
  onChoose,
  alphaCen,
  onChooseMember,
  onChooseSystem,
  onChooseBlackHole,
}: {
  store: EphemerisStore;
  focus: BodyId;
  visibleKinds: ReadonlySet<string>;
  clock: SimClock;
  readout: Signal;
  onChoose: (id: BodyId) => void;
  alphaCen: AlphaCenNavigator | null;
  onChooseMember: (key: AlphaCenKey) => void;
  onChooseSystem: (key: string) => void;
  onChooseBlackHole: (system: BlackHoleSystem) => void;
}) {
  const closing = useClosing();
  // Redrawn when a planet's small moons arrive.
  useStoreVersion(store);
  // And on the readout beat while open, for the craft that cannot be chosen right now.
  useSignal(readout);
  const jd = clock.tdbJulianDay;
  const focusBody = store.body(focus);
  const system = focusBody.parent ?? focusBody.id;

  // The system you are in starts unfolded, and so does the focused craft's group; the
  // rest start folded. Group keys share the set, prefixed so no body id can collide.
  // A focused small moon unfolds its planet's small moons too.
  const [expanded, setExpanded] = useState<ReadonlySet<BodyId>>(() =>
    focusBody.kind === 'spacecraft'
      ? new Set([system, `craft:${craftGroup(store, focusBody)}`])
      : isSmallMoon(focusBody)
        ? new Set([system, `small:${system}`])
        : new Set([system]),
  );

  const primaries = store.bodies.filter(
    (body) =>
      body.parent === null &&
      body.kind !== 'spacecraft' &&
      body.kind !== 'asteroid' &&
      body.kind !== 'comet' &&
      body.kind !== 'black-hole' &&
      !isCatalogueStar(body) &&
      visibleKinds.has(body.kind),
  );
  // The catalogue stars gone to from search (starBodies.ts), listed apart: they are not
  // in the Solar System. Alpha Centauri's have a section of their own, below, and so does
  // each planetary system's.
  const stars = store.bodies.filter(
    (body) => isCatalogueStar(body) && alphaCenMember(body.id) === null && planetarySystemOf(body.id) === null,
  );
  // The planetary systems' stars that are bodies, by system key.
  const hosts = new Map<string, BodyDefinition>();
  for (const body of store.bodies) {
    const owner = isCatalogueStar(body) ? planetarySystemOf(body.id) : null;
    if (owner !== null) {
      hosts.set(owner.key, body);
    }
  }
  const focusMember = alphaCenMember(focus);
  // Listed apart: between the planets they would push Neptune off the bottom.
  const asteroids = visibleKinds.has('asteroid')
    ? store.bodies.filter((body) => body.kind === 'asteroid')
    : [];
  // The comets likewise: one gone to from search is a body until the next (cometBodies.ts).
  const cometBodies = visibleKinds.has('comet')
    ? store.bodies.filter((body) => body.kind === 'comet')
    : [];
  // Moons only: JWST hangs off Earth in the frame tree, and is listed with the craft.
  const moonsOf = (id: BodyId): BodyDefinition[] =>
    visibleKinds.has('moon')
      ? store.bodies.filter(
          (body) => body.parent === id && body.kind === 'moon' && isShown(body, visibleKinds),
        )
      : [];
  const craft = visibleKinds.has('spacecraft')
    ? store.bodies.filter((body) => body.kind === 'spacecraft')
    : [];
  // The named satellites whose chip is on; a bulk one gone to from search is among them.
  const satellites = store.bodies.filter(
    (body) => body.kind === 'satellite' && isShown(body, visibleKinds),
  );
  const satellitesOpen = expanded.has('satellites:named') || focusBody.kind === 'satellite';

  const toggle = (id: BodyId): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div
      role="listbox"
      aria-label="Bodies"
      className={`scroll-hidden ${closing ? 'dropdown-exit' : 'dropdown-enter'}`}
      style={{
        marginTop: '0.55rem',
        width: '13.5rem',
        maxHeight: '70vh',
        overflowY: 'auto',
        // Opaque enough to need no blur behind it. See Panel.tsx.
        background: 'rgba(14,14,17,0.97)',
        border: '1px solid #262626',
        borderRadius: '0.4rem',
        padding: '0.35rem',
      }}
    >
      {primaries.map((body) => {
        const moons = moonsOf(body.id);
        const open = expanded.has(body.id);
        // The small moons are counted from the manifest until they are fetched.
        const smallCount =
          visibleKinds.has('moon') && visibleKinds.has(SMALL_MOON_LAYER)
            ? (store.smallMoonCount(body.id)?.count ?? 0)
            : 0;
        const moonCount = store.hasSmallMoons(body.id)
          ? moons.length
          : moons.length + smallCount;
        return (
          <div key={body.id}>
            <Row
              body={body}
              active={body.id === focus}
              inSystem={body.id === system && body.id !== focus}
              onChoose={onChoose}
              trailing={
                moonCount > 0 && (
                  <button
                    type="button"
                    aria-label={`${open ? 'Hide' : 'Show'} the moons of ${body.name}`}
                    aria-expanded={open}
                    onClick={() => toggle(body.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '0.2rem 0.35rem',
                      cursor: 'pointer',
                      color: '#6a6a6a',
                      fontSize: '0.62rem',
                      letterSpacing: '0.04em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      borderRadius: '0.2rem',
                    }}
                  >
                    {moonCount}
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        transform: open ? 'rotate(90deg)' : 'none',
                        transition: 'transform 160ms ease',
                        fontSize: '0.8rem',
                        lineHeight: 1,
                      }}
                    >
                      &rsaquo;
                    </span>
                  </button>
                )
              }
            />
            {open &&
              moons
                .filter((moon) => !isSmallMoon(moon))
                .map((moon) => (
                  <Row
                    key={moon.id}
                    body={moon}
                    indent
                    active={moon.id === focus}
                    inSystem={false}
                    onChoose={onChoose}
                    trailing={null}
                  />
                ))}
            {open && (
              <SmallMoons
                planet={body}
                moons={moons.filter(isSmallMoon)}
                count={smallCount}
                loaded={store.hasSmallMoons(body.id)}
                open={expanded.has(`small:${body.id}`)}
                onToggle={() => {
                  // Unfolding the list is a request for it.
                  void store.loadSmallMoons(body.id);
                  toggle(`small:${body.id}`);
                }}
                focus={focus}
                onChoose={onChoose}
              />
            )}
          </div>
        );
      })}
      {asteroids.length > 0 && (
        <>
          <div style={SECTION_HEADING}>Asteroids</div>
          {asteroids.map((body) => (
            <Row
              key={body.id}
              body={body}
              active={body.id === focus}
              inSystem={false}
              onChoose={onChoose}
              trailing={null}
            />
          ))}
        </>
      )}
      {cometBodies.length > 0 && (
        <>
          <div style={SECTION_HEADING}>Comets</div>
          {cometBodies.map((body) => (
            <Row
              key={body.id}
              body={body}
              active={body.id === focus}
              inSystem={false}
              onChoose={onChoose}
              trailing={null}
            />
          ))}
        </>
      )}
      {alphaCen !== null && (
        <>
          <div style={SECTION_HEADING}>{ALPHA_CEN_SYSTEM}</div>
          {ALPHA_CEN_MEMBERS.map(({ key }) => {
            // The star's planets, once it is a body with planets: Proxima's (D3c).
            const star = store.bodies.find((body) => alphaCenMember(body.id) === key);
            const planets = star === undefined ? [] : store.bodies.filter((body) => body.parent === star.id);
            return (
              <div key={key}>
                <MemberRow name={alphaCen.names[key]} active={focusMember === key} onChoose={() => onChooseMember(key)} />
                {planets.map((planet) => (
                  <Row
                    key={planet.id}
                    body={planet}
                    active={planet.id === focus}
                    inSystem={false}
                    indent
                    onChoose={onChoose}
                    trailing={null}
                  />
                ))}
              </div>
            );
          })}
        </>
      )}
      {allPlanetarySystems().map((system) => {
        const host = hosts.get(system.key);
        if (host === undefined) {
          return null;
        }
        const planets = store.bodies.filter((body) => body.parent === host.id);
        return (
          <div key={system.key}>
            <div style={SECTION_HEADING}>{system.name}</div>
            <MemberRow name={host.name} active={host.id === focus} onChoose={() => onChooseSystem(system.key)} />
            {planets.map((planet) => (
              <Row
                key={planet.id}
                body={planet}
                active={planet.id === focus}
                inSystem={false}
                indent
                onChoose={onChoose}
                trailing={null}
              />
            ))}
          </div>
        );
      })}
      {BLACK_HOLE_SYSTEMS.some((system) => store.isPropagatedBody(system.id)) && (
        <>
          <div style={SECTION_HEADING}>Black holes</div>
          {BLACK_HOLE_SYSTEMS.filter((system) => store.isPropagatedBody(system.id)).map((system) => (
            <div key={system.id}>
              <MemberRow name={system.name} active={system.id === focus} onChoose={() => onChooseBlackHole(system)} />
              {store.isPropagatedBody(system.companion) && (
                <Row
                  body={store.body(system.companion)}
                  active={system.companion === focus}
                  inSystem={false}
                  indent
                  onChoose={onChoose}
                  trailing={null}
                />
              )}
            </div>
          ))}
        </>
      )}
      {stars.length > 0 && (
        <>
          <div style={SECTION_HEADING}>Stars</div>
          {stars.map((body) => (
            <Row
              key={body.id}
              body={body}
              active={body.id === focus}
              inSystem={false}
              onChoose={onChoose}
              trailing={null}
            />
          ))}
        </>
      )}
      {craft.length > 0 && (
        <>
          <div style={SECTION_HEADING}>Spacecraft</div>
          {CRAFT_GROUPS.map((group) => {
            const members = craft.filter((body) => craftGroup(store, body) === group.id);
            if (members.length === 0) {
              return null;
            }
            const key = `craft:${group.id}`;
            const unfolded = expanded.has(key);
            return (
              <div key={key}>
                <button
                  type="button"
                  aria-expanded={unfolded}
                  aria-label={`${unfolded ? 'Hide' : 'Show'} ${group.label.toLowerCase()} spacecraft`}
                  onClick={() => toggle(key)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '0.25rem',
                    padding: '0.3rem 0.45rem',
                    cursor: 'pointer',
                    color: '#8a8a8a',
                    fontFamily: 'inherit',
                    fontSize: '0.7rem',
                    letterSpacing: '0.04em',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ flex: 1 }}>{group.label}</span>
                  <span style={{ color: '#5a5a5a', fontSize: '0.62rem' }}>{members.length}</span>
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      transform: unfolded ? 'rotate(90deg)' : 'none',
                      transition: 'transform 160ms ease',
                      fontSize: '0.8rem',
                      lineHeight: 1,
                      color: '#6a6a6a',
                    }}
                  >
                    &rsaquo;
                  </span>
                </button>
                {unfolded &&
                  members.map((body) => (
                    <Row
                      key={body.id}
                      body={body}
                      indent
                      active={body.id === focus}
                      inSystem={false}
                      onChoose={onChoose}
                      unavailable={craftUnavailability(store, body.id, jd)}
                      trailing={null}
                    />
                  ))}
              </div>
            );
          })}
        </>
      )}
      {satellites.length > 0 && (
        <>
          <div style={SECTION_HEADING}>Earth satellites</div>
          <button
            type="button"
            aria-expanded={satellitesOpen}
            aria-label={`${satellitesOpen ? 'Hide' : 'Show'} the named satellites`}
            onClick={() => toggle('satellites:named')}
            style={FOLD_STYLE}
          >
            <span style={{ flex: 1 }}>Named</span>
            <span style={{ color: '#5a5a5a', fontSize: '0.62rem' }}>{satellites.length}</span>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                transform: satellitesOpen ? 'rotate(90deg)' : 'none',
                transition: 'transform 160ms ease',
                fontSize: '0.8rem',
                lineHeight: 1,
                color: '#6a6a6a',
              }}
            >
              &rsaquo;
            </span>
          </button>
          {satellitesOpen &&
            satellites.map((body) => (
              <Row
                key={body.id}
                body={body}
                indent
                active={body.id === focus}
                inSystem={false}
                onChoose={onChoose}
                unavailable={satelliteUnavailability(store, body.id, jd)}
                trailing={null}
              />
            ))}
        </>
      )}
    </div>
  );
}

/** A folding group's heading, as the spacecraft's groups have. */
const FOLD_STYLE: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  background: 'transparent',
  border: 'none',
  borderRadius: '0.25rem',
  padding: '0.3rem 0.45rem',
  cursor: 'pointer',
  color: '#8a8a8a',
  fontFamily: 'inherit',
  fontSize: '0.7rem',
  letterSpacing: '0.04em',
  textAlign: 'left',
};

/** The rule and caption above a section of the list. */
const SECTION_HEADING: React.CSSProperties = {
  margin: '0.45rem 0.45rem 0.2rem',
  paddingTop: '0.45rem',
  borderTop: '1px solid #242424',
  color: '#5a5a5a',
  fontSize: '0.6rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

/**
 * A planet's small moons, folded behind one row: Saturn has 284 of them, and listed
 * with the major moons they would bury Titan.
 */
function SmallMoons({
  planet,
  moons,
  count,
  loaded,
  open,
  onToggle,
  focus,
  onChoose,
}: {
  planet: BodyDefinition;
  moons: readonly BodyDefinition[];
  /** How many the manifest says there are; the list itself waits for the fetch. */
  count: number;
  loaded: boolean;
  open: boolean;
  onToggle: () => void;
  focus: BodyId;
  onChoose: (id: BodyId) => void;
}) {
  if (count === 0) {
    return null;
  }
  return (
    <>
      <button
        type="button"
        aria-label={`${open ? 'Hide' : 'Show'} the small moons of ${planet.name}`}
        aria-expanded={open}
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '0.3rem 0.45rem 0.3rem 1.6rem',
          cursor: 'pointer',
          color: '#6a6a6a',
          fontSize: '0.68rem',
          letterSpacing: '0.04em',
          textAlign: 'left',
          borderRadius: '0.2rem',
        }}
      >
        Small moons
        <span style={{ color: '#4a4a4a' }}>{loaded ? moons.length : count}</span>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 160ms ease',
            fontSize: '0.8rem',
            lineHeight: 1,
          }}
        >
          &rsaquo;
        </span>
      </button>
      {open && !loaded && (
        <div style={{ padding: '0.3rem 0.45rem 0.3rem 1.6rem', color: '#4a4a4a', fontSize: '0.68rem' }}>
          Loading…
        </div>
      )}
      {open &&
        moons.map((moon) => (
          <Row
            key={moon.id}
            body={moon}
            indent
            active={moon.id === focus}
            inSystem={false}
            onChoose={onChoose}
            trailing={null}
          />
        ))}
    </>
  );
}

/**
 * The star systems under Solar Neighbourhood: where the camera can go as a whole. The
 * Solar System, Alpha Centauri (D3) -- framed as a system, from out of the pair's orbital
 * plane -- and the nearby stars with planets (D4a), each framed with its planets' orbits.
 */
function SystemList({
  inSolarSystem,
  inAlphaCen,
  inPlanetSystem,
  onSolarSystem,
  onAlphaCen,
  onPlanetSystem,
}: {
  inSolarSystem: boolean;
  inAlphaCen: boolean;
  inPlanetSystem: string | null;
  onSolarSystem: () => void;
  onAlphaCen: (() => void) | null;
  onPlanetSystem: ((key: string) => void) | null;
}) {
  const closing = useClosing();
  return (
    <div
      role="listbox"
      aria-label="Star systems"
      className={closing ? 'dropdown-exit' : 'dropdown-enter'}
      style={{
        marginTop: '0.55rem',
        width: '13.5rem',
        background: 'rgba(14,14,17,0.97)',
        border: '1px solid #262626',
        borderRadius: '0.4rem',
        padding: '0.35rem',
      }}
    >
      <div style={{ ...SECTION_HEADING, borderTop: 'none', paddingTop: 0, marginTop: '0.2rem' }}>Star systems</div>
      <MemberRow name="Solar System" active={inSolarSystem} onChoose={onSolarSystem} />
      {onAlphaCen !== null && <MemberRow name={ALPHA_CEN_SYSTEM} active={inAlphaCen} onChoose={onAlphaCen} />}
      {onPlanetSystem !== null &&
        allPlanetarySystems().map((system) => (
          <MemberRow
            key={system.key}
            name={system.name}
            active={inPlanetSystem === system.key}
            onChoose={() => onPlanetSystem(system.key)}
          />
        ))}
    </div>
  );
}

/**
 * The black holes under Milky Way (D5): each framed with the star on its orbit. Sgr A*
 * first, at the centre of the Galaxy; then the two nearest known, by distance.
 */
function BlackHoleList({
  active,
  onChoose,
}: {
  active: BodyId | null;
  onChoose: (system: BlackHoleSystem) => void;
}) {
  const closing = useClosing();
  return (
    <div
      role="listbox"
      aria-label="Black holes"
      className={closing ? 'dropdown-exit' : 'dropdown-enter'}
      style={{
        marginTop: '0.55rem',
        width: '13.5rem',
        background: 'rgba(14,14,17,0.97)',
        border: '1px solid #262626',
        borderRadius: '0.4rem',
        padding: '0.35rem',
      }}
    >
      <div style={{ ...SECTION_HEADING, borderTop: 'none', paddingTop: 0, marginTop: '0.2rem' }}>Black holes</div>
      {BLACK_HOLE_SYSTEMS.map((system) => (
        <MemberRow
          key={system.id}
          name={system.binary === null ? `${system.name} · Galactic Centre` : system.name}
          active={active === system.id}
          onChoose={() => onChoose(system)}
        />
      ))}
    </div>
  );
}

/**
 * A star of Alpha Centauri in the list: a row like any body's, but for a star that may not
 * be a body yet -- choosing it makes it one (App.tsx) -- so it carries a name, not a body.
 */
function MemberRow({ name, active, onChoose }: { name: string; active: boolean; onChoose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        role="option"
        aria-selected={active}
        onClick={onChoose}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          textAlign: 'left',
          background: active ? '#1e2a24' : 'transparent',
          border: 'none',
          borderRadius: '0.25rem',
          padding: '0.3rem 0.45rem',
          color: active ? ACCENT : '#a8a8a8',
          fontFamily: 'inherit',
          fontSize: '0.78rem',
          letterSpacing: '0.03em',
          cursor: 'pointer',
        }}
      >
        {name}
      </button>
    </div>
  );
}

function Row({
  body,
  active,
  inSystem,
  indent = false,
  unavailable = null,
  onChoose,
  trailing,
}: {
  body: BodyDefinition;
  active: boolean;
  /** The planet whose moon is in focus: marked, more quietly than the focus itself. */
  inSystem: boolean;
  indent?: boolean;
  /** Why this row cannot be chosen at the clock's instant, or null when it can. */
  unavailable?: string | null;
  onChoose: (id: BodyId) => void;
  trailing: React.ReactNode;
}) {
  // A satellite is a craft too, and has the craft's diamond, in the scene and here.
  const craft = body.kind === 'spacecraft' || body.kind === 'satellite';
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        role="option"
        aria-selected={active}
        aria-disabled={unavailable !== null}
        disabled={unavailable !== null}
        onClick={() => onChoose(body.id)}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          textAlign: 'left',
          background: active ? '#1e2a24' : 'transparent',
          border: 'none',
          borderRadius: '0.25rem',
          padding: `0.3rem 0.45rem 0.3rem ${indent ? '1.55rem' : '0.45rem'}`,
          color: active
            ? ACCENT
            : unavailable !== null
              ? '#4e4e4e'
              : inSystem
                ? '#e8e8e8'
                : '#a8a8a8',
          fontFamily: 'inherit',
          fontSize: indent || craft ? '0.72rem' : '0.78rem',
          letterSpacing: '0.03em',
          cursor: unavailable === null ? 'pointer' : 'default',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: indent || craft ? '0.4rem' : '0.5rem',
            height: indent || craft ? '0.4rem' : '0.5rem',
            // Planets filled, moons as rings, so a moon reads as belonging to the row
            // above it even before the indent does. A spacecraft is a diamond, as its
            // marker is in the scene.
            borderRadius: craft ? 0 : '50%',
            transform: craft ? 'rotate(45deg)' : 'none',
            background: indent || craft ? 'transparent' : body.color,
            border: indent || craft ? `1px solid ${body.color}` : 'none',
            opacity: unavailable === null ? 1 : 0.4,
            flex: 'none',
          }}
        />
        <span style={{ flex: 1 }}>{body.name}</span>
        {unavailable !== null && (
          <span style={{ fontSize: '0.6rem', color: '#4e4e4e', letterSpacing: '0.04em' }}>
            {unavailable}
          </span>
        )}
      </button>
      {trailing}
    </div>
  );
}
