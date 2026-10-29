import { ESA_MODEL_CREDIT } from '../../scene/craftModels.ts';
import { ACCENT, BRIGHT, Items, Item, MUTED, Prose, Strong, Sub, TEXT } from './prose.tsx';
import { REFERENCE_GROUPS, referenceAnchor, referenceNumber, type Reference } from './references.ts';
import type { AboutSection } from './section.ts';

/**
 * Where everything comes from: the data as this build fetched it, the numbered reference
 * list every [n] in the text points at, the 3D models' owners, and the credit lines the
 * sources ask for -- word for word where they ask for exact words.
 */
export const sourcesSection: AboutSection = {
  id: 'sources',
  tab: 'Sources',
  title: 'Sources and credits',
  blurb:
    'The data this build was made from, every paper and catalogue cited in this text by its number, and the credits each source asks for.',
  subsections: [
    { id: 'data', label: 'This build’s data' },
    ...REFERENCE_GROUPS.map((group) => ({ id: `refs-${group.id}`, label: group.label })),
    { id: 'models', label: '3D models' },
    { id: 'credits', label: 'Credits and licences' },
  ],
  Body: ({ data }) => {
    const { store, stars, beltInfo, cometInfo, satelliteInfo } = data;
    const { window: windowInfo, source } = store.manifest;
    return (
      <>
        <Sub section="sources" id="data">
          This build’s data
        </Sub>
        <Prose>
          Ephemerides from <Strong>{source.name}</Strong> {source.version}, DE441, generated{' '}
          {store.generatedAt.toISOString().slice(0, 10)}. Exact coverage runs{' '}
          {windowInfo.startUtc.slice(0, 10)} to {windowInfo.stopUtc.slice(0, 10)}, and a year either side of
          the build for the fast moons; outside that range positions are propagated and flagged. Frame is
          barycentric, ecliptic of J2000.
        </Prose>
        <Prose>
          Stars from <Strong>ESA Hipparcos</Strong> (1997) and <Strong>Tycho-2</Strong> (2000), read through{' '}
          {stars.via.includes('gea.esac.esa.int') ? (
            <>
              the <Strong>Gaia archive</Strong> at ESA, its mirror of both, VizieR at CDS Strasbourg not
              answering when the sky was built:
            </>
          ) : (
            <>
              the <Strong>VizieR</Strong> service at CDS Strasbourg:
            </>
          )}{' '}
          {stars.count.toLocaleString('en-US')} stars complete to magnitude {stars.magnitudeLimit}, positions
          at J2000 and carried to the date on screen by their own proper motions. Neither catalogue is a sky
          on its own — Tycho-2 is missing the brightest stars, whose light saturated its star mapper, and
          Hipparcos never completed the faint ones — so{' '}
          {stars.sources
            .map((entry) => `${entry.stars.toLocaleString('en-US')} from ${entry.table}`)
            .join(' and ')}
          .
        </Prose>
        {cometInfo !== null && (
          <Prose>
            Comet orbits from the <Strong>{cometInfo.source.name}</Strong>, queried{' '}
            {cometInfo.source.queriedAt.slice(0, 10)}: perihelion distance and time with the rest of each
            conic, and SBDB’s total-magnitude parameters where it has them, for{' '}
            {cometInfo.count.toLocaleString('en-US')} comets.
          </Prose>
        )}
        {beltInfo !== null && (
          <Prose>
            Asteroid orbits from the <Strong>{beltInfo.source.name}</Strong>, queried{' '}
            {beltInfo.source.queriedAt.slice(0, 10)}: osculating elements for every asteroid brighter than
            absolute magnitude {beltInfo.magnitudeLimit} on an elliptic orbit,{' '}
            {beltInfo.count.toLocaleString('en-US')} of them, heliocentric in the ecliptic of J2000.
          </Prose>
        )}
        <Prose>
          Earth satellite orbital elements from <Strong>CelesTrak</Strong> (Dr. T.S. Kelso), from data
          originated by the US Space Force’s <Strong>18th Space Defense Squadron</Strong> and published on{' '}
          <Strong>Space-Track.org</Strong>, fetched once a day when the data is built and never by your
          browser
          {satelliteInfo === null
            ? '.'
            : `: ${satelliteInfo.count.toLocaleString('en-US')} objects, queried ${satelliteInfo.source.queriedAt.slice(0, 10)}. ${satelliteInfo.credit}`}{' '}
          Propagated with <Strong>satellite.js</Strong> (MIT licence), David Vallado’s SGP4 in JavaScript.
        </Prose>

        {REFERENCE_GROUPS.map((group) => (
          <div key={group.id}>
            <Sub section="sources" id={`refs-${group.id}`}>
              {group.label}
            </Sub>
            <ol style={{ listStyle: 'none', margin: '0 0 1.1rem', padding: 0 }}>
              {group.refs.map((reference) => (
                <ReferenceEntry key={reference.key} reference={reference} />
              ))}
            </ol>
          </div>
        ))}

        <Sub section="sources" id="models">
          3D models
        </Sub>
        <Items>
          <Item>
            {`Models courtesy of NASA. Juice, Solar Orbiter, BepiColombo, Hera, Euclid, Gaia, Mars Express and the Trace Gas Orbiter are ESA’s, used by ESA’s written permission, their geometry as ESA made it: ${ESA_MODEL_CREDIT} Lucy’s, Psyche’s, IMAP’s, ESCAPADE’s, CAPSTONE’s and Orion’s are NASA’s, from its Eyes on the Solar System, and so are Hayabusa2’s and Danuri’s — NASA’s models of JAXA’s and KARI’s craft, neither agency having published one.`}
          </Item>
          <Item>
            The named Earth satellites’ models are NASA’s — from NASA 3D Resources, NASA’s mission pages and
            JPL’s, where NASA’s visualization team publishes SMAP’s and GRACE-FO’s — and ESA’s for XMM-Newton,
            SMILE and CryoSat-2, by the same permission. Sister craft built alike share one model, as Landsat
            8 and 9 do.
          </Item>
          <Item>
            Juice’s and Hera’s models are assembled from the ESA SPICE Service’s kernel datasets:{' '}
            {'ESA SPICE Service, JUICE Operational SPICE Kernel Dataset, https://doi.org/10.5270/esa-ybmj68p'}
            ;{' '}
            {'ESA SPICE Service, Hera Operational SPICE Kernel Dataset, https://doi.org/10.57780/esa-k25x2cv'}
            . XMM-Newton’s and SMILE’s come from the same service’s Cosmographia packages, for which it lists
            no dataset DOI.
          </Item>
        </Items>

        <Sub section="sources" id="credits">
          Credits and licences
        </Sub>
        <Items>
          <Item>
            Courtesy of <Strong>NASA/JPL-Caltech</Strong>, Solar System Dynamics Group; where Curiosity and
            Perseverance stand, from NASA/JPL-Caltech’s <Strong>Mars mission maps</Strong>.
          </Item>
          <Item>
            This research has made use of the NASA Exoplanet Archive, which is operated by the California
            Institute of Technology, under contract with the National Aeronautics and Space Administration
            under the Exoplanet Exploration Program.
          </Item>
          <Item>
            This work has made use of data from the European Space Agency (ESA) mission <Strong>Gaia</Strong>{' '}
            (https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis Consortium
            (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for the DPAC has been
            provided by national institutions, in particular the institutions participating in the Gaia
            Multilateral Agreement.
          </Item>
          <Item>
            Star catalogues read through the <Strong>VizieR</Strong> service and star identifiers from the{' '}
            <Strong>SIMBAD</Strong> database, both operated at CDS, Strasbourg; proper star names from the IAU
            Working Group on Star Names (CC BY 4.0).
          </Item>
          <Item>
            Surface maps of the Sun, the planets and Saturn’s rings: <Strong>Solar System Scope</Strong>{' '}
            (https://www.solarsystemscope.com/textures/), CC BY 4.0 — illustrative composites based on NASA
            elevation and imagery data. Pluto: NASA/Johns Hopkins University Applied Physics
            Laboratory/Southwest Research Institute (New Horizons, PIA11707). The Moon: NASA’s Scientific
            Visualization Studio (LRO). The other moons, Ceres and Vesta: mission mosaics, nearly all from
            USGS Astrogeology, several assembled by DLR and the LPI, from Galileo, Voyager, Cassini, New
            Horizons, Mars Express and Dawn. Ryugu’s model and map are ISAS/JAXA’s, its map’s images JAXA,
            University of Tokyo &amp; collaborators’. Earth’s night lights, clouds and water: NASA Earth
            Observatory and Visible Earth (VIIRS 2012, MODIS).
          </Item>
          <Item>Interface icons are hand-written inline SVG — no icon set, nothing to attribute.</Item>
          <Item>This project is not affiliated with or endorsed by NASA, JPL or ESA.</Item>
        </Items>
      </>
    );
  },
};

/** One numbered reference, with the id citations jump to. */
function ReferenceEntry({ reference }: { reference: Reference }) {
  const { key, who, title, where, link, use } = reference;
  return (
    <li
      id={referenceAnchor(key)}
      className="about-ref"
      style={{
        display: 'grid',
        gridTemplateColumns: '2.2rem 1fr',
        color: TEXT,
        fontSize: '0.82rem',
        lineHeight: 1.6,
        marginBottom: '0.55rem',
        scrollMarginTop: '1rem',
        borderRadius: '0.25rem',
      }}
    >
      <span style={{ color: MUTED, fontVariantNumeric: 'tabular-nums' }}>[{referenceNumber(key)}]</span>
      <span>
        <span style={{ color: BRIGHT }}>{who}</span>
        {title !== undefined && <>. {title.replace(/\.$/, '')}</>}
        {where !== undefined && (
          <>
            . <em>{where}</em>
          </>
        )}
        {link !== undefined && (
          <>
            .{' '}
            <a href={link} target="_blank" rel="noreferrer" style={{ color: ACCENT, wordBreak: 'break-all' }}>
              {link.replace(/^https:\/\//, '')}
            </a>
          </>
        )}
        <span style={{ display: 'block', color: MUTED, fontSize: '0.76rem' }}>{use}</span>
      </span>
    </li>
  );
}
