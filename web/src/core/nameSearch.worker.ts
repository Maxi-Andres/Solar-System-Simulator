import { nameSearchHandler, type NameSearchRequest } from './nameSearch.ts';

/**
 * The name indexes, fetched, parsed, made and searched off the main thread: see nameSearch.ts.
 * Requests in, each answered by its id; the indexes stay here for the page's life.
 */
const handle = nameSearchHandler();

self.onmessage = async (event: MessageEvent<NameSearchRequest>) => {
  (self as unknown as Worker).postMessage(await handle(event.data));
};
