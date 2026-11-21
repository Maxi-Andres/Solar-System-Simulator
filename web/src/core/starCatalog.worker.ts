import { columnBuffers, parseStarCatalog, type StarCatalogReply, withTypedColumns } from './starCatalog.ts';

/**
 * stars.json fetched and parsed off the main thread, its columns sent back as Float64Arrays
 * and transferred, not copied: see loadStarCatalog. One message in, the file's URL; one out.
 */
self.onmessage = async (event: MessageEvent<string>) => {
  const post = (reply: StarCatalogReply, transfer: Transferable[] = []) =>
    (self as unknown as Worker).postMessage(reply, transfer);
  try {
    const response = await fetch(event.data);
    if (!response.ok) {
      throw new Error(`Failed to load ${event.data}: HTTP ${response.status}`);
    }
    const catalog = withTypedColumns(parseStarCatalog(await response.json()));
    post({ catalog }, columnBuffers(catalog));
  } catch (error) {
    post({ error: error instanceof Error ? error.message : String(error) });
  }
};
