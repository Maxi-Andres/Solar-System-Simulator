import type { BodyDefinition } from '@sss/tools/types';

import { drawnRadiusEarth, type ExoPlanet } from '../core/exoplanets.ts';
import { FAR_LANDMARKS, type FarLandmark } from '../core/farLandmarks.ts';
import {
  clusterExtinctionV,
  clusterPopulation,
  clusterSampleRequest,
  clusterStarCount,
  globularClusterOf,
  SAMPLE_BUDGET,
  sampleLimitV,
} from '../core/globularClusters.ts';
import { INTERSTELLAR_CLOUDS, interstellarCloudBodyId, MAGELLANIC_TRACKS } from '../core/interstellarClouds.ts';
import { messierMarkOf, messierRadiusKm } from '../core/messier.ts';
import { notableStarOf } from '../core/notableStars.ts';
import { exoPlanetOf, planetarySystemOf } from '../core/planetarySystems.ts';
import { neutronStarSize, pulsarOf } from '../core/pulsars.ts';
import { recordHolderCosmology, recordHolderOf, type RecordHolder } from '../core/recordHolders.ts';
import { PARSEC_KM } from '../core/stars3d.ts';
import type { DescriptionPoint } from './types.ts';

/**
 * "How it is drawn here" for the kinds of the stars' and the galaxies' catalogues that are no
 * sphere with a map and no galaxy of light (generated.ts deepSkyFromData): a pulsar, a globular
 * cluster, a Messier mark or a marked star, a named interstellar cloud or Magellanic track, a
 * planet of another star and an Exoplanet Archive host placed from the Archive, a record-holder
 * or far landmark. Read off the body's catalogue entry and the code that draws it, as
 * generated.ts reads a planet's; null for any other body, which generated.ts then describes.
 */
export function beyondFromData(body: BodyDefinition): DescriptionPoint[] | null {
  if (body.kind === 'neutron-star') return pulsarFromData(body);
  if (body.kind === 'globular-cluster') return clusterFromData(body);
  if (body.kind === 'deep-sky') return markFromData(body);
  if (body.kind === 'region' && body.id.startsWith('ism-')) return cloudFromData(body);
  if (body.kind === 'planet') {
    const planet = exoPlanetOf(body.id);
    if (planet !== null) return exoPlanetFromData(planet);
  }
  if (body.kind === 'star' && /^exo-host-\d+$/.test(body.id)) return archiveHostFromData(body);
  if (body.kind === 'structure') {
    const holder = recordHolderOf(body.id);
    if (holder !== null) return recordHolderFromData(holder);
  }
  return null;
}

const km = (value: number): string => `${Number(value.toPrecision(3)).toLocaleString('en-US')} km`;
const pcText = (pc: number): string =>
  pc >= 1e4 ? `${Number((pc / 1000).toPrecision(3))} kpc` : pc >= 10 ? `${Math.round(pc).toLocaleString('en-US')} pc` : `${Number(pc.toPrecision(3))} pc`;

function pulsarFromData(body: BodyDefinition): DescriptionPoint[] {
  const found = pulsarOf(body.id);
  if (found === null) return [];
  const { catalog, k } = found;
  const p = catalog.pulsars;
  const moving = p.vx[k] !== 0 || p.vy[k] !== 0 || p.vz[k] !== 0;
  const size = neutronStarSize(catalog, k);
  const nicer = size.measured === null ? null : NICER_KEYS[size.measured.reference] ?? null;
  return [
    {
      title: 'Where it is',
      text:
        `Where ${p.jName[k] == null ? 'the McGill magnetar catalogue' : 'the ATNF Pulsar Catalogue'} puts it on the sky, at the distance its catalogue gives` +
        (moving
          ? ', carried from its catalogue’s epoch along its measured proper motion.'
          : ': no proper motion of it is listed, so it stands still.') +
        ' It does not move toward or away from us: no pulsar’s motion along the line of sight is measured but a few binaries’.',
      cite: [p.jName[k] == null ? 'mcgill' : 'atnf'],
    },
    {
      title: 'What stands in its place',
      text:
        size.measured === null
          ? `A sphere of radius ${size.radiusKm} km — a convention, not a measurement: the radius is measured for three neutron stars, all within their errors of 12 km.`
          : `A sphere of radius ${size.radiusKm} km, the radius NICER measured from the X-ray pulses of its hot polar caps (${size.measured.reference}), +${size.measured.radiusUpKm} −${size.measured.radiusDownKm} km.`,
      ...(nicer === null ? {} : { cite: [nicer] }),
    },
    {
      title: 'Its colour and glare',
      text:
        'The colour of a blackbody at a million kelvin — any surface hotter than about a hundred thousand kelvin looks the same pale blue-violet white — ' +
        'at full brightness, as the stars’ discs are drawn. Close by it glares by its surface brightness, some 3,500 times the Sun’s per square metre: ' +
        'a convention as the colour is, its temperature measured for few.',
    },
    {
      title: 'Its spin',
      text: 'Not drawn. A smooth sphere turning shows nothing, and the beams a pulsar is known by are mostly radio, from a region no measurement resolves.',
    },
  ];
}

