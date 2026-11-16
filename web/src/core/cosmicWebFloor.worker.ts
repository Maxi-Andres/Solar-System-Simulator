import { cosmicWebFloor, type FloorRequest } from './cosmicWebFloor.ts';

/** The cosmic web's galaxies' faint dots weighed off the main thread (cosmicWebFloor.ts): a second or two for 1.8 million. */
self.onmessage = (event: MessageEvent<FloorRequest>) => {
  const { id, ...request } = event.data;
  const answer = cosmicWebFloor(request);
  (self as unknown as Worker).postMessage({ id, ...answer }, [answer.weights.buffer]);
};
