import type { BodyDefinition, BodyId } from '@sss/tools/types';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

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
import { clusterFramingKm, globularClusterOf } from '../core/globularClusters.ts';
import { pulsarFramingKm } from '../core/pulsars.ts';
import { isCatalogueStar } from '../core/starBodies.ts';
import type { Signal } from '../core/signal.ts';
import type { SimClock } from '../core/time.ts';
import { useSignal } from '../core/useSignal.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';
import { isShown, isSmallMoon, SMALL_MOON_LAYER } from '../scene/floatingOrigin.ts';
import { GALAXY_VIEW } from '../scene/MilkyWay.tsx';
import { LOCAL_GROUP_VIEW } from '../scene/LocalGroup.tsx';
import {
  GALAXY_FRAMING_KM,
  LANIAKEA_FRAMING_KM,
  LOCAL_GROUP_FRAMING_KM,
  LOCAL_VOLUME_FRAMING_KM,
  NEARBY_UNIVERSE_FRAMING_KM,
  NEIGHBOURHOOD_FRAMING_KM,
  VIRGO_FRAMING_KM,
} from '../scene/scale.ts';
import { LANIAKEA_VIEW, LOCAL_VOLUME_VIEW, NEARBY_UNIVERSE_VIEW, VIRGO_VIEW } from '../scene/supergalactic.ts';
import {
  ensureStructureBodies,
  inLaniakea,
  laniakeaLandmark,
  laniakeaPlaceOf,
  structureBodyId,
  structureOf,
  type LaniakeaCatalogue,
} from '../core/laniakea.ts';
import type { LaniakeaLandmark } from '@sss/tools/types';
import { ensureGalaxyBody, galaxyBodyId, galaxyOf, GIANTS } from '../core/localGroup.ts';
import { virgoCentre, volumeRegion, type LocalVolumeArchive, type VolumeRegion } from '../core/localVolume.ts';
import type { LazySource } from '../core/satellites.ts';
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
 * Above them, **Local Group** (G1): the Sun, the camera 8 million light years out over the
 * Milky Way's pole with Andromeda across the frame (LOCAL_GROUP_FRAMING_KM), and beside it a
 * list of its big galaxies. At another galaxy the breadcrumb is Local Group and that galaxy.
 *
 * Above it, **Local Volume** (G2): the Sun, the camera 100 million light years out over the
 * supergalactic pole, the Local Sheet face-on and the Virgo Cluster to the right
 * (LOCAL_VOLUME_FRAMING_KM); its list, the Local Group, then its groups -- the Sculptor group's,
 * M81's, Centaurus A's -- each folded over its galaxies, brightest first, and beyond its 11 Mpc
 * the Virgo Cluster. The Virgo Cluster is not in the Local Volume: at one of its galaxies the
 * breadcrumb is **Virgo Cluster** and that galaxy, the crumb going to M87, its centre, framed
 * the same way (VIRGO_FRAMING_KM), and its list the cluster's own groups and the way back. At a
 * galaxy of the Local Volume, Local Volume and that galaxy.
 *
 * Above it all, **Laniakea** (G3): its attractor, the camera 1.8 billion light years out over the
 * supergalactic pole, its basin's outline about the frame (LANIAKEA_FRAMING_KM); its list, the
 * Nearby Universe -- the Sun from 1.5 billion light years, out to the Shapley Supercluster
 * (NEARBY_UNIVERSE_FRAMING_KM) -- Laniakea and the Local Volume, then the named structures by
 * kind, nearest first. At a galaxy or a structure of its catalogue the breadcrumb is Laniakea
 * and that place -- or, outside Laniakea's basin as the galaxies' watersheds draw it, Nearby
 * Universe and that place: the Coma Cluster is not in Laniakea.
 *
 * Milky Way has a list of its own beside it: the places in the galaxy -- home first, the
 * Solar System and the Solar Neighbourhood, then the black holes (D5, blackHoles.ts), Sgr
 * A* at the centre, Gaia BH1 and BH3, each framed with the star on its orbit. In one of
 * their systems the breadcrumb is Milky Way and the black hole: none of them is in the
 * neighbourhood the Solar Neighbourhood frames -- so the way home is in this list, where
 * the breadcrumb no longer shows it.
 *
 * The spacecraft come last, in a section of their own rather than folded under the
 * bodies they happen to be near. One that does not exist at the clock's instant -- not
 * launched yet, or past the end of its trajectory -- is listed but cannot be chosen,
 * and says which: there is nowhere to put the camera.
 *
 * The named Earth satellites after them, folded under one heading: a hundred rows would
 * otherwise be most of the list. One outside the days its elements are good for is listed
 * and cannot be chosen, as a craft before launch.
 *
 * **What each list holds.** A crumb's list is what is in the place that crumb names, and
 * nothing from anywhere else: Local Group's, its galaxies -- the big ones, then any dwarf gone
 * to; Milky Way's, its places -- home, the black holes, the supernova remnants, and the pulsars
 * and globular clusters gone to; Solar Neighbourhood's, its star systems and the stars gone to.
 * The last crumb, the body in focus, drops down the system it is in (crumbMenuFor): the Solar
 * System's bodies for anything of the Sun's, Alpha Centauri's stars and planets for one of
 * them, a planetary system's star and planets, a black hole and the star about it. A body that
 * is a place on its own -- a galaxy, a star of the neighbourhood, a pulsar, a cluster, a
 * remnant -- has no system to drop down, and no caret: it is in the list of the crumb just
 * before it, among the others like it. So a galaxy's crumb does not repeat the Local Group's
 * list beside it, and nothing out of the Solar System ever lists the planets.
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
  /** The galaxies beyond the Local Group (localVolume.ts), and going to one by its index. */
  readonly localVolume: LazySource<LocalVolumeArchive>;
  readonly onVolumeGalaxy: (k: number) => void;
  /** Laniakea's catalogue (laniakea.ts), and going to one of its galaxies by its record. */
  readonly laniakea: LazySource<LaniakeaCatalogue>;
  readonly onLaniakeaGalaxy: (k: number) => void;
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

