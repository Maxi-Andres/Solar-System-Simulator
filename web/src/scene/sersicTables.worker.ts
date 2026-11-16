import { sersicTable, type SersicWorkerAnswer, type SersicWorkerRequest } from './galaxyColumns.ts';

/**
 * The Prugniel-Simien tables (galaxyColumns.ts sersicTable) made off the main thread: the Local
 * Volume's galaxies bring several indices at once, 60 to 80 ms each, which made in the frame it
 * landed in held that frame back by a third of a second (galaxyColumns.ts sersicTablesAhead).
 * Answered one table at a time, its array transferred.
 */
self.onmessage = (event: MessageEvent<SersicWorkerRequest>) => {
  for (const n of event.data.indices) {
    const table = sersicTable(n);
    // A copy, since the array goes: this worker's own cache keeps nothing it needs again.
    const answer: SersicWorkerAnswer = { ...table, lnColumn: table.lnColumn.slice() };
    (self as unknown as Worker).postMessage(answer, [answer.lnColumn.buffer]);
  }
};
