import type { Description } from '../types.ts';
import { APOLLO_11 } from './apollo11.ts';
import { APOLLO_12 } from './apollo12.ts';
import { APOLLO_14 } from './apollo14.ts';
import { APOLLO_15 } from './apollo15.ts';
import { APOLLO_16 } from './apollo16.ts';
import { APOLLO_17 } from './apollo17.ts';
import { CHANGE_3, CHANGE_4, CHANGE_5, CHANGE_6 } from './change.ts';
import { LUNOKHOD_1, LUNOKHOD_2 } from './lunokhod.ts';
import { BLUE_GHOST_1, CHANDRAYAAN_3, SLIM } from './recent.ts';
import { SURVEYOR_1 } from './surveyor1.ts';

/** The Moon's landing sites with descriptions (core/landingSites.ts), in landing order. */
export const MOON_SITES: readonly Description[] = [
  SURVEYOR_1,
  APOLLO_11,
  APOLLO_12,
  LUNOKHOD_1,
  APOLLO_14,
  APOLLO_15,
  APOLLO_16,
  APOLLO_17,
  LUNOKHOD_2,
  CHANGE_3,
  CHANGE_4,
  CHANGE_5,
  CHANDRAYAAN_3,
  SLIM,
  CHANGE_6,
  BLUE_GHOST_1,
];
