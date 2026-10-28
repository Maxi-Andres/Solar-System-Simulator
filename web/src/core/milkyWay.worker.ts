import { sampleDust, sampleMilkyWay } from './milkyWay.ts';

/**
 * The Milky Way model's sample, off the main thread: a hundred milliseconds and more of
 * sampling that, done in a frame, was a visible hitch as the camera pulled out
 * (MilkyWay.tsx). Asked for with the point counts, answered with the arrays, transferred
 * rather than copied.
 */
self.onmessage = (event: MessageEvent<{ count: number; dust: number }>) => {
  const light = sampleMilkyWay(event.data.count);
  const dust = sampleDust(event.data.dust);
  (self as unknown as Worker).postMessage({ light, dust }, [
    light.positions.buffer,
    light.populations.buffer,
    dust.buffer,
  ]);
};
