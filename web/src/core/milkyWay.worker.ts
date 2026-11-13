import { sampleDust, sampleMilkyWay, spreadRadii } from './milkyWay.ts';

/**
 * The Milky Way model's sample, off the main thread: a hundred milliseconds and more of
 * sampling that, done in a frame, was a visible hitch as the camera pulled out
 * (MilkyWay.tsx). Asked for with the point counts, answered with the arrays, transferred
 * rather than copied -- each point's radius too, spread where its population is sparse
 * (spreadRadii), a k-d tree's search per point.
 */
self.onmessage = (event: MessageEvent<{ count: number; dust: number }>) => {
  const light = sampleMilkyWay(event.data.count);
  const radii = spreadRadii(light);
  const dust = sampleDust(event.data.dust);
  (self as unknown as Worker).postMessage({ light, radii, dust }, [
    light.positions.buffer,
    light.populations.buffer,
    radii.buffer,
    dust.buffer,
  ]);
};
