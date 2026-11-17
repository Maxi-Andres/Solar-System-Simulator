import { describe, expect, it } from 'vitest';

import { GIANTS } from './localGroup.ts';
import { CONN_M31_KPC, fromTangentPlane, GSS_FIELDS, m31StreamTrack } from './m31Stream.ts';
import { withAndromedas } from './streams.ts';

/** Andromeda's Giant Stellar Stream (m31Stream.ts): its track from Conn et al. 2016's fields. */

describe('the tangent plane', () => {
  it('is the identity at its centre and runs east along xi, north along eta', () => {
    const centre = fromTangentPlane(0, 0, 10.68, 41.27);
    expect(centre.raDeg).toBeCloseTo(10.68, 9);
    expect(centre.decDeg).toBeCloseTo(41.27, 9);
    expect(fromTangentPlane(1, 0, 10.68, 41.27).raDeg).toBeGreaterThan(10.68);
    expect(fromTangentPlane(0, -1, 10.68, 41.27).decDeg).toBeCloseTo(40.27, 3);
  });
});

describe('the Giant Stellar Stream', () => {
  const track = m31StreamTrack();
  const piece = track.pieces[0]!;
  const andromeda = GIANTS[0]!;
  const distanceAt = (i: number) => Math.hypot(piece[i * 3]!, piece[i * 3 + 1]!, piece[i * 3 + 2]!);

  it('runs from in front of Andromeda to about 120 kpc behind it, on the same scale', () => {
    expect(piece.length).toBe(GSS_FIELDS.length * 3);
    const scale = andromeda.distancePc / (CONN_M31_KPC * 1000);
    expect(distanceAt(0)).toBeCloseTo(756_000 * scale, -1);
    expect(distanceAt(0)).toBeLessThan(andromeda.distancePc);
    expect(distanceAt(GSS_FIELDS.length - 1) - andromeda.distancePc).toBeGreaterThan(80_000);
  });

  it('lies south-east of Andromeda on the sky, six degrees out at its far end', () => {
    const last = GSS_FIELDS.length - 1;
    const d = distanceAt(last);
    const dec = (Math.asin(piece[last * 3 + 2]! / d) * 180) / Math.PI;
    const ra = (Math.atan2(piece[last * 3 + 1]!, piece[last * 3]!) * 180) / Math.PI;
    expect(dec).toBeLessThan(andromeda.decDeg - 5);
    expect(ra).toBeGreaterThan(andromeda.raDeg);
  });

  it('is added after the file’s streams, and drawn even without the file', () => {
    expect(withAndromedas(null).streams.map((s) => s.name)).toEqual(['Giant Stellar Stream']);
    const file = { source: 'galstreams', licence: 'BSD', stepDeg: 1, streams: [{ ...track, name: 'GD-1' }] };
    expect(withAndromedas(file).streams.map((s) => s.name)).toEqual(['GD-1', 'Giant Stellar Stream']);
  });
});
