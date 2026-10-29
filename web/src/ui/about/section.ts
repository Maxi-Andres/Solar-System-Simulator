import type { ReactNode } from 'react';

import type {
  BeltInfo,
  CometInfo,
  ExoplanetCatalog,
  SatelliteInfo,
  StarCatalog,
  Stars3dInfo,
} from '@sss/tools/types';

import type { LoadedTier } from '../../core/belt.ts';
import type { EphemerisStore } from '../../core/ephemerisStore.ts';
import type { SectionId } from './nav.ts';

/**
 * Everything the About text reads from the data, gathered once by the panel. The lazily
 * loaded catalogues are null until they arrive -- a paragraph about the belt is written
 * only once there is a belt to count.
 */
export interface AboutData {
  readonly store: EphemerisStore;
  readonly stars: StarCatalog;
  readonly beltInfo: BeltInfo | null;
  readonly beltTiers: readonly LoadedTier[];
  readonly cometInfo: CometInfo | null;
  readonly satelliteInfo: SatelliteInfo | null;
  readonly stars3dInfo: Stars3dInfo | null;
  readonly exoplanetCatalog: ExoplanetCatalog | null;
}

/** One section of the About: its tab, its heading, its subsections and its text. */
export interface AboutSection {
  readonly id: SectionId;
  /** The tab's label: a word or two. */
  readonly tab: string;
  /** The heading over the section. */
  readonly title: string;
  /** One line under the heading: what this section holds. */
  readonly blurb: string;
  /** Its subsections in order, as listed at its top; each `id` is a `Sub` in `Body`. */
  readonly subsections: readonly { readonly id: string; readonly label: string }[];
  readonly Body: (props: { readonly data: AboutData }) => ReactNode;
}
