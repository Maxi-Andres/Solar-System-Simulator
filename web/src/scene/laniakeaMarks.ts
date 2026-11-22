import type { FoldHosts } from './markFolding.ts';
import { SYSTEM_GONE_PX, systemStrength } from './markFolding.ts';
import type { MarkCandidates } from './markDeclutter.ts';
import { cellCandidates, pointCells, type PointCells } from './pointCells.ts';

/**
 * Laniakea's marks (Laniakea.tsx) each frame, worked out only where they can be anything.
 *
 * A galaxy's mark is as much there as its host lets it be (markHosts.ts laniakeaFolds): the
 * group's brightest by its group's host's strength, a member by its fold into that host, one of
 * no group by how large FIELD_GALAXY_REACH of its half-light radii are on the screen. From
 * almost anywhere nearly all 86,899 are folded away: their groups too small on the screen to be
 * places, the field galaxies too far. A pass over every one, and the declutter's two over every
 * one after it, cost the frame several milliseconds to find that out again.
 *
 * So the same numbers are worked out for only the galaxies that could have one that is not
 * 0: the members of hosts that let some of them be there, and the field galaxies in cells of a
 * grid near enough (pointCells.ts). Every other galaxy's is 0 -- exactly what the pass gave it --
 * and the declutter is handed the marks that are not 0, the bodies, and those it left shown or
 * not kept last frame (`MarkState.candidates`); any other it would have left as it was.
 */

/** Each galaxy's place in its host, and the numbers that mark it, as markHosts.ts laniakeaFolds gives them. */
export interface LaniakeaMarkFolds {
  /** The host a galaxy is the mark of, -1 none. */
  readonly marks: Int32Array;
  /** The host a galaxy folds into, -1 none, and its distance from it, pc. */
  readonly host: Int32Array;
  readonly separationPc: Float32Array;
}

/** What a frame's strengths read, laid out once for a catalogue. */
export interface LaniakeaMarkIndex {
  readonly count: number;
  /** The galaxies that are a host's mark, and that host. */
  readonly ownK: Int32Array;
  readonly ownHost: Int32Array;
  /** The hosts that have members; host i's are `members[memberStart[i]]` to `members[memberStart[i + 1]]`, ascending. */
  readonly memberHosts: Int32Array;
  readonly memberStart: Int32Array;
  readonly members: Int32Array;
  /** Whether every member of host i is a finite distance from it (else they are all worked out). */
  readonly membersFinite: Uint8Array;
  /** Each galaxy's distance from its host, pc (LaniakeaMarkFolds). */
  readonly separationPc: Float32Array;
  /** The galaxies of no group, in cells weighed by their reach (pointCells.ts). */
  readonly field: PointCells;
}

/** The index for a catalogue's `records` (x, y, z the first floats of each `stride`) and folds. */
export function laniakeaMarkIndex(
  records: Float32Array,
  stride: number,
  folds: LaniakeaMarkFolds,
  reachPc: Float32Array,
): LaniakeaMarkIndex {
  const count = folds.marks.length;
  // Counted, then placed: each host's members together, ascending, in two passes.
  let ownCount = 0;
  let fieldCount = 0;
  let hostEnd = 0;
  for (let k = 0; k < count; k += 1) {
    if (folds.marks[k]! >= 0) ownCount += 1;
    else if (folds.host[k]! >= 0) hostEnd = Math.max(hostEnd, folds.host[k]! + 1);
    else fieldCount += 1;
  }
  const perHost = new Int32Array(hostEnd + 1);
  const ownK = new Int32Array(ownCount);
  const ownHost = new Int32Array(ownCount);
  const field = new Int32Array(fieldCount);
  ownCount = 0;
  fieldCount = 0;
  for (let k = 0; k < count; k += 1) {
    if (folds.marks[k]! >= 0) {
      ownK[ownCount] = k;
      ownHost[ownCount] = folds.marks[k]!;
      ownCount += 1;
    } else if (folds.host[k]! >= 0) {
      perHost[folds.host[k]! + 1] = perHost[folds.host[k]! + 1]! + 1;
    } else {
      field[fieldCount++] = k;
    }
  }
  let hostCount = 0;
  for (let h = 0; h < hostEnd; h += 1) if (perHost[h + 1]! > 0) hostCount += 1;
  const memberHosts = new Int32Array(hostCount);
  const memberStart = new Int32Array(hostCount + 1);
  // Where each host's members go, by host index.
  const slot = new Int32Array(hostEnd);
  let i = 0;
  let total = 0;
  for (let h = 0; h < hostEnd; h += 1) {
    const n = perHost[h + 1]!;
    if (n === 0) continue;
    memberHosts[i] = h;
    slot[h] = total;
    total += n;
    memberStart[i + 1] = total;
    i += 1;
  }
  const members = new Int32Array(total);
  const membersFinite = new Uint8Array(hostCount).fill(1);
  const hostSlot = new Int32Array(hostEnd).fill(-1);
  for (let j = 0; j < hostCount; j += 1) hostSlot[memberHosts[j]!] = j;
  for (let k = 0; k < count; k += 1) {
    const h = folds.host[k]!;
    if (folds.marks[k]! >= 0 || h < 0) continue;
    members[slot[h]!] = k;
    slot[h] = slot[h]! + 1;
    if (!Number.isFinite(folds.separationPc[k]!)) membersFinite[hostSlot[h]!] = 0;
  }
  return {
    count,
    ownK,
    ownHost,
    memberHosts,
    memberStart,
    members,
    membersFinite,
    separationPc: folds.separationPc,
    field: pointCells(records, stride, field, count, (k) => reachPc[k]!),
  };
}