/** The NICER papers, by the reference pulsars.ts gives each measured radius. */
const NICER_KEYS: Readonly<Record<string, string>> = {
  'Riley et al. 2019, ApJL 887, L21': 'riley2019',
  'Riley et al. 2021, ApJL 918, L27': 'riley2021',
  'Choudhury et al. 2024, ApJL 971, L20': 'choudhury2024',
};

function clusterFromData(body: BodyDefinition): DescriptionPoint[] {
  const found = globularClusterOf(body.id);
  if (found === null) return [];
  const { catalog: c, k } = found;
  const count = clusterStarCount(c, k);
  const population = clusterPopulation(c.feH[k] ?? null);
  const limit = sampleLimitV(clusterSampleRequest(c, k));
  const extinction = clusterExtinctionV(c, k);
  const stars = count.stars >= 1e6 ? `${Number((count.stars / 1e6).toPrecision(3))} million` : Math.round(count.stars).toLocaleString('en-US');
  return [
    {
      title: 'Where it is',
      text:
        `Its centre at ${pcText(c.distancePc[k]!)} ± ${c.distanceErrorPc[k]} pc from the Sun, Baumgardt and Vasiliev’s distance, ` +
        'moving on the straight line its measured position, proper motion and radial velocity give.',
      cite: ['baumgardtVasiliev2021', 'vasilievBaumgardt2021'],
    },
    {
      title: 'Its stars',
      text:
        `Drawn one by one, each at its own brightness — but from a model, for no catalogue lists a cluster’s stars down to its faintest. ` +
        (count.from === 'light'
          ? `As many as give its measured light, absolute magnitude ${count.absoluteV!.toFixed(2)}: ${stars} living stars. `
          : `With no measured V or reddening to count them by, as many as its mass would hold: ${stars} living stars. `) +
        `They are spread as a Plummer sphere of its measured half-mass radius, ${c.halfMassRadiusPc[k]} pc, cut at its tidal radius, ${c.tidalRadiusPc[k]} pc; ` +
        `their brightness and colour are those of a 12-billion-year-old population of metallicity [M/H] ${population.mh}, with the Kroupa initial mass function. ` +
        `Shown are those brighter than V ${limit.toFixed(1)} as seen from its centre${limit < 7.5 ? `, the faintest limit that keeps it within ${SAMPLE_BUDGET.toLocaleString('en-US')} stars` : ''}.`,
      cite: ['plummer1911', 'bressan2012', 'kroupa2001'],
    },
    {
      title: 'The dust in front',
      text:
        extinction === null
          ? 'None is drawn: Harris’s catalogue gives no reddening for it.'
          : `Its light dimmed by A_V ${extinction.toFixed(2)} on the way to the Sun: 3.1 times Harris’s reddening, E(B−V) ${c.ebv[k]}.`,
      cite: ['harris1996'],
    },
  ];
}

