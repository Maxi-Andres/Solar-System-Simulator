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
        <Prose>
          The auroral ovals are NOAA’s <Strong>OVATION Prime</Strong> forecast. It is not built into this
          build: your browser fetches it from services.swpc.noaa.gov when the Auroras layer is on, and again
          every ten minutes, so it is always the latest one. The meteor showers are the{' '}
          <Strong>International Meteor Organization</Strong>’s 2026 working list, with speeds and parents
          from the <Strong>IAU Meteor Data Center</Strong>, written into the code.
        </Prose>
        <Prose>
          The constellations’ boundaries are the IAU’s, from Davenhall &amp; Leggett’s{' '}
          <Strong>Catalogue of Constellation Boundary Data</Strong> (CDS VI/49) in B1875, precessed to J2000
          when the data is built; their figures and name positions are <Strong>d3-celestial</Strong>’s, each
          figure’s vertex matched to its star in the sky above, by Hipparcos number.
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
            Landing sites on the Moon from the <Strong>Lunar Reconnaissance Orbiter Camera</Strong> team’s
            measurements: NASA/GSFC/Arizona State University. On Mars, from HiRISE images, NASA/JPL-Caltech/
            University of Arizona, as Konopliv et al. 2026 list them; Spirit’s and Opportunity’s drives from the
            MER Analyst’s Notebook, PDS Geosciences Node, Washington University in St. Louis.
          </Item>
          <Item>
            Aurora forecast: <Strong>NOAA Space Weather Prediction Center</Strong>, OVATION Prime, public domain
            (a work of the U.S. Government), https://www.swpc.noaa.gov/products/aurora-30-minute-forecast.
          </Item>
          <Item>
            Meteor showers: the International Meteor Organization’s 2026 Meteor Shower Calendar, edited by
            Jürgen Rendtel, https://www.imo.net; the IAU Meteor Data Center, https://www.ta3.sk/IAUC22DB/MDC2022/
            (Jenniskens et al. 2020, Planetary and Space Science 182, 104821; Jopek &amp; Kaňuchová 2017,
            Planetary and Space Science 143, 3), as its maintainers ask it to be cited.
          </Item>
          <Item>
            Constellation boundaries: Davenhall, A. C., &amp; Leggett, S. K. 1989, Catalogue of Constellation
            Boundary Data (Royal Observatory Edinburgh), CDS VI/49, after Delporte, E. 1930, Délimitation
            scientifique des constellations (IAU); constbnd.dat prepared by Bill J. Gray (Project Pluto), 2007;
            via VizieR (CDS, Strasbourg). Constellation figures and name positions: d3-celestial, Copyright (c)
            2015, Olaf Frohn, BSD 3-Clause (https://github.com/ofrohn/d3-celestial), its lines after the IAU’s
            charts made with Sky &amp; Telescope; the licence’s full text travels with the data, in
            constellations.json.
          </Item>
          <Item>
            This research has made use of the NASA Exoplanet Archive, which is operated by the California
            Institute of Technology, under contract with the National Aeronautics and Space Administration
            under the Exoplanet Exploration Program.
          </Item>
          <Item>
            α Centauri A’s candidate S1: one orbit from S1+C1_stable_orbits_consistent_with_JWST_nondetections.txt,
            in “The data for ‘Worlds Next Door: A Candidate Giant Planet Imaged in the Habitable Zone of αCen A.
            I.’”, Beichman, Sanghi et al. 2025, Zenodo, doi:10.5281/zenodo.16280658, CC BY 4.0; its numbers used
            as published.
          </Item>
          <Item>
            Pulsars from the <Strong>ATNF Pulsar Catalogue</Strong>: “The ATNF Pulsar Catalogue”, R. N.
            Manchester, G. B. Hobbs, A. Teoh &amp; M. Hobbs, Astronomical Journal, 129, 1993–2006 (2005),
            https://www.atnf.csiro.au/research/pulsar/psrcat. Magnetars from the{' '}
            <Strong>McGill Online Magnetar Catalog</Strong> (Olausen &amp; Kaspi 2014),
            http://www.physics.mcgill.ca/~pulsar/magnetar/main.html.
          </Item>
          <Item>
            The Local Group’s dwarf galaxies from A. W. McConnachie’s catalogue of nearby galaxies (January 2021
            version), https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/community/nearby/ — McConnachie, A. W.,
            2012, AJ, 144, 4, The observed properties of dwarf galaxies in and around the Local Group.
          </Item>
          <Item>
            Andromeda’s face-on maps, adapted — deprojected, its foreground stars, its bulge and M32 and NGC 205
            taken out — by tools/galaxies/prepare.py, credited in web/public/galaxies/CREDITS.md: WISE 3.4 and 22
            µm and GALEX far-UV from z0MGS, Leroy, A. K., et al. 2019, ApJS 244, 24, IRSA doi:10.26131/IRSA6 —
            WISE a joint project of UCLA and JPL/Caltech, funded by NASA; GALEX operated for NASA by Caltech; its
            dust column density from Marsh, K. A., et al. 2018, Dust in the Eye of Andromeda, MNRAS,
            doi:10.1093/mnras/sty2037, from Herschel, an ESA space observatory with science instruments provided
            by European-led Principal Investigator consortia and with important participation from NASA.
          </Item>
          <Item>
            The cosmic microwave background’s map: Credit: ESA, Planck Collaboration. Planck 2018 SMICA map, from the
            Planck Legacy Archive through the NASA/IPAC Infrared Science Archive, adapted — made equirectangular,
            8-bit — by tools/src/cmb/prepareCmb.ts, credited in web/public/cmb/CREDITS.md; CC BY-NC 3.0 IGO. Its
            Planck map colouring: the Planck Collaboration’s colour table, Planck_Parchment_RGB.txt, its six knots
            in web/src/scene/cmb.ts, as distributed by A. Zonca (github.com/zonca/paperplots).
          </Item>
          <Item>{"Tempel et al. 2014, MNRAS 438, 3465, via VizieR (CDS, Strasbourg). Built on SDSS DR8: Funding for SDSS-III has been provided by the Alfred P. Sloan Foundation, the Participating Institutions, the National Science Foundation, and the U.S. Department of Energy Office of Science (the full SDSS-III acknowledgement: https://www.sdss3.org/collaboration/boiler-plate.php)."} doi:10.26093/cds/vizier.74383465.</Item>
          <Item>{"Malavasi et al. 2020, A&A 642, A19. \"This work makes use of the service L3S/COSFIL.\" Built on SDSS-III BOSS DR12: Funding for SDSS-III has been provided by the Alfred P. Sloan Foundation, the Participating Institutions, the National Science Foundation, and the U.S. Department of Energy Office of Science (the full SDSS-III acknowledgement: https://www.sdss3.org/collaboration/boiler-plate.php)."}</Item>
          <Item>{"SDSS-III BOSS DR12. Funding for SDSS-III has been provided by the Alfred P. Sloan Foundation, the Participating Institutions, the National Science Foundation, and the U.S. Department of Energy Office of Science (the full SDSS-III acknowledgement: https://www.sdss3.org/collaboration/boiler-plate.php)."}</Item>
          <Item>
            {'SDSS DR16Q: Lyke et al. 2020, ApJS 250, 8, via VizieR (CDS, Strasbourg), doi:10.26093/cds/vizier.7289. SDSS-IV’s acknowledgement, as https://www.sdss.org/collaboration/citing-sdss/ asks for it (https://www.sdss4.org/collaboration/#sdss4acknowledgement): '}
            {
              'Funding for the Sloan Digital Sky Survey IV has been provided by the Alfred P. Sloan Foundation, the U.S. Department of Energy Office of Science, and the Participating Institutions. SDSS acknowledges support and resources from the Center for High-Performance Computing at the University of Utah. The SDSS web site is www.sdss4.org. '
            }
            {
              'SDSS is managed by the Astrophysical Research Consortium for the Participating Institutions of the SDSS Collaboration including the Brazilian Participation Group, the Carnegie Institution for Science, Carnegie Mellon University, Center for Astrophysics | Harvard & Smithsonian (CfA), the Chilean Participation Group, the French Participation Group, Instituto de Astrofísica de Canarias, The Johns Hopkins University, Kavli Institute for the Physics and Mathematics of the Universe (IPMU) / University of Tokyo, the Korean Participation Group, Lawrence Berkeley National Laboratory, Leibniz Institut für Astrophysik Potsdam (AIP), Max-Planck-Institut für Astronomie (MPIA Heidelberg), Max-Planck-Institut für Astrophysik (MPA Garching), Max-Planck-Institut für Extraterrestrische Physik (MPE), National Astronomical Observatories of China, New Mexico State University, New York University, University of Notre Dame, Observatório Nacional / MCTI, The Ohio State University, Pennsylvania State University, Shanghai Astronomical Observatory, United Kingdom Participation Group, Universidad Nacional Autónoma de México, University of Arizona, University of Colorado Boulder, University of Oxford, University of Portsmouth, University of Utah, University of Virginia, University of Washington, University of Wisconsin, Vanderbilt University, and Yale University.'
            }
          </Item>
          <Item>
            {'The Planck SZ clusters: Planck Collaboration 2016, A&A 594, A27, via VizieR (CDS, Strasbourg). Based on observations obtained with Planck (http://www.esa.int/Planck), an ESA science mission with instruments and contributions directly funded by ESA Member States, NASA, and Canada.'}
          </Item>
          <Item>
            {'The quasars’ K-corrections: Richards et al. 2006, AJ 131, 2766, via VizieR (CDS, Strasbourg).'}
          </Item>
          <Item>
            This research has made use of the NASA/IPAC Extragalactic Database (NED) and the NASA/IPAC Infrared
            Science Archive, which are funded by the National Aeronautics and Space Administration and operated by
            the California Institute of Technology.
          </Item>
          <Item>
            Supernova remnants’ positions and sizes from D. A. Green’s Catalogue of Galactic Supernova Remnants
            (2024 October version), https://www.mrao.cam.ac.uk/surveys/snrs/.
          </Item>
          <Item>
            The supernova remnants’ pictures, adapted — reprojected, their stars and sky taken out — as
            web/public/remnants/CREDITS.md details: the Crab Nebula’s, ESO (eso9948f), CC BY 4.0; Cassiopeia A’s,
            NASA, ESA, and the Hubble Heritage (STScI/AURA)-ESA/Hubble Collaboration. Acknowledgement: Robert A.
            Fesen (Dartmouth College, USA) and James Long (ESA/Hubble) (heic0609a), CC BY 4.0; Kepler’s, NASA, ESA,
            R. Sankrit and W. Blair (Johns Hopkins University) (opo0429i), CC BY 4.0. Tycho’s, NASA/CXC/Rutgers/J.Warren
            &amp; J.Hughes et al.; SN 1006’s, NASA/CXC/Middlebury College/F.Winkler; Puppis A’s, X-ray:
            NASA/CXC/IAFE/G.Dubner et al &amp; ESA/XMM-Newton; Cassiopeia A’s 3D map, Model: NASA/CXC/MIT/T. Delaney
            et al. — Chandra’s, on which NASA asserts no copyright. Vela’s from the Southern H-Alpha Sky Survey
            Atlas (SHASSA), which is supported by the National Science Foundation (Gaustad et al. 2001), © Las
            Cumbres Observatory, for scientific and educational use. The Cygnus Loop’s and IC 443’s from the
            Digitized Sky Surveys, which were produced at the Space Telescope Science Institute under U.S.
            Government grant NAG W-2166, the images of these surveys based on photographic data obtained using
            the Oschin Schmidt Telescope on Palomar Mountain (the Palomar Observatory Sky Surveys, made by the
            California Institute of Technology), through NASA’s SkyView. Their stars found with Gaia DR3 and
            Hipparcos.
          </Item>
          <Item>
            Stellar streams from galstreams, Copyright (c) 2017, Cecilia Mateu, BSD 3-Clause
            (https://github.com/cmateu/galstreams), each track its own paper’s: Antoja et al. 2020 and Ramos et
            al. 2020 (Sagittarius); Price-Whelan et al. 2019 and Bonaca et al. 2020 (Palomar 5); Koposov et al.
            2023 (Orphan–Chenab); Ibata et al. 2021 and 2024; Ramos et al. 2021; Martin et al. 2022; Shipp et
            al. 2018 and 2019; Grillmair 2014, 2017 and 2019; Grillmair et al. 2013; Bonaca et al. 2012 and 2019;
            Martin et al. 2013; Li et al. 2018 and 2021; Fu et al. 2018; Williams et al. 2011; Yam et al. 2013;
            Yuan et al. 2020 and 2021; Thomas &amp; Battaglia 2021; Myeong et al. 2017; Harris 1996; Palau &amp;
            Miralda-Escudé 2019 and 2021; Grillmair &amp; Carlin 2016; Ferguson et al. 2022; Sollima 2020; Jensen
            et al. 2021; Caldwell et al. 2020; Weiss et al. 2018; Perottoni et al. 2019; Balbinot et al. 2016;
            Yang et al. 2022 and 2023; Chandra et al. 2022 — as web/public/streams/CREDITS.md details.
          </Item>
          <Item>
            The Local Bubble’s wall: V. Pelgrims, Harvard Dataverse, doi:10.7910/DVN/RHPVNC; the Radcliffe Wave: R.
            Konietzka, Harvard Dataverse, doi:10.7910/DVN/F98QHY and doi:10.7910/DVN/Q7F4PC; both CC0, adapted as
            web/public/local-ism/CREDITS.md details.
          </Item>
          <Item>
            Open clusters from the Unified Cluster Catalogue, Perren et al. 2023, zenodo.org/records/20705026, CC BY
            4.0. H II regions’ sizes from the WISE Catalog of Galactic H II Regions, Anderson et al. 2014. Positions
            of the notable stars from SIMBAD, CDS, Strasbourg.
          </Item>
          <Item>
            Globular clusters from Holger Baumgardt’s Galactic Globular Cluster Database
            (https://people.smp.uq.edu.au/HolgerBaumgardt/globular/) and the Harris catalogue, Harris 1996
            (2010 edition), https://physics.mcmaster.ca/~harris/mwgc.dat.
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
