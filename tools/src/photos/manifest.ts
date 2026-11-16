/**
 * The photo library: official pictures of the objects the app shows, for their description
 * panels (Phase E). The pictures themselves are not in git -- `pnpm -C tools fetch:photos`
 * downloads what manifest.json lists into tools/.cache/photos/ -- and none ships yet.
 *
 * Every entry records what its source asks for: the credit line word for word, the licence,
 * the page it was found on and the file itself. Only sources whose terms allow reuse:
 *
 * - NASA (images.nasa.gov, Photojournal, NASA Science): not subject to copyright in the US,
 *   credit requested. An image NASA hosts but did not make (ESA's, JAXA's, a contractor's)
 *   is not NASA's to release, and is listed under its owner's terms instead.
 * - ESA/Hubble, ESA/Webb, ESO, NOIRLab/NSF/AURA, the EHT: CC BY 4.0.
 * - ESA (esa.int): CC BY-SA 3.0 IGO where the page says so.
 * - Wikimedia Commons only as a copy of one of those, its original source recorded.
 *
 * What is not a photograph says so (`colour: 'illustration'`); real pictures are preferred.
 */

export type PhotoCategory =
  | 'sun'
  | 'planet'
  | 'dwarf-planet'
  | 'moon'
  | 'asteroid'
  | 'comet'
  | 'interstellar'
  | 'spacecraft'
  | 'earth-satellite'
  | 'star'
  | 'black-hole'
  | 'star-cluster'
  | 'nebula'
  | 'supernova-remnant'
  | 'milky-way'
  | 'galaxy'
  | 'galaxy-cluster'
  | 'supercluster'
  | 'exoplanet-system'
  | 'record-holder'
  | 'cmb';

/**
 * What the colours mean.
 *
 * - `true`: as the eye or an ordinary camera would see it (a spacecraft's photo in its
 *   red, green and blue filters, a photograph of hardware).
 * - `enhanced`: visible light, its colour or contrast stretched to show differences.
 * - `false`: bands outside the visible, or visible bands given other colours (Hubble's
 *   narrow-band palette, infrared, X-ray, radio).
 * - `monochrome`: one band, grey.
 * - `illustration`: an artist's impression or a render, not a picture of the object.
 */
export type PhotoColour = 'true' | 'enhanced' | 'false' | 'monochrome' | 'illustration';

/** The licences the library holds, and where each is written. */
export const LICENCES = {
  'Public domain (NASA)': 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-SA 3.0 IGO': 'https://creativecommons.org/licenses/by-sa/3.0/igo/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
} as const;

export type Licence = keyof typeof LICENCES;

export interface Photo {
  /** Its file name in the cache, without extension: unique, lower case. */
  readonly key: string;
  /** The source's own title for it. */
  readonly title: string;
  /** The credit line, word for word as the source asks for it. */
  readonly credit: string;
  readonly licence: Licence;
  /** The page it is published on, where the credit and licence are stated. */
  readonly sourcePage: string;
  /** The original file. */
  readonly fileUrl: string;
  /** A smaller rendition of the same file from the same host, fetched in its place when given. */
  readonly downloadUrl?: string;
  /** Where it was found, when that is a copy of the official image and not its source. */
  readonly via?: { readonly name: string; readonly page: string };
  /** The mission, telescope or instrument; for hardware, what it shows. */
  readonly instrument: string;
  /** When it was taken or released, ISO 8601 (as precise as the source says); null if not said. */
  readonly date: string | null;
  readonly colour: PhotoColour;
  /** Anything a reader of the credit should know: a caveat, a licence doubt, what it shows. */
  readonly note?: string;
}

export interface PhotoObject {
  /** The app's body id where it is a fixed one (`mars`, `snr-crab`, `far-gn-z11`); else null. */
  readonly id: string | null;
  /** Its name as the app shows it and its search finds it. */
  readonly name: string;
  readonly category: PhotoCategory;
  /** False for objects the checklist plans but the app does not hold yet. */
  readonly inApp: boolean;
  readonly photos: readonly Photo[];
}

/** An object the app shows for which no picture under these terms was found, and why. */
export interface Unphotographed {
  readonly id: string | null;
  readonly name: string;
  readonly category: PhotoCategory;
  readonly reason: string;
}

export interface PhotoManifest {
  readonly objects: readonly PhotoObject[];
  readonly unphotographed: readonly Unphotographed[];
}

const COLOURS: readonly PhotoColour[] = ['true', 'enhanced', 'false', 'monochrome', 'illustration'];

/** What is wrong with a manifest, one line each; empty when nothing is. */
export function checkManifest(manifest: PhotoManifest): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  const names = new Set<string>();
  for (const object of manifest.objects) {
    const where = `${object.name}`;
    if (names.has(`${object.category}:${object.name}`)) problems.push(`${where}: listed twice`);
    names.add(`${object.category}:${object.name}`);
    if (object.photos.length === 0) problems.push(`${where}: no photos (list it under unphotographed instead)`);
    for (const photo of object.photos) {
      const at = `${where} / ${photo.key}`;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(photo.key)) problems.push(`${at}: key must be lower-case words joined by hyphens`);
      for (const field of ['title', 'credit', 'instrument'] as const) {
        if (typeof photo[field] !== 'string' || photo[field].trim() === '') problems.push(`${at}: no ${field}`);
      }
      if (!(photo.licence in LICENCES)) problems.push(`${at}: unknown licence ${photo.licence}`);
      if (!COLOURS.includes(photo.colour)) problems.push(`${at}: unknown colour ${photo.colour}`);
      for (const url of [photo.sourcePage, photo.fileUrl, photo.downloadUrl, photo.via?.page]) {
        if (url !== undefined && !/^https:\/\/[^\s]+$/.test(url)) problems.push(`${at}: not an https URL: ${url}`);
      }
      if (photo.date !== null && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(photo.date)) problems.push(`${at}: date ${photo.date} is not ISO 8601`);
      // The same key under two objects must be the same picture.
      const text = JSON.stringify(photo);
      const before = seen.get(photo.key);
      if (before !== undefined && before !== text) problems.push(`${at}: key used for two different pictures`);
      seen.set(photo.key, text);
    }
  }
  for (const missing of manifest.unphotographed) {
    if (missing.reason.trim() === '') problems.push(`${missing.name}: unphotographed without a reason`);
  }
  return problems;
}
