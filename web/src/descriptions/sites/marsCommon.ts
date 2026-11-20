import type { DescriptionPoint, DescriptionSource } from '../types.ts';

/**
 * What every Mars landing site's page says the same way: how a site is drawn here (read off
 * core/landingSites.ts and scene/SolarSystem's Mars), and the sources of the positions. Only
 * what is the same for all of them; each page adds its own.
 */

/** How a site is drawn: its mark, the ground it stands on, what of it is not drawn. */
export function marsSiteDrawn(what: string): DescriptionPoint[] {
  return [
    {
      title: 'When it shows',
      text: 'Only while Mars is large on the screen, and only on the side turned to the camera, turning with the planet: many names on a small Mars would bury it.',
    },
    {
      title: 'The ground under it',
      text:
        'Mars is drawn as its reference ellipsoid, with no terrain: the mark sits on that smooth surface at the site’s latitude and longitude, not on the real ground, which may be kilometres above or below it. Mars’s map is about 10 km a pixel at the equator (2,048 pixels round 21,339 km, worked out here), far too coarse to show anything of the site.',
    },
    {
      title: 'What is not drawn',
      text: `${what} No model of it stands there; the photographs on this page are the only way to see it here.`,
    },
  ];
}

export const KONOPLIV_2026: DescriptionSource = {
  key: 'konopliv2026',
  text: 'Konopliv, A. S., Park, R. S., Le Maistre, S., Yseboodt, M., & Baland, R.-M. 2026, Updated Mars Orientation and Gravity Field and Indication of Decadal Changes in Rotation Rate, Planet. Sci. J. 7, 212 (Table 7: the landers found in HiRISE images, tied to the MOLA frame)',
  url: 'https://doi.org/10.3847/PSJ/ae9ba7',
};

export const MER_NOTEBOOK: DescriptionSource = {
  key: 'merNotebook',
  text: 'PDS Geosciences Node, Washington University in St. Louis, MER Analyst’s Notebook: the rovers’ traverse files (MERA_traverse.csv, MERB_traverse_5130.csv)',
  url: 'https://an.rsl.wustl.edu/mer/',
};
