import type { CraftShape } from '@sss/tools/types';

/**
 * A craft's pointing rule, in words, for the info panel's "Facing (modelled)" line: the
 * craft's and the Earth satellites' alike. See CraftShape.
 *
 * An Earth satellite in LVLH says both of its axes, since both are the rule: what is on
 * Earth, and that it flies along its track.
 */
export function facingRule(shape: CraftShape): string {
  if (shape.pointsAt === 'nadir') {
    return shape.pointingPart === 'body-axes'
      ? 'LVLH: +Z to Earth, +X along track'
      : `${partName(shape)} to Earth, along track (LVLH)`;
  }
  const target = {
    earth: 'Earth',
    sun: 'Sun',
    'ecliptic-south': 'ecliptic south',
    zenith: 'zenith',
  }[shape.pointsAt];
  return `${partName(shape)} to ${target}`;
}

function partName(shape: CraftShape): string {
  return {
    dish: 'Dish',
    'heat-shield': 'Heat shield',
    sunshield: 'Sunshield',
    'solar-arrays': 'Solar arrays',
    'spin-axis': 'Spin axis',
    deck: 'Deck',
    instruments: 'Instruments',
    antennas: 'Antennas',
    'body-axes': 'Body axes',
  }[shape.pointingPart];
}
