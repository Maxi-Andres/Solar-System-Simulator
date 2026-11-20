import type { LaniakeaInfo } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { DEFAULT_LAYER_STATE, LAYER_GROUPS, LAYERS } from '../state/store.ts';
import {
  ALL_BASIN_CHIPS,
  BASIN_CHIPS,
  basinChipShown,
  basinOutlines,
  DEFAULT_BASIN_CHIPS,
  LANIAKEA_BASIN_CHIP,
  OTHER_BASIN_CHIP,
  outlineOfStructure,
  toggledBasinChip,
} from './basinChips.ts';

type Basin = LaniakeaInfo['basins']['basins'][number];

const basin = (name: string, grid: Basin['grid'], label: number, extra: Partial<Basin> = {}): Basin => ({
  name,
  kind: grid === 'galaxiesRepulsion' ? 'repulsion' : 'attraction',
  grid,
  label,
  voxels: 1000,
  volumeMpc3: 1e6,
  paperVolumeMpcH3: 1e6,
  ...extra,
});

/** Table A.1's basins as laniakea.json lists them, a repeller, and one basin more the table does not name. */
const INFO = {
  basins: {
    home: { galaxiesAttraction: 1, galaxiesRepulsion: 0, groupsAttraction: 4 },
    basins: [
      basin('Laniakea', 'galaxiesAttraction', 1, { landmark: 'Laniakea Supercluster' }),
      basin('Apus', 'galaxiesAttraction', 2, { landmark: 'Apus basin' }),
      basin('Hercules', 'galaxiesAttraction', 3, { landmark: 'Hercules basin' }),
      basin('Hercules', 'groupsAttraction', 1, { landmark: 'Hercules basin' }),
      basin('Lepus', 'galaxiesAttraction', 4, { landmark: 'Lepus basin' }),
      basin('Perseus-Pisces', 'galaxiesAttraction', 5, { landmark: 'Perseus-Pisces basin' }),
      basin('Shapley', 'galaxiesAttraction', 6, { landmark: 'Shapley basin' }),
      basin('Shapley', 'groupsAttraction', 4, { landmark: 'Shapley basin' }),
      basin('Sculptor Void', 'galaxiesRepulsion', 1),
      basin('Basin near Coma Cluster', 'galaxiesAttraction', 14, { paperVolumeMpcH3: null, landmark: 'Basin near Coma Cluster' }),
    ],
  },
} as unknown as Pick<LaniakeaInfo, 'basins'>;

describe('the Basins of Attraction layer', () => {
  it('is one switch among the models, off at first: computed, not seen', () => {
    expect(LAYERS.find((l) => l.id === 'basins')?.label).toBe('Basins of Attraction');
    expect(LAYER_GROUPS.find((g) => g.id === 'models')?.layers).toContain('basins');
    expect(DEFAULT_LAYER_STATE.basins).toBe(false);
    // The two layers it folds in are gone.
    expect(LAYERS.map((l) => l.id as string)).not.toContain('laniakeaBasin');
    expect(LAYERS.map((l) => l.id as string)).not.toContain('shapleyBasin');
  });

  it('outlines every basin of the galaxies\' reconstruction, and of the groups\' only the one it puts us in', () => {
    const outlines = basinOutlines(INFO);
    expect(outlines.map((o) => o.key)).toEqual([
      'galaxiesAttraction:1',
      'galaxiesAttraction:2',
      'galaxiesAttraction:3',
      'galaxiesAttraction:4',
      'galaxiesAttraction:5',
      'galaxiesAttraction:6',
      'groupsAttraction:4',
      'galaxiesAttraction:14',
    ]);
    expect(outlines[0]).toMatchObject({ name: 'Laniakea', landmark: 'Laniakea Supercluster', chip: LANIAKEA_BASIN_CHIP, color: '#e8b45a' });
    expect(outlines[5]).toMatchObject({ name: 'Shapley', color: '#6fa8d8' });
    expect(outlines[7]).toMatchObject({ landmark: 'Basin near Coma Cluster', chip: OTHER_BASIN_CHIP });
    // Each named chip its own hue.
    expect(new Set(BASIN_CHIPS.map((c) => c.color)).size).toBe(BASIN_CHIPS.length);
  });

  it('names a structure where an older catalogue does not', () => {
    const old = {
      basins: { ...INFO.basins, basins: INFO.basins.basins.map(({ landmark: _landmark, ...rest }) => rest) },
    } as unknown as Pick<LaniakeaInfo, 'basins'>;
    expect(basinOutlines(old).map((o) => o.landmark).slice(0, 2)).toEqual(['Laniakea Supercluster', 'Apus basin']);
  });

  it('starts with every chip on but the groups\' Shapley, and toggles one at a time', () => {
    const groups = BASIN_CHIPS.findIndex((c) => c.id === 'shapley-groups');
    expect(basinChipShown(DEFAULT_BASIN_CHIPS, groups)).toBe(false);
    for (let i = 0; i <= OTHER_BASIN_CHIP; i += 1) if (i !== groups) expect(basinChipShown(DEFAULT_BASIN_CHIPS, i), String(i)).toBe(true);
    expect(toggledBasinChip(DEFAULT_BASIN_CHIPS, groups)).toBe(ALL_BASIN_CHIPS);
    expect(basinChipShown(toggledBasinChip(DEFAULT_BASIN_CHIPS, LANIAKEA_BASIN_CHIP), LANIAKEA_BASIN_CHIP)).toBe(false);
  });

  it('finds the outline drawn for a structure, the galaxies\' reconstruction\'s', () => {
    expect(outlineOfStructure(INFO, 'Shapley basin')?.grid).toBe('galaxiesAttraction');
    expect(outlineOfStructure(INFO, 'Sculptor Void repeller')).toBeNull();
  });
});