function markFromData(body: BodyDefinition): DescriptionPoint[] {
  const mark = messierMarkOf(body.id);
  if (mark !== null) {
    const radiusKm = messierRadiusKm(mark);
    return [
      {
        title: 'What stands in its place',
        text:
          (radiusKm === null
            ? 'A mark at its place and distance, framed from a parsec away: no size of it is catalogued.'
            : `A mark at its place and distance, framed to hold its catalogued radius, ${Number(mark.radiusArcmin!.toPrecision(3))}′ — ${pcText(radiusKm / PARSEC_KM)} at its distance.`) +
          (mark.type === 'Open cluster' ? ' Its stars are not the mark’s: those the star catalogue holds are drawn there as every star is, by their own light.' : '') +
          ' It stands still.',
      },
    ];
  }
  const star = notableStarOf(body.id);
  if (star === null) return [];
  return [
    {
      title: 'What stands in its place',
      text:
        star.extent !== undefined
          ? `A mark at its centre, framed to hold its ${star.extent.label}, ${star.extent.pc.toFixed(1)} pc: its stars are the star catalogue’s, drawn by their own light, its named members marked.`
          : `A mark, not a star: its size, light and colour are not drawn. ${star.motion === null ? 'It stands still: nothing of its motion would show in centuries.' : 'It moves as measured, along its proper motion and radial velocity from J2000.'}`,
    },
  ];
}

function cloudFromData(body: BodyDefinition): DescriptionPoint[] {
  const cloud = INTERSTELLAR_CLOUDS.find((candidate) => interstellarCloudBodyId(candidate) === body.id);
  if (cloud !== undefined) {
    return [
      {
        title: 'What stands in its place',
        text:
          `A mark at its centre and a ring of its radius, ${pcText(cloud.radiusPc)} (${cloud.sizeNote})` +
          `${cloud.distanceDisputed ? ', dashed: its distance is assumed, or other measurements put it elsewhere' : ''}. ` +
          'Its gas and dust are not drawn: a ring says where and how big, not what it looks like.',
      },
    ];
  }
  const track = MAGELLANIC_TRACKS.find((candidate) => interstellarCloudBodyId(candidate) === body.id);
  if (track === undefined) return [];
  return [
    {
      title: 'What stands in its place',
      text:
        `Its track on the sky, dashed, with a mark at its middle: ${track.lengthNote}. ` +
        'Drawn where its hydrogen is mapped on the sky and at the Magellanic Clouds’ own distance — a choice, not a measurement: no distance along it is measured.',
    },
  ];
}

function exoPlanetFromData(planet: ExoPlanet): DescriptionPoint[] {
  const measured = planet.radiusEarth !== undefined && planet.radiusEarth !== null;
  const radius = drawnRadiusEarth(planet);
  const points: DescriptionPoint[] = [
    {
      title: 'Its size',
      text: measured
        ? `A sphere of radius ${Number(radius.toPrecision(3))} Earth radii, ${km(radius * 6371)}: the radius its transits measured.`
        : planet.massEarth > 0
          ? `A sphere of radius ${Number(radius.toPrecision(3))} Earth radii, ${km(radius * 6371)}, an estimate from its mass by Chen and Kipping’s relation — ` +
            `${planet.massIsMinimum ? 'from its minimum mass, so the size at that minimum' : 'the size such a mass usually has'}: no radius of it is measured.`
          : 'No radius and no mass of it are known, so nothing of its size is drawn.',
      ...(measured ? {} : { cite: ['chenKipping2017'] }),
    },
    {
      title: 'Its orbit',
      text:
        `An ellipse of semi-major axis ${Number(planet.semiMajorAxisAu.toPrecision(4))} AU` +
        `${planet.eccentricity > 0 ? ` and eccentricity ${Number(planet.eccentricity.toFixed(3))}` : ', drawn circular'}, gone round once in ` +
        `${planet.periodDays < 2 ? `${Number((planet.periodDays * 24).toPrecision(3))} hours` : `${Number(planet.periodDays.toPrecision(4)).toLocaleString('en-US')} days`}. ` +
        (planet.orbitChosen !== undefined
          ? `How it lies is ${planet.orbitChosen}.`
          : `${planet.inclinationDeg === null ? 'Its tilt to the sky is not measured: drawn edge-on as seen from the Sun, the one tilt at which a minimum mass is the mass.' : `Tilted ${Number(planet.inclinationDeg.toFixed(2))}° to the sky, as measured.`} ` +
            `${planet.nodeDeg === null ? 'Which way it runs across the sky is not measured: its node is put east–west.' : `Its node at ${Number(planet.nodeDeg.toFixed(1))}° east of north, as measured.`} ` +
            (planet.phase.kind === 'unknown'
              ? 'Where along the orbit it is, is not known: it is put at periastron at J2000, a stand-in.'
              : 'Where along the orbit it is comes from its fit.')),
    },
    {
      title: 'Its light',
      text: 'Lit by its own star, as a planet of the Sun is by the Sun. Its colour is not measured: a pale warm white if it is confirmed, grey if it is disputed or a candidate.',
    },
  ];
  return points;
}

