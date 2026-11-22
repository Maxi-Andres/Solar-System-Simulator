import { clusterDustResponder, type ClusterDustRequest } from './globularClusterDust.ts';

/**
 * The dust in front of every globular cluster from the camera, off the main thread
 * (globularClusterDust.ts): sent the catalogue once, then a camera at a time, each answered
 * with the clusters' A_V, the array transferred.
 */
const respond = clusterDustResponder();

self.onmessage = (event: MessageEvent<ClusterDustRequest>) => {
  const answer = respond(event.data);
  if (answer !== null) {
    (self as unknown as Worker).postMessage(answer, [answer.extinction.buffer]);
  }
};