/**
 * What the focused body's crumb drops down: the system it is in -- the Solar System, Alpha
 * Centauri, a planetary system, a black hole's -- or nothing, for a body that is a place on
 * its own and is listed by the crumb before it (see the header).
 */
export type CrumbMenu = 'solar-system' | 'alpha-centauri' | 'planetary-system' | 'black-hole' | 'none';

export function crumbMenuFor(body: BodyDefinition): CrumbMenu {
  if (
    body.kind === 'galaxy' ||
    body.kind === 'structure' ||
    body.kind === 'neutron-star' ||
    body.kind === 'globular-cluster' ||
    body.kind === 'supernova-remnant'
  ) {
    return 'none';
  }
  if (blackHoleSystemOf(body.id) !== null) {
    return 'black-hole';
  }
  if (alphaCenMember(body.id) !== null || (body.parent !== null && alphaCenMember(body.parent) !== null)) {
    return 'alpha-centauri';
  }
  if (planetarySystemOf(body.id) !== null) {
    return 'planetary-system';
  }
  // Any other star than the Sun is in the neighbourhood, and listed there.
  return isCatalogueStar(body) ? 'none' : 'solar-system';
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
  localVolume,
  onVolumeGalaxy,
  laniakea,
}: BodyPickerProps) {
  const [open, setOpen] = useState(false);
  const volumeArchive = useSyncExternalStore(localVolume.subscribe, () => localVolume.value);
  const laniakeaArchive = useSyncExternalStore(laniakea.subscribe, () => laniakea.value);
  const root = useRef<HTMLDivElement>(null);

  const focusBody = store.body(focus);
  const parent = focusBody.parent === null ? null : store.body(focusBody.parent);
  // Alpha Centauri's own level, when one of its stars or their planets is in focus.
  const inAlphaCen = alphaCenMember(focus) !== null || (parent !== null && alphaCenMember(parent.id) !== null);
  // Or a planetary system's, when its star or a planet of it is.
  const planetSystem = planetarySystemOf(focus);
  // Or a black hole's, with the star about it.
  const blackHoleSystem = blackHoleSystemOf(focus);
  // A pulsar or a globular cluster is out in the galaxy, as a black hole is: hundreds of
  // light years off at the least.
  const inGalaxy =
    focusBody.kind === 'neutron-star' || focusBody.kind === 'globular-cluster' || focusBody.kind === 'supernova-remnant';
  // Another galaxy: out of the Milky Way altogether -- and beyond the Local Group, in the
  // Local Volume or in the Virgo Cluster.
  const inOtherGalaxy = focusBody.kind === 'galaxy' || focusBody.kind === 'structure';
  const region = inOtherGalaxy ? volumeRegion(galaxyOf(focus)) : null;
  // A galaxy or a structure of Laniakea's catalogue: in Laniakea, or beyond it (see the header).
  const deep = focusBody.kind === 'structure' || galaxyOf(focus)?.laniakeaIndex !== undefined;
  const deepPlace = !deep || laniakeaArchive === null ? null : laniakeaPlaceOf(laniakeaArchive, focus, galaxyOf(focus)?.laniakeaIndex);
  const laniakeaItself = laniakeaArchive === null ? null : laniakeaLandmark(laniakeaArchive);
  const beyondLaniakea =
    deep &&
    (laniakeaArchive === null ||
      deepPlace === null ||
      structureOf(focus) === laniakeaItself ||
      !inLaniakea(laniakeaArchive, deepPlace));
  // What the focus's own crumb drops down. A star other than the Sun is in the
  // neighbourhood, not in the Solar System; nor is anything of Alpha Centauri's or another
  // star's, nor a black hole's, nor a pulsar.
  const menu = crumbMenuFor(focusBody);
  const inSolarSystem = menu === 'solar-system';
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
  const toLocalGroup = (): void => {
    requestFraming(LOCAL_GROUP_FRAMING_KM, LOCAL_GROUP_VIEW);
    onFocus('sun');
    renderDemand.request();
  };
  const toLocalVolume = (): void => {
    void localVolume.request();
    requestFraming(LOCAL_VOLUME_FRAMING_KM, LOCAL_VOLUME_VIEW);
    onFocus('sun');
    renderDemand.request();
  };
  // The Virgo Cluster: M87, made a body if it is not one yet (it is, once loaded: App.tsx).
  const toVirgo = (): void => {
    void localVolume.request().then(() => {
      const archive = localVolume.value;
      const k = archive === null ? null : virgoCentre(archive);
      if (archive === null || k === null) {
        return;
      }
      const id = ensureGalaxyBody(store, archive.galaxies[k]!);
      requestFraming(VIRGO_FRAMING_KM, VIRGO_VIEW);
      onFocus(id);
      renderDemand.request();
    });
  };
  // Laniakea: its attractor, the structures made bodies first if the catalogue has only now come.
  const toStructure = (choose: (c: LaniakeaCatalogue) => LaniakeaLandmark | null, km?: number, view?: typeof LANIAKEA_VIEW): void => {
    void laniakea.request().then(() => {
      const c = laniakea.value;
      const landmark = c === null ? null : choose(c);
      if (c === null || landmark === null) {
        return;
      }
      ensureStructureBodies(store, c.info.landmarks);
      if (km !== undefined) {
        requestFraming(km, view);
      }
      onFocus(structureBodyId(landmark));
      renderDemand.request();
    });
  };
  const toLaniakea = (): void => toStructure(laniakeaLandmark, LANIAKEA_FRAMING_KM, LANIAKEA_VIEW);
  const toNearbyUniverse = (): void => {
    void laniakea.request();
    requestFraming(NEARBY_UNIVERSE_FRAMING_KM, NEARBY_UNIVERSE_VIEW);
    onFocus('sun');
    renderDemand.request();
  };
  // Laniakea's structures, under its caret.
  const [laniakeaOpen, setLaniakeaOpen] = useState(false);
  // The Local Group's big galaxies, under its own caret.
  const [galaxiesOpen, setGalaxiesOpen] = useState(false);
  // The Local Volume's groups, or the Virgo Cluster's, under theirs.
  const [volumeOpen, setVolumeOpen] = useState(false);

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
  // A pulsar, a cluster or a remnant from Milky Way's list, framed as search frames it (App.tsx):
  // a cluster from four half-light radii out, a neutron star from ten of its radii; a remnant
  // frames itself whichever way it is focused.
  const toGalaxyPlace = (id: BodyId): void => {
    const cluster = globularClusterOf(id);
    const body = store.body(id);
    if (cluster !== null) {
      requestFraming(clusterFramingKm(cluster.catalog, cluster.k));
    } else if (body.kind === 'neutron-star') {
      requestFraming(pulsarFramingKm(body.radiusEquatorialKm));
    }
    onFocus(id);
    renderDemand.request();
  };
  // Opening one list closes the others.
  const only = (which: 'bodies' | 'systems' | 'places' | 'galaxies' | 'volume' | 'laniakea'): void => {
    setOpen((value) => which === 'bodies' && !value);
    setLaniakeaOpen((value) => which === 'laniakea' && !value);
    if (which === 'laniakea') {
      void laniakea.request();
    }
    setSystemsOpen((value) => which === 'systems' && !value);
    setBlackHolesOpen((value) => which === 'places' && !value);
    setGalaxiesOpen((value) => which === 'galaxies' && !value);
    setVolumeOpen((value) => which === 'volume' && !value);
    if (which === 'volume') {
      // Opening the list is a request for what it lists.
      void localVolume.request();
    }
  };

  // Closes on a click anywhere else and on Escape, like any menu.
  useEffect(() => {
    if (!open && !systemsOpen && !blackHolesOpen && !galaxiesOpen && !volumeOpen && !laniakeaOpen) {
      return;
    }
    const closeAll = (): void => {
      setOpen(false);
      setLaniakeaOpen(false);
      setSystemsOpen(false);
      setBlackHolesOpen(false);
      setGalaxiesOpen(false);
      setVolumeOpen(false);
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) {
        closeAll();
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeAll();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, systemsOpen, blackHolesOpen, galaxiesOpen, volumeOpen, laniakeaOpen]);

  // A focus with no list of its own closes the one left open, rather than keep it to reopen later.
  useEffect(() => {
    if (menu === 'none') {
      setOpen(false);
    }
  }, [menu]);

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
        <Crumb onClick={beyondLaniakea ? toNearbyUniverse : toLaniakea} outer>
          {beyondLaniakea ? 'Nearby Universe' : 'Laniakea'}
        </Crumb>
        <button
          type="button"
          aria-label="Structures of Laniakea and beyond"
          aria-haspopup="listbox"
          aria-expanded={laniakeaOpen}
          title="Go to a cluster, supercluster or void"
          onClick={() => only('laniakea')}
          style={{ ...crumbStyle, color: OUTER_CRUMB, display: 'inline-flex', alignItems: 'center' }}
        >
          <Caret open={laniakeaOpen} />
        </button>
        <Separator />
        {!deep && (
          <>
            <Crumb onClick={region === 'virgo' ? toVirgo : toLocalVolume} outer>
              {region === 'virgo' ? 'Virgo Cluster' : 'Local Volume'}
            </Crumb>
            <button
              type="button"
              aria-label={region === 'virgo' ? 'Groups of the Virgo Cluster' : 'Groups of the Local Volume'}
              aria-haspopup="listbox"
              aria-expanded={volumeOpen}
              title={region === 'virgo' ? 'Go to a galaxy of the Virgo Cluster' : 'Go to a group of the Local Volume'}
              onClick={() => only('volume')}
              style={{ ...crumbStyle, color: OUTER_CRUMB, display: 'inline-flex', alignItems: 'center' }}
            >
              <Caret open={volumeOpen} />
            </button>
            <Separator />
          </>
        )}
        {region === null && !deep && (
          <>
            <Crumb onClick={toLocalGroup} outer>
              Local Group
            </Crumb>
            <button
              type="button"
              aria-label="Galaxies of the Local Group"
              aria-haspopup="listbox"
              aria-expanded={galaxiesOpen}
              title="Go to a galaxy of the Local Group"
              onClick={() => only('galaxies')}
              style={{ ...crumbStyle, color: OUTER_CRUMB, display: 'inline-flex', alignItems: 'center' }}
            >
              <Caret open={galaxiesOpen} />
            </button>
            <Separator />
          </>
        )}
        {!inOtherGalaxy && (
          <>
            <Crumb onClick={toGalaxy} outer>
              Milky Way
            </Crumb>
            <button
              type="button"
              aria-label="Places in the Milky Way"
              aria-haspopup="listbox"
              aria-expanded={blackHolesOpen}
              title="Go to a place in the Milky Way"
              onClick={() => only('places')}
              style={{ ...crumbStyle, color: OUTER_CRUMB, display: 'inline-flex', alignItems: 'center' }}
            >
              <Caret open={blackHolesOpen} />
            </button>
            <Separator />
          </>
        )}
        {blackHoleSystem === null && !inGalaxy && !inOtherGalaxy && (
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
              onClick={() => only('systems')}
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
        {/* The focus: dropping down the system it is in, or, a place on its own, only its name. */}
        {menu === 'none' ? (
          <span aria-current="location" style={{ ...crumbStyle, color: '#fff', cursor: 'default' }}>
            {focusBody.name}
          </span>
        ) : (
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-current="location"
            onClick={() => only('bodies')}
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
        )}
      </nav>

      <Presence show={systemsOpen}>
        <SystemList
          store={store}
          focus={focus}
          onStar={(id) => {
            onFocus(id);
            renderDemand.request();
            setSystemsOpen(false);
          }}
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

      <Presence show={laniakeaOpen}>
        <LaniakeaList
          archive={laniakeaArchive}
          active={deep ? focus : null}
          onNearbyUniverse={() => {
            toNearbyUniverse();
            setLaniakeaOpen(false);
          }}
          onLaniakea={() => {
            toLaniakea();
            setLaniakeaOpen(false);
          }}
          onLocalVolume={() => {
            toLocalVolume();
            setLaniakeaOpen(false);
          }}
          onChoose={(landmark) => {
            toStructure(() => landmark);
            setLaniakeaOpen(false);
          }}
        />
      </Presence>

      <Presence show={volumeOpen}>
        <VolumeList
          archive={volumeArchive}
          region={region ?? 'local-volume'}
          active={inOtherGalaxy ? focus : null}
          onLocalGroup={() => {
            toLocalGroup();
            setVolumeOpen(false);
          }}
          onLocalVolume={() => {
            toLocalVolume();
            setVolumeOpen(false);
          }}
          onVirgo={() => {
            toVirgo();
            setVolumeOpen(false);
          }}
          onChoose={(k) => {
            onVolumeGalaxy(k);
            renderDemand.request();
            setVolumeOpen(false);
          }}
        />
      </Presence>

      <Presence show={galaxiesOpen}>
        <GalaxyList
          store={store}
          visibleKinds={visibleKinds}
          active={inOtherGalaxy ? focus : null}
          onMilkyWay={() => {
            toGalaxy();
            setGalaxiesOpen(false);
          }}
          onChoose={(id) => {
            onFocus(id);
            renderDemand.request();
            setGalaxiesOpen(false);
          }}
        />
      </Presence>

      <Presence show={blackHolesOpen}>
        <PlaceList
          store={store}
          visibleKinds={visibleKinds}
          focus={focus}
          active={blackHoleSystem?.id ?? null}
          inSolarSystem={inSolarSystem}
          onSolarSystem={() => {
            onFocus('sun');
            renderDemand.request();
            setBlackHolesOpen(false);
          }}
          onNeighbourhood={() => {
            toNeighbourhood();
            setBlackHolesOpen(false);
          }}
          onChoose={(system) => {
            toBlackHole(system);
            setBlackHolesOpen(false);
          }}
          onChoosePlace={(id) => {
            toGalaxyPlace(id);
            setBlackHolesOpen(false);
          }}
        />
      </Presence>

      <Presence show={open && menu !== 'none'}>
        <BodyList
          menu={menu}
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

/**
 * The focus's own list: the system it is in (crumbMenuFor). The Solar System's is the Sun,
 * the planets with their moons, the small bodies, the spacecraft and the satellites; Alpha
 * Centauri's, its three stars and Proxima's planets; a planetary system's, its star and
 * planets; a black hole's, it and the star about it.
 */
function BodyList({
  menu,
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
  menu: CrumbMenu;
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

  const solar = menu === 'solar-system';
  const primaries = store.bodies.filter(
    (body) =>
      solar &&
      body.parent === null &&
      body.kind !== 'spacecraft' &&
      body.kind !== 'asteroid' &&
      body.kind !== 'comet' &&
      body.kind !== 'black-hole' &&
      body.kind !== 'neutron-star' &&
      body.kind !== 'globular-cluster' &&
      body.kind !== 'supernova-remnant' &&
      body.kind !== 'galaxy' &&
      !isCatalogueStar(body) &&
      visibleKinds.has(body.kind),
  );
  // The planetary system in focus, and its star, which is a body while it is.
  const planetSystem = menu === 'planetary-system' ? planetarySystemOf(focus) : null;
  const host =
    planetSystem === null
      ? undefined
      : store.bodies.find((body) => isCatalogueStar(body) && planetarySystemOf(body.id)?.key === planetSystem.key);
  // The black hole in focus, or the one whose star is.
  const blackHole = menu === 'black-hole' ? blackHoleSystemOf(focus) : null;
  const focusMember = alphaCenMember(focus);
  // Listed apart: between the planets they would push Neptune off the bottom.
  const asteroids = solar && visibleKinds.has('asteroid')
    ? store.bodies.filter((body) => body.kind === 'asteroid')
    : [];
  // The comets likewise: one gone to from search is a body until the next (cometBodies.ts).
  const cometBodies = solar && visibleKinds.has('comet')
    ? store.bodies.filter((body) => body.kind === 'comet')
    : [];
  // Moons only: JWST hangs off Earth in the frame tree, and is listed with the craft.
  const moonsOf = (id: BodyId): BodyDefinition[] =>
    visibleKinds.has('moon')
      ? store.bodies.filter(
          (body) => body.parent === id && body.kind === 'moon' && isShown(body, visibleKinds),
        )
      : [];
  const craft = solar && visibleKinds.has('spacecraft')
    ? store.bodies.filter((body) => body.kind === 'spacecraft')
    : [];
  // The named satellites whose chip is on; a bulk one gone to from search is among them.
  const satellites = store.bodies.filter(
    (body) => solar && body.kind === 'satellite' && isShown(body, visibleKinds),
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
      aria-label={
        menu === 'alpha-centauri'
          ? ALPHA_CEN_SYSTEM
          : (planetSystem?.name ?? blackHole?.name ?? 'Bodies')
      }
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
      {menu === 'alpha-centauri' && alphaCen !== null && (
        <>
          <div style={TOP_HEADING}>{ALPHA_CEN_SYSTEM}</div>
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
      {planetSystem !== null && host !== undefined && (
        <>
          {planetSystem.name !== host.name && <div style={TOP_HEADING}>{planetSystem.name}</div>}
          <MemberRow name={host.name} active={host.id === focus} onChoose={() => onChooseSystem(planetSystem.key)} />
          {store.bodies
            .filter((body) => body.parent === host.id)
            .map((planet) => (
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
        </>
      )}
      {blackHole !== null && (
        <>
          <MemberRow name={blackHole.name} active={blackHole.id === focus} onChoose={() => onChooseBlackHole(blackHole)} />
          {store.isPropagatedBody(blackHole.companion) && (
            <Row
              body={store.body(blackHole.companion)}
              active={blackHole.companion === focus}
              inSystem={false}
              indent
              onChoose={onChoose}
              trailing={null}
            />
          )}
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

/** The caption of a list's first section: no rule above it. */
const TOP_HEADING: React.CSSProperties = { ...SECTION_HEADING, borderTop: 'none', paddingTop: 0, marginTop: '0.2rem' };

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
 * Then the stars gone to from search (starBodies.ts) and Sirius's two: stars of the
 * neighbourhood on their own, with no list of their own on the breadcrumb.
 */
function SystemList({
  store,
  focus,
  onStar,
  inSolarSystem,
  inAlphaCen,
  inPlanetSystem,
  onSolarSystem,
  onAlphaCen,
  onPlanetSystem,
}: {
  store: EphemerisStore;
  focus: BodyId;
  onStar: (id: BodyId) => void;
  inSolarSystem: boolean;
  inAlphaCen: boolean;
  inPlanetSystem: string | null;
  onSolarSystem: () => void;
  onAlphaCen: (() => void) | null;
  onPlanetSystem: ((key: string) => void) | null;
}) {
  const closing = useClosing();
  // Redrawn as stars are made bodies and let go.
  useStoreVersion(store);
  const stars = store.bodies.filter((body) => crumbMenuFor(body) === 'none' && isCatalogueStar(body));
  return (
    <div
      role="listbox"
      aria-label="Star systems"
      className={`scroll-hidden ${closing ? 'dropdown-exit' : 'dropdown-enter'}`}
      style={{ ...LIST_STYLE, maxHeight: '70vh', overflowY: 'auto' }}
    >
      <div style={TOP_HEADING}>Star systems</div>
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
      {stars.length > 0 && (
        <>
          <div style={SECTION_HEADING}>Stars</div>
          {stars.map((body) => (
            <Row key={body.id} body={body} active={body.id === focus} inSystem={false} onChoose={onStar} trailing={null} />
          ))}
        </>
      )}
    </div>
  );
}

/**
 * The Local Group's galaxies: the Milky Way, the four big ones that are bodies from the
 * start, then any dwarf gone to from search, while the Local Group is shown.
 */
function GalaxyList({
  store,
  visibleKinds,
  active,
  onMilkyWay,
  onChoose,
}: {
  store: EphemerisStore;
  visibleKinds: ReadonlySet<string>;
  active: BodyId | null;
  onMilkyWay: () => void;
  onChoose: (id: BodyId) => void;
}) {
  const closing = useClosing();
  useStoreVersion(store);
  const giants = new Set(GIANTS.map(galaxyBodyId));
  // The Local Group's own: those beyond are listed by the Local Volume's crumb.
  const dwarfs = visibleKinds.has('galaxy')
    ? store.bodies.filter(
        (body) => body.kind === 'galaxy' && !giants.has(body.id) && galaxyOf(body.id)?.volumeIndex === undefined,
      )
    : [];
  return (
    <div
      role="listbox"
      aria-label="Galaxies of the Local Group"
      className={`scroll-hidden ${closing ? 'dropdown-exit' : 'dropdown-enter'}`}
      style={{ ...LIST_STYLE, maxHeight: '70vh', overflowY: 'auto' }}
    >
      <MemberRow name="Milky Way" active={false} onChoose={onMilkyWay} />
      {GIANTS.map((galaxy) => (
        <MemberRow
          key={galaxy.key}
          name={galaxy.name}
          active={active === galaxyBodyId(galaxy)}
          onChoose={() => onChoose(galaxyBodyId(galaxy))}
        />
      ))}
      {dwarfs.length > 0 && (
        <>
          <div style={SECTION_HEADING}>Dwarfs</div>
          {dwarfs.map((body) => (
            <MemberRow key={body.id} name={body.name} active={active === body.id} onChoose={() => onChoose(body.id)} />
          ))}
        </>
      )}
    </div>
  );
}

/** A group's galaxies listed at most, brightest first; the rest are found by search. */
const GROUP_ROWS = 40;

/**
 * The Local Volume's list: the Local Group, then its groups, each folded over its galaxies,
 * brightest first, and beyond it the Virgo Cluster. Or, in the Virgo Cluster, its own groups
 * and the way back. The group of the galaxy in focus starts unfolded.
 */
function VolumeList({
  archive,
  region,
  active,
  onLocalGroup,
  onLocalVolume,
  onVirgo,
  onChoose,
}: {
  archive: LocalVolumeArchive | null;
  region: VolumeRegion;
  active: BodyId | null;
  onLocalGroup: () => void;
  onLocalVolume: () => void;
  onVirgo: () => void;
  onChoose: (k: number) => void;
}) {
  const closing = useClosing();
  const groups = archive === null ? [] : archive.groups.filter((group) => group.region === region);
  const activeIndex = active === null ? undefined : galaxyOf(active)?.volumeIndex;
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(() => {
    const group = groups.find((entry) => activeIndex !== undefined && entry.members.includes(activeIndex));
    return new Set(group === undefined ? [] : [group.label]);
  });
  const toggle = (label: string): void => {
    setUnfolded((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };
  return (
    <div
      role="listbox"
      aria-label={region === 'virgo' ? 'Groups of the Virgo Cluster' : 'Groups of the Local Volume'}
      className={`scroll-hidden ${closing ? 'dropdown-exit' : 'dropdown-enter'}`}
      style={{ ...LIST_STYLE, width: '15rem', maxHeight: '70vh', overflowY: 'auto' }}
    >
      {region === 'virgo' ? (
        <MemberRow name="Local Volume" active={false} onChoose={onLocalVolume} />
      ) : (
        <MemberRow name="Local Group" active={false} onChoose={onLocalGroup} />
      )}
      {archive === null && <div style={{ ...SECTION_HEADING, borderTop: 'none' }}>Loading…</div>}
      {groups.length > 0 && <div style={SECTION_HEADING}>{region === 'virgo' ? 'Virgo Cluster' : 'Groups'}</div>}
      {archive !== null &&
        groups.map((group) => {
          const open = unfolded.has(group.label);
          const shown = group.members.slice(0, GROUP_ROWS);
          return (
            <div key={group.label}>
              <button
                type="button"
                aria-expanded={open}
                aria-label={`${open ? 'Hide' : 'Show'} ${group.label}`}
                onClick={() => toggle(group.label)}
                style={FOLD_STYLE}
              >
                <span style={{ flex: 1 }}>{group.label}</span>
                <span style={{ color: '#5a5a5a', fontSize: '0.62rem' }}>{group.members.length}</span>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    transform: open ? 'rotate(90deg)' : 'none',
                    transition: 'transform 160ms ease',
                    fontSize: '0.8rem',
                    lineHeight: 1,
                    color: '#6a6a6a',
                  }}
                >
                  &rsaquo;
                </span>
              </button>
              {open &&
                shown.map((k) => (
                  <MemberRow
                    key={k}
                    name={archive.galaxies[k]!.name}
                    active={activeIndex === k}
                    indent
                    onChoose={() => onChoose(k)}
                  />
                ))}
              {open && group.members.length > shown.length && (
                <div style={{ padding: '0.25rem 0.45rem 0.3rem 1.55rem', color: '#4e4e4e', fontSize: '0.64rem' }}>
                  {`${group.members.length - shown.length} more · search`}
                </div>
              )}
            </div>
          );
        })}
      {region === 'local-volume' && (
        <>
          <div style={SECTION_HEADING}>Beyond</div>
          <MemberRow name="Virgo Cluster" active={false} onChoose={onVirgo} />
        </>
      )}
    </div>
  );
}

/** Laniakea's list's sections: the named structures by kind, in this order, nearest first in each. */
const STRUCTURE_SECTIONS: readonly { readonly label: string; readonly kinds: readonly LaniakeaLandmark['kind'][] }[] = [
  { label: 'Clusters', kinds: ['cluster'] },
  { label: 'Superclusters', kinds: ['supercluster', 'attractor'] },
  { label: 'Basins', kinds: ['basin', 'repeller'] },
  { label: 'Voids and walls', kinds: ['void', 'wall'] },
];

/**
 * Laniakea's list: the views -- the Nearby Universe, Laniakea, the Local Volume -- then the
 * named structures, by kind, nearest first. Laniakea's own entry is the second view.
 */
function LaniakeaList({
  archive,
  active,
  onNearbyUniverse,
  onLaniakea,
  onLocalVolume,
  onChoose,
}: {
  archive: LaniakeaCatalogue | null;
  active: BodyId | null;
  onNearbyUniverse: () => void;
  onLaniakea: () => void;
  onLocalVolume: () => void;
  onChoose: (landmark: LaniakeaLandmark) => void;
}) {
  const closing = useClosing();
  const own = archive === null ? null : laniakeaLandmark(archive);
  const landmarks = archive === null ? [] : [...archive.info.landmarks].filter((l) => l !== own).sort((a, b) => a.distancePc - b.distancePc);
  return (
    <div
      role="listbox"
      aria-label="Structures of Laniakea and beyond"
      className={`scroll-hidden ${closing ? 'dropdown-exit' : 'dropdown-enter'}`}
      style={{ ...LIST_STYLE, width: '15rem', maxHeight: '70vh', overflowY: 'auto' }}
    >
      <MemberRow name="Nearby Universe" active={false} onChoose={onNearbyUniverse} />
      <MemberRow name="Laniakea" active={own !== null && active === structureBodyId(own)} onChoose={onLaniakea} />
      <MemberRow name="Local Volume" active={false} onChoose={onLocalVolume} />
      {archive === null && <div style={SECTION_HEADING}>Loading…</div>}
      {STRUCTURE_SECTIONS.map(({ label, kinds }) => {
        const rows = landmarks.filter((l) => kinds.includes(l.kind));
        return rows.length === 0 ? null : (
          <div key={label}>
            <div style={SECTION_HEADING}>{label}</div>
            {rows.map((landmark) => (
              <MemberRow
                key={landmark.name}
                name={landmark.name}
                active={active === structureBodyId(landmark)}
                onChoose={() => onChoose(landmark)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** The kinds out in the galaxy listed under Milky Way, in their order, with their headings. */
const GALAXY_PLACES: readonly { readonly kind: string; readonly label: string }[] = [
  { kind: 'supernova-remnant', label: 'Supernova remnants' },
  { kind: 'neutron-star', label: 'Pulsars' },
  { kind: 'globular-cluster', label: 'Globular clusters' },
];

/**
 * The places under Milky Way: home -- the Solar System, the Solar Neighbourhood -- and the
 * black holes (D5), each framed with the star on its orbit: Sgr A* first, at the centre of
 * the Galaxy; then the nearest known, by distance. Then what else is out in the galaxy and a
 * body: the supernova remnants, bodies from the start, and the pulsars and globular clusters
 * gone to -- each a place on its own, with no list of its own on the breadcrumb.
 */
function PlaceList({
  store,
  visibleKinds,
  focus,
  active,
  inSolarSystem,
  onSolarSystem,
  onNeighbourhood,
  onChoose,
  onChoosePlace,
}: {
  store: EphemerisStore;
  visibleKinds: ReadonlySet<string>;
  focus: BodyId;
  active: BodyId | null;
  inSolarSystem: boolean;
  onSolarSystem: () => void;
  onNeighbourhood: () => void;
  onChoose: (system: BlackHoleSystem) => void;
  onChoosePlace: (id: BodyId) => void;
}) {
  const closing = useClosing();
  useStoreVersion(store);
  return (
    <div
      role="listbox"
      aria-label="Places in the Milky Way"
      className={`scroll-hidden ${closing ? 'dropdown-exit' : 'dropdown-enter'}`}
      style={{ ...LIST_STYLE, maxHeight: '70vh', overflowY: 'auto' }}
    >
      <div style={TOP_HEADING}>Home</div>
      <MemberRow name="Solar System" active={inSolarSystem} onChoose={onSolarSystem} />
      <MemberRow name="Solar Neighbourhood" active={false} onChoose={onNeighbourhood} />
      <div style={SECTION_HEADING}>Black holes</div>
      {BLACK_HOLE_SYSTEMS.map((system) => (
        <MemberRow
          key={system.id}
          name={system.binary === null ? `${system.name} · Galactic Centre` : system.name}
          active={active === system.id}
          onChoose={() => onChoose(system)}
        />
      ))}
      {GALAXY_PLACES.map(({ kind, label }) => {
        const members = visibleKinds.has(kind) ? store.bodies.filter((body) => body.kind === kind) : [];
        return (
          members.length > 0 && (
            <div key={kind}>
              <div style={SECTION_HEADING}>{label}</div>
              {members.map((body) => (
                <Row
                  key={body.id}
                  body={body}
                  active={body.id === focus}
                  inSystem={false}
                  onChoose={onChoosePlace}
                  trailing={null}
                />
              ))}
            </div>
          )
        );
      })}
    </div>
  );
}

/** A dropdown's box, as every list under the breadcrumb has it. */
const LIST_STYLE: React.CSSProperties = {
  marginTop: '0.55rem',
  width: '13.5rem',
  // Opaque enough to need no blur behind it. See Panel.tsx.
  background: 'rgba(14,14,17,0.97)',
  border: '1px solid #262626',
  borderRadius: '0.4rem',
  padding: '0.35rem',
};

/**
 * A star of Alpha Centauri in the list: a row like any body's, but for a star that may not
 * be a body yet -- choosing it makes it one (App.tsx) -- so it carries a name, not a body.
 */
function MemberRow({
  name,
  active,
  onChoose,
  indent = false,
}: {
  name: string;
  active: boolean;
  onChoose: () => void;
  indent?: boolean;
}) {
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
          padding: `0.3rem 0.45rem 0.3rem ${indent ? '1.55rem' : '0.45rem'}`,
          color: active ? ACCENT : '#a8a8a8',
          fontFamily: 'inherit',
          fontSize: indent ? '0.72rem' : '0.78rem',
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