function archiveHostFromData(body: BodyDefinition): DescriptionPoint[] {
  const archive = planetarySystemOf(body.id)?.archive;
  if (archive === undefined) return [];
  return [
    {
      title: 'Where it is',
      text:
        `Not one of the 3D stars, so placed from the NASA Exoplanet Archive’s own position${archive.distancePc === null ? '' : ` and distance, ${pcText(archive.distancePc)}`}` +
        `${archive.moving ? ', moving along the motion the Archive gives' : ', standing still: the Archive gives no motion of it'}. No point is drawn for it among the stars.`,
      cite: ['nea'],
    },
    {
      title: 'Its size and colour',
      text:
        (body.radiusPublished === true
          ? `Up close, a disc of the Archive’s radius for it, ${Number((body.radiusEquatorialKm / 695_700).toPrecision(3))} times the Sun’s — a published value, mostly from its spectrum and models of stars, not from measuring its disc.`
          : 'None is drawn: the Archive gives no radius for it, so it stays a marker.') +
        ` Its colour is ${archive.teffK === null ? 'the Sun’s, as the Archive gives no temperature for it' : `a blackbody’s at its effective temperature, ${Math.round(archive.teffK).toLocaleString('en-US')} K`}.`,
      cite: ['nea'],
    },
  ];
}

function recordHolderFromData(holder: RecordHolder): DescriptionPoint[] {
  const far = FAR_LANDMARKS.find((landmark) => landmark.key === holder.key) ?? null;
  const cosmology = recordHolderCosmology(holder);
  const points: DescriptionPoint[] = [
    {
      title: 'Where it is',
      text:
        holder.nearby === true
          ? `At its position on the sky (${holder.position}) and at the comoving distance its redshift gives — moved into the cosmic microwave background’s frame — in Cosmicflows-4’s cosmology, H0 ${cosmology.h0}, as Laniakea’s galaxies placed by redshift are. Its own motion through space, a few hundred km/s, is in that redshift too.`
          : holder.kind === 'cmb-feature'
            ? `On the cosmic microwave background’s wall, at the distance of last scattering in Planck 2018’s cosmology, and at its place on the sky (${holder.position}).`
            : `At its position on the sky (${holder.position}) and at the comoving distance its redshift has in Planck 2018’s cosmology: where it is now, on the Hubble flow — not where it was when the light we see left it.`,
      cite: holder.nearby === true ? ['tully2023'] : ['planck2020params'],
    },
    {
      title: 'What stands in its place',
      text: `${far === null ? 'A mark and its name' : farExtentText(far)}. It is shown with ${holder.nearby === true ? 'Laniakea’s structures, in their layer' : 'the Observable Universe layer, fading in once the camera is some three billion light years from the Sun'}; the one in focus is always drawn.`,
    },
  ];
  return points;
}

function farExtentText(landmark: FarLandmark): string {
  const extent = landmark.extent;
  switch (extent.kind) {
    case 'group':
      return `A mark at the mean place of its ${extent.members} quasars, and a ring of its paper’s characteristic size, ${extent.characteristicMpc} Mpc — not its shape, since its members are not drawn as members`;
    case 'field':
      return `A beam from the Sun out to the redshift of the farthest galaxy confirmed in it, as wide as the field is on the sky, ${extent.areaArcmin2.toLocaleString('en-US')} square arcminutes`;
    case 'span':
      return `A mark, and a ring of the diameter its paper gives, ${extent.diameterMpc.toFixed(0)} Mpc comoving at Planck 2018’s H0`;
    case 'sky-disc':
      return `A circle ${extent.radiusDeg}° in radius on the sky, on the cosmic microwave background’s wall`;
    case 'direction':
      return 'A beam from the Sun to it on the wall: the way the Sun moves against the cosmic microwave background';
    case 'mark':
      return 'A mark and its name: nothing more of it is drawn';
  }
}
