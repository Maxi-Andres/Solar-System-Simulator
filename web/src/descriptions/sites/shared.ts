import type { BodyId } from '@sss/tools/types';

import { formatSiteCoordinates, landingSiteOf } from '../../core/landingSites.ts';
import type { DescriptionPhoto, DescriptionPoint, DescriptionSource } from '../types.ts';

/**
 * What the landing sites' pages share (sites/): their photographs' paths and licences, the
 * points every site says the same way -- its mark, where it stands -- and the sources several
 * cite. Each page is hand-written; this only keeps the repeated parts in one place.
 */

/** A photograph under public/photos/sites/<site>/: `<name>.webp` and `<name>-large.webp`. */
export function sitePhoto(
  site: BodyId,
  name: string,
  width: number,
  height: number,
  rest: Omit<DescriptionPhoto, 'file' | 'largeFile' | 'width' | 'height'>,
): DescriptionPhoto {
  return {
    file: `photos/sites/${site}/${name}.webp`,
    largeFile: `photos/sites/${site}/${name}-large.webp`,
    width,
    height,
    ...rest,
  };
}

/** An Apollo or Surveyor photograph, a Photojournal release: NASA's, free to use. */
export const NASA_LICENCE = 'NASA media, not copyrighted';
export const PHOTOJOURNAL_LICENCE = 'NASA media, not copyrighted; credit requested';

/** LRO's narrow-angle camera, as its team credits it. */
export const LROC_CREDIT = 'NASA/GSFC/Arizona State University';

/**
 * An image from the LROC team's own pages (lroc.im-ldi.com), not their public-domain archive
 * in the PDS: copyrighted, and free for educational use with the credit (their terms of use).
 */
export const LROC_LICENCE =
  'LROC website image, © Arizona State University: free for educational use with this credit; commercial use needs permission';

/**
 * The landers and rovers of China, India and Japan photographed themselves and their ground,
 * and those images are not reproduced here: neither CNSA's, nor ISRO's (reproduction on
 * request), nor JAXA's (no modification, and SLIM's own portrait shared with three other
 * owners) are under a licence clearly free with credit. Said on each page as a missing point.
 */
export function ownImagesMissing(why: string): DescriptionPoint {
  return {
    title: 'Its own photographs',
    text: `Not reproduced here: ${why} Only LRO’s views of the site, whose terms allow it, are shown.`,
  };
}

/** How every site is drawn: a mark on the ground, not the craft. */
export const SITE_MARK: DescriptionPoint = {
  title: 'Its mark',
  text: 'A mark on the Moon’s surface at the measured place of the hardware, turning with the Moon. It is shown only while the Moon is large on the screen, and only on the side turned to the camera; the craft itself is not drawn.',
};

/** Where a site stands, from landingSites.ts, citing whoever measured it. */
export function wherePoint(id: BodyId, cite: readonly string[], add = ''): DescriptionPoint {
  const site = landingSiteOf(id);
  if (site === null) throw new Error(`no landing site ${id}`);
  return {
    title: 'Where it stands',
    text: `${formatSiteCoordinates(site.latitudeDeg, site.longitudeDeg)}, in the Moon’s mean-Earth frame: the hardware itself, measured in LRO’s narrow-angle camera images after the landing, not the point the mission aimed for.${add === '' ? '' : ` ${add}`}`,
    cite,
  };
}

/** Why only an orbiter sees it: the size of a lander against the distance to the Moon. */
export const NO_TELESCOPE: DescriptionPoint = {
  title: 'No telescope on Earth can see it',
  text: 'A lander a few metres across, 384,000 km away, spans about two thousandths of an arcsecond (worked out here): far below what any telescope on Earth, or Hubble, can make out. Only a camera in orbit about the Moon, a few tens of kilometres up, has photographed the landing sites.',
  cite: ['robinson2010'],
};

/** The sources several site pages cite. */
export const SITE_SOURCES = {
  wagner2017: {
    key: 'wagner2017',
    text: 'Wagner, R. V., et al. 2017, Coordinates of anthropogenic features on the Moon, Icarus 283, 92; its table as updated by the LROC team in 2016',
    url: 'https://doi.org/10.1016/j.icarus.2016.05.011',
  },
  robinson2010: {
    key: 'robinson2010',
    text: 'Robinson, M. S., et al. 2010, Lunar Reconnaissance Orbiter Camera (LROC) Instrument Overview, Space Sci. Rev. 150, 81',
    url: 'https://doi.org/10.1007/s11214-010-9634-2',
  },
  murphy2013: {
    key: 'murphy2013',
    text: 'Murphy, T. W. 2013, Lunar laser ranging: the millimeter challenge, Rep. Prog. Phys. 76, 076901',
    url: 'https://doi.org/10.1088/0034-4885/76/7/076901',
  },
  fincannon2012: {
    key: 'fincannon2012',
    text: 'Fincannon, J. 2012, Six Flags on the Moon: What is Their Current Condition?, Apollo Lunar Surface Journal',
    url: 'https://www.nasa.gov/wp-content/uploads/static/history/alsj/ApolloFlags-Condition.html',
  },
  platoff1993: {
    key: 'platoff1993',
    text: 'Platoff, A. M. 1993, Where No Flag Has Gone Before: Political and Technical Aspects of Placing a Flag on the Moon, NASA CR-188251',
    url: 'https://ntrs.nasa.gov/citations/19940008327',
  },
  lroc2011low: {
    key: 'lroc2011low',
    text: 'LROC team 2011, Skimming the Moon (the first low-altitude images of the Apollo sites, 25 cm pixels)',
    url: 'https://lroc.im-ldi.com/images/379',
  },
} satisfies Readonly<Record<string, DescriptionSource>>;
