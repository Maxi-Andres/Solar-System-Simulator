/**
 * How a fictional object is drawn (Phase F): our own procedural looks, made from what its
 * canon says about it -- never a franchise's model, texture or artwork.
 *
 * The data (core/fiction*.ts) says *what* an object looks like with a FictionLook; the scene
 * (scene/fiction/fictionLooks.ts) turns it into a material or a mesh. Kept apart so the
 * data can be tested without three.js and the looks without the data.
 */

/** The kinds of world surface drawn procedurally, each from what its canon describes. */
export type WorldPalette =
  /** Lush, blue-green, under broken cloud (Pandora). */
  | 'jungle-moon'
  /** A banded gas giant; `tint` sets its hue (Polyphemus). */
  | 'banded-giant'
  /** Sand seas and rock, small polar caps (Arrakis). */
  | 'desert'
  /** Red-ochre, dry, mountainous (Vulcan). */
  | 'arid'
  /** Under a thick, hazy atmosphere: no surface seen (Erid, Adrian). */
  | 'dense-haze'
  /** Dark rock under storms (LV-426). */
  | 'storm-rock'
  /** Seared and frozen in turn (Trisolaris). */
  | 'scorched'
  /** Oceans, land and cloud, Earth-like (Soror). */
  | 'temperate'
  /** Crystalline, glinting (Krypton). */
  | 'crystal'
  /** Airless rock, cratered, grey to ochre: a small moon (Polyphemus' other moons). */
  | 'barren'
  /** Airless ice, bright, cracked: an icy moon (Polyphemus' other moons). */
  | 'icy';

export type FictionLook =
  | {
      readonly kind: 'world';
      readonly palette: WorldPalette;
      /** Fixes the procedural pattern: the same world looks the same every time. */
      readonly seed: number;
      /** A hue to lean the palette towards, linear RGB 0..1. */
      readonly tint?: readonly [number, number, number];
      /** Cloud cover, 0..1; none when absent. */
      readonly clouds?: number;
      /** Rings, their inner and outer radii in the world's radii. */
      readonly rings?: { readonly inner: number; readonly outer: number };
    }
  /** A black slab in the proportions 1 : 4 : 9 (2001's monoliths). Longest edge 1. */
  | { readonly kind: 'monolith' }
  /** A closed cylinder, length over diameter as given (Rama). Length 1. */
  | { readonly kind: 'cylinder'; readonly lengthOverDiameter: number }
  /** A sphere that shows the sky behind it bent, as a wormhole's mouth would. Radius 1. */
  | { readonly kind: 'wormhole' }
  /**
   * A ship, our own design from what its canon describes. Length 1 along local +z (+z the bow,
   * the direction it accelerates), centred on its centre of mass.
   */
  | { readonly kind: 'ship'; readonly design: 'hail-mary' };
