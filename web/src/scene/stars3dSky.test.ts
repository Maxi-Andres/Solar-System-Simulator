import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StarCatalog, Stars3dInfo } from '@sss/tools/types';
import { expect, it } from 'vitest';

import { describeWithData as withData } from '../core/describeWithData.ts';
import { brightestMagnitude, parseStarCatalog } from '../core/starCatalog.ts';
import { parseStars3dInfo, STAR3D, STAR3D_FLOATS } from '../core/stars3d.ts';
import { FOV_DEG } from './scale.ts';
import { buildStarAttributes, skyDirection } from './starGeometry.ts';
import { magnitudeToPeakCoefficients, peakDisplayValue } from './starRendering.ts';
import { LIMIT_SLACK, star3dPeak, starSeenFrom } from './stars3dShader.ts';

/**
 * The equivalence D2 promises, on the shipped data: **seen from the Sun, the 3D stars are
 * the sky.** Every star.json row that a 3D record names is rendered both ways -- by the
 * sky's vertex shader at infinity (skyDirection, its lines in float64) and by the 3D one
 * from the Sun (starSeenFrom, its lines in float32) -- and the two must land within a
 * pixel and at the same brightness to within a code value. And a 3D star the sky does not
 * hold must be fainter than the sky's limit from the Sun -- with exactly the exceptions the
 * data publishes, `counts.gaiaOnlyBrighterThanSkyLimit`: real stars Hipparcos and Tycho-2
 * missed, mostly companions Hipparcos resolved but listed under their primary's number.
 * They are the one place the sky at home changes, and it changes toward the truth: Mizar
 * B, V 3.9, now shines beside Mizar, where the old sky had nothing.
 *
 * Skipped when the data has not been generated, like the other data tests.
 */

const DATA = join(import.meta.dirname, '../../public/data');

async function tryLoad(): Promise<{
  sky: StarCatalog;
  info: Stars3dInfo;
  tiers: Float32Array[];
} | null> {
  try {
    const sky = parseStarCatalog(JSON.parse(await readFile(join(DATA, 'stars.json'), 'utf8')) as unknown);
    const info = parseStars3dInfo(
      JSON.parse(await readFile(join(DATA, 'stars3d/stars3d.json'), 'utf8')) as unknown,
      sky.count,
    );
    const tiers = await Promise.all(
      info.tiers.map(async (tier) => {
        const bytes = await readFile(join(DATA, 'stars3d', tier.file));
        return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      }),
    );
    return { sky, info, tiers };
  } catch {
    return null;
  }
}

const data = await tryLoad();
const describeWithData = withData(data !== null);

/** Pixels per radian in a 910-pixel frame. */
const PX_PER_RAD = 910 / (2 * Math.tan(((FOV_DEG / 2) * Math.PI) / 180));
/** 2026-10-22, in Julian years from J2000. */
const YEARS = (2_461_335.5 - 2_451_545) / 365.25;

describeWithData('the 3D stars against the sky, from the Sun', () => {
  const { sky, info, tiers } = data!;
  const attributes = buildStarAttributes(sky);
  const coefficients = magnitudeToPeakCoefficients(brightestMagnitude(sky), sky.magnitudeLimit);

  // Every record, measured once.
  let placed = 0;
  let worstPx = 0;
  let worstCode = 0;
  let worstRow = '';
  /** Stars the sky does not hold that the renderer still draws from the Sun. */
  const added: string[] = [];
  const seenRows = new Set<number>();
  tiers.forEach((records, tierIndex) => {
    const count = records.length / STAR3D_FLOATS;
    for (let i = 0; i < count; i += 1) {
      const row = records[i * STAR3D_FLOATS + STAR3D.sky]!;
      const seen = starSeenFrom(records, i, { x: 0, y: 0, z: 0 }, YEARS);
      if (row < 0) {
        if (seen.magnitude <= sky.magnitudeLimit + LIMIT_SLACK) {
          added.push(`tier ${tierIndex} record ${i}, V ${seen.magnitude.toFixed(2)} at ${seen.distancePc.toFixed(1)} pc`);
        }
        continue;
      }
      placed += 1;
      seenRows.add(row);
      const direction = skyDirection(attributes, row, YEARS);
      // The angle by atan2 of the cross and dot products, against the float32 vector
      // normalised in float64. Not acos of a cosine divided by the shader's own float32
      // length: that length is rounded by up to 2^-24 of itself, and acos turns a cosine
      // 1.2e-7 short of 1 into 4.9e-4 rad -- an apparent 0.9 px error that was the
      // measurement's, found on Deneb, which the render does not have.
      const cross = Math.hypot(
        seen.y * direction.z - seen.z * direction.y,
        seen.z * direction.x - seen.x * direction.z,
        seen.x * direction.y - seen.y * direction.x,
      );
      const dot = seen.x * direction.x + seen.y * direction.y + seen.z * direction.z;
      worstPx = Math.max(worstPx, Math.atan2(cross, dot) * PX_PER_RAD);
      const peak = star3dPeak(seen.magnitude, coefficients, sky.magnitudeLimit, 0) ?? 0;
      const code = Math.abs(peak - peakDisplayValue(sky.mag[row]!, coefficients)) * 255;
      if (code > worstCode) {
        worstCode = code;
        worstRow = `row ${row}: sky V ${sky.mag[row]}, 3D V ${seen.magnitude} at ${seen.distancePc.toFixed(1)} pc`;
      }
    }
  });

  it('places each sky row at most once, and as many as stars3d.json says', () => {
    expect(seenRows.size).toBe(placed);
    expect(placed).toBe(info.sky.placed);
  });

  it('puts every placed sky star within a hundredth of a pixel of where the sky draws it', () => {
    console.info(`3D against the sky, ${placed} stars: worst ${worstPx.toFixed(4)} px, ${worstCode.toFixed(3)} code values`);
    // 0.0011 px on the data of 2026-10-24, at 2026-10-22.
    expect(worstPx).toBeLessThan(0.01);
  });

  it('draws it at the sky’s brightness, within a tenth of a code value', () => {
    // 0.053 on the data of 2026-10-24: a V 7.49 star 2.5 pc away at 103 km/s, which really
    // is 0.002 mag brighter now than at J2000. It was 5.1 before LIMIT_SLACK, from a star
    // at exactly the limit that float32 put 2e-6 mag past it.
    expect(worstCode, worstRow).toBeLessThan(0.1);
  });

  it('adds to the sky at home only the stars the data says the sky missed', () => {
    expect(added.length, added.join('; ')).toBe(info.counts.gaiaOnlyBrighterThanSkyLimit);
  });
});
