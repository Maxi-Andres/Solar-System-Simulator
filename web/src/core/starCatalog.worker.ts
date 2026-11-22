import { starColorSteps } from '../scene/blackbody.ts';
import { columnBuffers, parseStarCatalog, type StarCatalogReply, withTypedColumns } from './starCatalog.ts';

/**
 * stars.json fetched and parsed off the main thread, its columns sent back as Float64Arrays
 * and transferred, not copied: see loadStarCatalog. One message in, the file's URL; one out.
 * With the catalogue, the colour steps its stars need, made here rather than in the sky's mount.
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
    const colorSteps = starColorSteps(catalog.bv);
    post({ catalog, colorSteps }, [...columnBuffers(catalog), colorSteps.buffer]);
  } catch (error) {
    post({ error: error instanceof Error ? error.message : String(error) });
  }
};
