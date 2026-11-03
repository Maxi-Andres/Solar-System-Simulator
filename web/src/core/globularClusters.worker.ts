import { sampleGlobularCluster, type ClusterSampleRequest } from './globularClusters.ts';

/** One cluster sampled off the main thread, as the nuclear cluster is (GlobularClusters.tsx); the arrays transferred, not copied. */
self.onmessage = (event: MessageEvent<ClusterSampleRequest>) => {
  const sample = sampleGlobularCluster(event.data);
  (self as unknown as Worker).postMessage(sample, [
    sample.positions.buffer,
    sample.absoluteV.buffer,
    sample.colorIndex.buffer,
  ]);
};