/** A list of galaxies and how many of it are used. */
interface List {
  list: Int32Array;
  count: number;
}

/**
 * One catalogue's marks from frame to frame: the galaxies whose mark is not 0 this frame
 * (`live`), and those the declutter left shown or not kept (`dirty`).
 */
export class MarkState {
  readonly index: LaniakeaMarkIndex;
  private readonly live: List;
  private readonly dirty: List;
  private readonly picked: List;
  private readonly cells: Int32Array;
  private readonly seen: Uint8Array;

  constructor(index: LaniakeaMarkIndex) {
    this.index = index;
    this.live = { list: new Int32Array(index.count), count: 0 };
    this.dirty = { list: new Int32Array(index.count), count: 0 };
    this.picked = { list: new Int32Array(index.count), count: 0 };
    this.cells = new Int32Array(index.field.items.length + index.field.always.length);
    this.seen = new Uint8Array(index.count);
  }

  /**
   * This frame's strength of every mark into `value`, as Laniakea.tsx's pass worked it out --
   * the focus whole, a host's mark its host's strength, a member its fold, a galaxy of no group
   * by its reach on the screen -- from `hosts` (updated for this frame), the camera about the
   * Sun, pc, and the view's CSS pixels per radian. Only those that can be other than 0 are
   * worked out; the rest are 0.
   */
  strengths(
    hosts: Pick<FoldHosts, 'strength' | 'system' | 'scale' | 'member'>,
    records: Float32Array,
    stride: number,
    reachPc: Float32Array,
    cameraPc: readonly [number, number, number],
    cssPerRadian: number,
    focusIndex: number,
    value: Float32Array,
  ): void {
    const { live, index } = this;
    for (let i = 0; i < live.count; i += 1) value[live.list[i]!] = 0;
    live.count = 0;
    const put = (k: number, s: number): void => {
      if (s === 0) return;
      value[k] = s;
      live.list[live.count++] = k;
    };
    if (Number.isInteger(focusIndex) && focusIndex >= 0 && focusIndex < index.count) put(focusIndex, 1);
    const { strength, system, scale } = hosts;
    for (let i = 0; i < index.ownK.length; i += 1) {
      const k = index.ownK[i]!;
      if (k !== focusIndex) put(k, strength[index.ownHost[i]!] ?? 0);
    }
    for (let i = 0; i < index.memberHosts.length; i += 1) {
      const h = index.memberHosts[i]!;
      // A host that lets none of its members be there: each member's fold is a number from 0
      // to 1 (a finite separation, a finite scale) and the least of it, the host's strength
      // and the host's system is 0 -- so long as neither of those is not a number.
      if (h < strength.length && index.membersFinite[i] === 1 && Number.isFinite(scale[h]!) && scale[h]! > 0) {
        const s = strength[h]!;
        const y = system[h]!;
        if ((s === 0 && y === y) || (y === 0 && s === s)) continue;
      }
      for (let j = index.memberStart[i]!; j < index.memberStart[i + 1]!; j += 1) {
        const k = index.members[j]!;
        if (k !== focusIndex) put(k, hosts.member(h, index.separationPc[k]!));
      }
    }
    // A galaxy of no group is there at all only while its reach on the screen is over SYSTEM_GONE_PX.
    const found = cellCandidates(index.field, cameraPc, cssPerRadian / SYSTEM_GONE_PX, this.cells);
    const [cx, cy, cz] = cameraPc;
    for (let i = 0; i < found; i += 1) {
      const k = this.cells[i]!;
      if (k === focusIndex) continue;
      const d = Math.hypot(records[k * stride]! - cx, records[k * stride + 1]! - cy, records[k * stride + 2]! - cz);
      put(k, systemStrength((reachPc[k]! / d) * cssPerRadian));
    }
  }

  /**
   * The marks the declutter must look at this frame, ascending (Laniakea's declutter order is
   * the records'): those not 0 this frame, the `bodies`, and those it left shown or not kept.
   */
  candidates(bodies: readonly number[]): MarkCandidates {
    const { picked, seen, live, dirty } = this;
    picked.count = 0;
    const add = (k: number): void => {
      if (seen[k] === 1) return;
      seen[k] = 1;
      picked.list[picked.count++] = k;
    };
    for (let i = 0; i < live.count; i += 1) add(live.list[i]!);
    for (let i = 0; i < dirty.count; i += 1) add(dirty.list[i]!);
    for (const k of bodies) add(k);
    const used = picked.list.subarray(0, picked.count);
    used.sort();
    for (let i = 0; i < picked.count; i += 1) seen[picked.list[i]!] = 0;
    return picked;
  }

  /** After the declutter: of the marks it looked at, those it left shown or not kept. */
  settle(shown: ArrayLike<number>, kept: Uint8Array): void {
    const { picked, dirty } = this;
    dirty.count = 0;
    for (let i = 0; i < picked.count; i += 1) {
      const k = picked.list[i]!;
      if (shown[k] !== 0 || kept[k] === 0) dirty.list[dirty.count++] = k;
    }
  }
}
