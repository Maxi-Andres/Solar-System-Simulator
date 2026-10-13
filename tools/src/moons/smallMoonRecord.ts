/** One small moon as JPL's tables describe it. Written by buildMoonList.ts. */
export interface SmallMoonRecord {
  /** Horizons ID: x01-x98 for numbered moons, 5xxxx and up for provisional ones. */
  readonly horizonsId: string;
  /** As JPL's elements table writes it; see SMALL_MOONS for the display name. */
  readonly name: string;
  readonly parent: string;
  /** Mean semi-major axis, km. */
  readonly semiMajorAxisKm: number;
  readonly eccentricity: number;
  /** Mean inclination, degrees, to the plane the table states (Laplace or ecliptic). */
  readonly inclinationDeg: number;
  /** Sidereal period, days. */
  readonly periodDays: number;
  /** The JPL satellite ephemeris it comes from, e.g. SAT441. */
  readonly ephemeris: string;
  /** Mean radius, km, or null where JPL publishes none. */
  readonly radiusKm: number | null;
  /** Where the radius came from. */
  readonly radiusSource: 'phys_par' | 'horizons' | null;
  /** GM, km^3/s^2, where measured. */
  readonly gmKm3S2: number | null;
}
