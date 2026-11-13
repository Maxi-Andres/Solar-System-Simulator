import { MILKY_WAY_FOLD_PX } from './homeName.ts';
import { SATELLITE_HIDDEN_PX, SATELLITE_SHOWN_PX } from './scale.ts';

/**
 * Marks that fold into the mark of what they belong to, as a moon's does into its planet's.
 *
 * Zoomed out past the Local Group, the Milky Way's hundred and sixty globular clusters were a
 * heap of rings on the Milky Way, and the Local Group's dwarfs a heap round Andromeda: each
 * catalogue faded its marks by the camera's distance and never by how small its system had
 * become on the screen. Now every mark has a host -- a globular cluster, a pulsar, a remnant,
 * a black hole the Milky Way; a satellite its giant; a galaxy of another group that group's
 * brightest -- and folds into its host's mark as the two come together on the screen. A
 * system far away is one mark with one name; nearer, it opens into its members.
 *
 * ## The rule
 *
 * By the **apparent separation**: the member's distance from its host in space, seen from
 * where the camera is -- the moons' rule (scale.ts satelliteOpacity), which reads a moon's
 * orbit and not where on it the moon is, so that Io does not vanish each time it crosses
 * Jupiter. The same here: a cluster in front of the bulge is not folded while the galaxy fills
 * the screen, nor does it come and go as the camera turns round, and it costs no projection --
 * one multiplication a mark, which matters for tens of thousands of galaxies.
 *
 * Gone at FOLD_GONE_PX, full at FOLD_FULL_PX: the moons' twelve and twenty-four pixels. Twelve
 * is a mark's own size and a pixel more -- the marks are eleven to fifteen pixels across, rings
 * of four to six pixels' radius -- so below it the member's ring lies on its host's, two marks
 * that read as one smudge. A smoothstep between, so the fade has no corner.
 *
 * The fade is continuous in the camera's position, so the mark itself never flickers. Where a
 * yes or no is taken from it -- a name shown, a mark that can be clicked -- it is taken with
 * hysteresis (`foldedShown`): shown from FOLD_SHOWN_FROM, kept down to FOLD_KEPT_TO.
 *
 * ## Hosts of hosts
 *
 * A host has a host of its own -- Andromeda's is the Local Group's, whose mark is the Milky
 * Way's -- and a member is never more there than its host: its strength is the least of its own
 * and its host's, so a system folded away takes its members with it.
 *
 * The focused body and every host above it are never folded (`pinned`): looking at a cluster,
 * its mark stays however far out the camera goes, and so does the Milky Way's.
 *
 * ## A system small on the screen
 *
 * The separation alone left the Local Group a cloud of rings from the Local Volume's view: its
 * free members lie a megaparsec and more from the Milky Way, still tens of pixels from its mark,
 * while the Local Group's name had already taken their names into its own (homeName.ts). So a
 * host may also have a reach -- the Local Group's megaparsec, Andromeda's satellites' 300 kpc --
 * and its members fold as that reach shrinks on the screen from SYSTEM_FULL_PX to
 * SYSTEM_GONE_PX: whole down to the size at which homeName folds the names, gone at half of it.
 * A host with no reach given is folded by separation alone.
 *
 * ## A host that is a place only when near
 *
 * Laniakea's ten thousand groups (G3) are each a host, its brightest galaxy's mark, and at the
 * top of nothing: folded by separation alone, every one of them was a mark from anywhere, a
 * wall of rings over the map. So a host may also be **present** only while its system is
 * large on the screen: its own mark, and with it its members', drawn as its presence radius
 * grows from SYSTEM_GONE_PX to SYSTEM_FULL_PX -- a group far off is its light alone, and comes
 * in as a place, its mark and its galaxies' at once, as the camera comes near.
 */

