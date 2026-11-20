import type { LaniakeaBasinGrid, LaniakeaInfo } from '@sss/tools/types';

/**
 * The Basins of Attraction layer's chips (LayersPanel.tsx BasinChips): one a basin, each
 * switching its outline -- the shape Dupuy & Courtois 2023 drew from the Cosmicflows-4
 * velocity field's watersheds -- in its own faint hue.
 *
 * Every basin of attraction of the galaxies' reconstruction the catalogue draws (laniakea.json
 * basins.basins: Table A.1's six, and any more its build kept), and, from the groups'
 * reconstruction, the basin it puts the Milky Way in: Shapley's, which there takes Laniakea in
 * -- the other answer to where we live, off until asked for, as the two are not drawn as one
 * truth. The groups' other basins (Hercules, Lepus, Perseus-Pisces) are smaller versions of the
 * galaxies' and are not drawn a second time.
 *
 * A chip is a bit of the view store's basinChips, kept between visits as the satellites' chips
 * are: the chips are a fixed list, so a bit always means the same basin, and any basin the list
 * does not name shares the last bit, OTHER_BASIN_CHIP.
 */

export interface BasinChip {
  readonly id: string;
  readonly label: string;
  /** Its grid and its name there (laniakea.json basins.basins). */
  readonly grid: LaniakeaBasinGrid;
  readonly name: string;
  /** Its outline's hue: Laniakea's map gold, Shapley's blue; the rest apart from both and from each other. */
  readonly color: string;
  readonly description: string;
}

export const BASIN_CHIPS: readonly BasinChip[] = [
  { id: 'laniakea', label: 'Laniakea', grid: 'galaxiesAttraction', name: 'Laniakea', color: '#e8b45a', description: 'Ours, from the CF4 galaxies’ reconstruction.' },
  { id: 'apus', label: 'Apus', grid: 'galaxiesAttraction', name: 'Apus', color: '#b58ad6', description: 'Beyond Laniakea, deep in the southern sky.' },
  { id: 'hercules', label: 'Hercules', grid: 'galaxiesAttraction', name: 'Hercules', color: '#7cc596', description: 'Toward the Hercules Supercluster.' },
  { id: 'lepus', label: 'Lepus', grid: 'galaxiesAttraction', name: 'Lepus', color: '#dc8a80', description: 'South of the Milky Way’s plane, beyond Laniakea.' },
  { id: 'perseus-pisces', label: 'Perseus–Pisces', grid: 'galaxiesAttraction', name: 'Perseus-Pisces', color: '#5ec2bb', description: 'Our nearest neighbour basin, across the Local Void.' },
  { id: 'shapley', label: 'Shapley', grid: 'galaxiesAttraction', name: 'Shapley', color: '#6fa8d8', description: 'The Shapley Supercluster’s, from the CF4 galaxies.' },
  {
    id: 'shapley-groups',
    label: 'Shapley, groups',
    grid: 'groupsAttraction',
    name: 'Shapley',
    color: '#8f9ff0',
    description: 'The other answer: from the CF4 groups, Laniakea is part of Shapley’s basin.',
  },
];

/** The chip any basin the list does not name is under. */
export const OTHER_BASIN_CHIP = BASIN_CHIPS.length;
export const OTHER_BASIN_COLOR = '#a3a3a3';
export const ALL_BASIN_CHIPS = (1 << (BASIN_CHIPS.length + 1)) - 1;

/** On at first: all but the groups' Shapley, which overlaps the galaxies' six and is the other answer. */
export const DEFAULT_BASIN_CHIPS = ALL_BASIN_CHIPS & ~(1 << BASIN_CHIPS.findIndex((c) => c.id === 'shapley-groups'));

/** The chips' bit for Laniakea: show me turns it on with the layer. */
export const LANIAKEA_BASIN_CHIP = 0;

/** A basin drawn: its grid and number, its name, its structure's name, its chip and its hue. */
export interface BasinOutline {
  /** "galaxiesAttraction:1". */
  readonly key: string;
  readonly grid: LaniakeaBasinGrid;
  readonly label: number;
  readonly name: string;
  /** Its structure body's name (laniakea.json landmarks). */
  readonly landmark: string;
  readonly chip: number;
  readonly color: string;
}

/** Its structure's name where an older catalogue does not say it: as landmarks.ts basinLandmarkName. */
function landmarkName(name: string): string {
  return name === 'Laniakea' ? 'Laniakea Supercluster' : `${name} basin`;
}

/** The basins the layer draws, in the chips' order, the ones the list does not name last. */
export function basinOutlines(info: Pick<LaniakeaInfo, 'basins'>): BasinOutline[] {
  const groupsHome = info.basins.home.groupsAttraction;
  const outlines = info.basins.basins
    .filter((b) => b.kind === 'attraction' && (b.grid === 'galaxiesAttraction' || (b.grid === 'groupsAttraction' && b.label === groupsHome && groupsHome > 0)))
    .map((b) => {
      const found = BASIN_CHIPS.findIndex((c) => c.grid === b.grid && c.name === b.name);
      const chip = found < 0 ? OTHER_BASIN_CHIP : found;
      return {
        key: `${b.grid}:${b.label}`,
        grid: b.grid,
        label: b.label,
        name: b.name,
        landmark: b.landmark ?? landmarkName(b.name),
        chip,
        color: found < 0 ? OTHER_BASIN_COLOR : BASIN_CHIPS[found]!.color,
      };
    });
  return outlines.sort((a, b) => a.chip - b.chip || a.label - b.label);
}

/** True when chip `index` is on in `mask`. */
export function basinChipShown(mask: number, index: number): boolean {
  return (mask & (1 << index)) !== 0;
}

/** `mask` with chip `index` switched. */
export function toggledBasinChip(mask: number, index: number): number {
  return mask ^ (1 << index);
}

/** The outline drawn for a structure, by its name: its basin's; null for one with none drawn. */
export function outlineOfStructure(info: Pick<LaniakeaInfo, 'basins'>, structureName: string): BasinOutline | null {
  return basinOutlines(info).find((o) => o.landmark === structureName && o.grid === 'galaxiesAttraction') ?? null;
}
