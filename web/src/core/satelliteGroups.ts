import type { SatelliteGroup } from '@sss/tools/types';

/**
 * The Satellites layer's chips: CelesTrak's groups as a person names them.
 *
 * The data carries fifteen groups, overlapping -- the ISS is in `active`, `stations` and
 * `visual` at once; a GOES is `weather` and `geo` -- and a filter wants each satellite in
 * exactly one place, so it can be switched off by one chip and counted once. So each goes
 * to the first chip below that claims it: what it is for before where it is, the
 * stations first because they are what people look for, debris before the rest because a
 * fragment of Fengyun 1C is debris whatever else is said of it.
 *
 * The order is the panel's and the bit order of the stored choice: a new chip goes at the
 * end, after Other, so a stored choice keeps meaning what it meant.
 */
export interface SatelliteChip {
  readonly id: string;
  readonly label: string;
  /** The CelesTrak groups that put a satellite here. */
  readonly groups: readonly SatelliteGroup[];
  /** Also every object of these SATCAT types, whatever its group. */
  readonly objectTypes?: readonly number[];
  /** What the chip's title says it holds. */
  readonly description: string;
}

/** Index of 'DEB' in SATELLITE_OBJECT_TYPES. */
const DEBRIS_TYPE = 2;

export const SATELLITE_CHIPS: readonly SatelliteChip[] = [
  { id: 'stations', label: 'Stations', groups: ['stations'], description: 'Space stations and what is docked to them' },
  { id: 'science', label: 'Science', groups: ['science', 'resource'], description: 'Space science and Earth observation' },
  { id: 'weather', label: 'Weather', groups: ['weather'], description: 'Weather satellites' },
  { id: 'gnss', label: 'GNSS', groups: ['gnss'], description: 'Navigation: GPS, GLONASS, Galileo, BeiDou, QZSS, NavIC' },
  { id: 'geo', label: 'GEO', groups: ['geo', 'tdrss'], description: 'Other active geosynchronous satellites, TDRS among them' },
  { id: 'starlink', label: 'Starlink', groups: ['starlink'], description: "SpaceX's Starlink" },
  {
    id: 'debris',
    label: 'Debris',
    groups: ['fengyun-1c-debris', 'iridium-33-debris', 'cosmos-2251-debris'],
    objectTypes: [DEBRIS_TYPE],
    description: 'Fragments: the Fengyun 1C test of 2007 and the Iridium 33 / Cosmos 2251 collision of 2009',
  },
  { id: 'other', label: 'Other', groups: [], description: 'Every other payload, OneWeb and Kuiper among them, and rocket bodies' },
];

/** The chip of last resort: Other's index. */
export const OTHER_CHIP = 7;

/** Every chip shown: the default, as a bit mask over SATELLITE_CHIPS. */
export const ALL_SATELLITE_CHIPS = (1 << SATELLITE_CHIPS.length) - 1;

/**
 * The order chips claim a satellite in, by index into SATELLITE_CHIPS: stations, then
 * debris, then what a satellite is for. Not the panel's order -- a GOES is weather, not
 * GEO, and a Starlink is not "other" because it is also `active`.
 */
const CLAIM_ORDER: readonly number[] = [0, 6, 5, 3, 2, 1, 4];

/** Bits 0..15 of a record's flags: its CelesTrak groups. */
export const GROUP_MASK = 0xffff;

/**
 * The chip a satellite is drawn and counted under, from its packed flags (see
 * SATELLITE_RECORD_FLOATS) and the group names in the data's bit order.
 */
export function chipOfFlags(flags: number, groups: readonly SatelliteGroup[], typeShift: number): number {
  const mask = flags & GROUP_MASK;
  const objectType = (flags >>> typeShift) & 3;
  for (const index of CLAIM_ORDER) {
    const chip = SATELLITE_CHIPS[index]!;
    if (chip.objectTypes?.includes(objectType) === true) {
      return index;
    }
    for (const group of chip.groups) {
      const bit = groups.indexOf(group);
      if (bit >= 0 && (mask & (1 << bit)) !== 0) {
        return index;
      }
    }
  }
  return OTHER_CHIP;
}

/** True when chip `index` is shown in `mask`. */
export function chipShown(mask: number, index: number): boolean {
  return (mask & (1 << index)) !== 0;
}

/** `mask` with chip `index` switched. */
export function toggledChip(mask: number, index: number): number {
  return mask ^ (1 << index);
}

/**
 * A chip among the visible kinds: what lets a named satellite -- a body, shown or hidden by
 * its kind like any other -- follow its chip as the dots do. See isShown.
 */
export function satelliteChipLayer(index: number): string {
  return `satellite-chip-${index}`;
}

/**
 * What every satellite body carries beyond its definition, registered as it is added (see
 * satelliteBodies.ts): its chip, and the identifiers search shows. Here rather than there,
 * so search and isShown can read it without importing SGP4.
 */
export interface SatelliteBodyTag {
  readonly chip: number;
  /** Who flies it, or null for a bulk object, whose operator the data does not say. */
  readonly operator: string | null;
  readonly noradId: number;
  readonly cosparId: string;
  /**
   * The catalogue's own name where the shown one differs: "ISS (ZARYA)" for the
   * International Space Station, "HST" for Hubble. What people type is often this one.
   */
  readonly catalogueName?: string;
}

const tags = new Map<string, SatelliteBodyTag>();

export function tagSatelliteBody(id: string, tag: SatelliteBodyTag): void {
  tags.set(id, tag);
}

export function untagSatelliteBody(id: string): void {
  tags.delete(id);
}

export function satelliteBodyTag(id: string): SatelliteBodyTag | null {
  return tags.get(id) ?? null;
}

/** The chip of a satellite body, or OTHER_CHIP for one not registered. */
export function satelliteBodyChip(id: string): number {
  return tags.get(id)?.chip ?? OTHER_CHIP;
}