/** The member's mark is gone with its apparent separation from its host this small, CSS pixels. */
export const FOLD_GONE_PX = SATELLITE_HIDDEN_PX;
/** And whole from this one. */
export const FOLD_FULL_PX = SATELLITE_SHOWN_PX;
/** A name, or a click, needs this much of its mark to appear, and goes below FOLD_KEPT_TO. */
export const FOLD_SHOWN_FROM = 0.65;
export const FOLD_KEPT_TO = 0.35;

/** A host's members are whole while its reach is this many CSS pixels on the screen (homeName.ts MILKY_WAY_FOLD_PX)... */
export const SYSTEM_FULL_PX = MILKY_WAY_FOLD_PX;
/** ...and gone at this. */
export const SYSTEM_GONE_PX = MILKY_WAY_FOLD_PX / 2;

function smoothstep(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

/** How much of a member's mark is drawn, 1 to 0, from its apparent separation from its host, pixels. */
export function foldStrength(separationPx: number): number {
  return smoothstep((separationPx - FOLD_GONE_PX) / (FOLD_FULL_PX - FOLD_GONE_PX));
}

/** How much of its members' marks a host lets be drawn, 1 to 0, from its reach on the screen, pixels. */
export function systemStrength(reachPx: number): number {
  return smoothstep((reachPx - SYSTEM_GONE_PX) / (SYSTEM_FULL_PX - SYSTEM_GONE_PX));
}

/** Whether what hangs on a mark -- its name, its click -- is there: with hysteresis, see the header. */
export function foldedShown(strength: number, wasShown: boolean): boolean {
  return strength >= (wasShown ? FOLD_KEPT_TO : FOLD_SHOWN_FROM);
}

/** A mark's host and its distance from it, parsecs; host -1 for one that folds into nothing. */
export interface FoldOf {
  readonly host: number;
  readonly separationPc: number;
}

export const UNFOLDED: FoldOf = { host: -1, separationPc: Infinity };

/**
 * The hosts: each a place with a mark (the Milky Way's centre, Andromeda, a group's brightest
 * galaxy), its host above it, and this frame's numbers. Added parents first, so one pass in
 * order works the strengths out from the top down.
 *
 * Positions are parsecs about the Sun, scene axes, as every catalogue here keeps them.
 */
export class FoldHosts {
  readonly keys: string[] = [];
  private readonly index = new Map<string, number>();
  private readonly x: number[] = [];
  private readonly y: number[] = [];
  private readonly z: number[] = [];
  private readonly parent: number[] = [];
  private readonly separation: number[] = [];
  /** The reach of its system, parsecs (see the header); Infinity for none. */
  private readonly reach: number[] = [];
  /** The radius its own mark needs on the screen to be there, parsecs (see the header); 0 for always. */
  private readonly presence: number[] = [];
  /** This frame's: pixels per parsec at the host's distance, how much of its mark is drawn, and how much it lets its members' be. */
  scale = new Float64Array(0);
  strength = new Float64Array(0);
  system = new Float64Array(0);
  private pinned = new Uint8Array(0);

  get count(): number {
    return this.keys.length;
  }

  indexOf(key: string): number {
    return this.index.get(key) ?? -1;
  }

  /**
   * Adds a host, if it is not there yet, and returns its index. Its own host must be there
   * first. `presencePc`: present only while that radius is large on the screen (see the header).
   */
  add(
    key: string,
    positionPc: readonly [number, number, number],
    parentKey: string | null,
    reachPc = Infinity,
    presencePc = 0,
  ): number {
    const known = this.index.get(key);
    if (known !== undefined) {
      return known;
    }
    const parent = parentKey === null ? -1 : this.indexOf(parentKey);
    if (parentKey !== null && parent < 0) {
      throw new Error(`The host ${key}'s own host, ${parentKey}, is not known yet.`);
    }
    const i = this.keys.length;
    this.keys.push(key);
    this.index.set(key, i);
    this.x.push(positionPc[0]);
    this.y.push(positionPc[1]);
    this.z.push(positionPc[2]);
    this.parent.push(parent);
    this.separation.push(parent < 0 ? Infinity : this.distancePc(parent, positionPc));
    this.reach.push(reachPc);
    this.presence.push(presencePc);
    return i;
  }

  /** A host's place in the hierarchy: its own host and its distance from it. */
  foldOf(host: number): FoldOf {
    return { host: this.parent[host] ?? -1, separationPc: this.separation[host] ?? Infinity };
  }

  /** The distance of a point from a host, parsecs. */
  distancePc(host: number, positionPc: readonly [number, number, number]): number {
    return Math.hypot(positionPc[0] - this.x[host]!, positionPc[1] - this.y[host]!, positionPc[2] - this.z[host]!);
  }

  /** The host and every host above it. */
  chain(host: number): number[] {
    const out: number[] = [];
    for (let h = host; h >= 0; h = this.parent[h]!) {
      out.push(h);
    }
    return out;
  }

  /**
   * This frame's numbers, from where the camera is (parsecs about the Sun) and the view's
   * pixels per radian, CSS pixels. `pinned`: the hosts never folded (see the header).
   */
  update(cameraPc: readonly [number, number, number], pixelsPerRadian: number, pinned: readonly number[]): void {
    const n = this.keys.length;
    if (this.scale.length !== n) {
      this.scale = new Float64Array(n);
      this.strength = new Float64Array(n);
      this.system = new Float64Array(n);
      this.pinned = new Uint8Array(n);
    }
    this.pinned.fill(0);
    for (const h of pinned) {
      if (h >= 0 && h < n) this.pinned[h] = 1;
    }
    for (let h = 0; h < n; h += 1) {
      const d = Math.hypot(cameraPc[0] - this.x[h]!, cameraPc[1] - this.y[h]!, cameraPc[2] - this.z[h]!);
      this.scale[h] = d > 0 ? pixelsPerRadian / d : Infinity;
      const reach = this.reach[h]!;
      this.system[h] = Number.isFinite(reach) ? systemStrength(reach * this.scale[h]!) : 1;
      const p = this.parent[h]!;
      // A host where its own host is -- the Milky Way inside the Local Group whose mark is its
      // own -- is that mark: as much there as it is.
      const own =
        this.pinned[h] === 1 || p < 0 ? 1 : this.separation[h] === 0 ? this.strength[p]! : this.member(p, this.separation[h]!);
      const presence = this.presence[h]!;
      this.strength[h] = presence > 0 && this.pinned[h] === 0 ? Math.min(own, systemStrength(presence * this.scale[h]!)) : own;
    }
  }

  /** How much of a mark is drawn that is `separationPc` from host `host` (-1: none, always whole). */
  member(host: number, separationPc: number): number {
    if (host < 0 || host >= this.strength.length) {
      return 1;
    }
    return Math.min(foldStrength(separationPc * this.scale[host]!), this.strength[host]!, this.system[host]!);
  }
}

/**
 * Every mark of a catalogue at once, into `out`: mark k is `separationPc[k]` from host
 * `host[k]`, and `pinned` (-1 none) is the focused one. Returns whether anything changed by more
 * than a step a screen can show -- or reached 0 or 1, so a mark is gone or whole exactly -- so an
 * unchanged buffer is not sent to the GPU again.
 */
export function foldMembers(
  hosts: FoldHosts,
  host: Int32Array,
  separationPc: Float32Array,
  out: Float32Array,
  pinned: number,
): boolean {
  let changed = false;
  for (let k = 0; k < out.length; k += 1) {
    const value = k === pinned ? 1 : hosts.member(host[k]!, separationPc[k]!);
    if (value !== out[k] && (Math.abs(value - out[k]!) > 1 / 512 || value === 0 || value === 1)) {
      out[k] = value;
      changed = true;
    }
  }
  return changed;
}
