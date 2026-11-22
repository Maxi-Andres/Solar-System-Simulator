import type { BodyId } from '@sss/tools/types';

import { useViewStore } from '../state/store.ts';

/** Names said with "the" before them, in the way into a description. */
const WITH_THE: ReadonlySet<string> = new Set([
  'Sun',
  'Moon',
  'James Webb Space Telescope',
  'Hubble Space Telescope',
  'International Space Station',
  'Roman Space Telescope',
  'Andromeda Galaxy',
  'Large Magellanic Cloud',
  'Small Magellanic Cloud',
  'Orion Nebula',
  'Crab Nebula',
  'Laniakea Supercluster',
  'Milky Way',
  'cosmic microwave background',
  // The breadcrumb's levels (state/levels.ts).
  'Solar System',
  'Solar Neighbourhood',
  'Local Volume',
  'Nearby Universe',
  'observable universe',
  // Alpha Centauri as a whole (descriptions/alphaCentauriSystem.ts).
  'Alpha Centauri system',
]);

/**
 * Kinds of name an English speaker puts "the" before: a nebula, a cloud, a cluster, a wall, a
 * telescope, a meteor shower… -- the Coalsack, the Hyades, the Perseids. A name already starting
 * with "the" is left alone.
 */
const THE_BY_ENDING =
  /(Nebula|Cloud|Clouds|Cluster|Supercluster|Void|Wall|Stream|Bubble|Bubbles|Superbubble|Loop|Arc|Ring|Wave|Bridge|Arm|Sheet|Group|Galaxy|Observatory|Telescope|Station|Belt|Coalsack|Hyades|Pleiades|ids|ds)$/;

export function spokenName(name: string): string {
  if (/^the/i.test(name)) return name;
  return WITH_THE.has(name) || THE_BY_ENDING.test(name) ? `the ${name}` : name;
}

/**
 * The way into a description (DescriptionView): what it is, its photos, what is measured and
 * what is not. The focused body's, from its panel; or, with `about`, one of what is no body --
 * the Milky Way's, the CMB's -- from wherever it is reached.
 */
export function ReadMore({ name, about = null, onRead }: { name: string; about?: BodyId | null; onRead?: () => void }) {
  const readAbout = useViewStore((state) => state.readAbout);
  return (
    <button
      type="button"
      onClick={() => {
        readAbout(about);
        onRead?.();
      }}
      style={{
        display: 'block',
        width: '100%',
        marginTop: '0.6rem',
        padding: '0.4rem 0.6rem',
        background: 'transparent',
        border: '1px solid #2a2a2a',
        borderRadius: '0.3rem',
        color: '#9fc3e0',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '0.74rem',
        textAlign: 'left',
      }}
    >
      Read about {spokenName(name)} →
    </button>
  );
}
