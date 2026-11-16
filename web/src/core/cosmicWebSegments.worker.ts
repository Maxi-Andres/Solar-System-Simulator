import type { CosmicWebInfo } from '@sss/tools/types';

import { filamentSegments, type CosmicWebFilaments } from './cosmicWeb.ts';

/** The filaments made segments off the main thread (cosmicWeb.ts filamentSegments): a few hundred milliseconds for 491,000. */
self.onmessage = (event: MessageEvent<{ filaments: CosmicWebFilaments; info: CosmicWebInfo['filaments'] }>) => {
  const segments = filamentSegments(event.data.filaments, event.data.info);
  (self as unknown as Worker).postMessage(segments, [segments.a.buffer, segments.b.buffer]);
};
