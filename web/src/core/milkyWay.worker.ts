import { sampleMilkyWay } from './milkyWay.ts';

/**
 * The Milky Way model's sample, off the main thread: ninety milliseconds of sampling that,
 * done in a frame, was a visible hitch as the camera pulled out (MilkyWay.tsx). Asked for
 * with a point count, answered with the two arrays, transferred rather than copied.
 */
self.onmessage = (event: MessageEvent<{ count: number }>) => {
  const sample = sampleMilkyWay(event.data.count);
  (self as unknown as Worker).postMessage(sample, [sample.positions.buffer, sample.populations.buffer]);
};
