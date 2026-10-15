/**
 * When a body's detail -- its surface maps, a craft's model -- may be let go.
 *
 * Detail is fetched as a body grows on screen, and until now it was kept forever. Visit
 * a dozen craft and a few planets and the browser held well over a gigabyte, on a laptop
 * whose GPU memory is its RAM: measured, 590 MB at start to 1.2 GB five minutes later,
 * none of it ever coming back.
 *
 * So detail is released once its body has been small for a while. Two rules keep that
 * from thrashing:
 *
 *  - **Hysteresis in size.** Detail is asked for at a radius and kept down to half of
 *    it, so a body hovering at the threshold is not fetched and dropped every frame.
 *  - **A delay.** It must stay below that for half a minute. Flicking between two craft,
 *    or zooming out for a look and back in, costs nothing; leaving a system for good
 *    gives its memory back.
 *
 * What comes back is fetched again, from the browser's cache by then: a decode and an
 * upload, the same as the first time, while the body is still a growing dot.
 */

/** How long a body must stay small before its detail is released, in milliseconds. */
export const DETAIL_RELEASE_MS = 30_000;

/** Below this share of the request radius, a body counts as small. */
export const DETAIL_KEEP_FRACTION = 0.5;

/** True while a body this many pixels across still wants detail asked for at `requestPx`. */
export function detailWanted(pixelRadius: number, requestPx: number): boolean {
  return pixelRadius >= requestPx * DETAIL_KEEP_FRACTION;
}

/** True once detail last wanted at `wantedAtMs` may be released at `nowMs`. */
export function detailExpired(wantedAtMs: number, nowMs: number): boolean {
  return nowMs - wantedAtMs > DETAIL_RELEASE_MS;
}
