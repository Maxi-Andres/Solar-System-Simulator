import type { ChunkInfo, PathTable } from '@sss/tools/types';

/**
 * A spacecraft's path in pieces: paths/<id>/<index>.json, as the generator cuts it (see
 * splitPath in tools/src/paths.ts and PathInfo.chunks).
 *
 * A trail is one turn of the craft's orbit back from the clock, so only the pieces that
 * turn is in are fetched, and joined into one path to draw. BepiColombo's path was one
 * file of 1.53 MB, almost all of it the months it circles Mercury after the build, fetched
 * at startup to draw the three months before it.
 */

/**
 * Index of the piece covering `jd` in `chunks` (in time order, neighbours sharing their
 * boundary), clamped to the first and the last: a boundary instant belongs to both
 * neighbours, and the later one is taken.
 */
export function pieceIndexAt(chunks: readonly ChunkInfo[], jd: number): number {
  let low = 0;
  let high = chunks.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (chunks[mid]!.startJd <= jd) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/**
 * Consecutive pieces of one path joined back into one, each shared boundary sample kept
 * once: to the last digit the samples, tolerances and gaps of the path over their span.
 */
export function joinPathPieces(pieces: readonly PathTable[]): PathTable {
  const first = pieces[0];
  if (first === undefined) {
    throw new Error('No pieces of a path to join.');
  }
  if (pieces.length === 1) {
    return first;
  }
  const keep = (column: (piece: PathTable) => readonly number[]): number[] =>
    pieces.flatMap((piece, index) => (index === 0 ? column(piece) : column(piece).slice(1)));
  const gaps: number[] = [];
  let intervals = 0;
  for (const piece of pieces) {
    for (const gap of piece.gaps) {
      gaps.push(gap + intervals);
    }
    intervals += piece.count - 1;
  }
  return {
    id: first.id,
    horizonsId: first.horizonsId,
    center: first.center,
    count: intervals + 1,
    t: keep((piece) => piece.t),
    x: keep((piece) => piece.x),
    y: keep((piece) => piece.y),
    z: keep((piece) => piece.z),
    vx: keep((piece) => piece.vx),
    vy: keep((piece) => piece.vy),
    vz: keep((piece) => piece.vz),
    toleranceKm: pieces.flatMap((piece) => piece.toleranceKm),
    gaps,
  };
}
