import type { BodyId } from '@sss/tools/types';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import { GalacticBubbles } from './GalacticBubbles.tsx';
import { LocalInterstellar } from './LocalInterstellar.tsx';
import { Nebulae } from './Nebulae.tsx';
import { Streams } from './Streams.tsx';

/**
 * What the Milky Way holds besides its stars and its model's glow, each its own layer: the
 * nebulae, the halo's stellar streams, the Fermi and eROSITA bubbles, and the Sun's own
 * surroundings in the interstellar medium. Mounted before LabelProjector: their names are
 * posted to its declutter pass (sceneLabels.ts).
 */

export interface GalaxyFeatureLayers {
  readonly nebulae: boolean;
  readonly stellarStreams: boolean;
  readonly galacticBubbles: boolean;
  readonly localInterstellar: boolean;
  /** The Labels layer, with the interface shown. */
  readonly labels: boolean;
  /** The Icons layer. */
  readonly icons: boolean;
}

/** What each feature component is given. */
export interface FeatureProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
  readonly showLabels: boolean;
  readonly showIcons: boolean;
}

export interface GalaxyFeaturesProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly layers: GalaxyFeatureLayers;
}

export function GalaxyFeatures({ store, clock, focus, layers }: GalaxyFeaturesProps) {
  const common = { store, clock, focus, showLabels: layers.labels, showIcons: layers.icons };
  return (
    <>
      <Nebulae {...common} visible={layers.nebulae} />
      <Streams {...common} visible={layers.stellarStreams} />
      <GalacticBubbles {...common} visible={layers.galacticBubbles} />
      <LocalInterstellar {...common} visible={layers.localInterstellar} />
    </>
  );
}
