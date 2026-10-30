import { Cite, Item, Items, Strong, Sub, Why, Xref } from './prose.tsx';
import type { AboutSection } from './section.ts';
import {
  beltSentence,
  capitalised,
  CLOSE_ORBIT_MONTHS,
  craftCount,
  satelliteAccuracySentence,
  smallBodySentence,
  smallMoonSentence,
  spelled,
} from './sentences.ts';

/**
 * What is measured: the real data, domain by domain, with how closely the scene holds it.
 * Estimates and conventions for whatever the data leaves open are the next section's.
 */
export const measuredSection: AboutSection = {
  id: 'measured',
  tab: 'Measured',
  title: 'What is measured',
  blurb: 'The real data in the scene, domain by domain, where it comes from and how closely it is followed.',
  subsections: [
    { id: 'planets', label: 'Planets and moons' },
    { id: 'small-bodies', label: 'Asteroids and comets' },
    { id: 'spacecraft', label: 'Spacecraft' },
    { id: 'satellites', label: 'Earth satellites' },
    { id: 'stars', label: 'Stars' },
    { id: 'alpha-centauri', label: 'Alpha Centauri' },
    { id: 'sirius', label: 'Sirius and its white dwarf' },
    { id: 'exoplanets', label: 'Planets of other stars' },
    { id: 'black-holes', label: 'Black holes' },
    { id: 'galactic-centre', label: 'The Galactic Centre’s stars' },
    { id: 'pulsars', label: 'Pulsars and magnetars' },
    { id: 'galaxy', label: 'The Milky Way' },
  ],
  Body: ({ data }) => {
    const { store, stars, beltInfo, beltTiers, satelliteInfo, stars3dInfo, exoplanetCatalog, pulsarCatalog } = data;
    const pulsarCounts = pulsarCatalog?.counts ?? null;
    const smallMoons = smallMoonSentence(store);
    return (
      <>
        <Sub section="measured" id="planets">
          Planets and moons
        </Sub>
        <Items>
          <Item>
            Positions and velocities, interpolated from JPL state vectors
            <Cite k="horizons" />. Error against JPL at finer resolution: 32 m for Earth, 9.7 km for Mercury.{' '}
            <Xref to="physics" sub="interpolation">
              How they are interpolated
            </Xref>
            .
          </Item>
          <Item>
            Twenty-one moons — every one massive enough to have pulled itself round, plus Phobos and Deimos —
            from JPL’s own satellite ephemerides, measured from their planet’s centre. Each is sampled finely
            enough to land within a hundredth of its own radius, which for Phobos, round Mars every 7 hours 39
            minutes, means every fifteen minutes. Its worst error is 48 metres.
          </Item>
          {smallMoons !== '' && <Item>{smallMoons}</Item>}
          <Item>
            Radii and polar flattening from the IAU 2015 report
            <Cite k="archinal2018" /> — Saturn really is 9.8% shorter pole to pole.
          </Item>
          <Item>
            Rotation at each body’s real sidereal rate, retrograde where it is retrograde: Venus, Uranus and
            Pluto.
          </Item>
          <Item>
            Axis direction and prime meridian from the IAU rotational elements
            <Cite k="archinal2018" />, so each body is turned the way it is actually turned. Checked against
            JPL’s own sub-solar point for every planet: worst disagreement 0.0026°.{' '}
            <Xref to="physics" sub="rotation">
              The rotation model
            </Xref>
            .
          </Item>
          <Item>
            The moons are turned and shaped the same way, from the IAU model in the form JPL publishes it —
            every periodic term kept, because some are anything but small: Mimas’s face swings 45° over 71
            years, dragged by its resonance with Tethys, and Triton’s pole circles by 32°. Each is the real
            triaxial shape, long axis on its planet: Phobos is 26 by 23 by 18 km. Checked against JPL for all
            twenty-one: poles within 0.002°, and the face each turns to its planet within 0.007°.
          </Item>
          <Item>
            Surface maps registered to that axis, checked against the images’ own pixels. Earth’s noon really
            falls on Greenwich, and the daylit half is the half that should be lit. What the maps themselves
            are, and are not:{' '}
            <Xref to="estimated" sub="maps">
              Not known › Surface maps
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="small-bodies">
          Asteroids and comets
        </Sub>
        <Items>
          <Item>
            {smallBodySentence(store)}
            <Cite k="sbdb" />
          </Item>
          {beltInfo !== null && <Item>{beltSentence(beltInfo, beltTiers)}</Item>}
          <Item>
            How far the belt and the comets drift from their real paths, and what their dots mean:{' '}
            <Xref to="estimated" sub="small-bodies">
              Not known › Asteroids and comets
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="spacecraft">
          Spacecraft
        </Sub>
        <Items>
          <Item>
            {`${capitalised(spelled(craftCount(store)))} spacecraft — the ones travelling between the planets, the observatories at the Lagrange points, the craft orbiting Mars, the Moon and Jupiter, two rovers and a lander on Mars, and five that ended inside the window, Cassini among them — each from its own JPL trajectory, reconstructed from tracking where it has been and predicted where it is going. A spacecraft’s path is not an orbit, so no single step can follow it: Juice cruises for months on a curve one sample a day follows well inside a kilometre, then passes 8,640 km above Earth at 13 km/s. So the sampling refines itself, down to a minute, wherever the curve would stray from JPL’s by more than its tolerance: a kilometre near a body, and away from one an angle — ten microradians seen from the nearest, 15 km at the L1 point. That is about a fortieth of a pixel from Earth, and it is what stops the sampling chasing the few-kilometre steps where JPL’s trajectory files for those craft meet, about weekly. The orbiters of Mars and the Moon are the expensive ones — MRO goes round Mars every 112 minutes, all of it within the kilometre — so they are followed for ${spelled(CLOSE_ORBIT_MONTHS)} months either side of the build rather than ten years, and are absent outside that; Juno, whose orbit takes weeks, for the whole window.`}
          </Item>
          <Item>
            {`Not every spacecraft is here — ${spelled(craftCount(store))} are: those between the planets, at the Lagrange points, around the Moon and Mars, on the ground on Mars, and Juno, Cassini and Akatsuki at their planets. NASA Eyes shows 174, a chosen set of science missions. JPL Horizons, the source of every path here, carries about 276 spacecraft, spent rocket stages included. Around Earth, the tens of thousands of tracked objects — communications constellations such as Starlink, weather and navigation satellites, rocket bodies and debris — are the Satellites layer’s, from the public orbital elements CelesTrak publishes.`}
          </Item>
          <Item>
            Up close, spacecraft are their agencies’ own 3D models, at their true size in metres — Europa
            Clipper is 30.5 m across against a 3,100 km Europa. The named Earth satellites are drawn the same
            way, the International Space Station 109 m across. Whose each model is:{' '}
            <Xref to="sources" sub="models">
              Sources › 3D models
            </Xref>
            ; what stands in where there is none:{' '}
            <Xref to="estimated" sub="spacecraft">
              Not known › Spacecraft
            </Xref>
            .
          </Item>
          <Item>
            Spacecraft trails drawn from JPL’s samples themselves, never from an ellipse: a craft changes
            orbit at every flyby and an ellipse would be wrong on both sides of one. The line is held to a
            fixed angle — a tenth of a milliradian, a quarter of a pixel — as seen from the nearest planet, so
            a flyby keeps every kilometre of its detail while a cruise through empty space costs a handful of
            points; and around the craft itself it is redrawn every frame from the same data the craft is
            placed with, so it runs into the marker at any zoom. It is a trail, as NASA Eyes draws one: only
            where the craft has been, reaching back one period of the orbit it is on now and fading with age,
            so Parker Solar Probe shows the loop it has just flown — bright at the craft, gone a period ago —
            rather than all of them.
          </Item>
        </Items>

        <Sub section="measured" id="satellites">
          Earth satellites
        </Sub>
        <Items>
          <Item>
            {satelliteAccuracySentence(satelliteInfo)}
            <Cite k={['celestrak', 'vallado2006']} />
          </Item>
        </Items>

        <Sub section="measured" id="stars">
          Stars
        </Sub>
        <Items>
          <Item>
            {`The sky is ESA’s Hipparcos and Tycho-2 catalogues together: every one of the ${stars.count.toLocaleString('en-US')} stars down to magnitude ${stars.magnitudeLimit} is a real star, at its own right ascension and declination, moving at its own proper motion, and coloured from its own measured B−V through Planck’s law and the CIE observer — so Betelgeuse is orange because it is 3,600 K. The check is Orion’s belt: nobody arranged those three stars, and if the epoch shift and the rotation into the ecliptic are right they land in a row on their own. They do, with Alnilam 0.09° off the line across a 2.74° span, which is the sky’s own figure.`}
            <Cite k={['hipparcos', 'hog2000']} />{' '}
            <Xref to="physics" sub="colour">
              How a B−V becomes a colour
            </Xref>
            .
          </Item>
          <Item>
            Past the Solar System the stars are drawn at their real distances: every star with a parallax
            measured well enough to place it, from <Strong>ESA Gaia</Strong> DR3
            <Cite k="gaiaDr3" /> or the <Strong>Hipparcos</Strong> new reduction (van Leeuwen 2007)
            <Cite k="vanLeeuwen2007" />, and the <Strong>Gaia Catalogue of Nearby Stars</Strong> (Gaia
            Collaboration, Smart et al. 2021)
            <Cite k="gcns" />, the census of everything within 100 parsecs. Each moves on its own measured
            motion, in three dimensions where its radial velocity was measured — Gaia DR3’s, or where Gaia has
            none, as for the brightest stars its spectrometer saturates on, the{' '}
            <Strong>Pulkovo Compilation of Radial Velocities</Strong> (Gontcharov 2006)
            <Cite k="gontcharov2006" /> — and across the sky only where it was not, and its brightness is
            worked out from wherever the camera is — so from the Sun they are the same sky as above, and from
            Alpha Centauri the Sun is a yellow star of magnitude 0.4.{' '}
            <Xref to="physics" sub="magnitudes">
              The distance modulus
            </Xref>
            .
          </Item>
          <Item>
            The Sun becomes one of these stars once its disc is smaller than a pixel: absolute magnitude 4.81
            (Willmer 2018)
            <Cite k="willmer2018" />.
          </Item>
          {stars3dInfo !== null && (
            <Item>
              {`${stars3dInfo.count.toLocaleString('en-US')} stars in 3D, ${stars3dInfo.counts.withinTenParsecs.toLocaleString('en-US')} of them within ten parsecs; ${stars3dInfo.sky.atInfinity.toLocaleString('en-US')} of the sky’s stays at infinity. Read through ${stars3dInfo.sources.map((entry) => `${entry.via} (${entry.table})`).join(' and ')}, ${stars3dInfo.queriedAt.slice(0, 10)}.`}
            </Item>
          )}
        </Items>

        <Sub section="measured" id="alpha-centauri">
          Alpha Centauri
        </Sub>
        <Items>
          <Item>
            Alpha Centauri moves as measured. A and B follow the orbit of{' '}
            <Strong>Kervella et al. 2016</Strong>
            <Cite k="kervella2016" />, checked against the positions Hipparcos measured in 1991 and the NTT in
            2009, about the barycentre whose position and motion{' '}
            <Strong>Kervella, Thévenin &amp; Lovis 2017</Strong>
            <Cite k="kervellaTL2017" /> give; their radii are the interferometric ones of{' '}
            <Strong>Kervella et al. 2017</Strong>
            <Cite k="kervella2017" />.
          </Item>
          <Item>
            Proxima’s orbit about the pair is worked out as Kervella, Thévenin &amp; Lovis worked it out, from
            its position and its velocity relative to the barycentre — their velocity, corrected for
            gravitational redshift and convective shift — and it gives back their 8,700 AU and 547,000 years.
            <Why>
              Proxima moves about the pair at only 273 m/s, so those corrections are most of the answer.
            </Why>
          </Item>
          <Item>
            Alpha Centauri’s three stars are spheres of their measured radii. How they are lit and coloured:{' '}
            <Xref to="choices" sub="stars">
              Choices › Stars
            </Xref>
            ;{' '}
            <Xref to="estimated" sub="stars">
              what is borrowed
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="sirius">
          Sirius and its white dwarf
        </Sub>
        <Items>
          <Item>
            Sirius A and Sirius B follow the orbit of <Strong>Bond et al. 2017</Strong>
            <Cite k="bond2017" />: fifty years, B between 8 and 31 AU from A, with their dynamical masses —
            2.063 Suns for A, 1.018 for B — and the system’s distance, 2.639 pc. Sirius B, the white dwarf, is
            a sphere of the radius HST’s spectra give it, 0.008098 of the Sun’s: 5,630 km, smaller than the
            Earth, with the mass of the Sun. Sirius A’s radius is the interferometric one of{' '}
            <Strong>Davis et al. 2011</Strong>
            <Cite k="davis2011" />.
          </Item>
          <Item>
            The pair’s barycentre is not published; it is worked out here from Sirius A’s Hipparcos position
            and motion in 1991 <Cite k="vanLeeuwen2007" />, less A’s own motion on the orbit then, and moves
            straight at Bond et al.’s system velocity, −8.47 km/s.
            <Why>
              Hipparcos caught A three years before periastron, 0.46″ a year of its motion its orbit’s; drawn
              on that line it would have left the orbit by arcseconds, AU at this distance.
            </Why>
          </Item>
        </Items>

        <Sub section="measured" id="exoplanets">
          Planets of other stars
        </Sub>
        <Items>
          <Item title="Proxima">
            Proxima’s planets are <Strong>b</Strong> (Anglada-Escudé et al. 2016)
            <Cite k="angladaEscude2016" />, with its conjunction from <Strong>Damasso et al. 2020</Strong>
            <Cite k="damasso2020" /> and its distance and mass from <Strong>Faria et al. 2022</Strong>
            <Cite k="faria2022" />; <Strong>d</Strong>, from Faria et al. 2022, confirmed by Suárez Mascareño
            et al. 2025
            <Cite k="suarezMascareno2025" />; and the candidate <Strong>c</Strong>, from Damasso et al. 2020.
            Which are confirmed is the NASA Exoplanet Archive’s word.
          </Item>
          <Item title="Four more nearby stars">
            Four more nearby stars have their planets, each read from the paper that fitted it.{' '}
            <Strong>Tau Ceti</Strong>’s four from <Strong>Feng et al. 2017</Strong>
            <Cite k="feng2017" />, signals under 0.6 m/s that the Archive lists with its controversy flag — e
            not at all — so all four are drawn grey and named disputed or candidate.{' '}
            <Strong>Epsilon Eridani b</Strong> from <Strong>Thompson et al. 2025</Strong>
            <Cite k="thompson2025" />, the one orbit here oriented on the sky by measurement — Hipparcos,
            Hubble and Gaia astrometry with the radial velocities, a Jupiter mass at 40° — with its
            conjunction from <Strong>Harada et al. 2025</Strong>
            <Cite k="harada2025" />. <Strong>Barnard’s Star</Strong>’s four from{' '}
            <Strong>Basant et al. 2025</Strong>
            <Cite k="basant2025" />, b first found by González Hernández et al. 2024
            <Cite k="gonzalezHernandez2024" />. <Strong>51 Pegasi b</Strong>, the first planet found about a
            Sun-like star (Mayor &amp; Queloz 1995)
            <Cite k="mayorQueloz1995" />, tilted 49.8° as its own light gives it in{' '}
            <Strong>Cont et al. 2026</Strong>
            <Cite k="cont2026" />. The four stars are spheres of their interferometric radii, as Alpha
            Centauri’s are: Tau Ceti 0.793 R☉ (Teixeira et al. 2009)
            <Cite k="teixeira2009" />, Epsilon Eridani 0.74 (Baines &amp; Armstrong 2012)
            <Cite k="bainesArmstrong2012" />, Barnard’s Star 0.1869 and 51 Pegasi 1.15 (Boyajian et al. 2012,
            2013)
            <Cite k={['boyajian2012', 'boyajian2013']} />.
          </Item>
          <Item title="Every other confirmed planet">
            Every other star with a confirmed planet is from the <Strong>NASA Exoplanet Archive</Strong>’s
            Planetary Systems Composite Parameters (pscomppars, DOI 10.26133/NEA13)
            <Cite k="nea" />
            {exoplanetCatalog == null
              ? ''
              : `, queried ${exoplanetCatalog.source.queriedAt.slice(0, 10)}: ${exoplanetCatalog.counts.planets.toLocaleString('en-US')} planets about ${exoplanetCatalog.counts.hosts.toLocaleString('en-US')} stars. ${(exoplanetCatalog.counts.matchedByGaia + exoplanetCatalog.counts.matchedByHip).toLocaleString('en-US')} of the stars are among the 3D stars, found by their Gaia DR3 or Hipparcos number, and ride on them; the other ${exoplanetCatalog.counts.placedFromArchive.toLocaleString('en-US')} — most of the Kepler and TESS stars, past the census — stand where the Archive’s position, distance and motion put them${exoplanetCatalog.counts.unplaced > 0 ? `, and ${exoplanetCatalog.counts.unplaced} with no distance are not placed` : ''}`}
            . The Exoplanet Hosts layer rings each on the map, with a dot on the ring for each of its planets.
            Gone to, a star is a sphere of the Archive’s radius, and its planets are on the Archive’s orbits:
            one seen to transit is a sphere of its measured radius, at its measured tilt. The composite table
            takes each number from whichever paper the Archive judged best, so one planet’s may come from
            several; each panel names its orbit’s. Proxima’s and the four systems above keep their papers’
            orbits. Everything else the Archive leaves open — size, tilt, node, phase — is filled by stated
            conventions:{' '}
            <Xref to="estimated" sub="exoplanets">
              Not known › Planets of other stars
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="black-holes">
          Black holes
        </Sub>
        <Items>
          <Item>
            The black holes are spheres of their event horizons at true size: Sgr A*’s 12.7 million km in
            radius, a fifth of the way out to Mercury’s orbit; Gaia BH1’s 28 km, Gaia BH3’s 97 km and Cygnus
            X-1’s 63 km, smaller than a city and below a pixel from anywhere farther than a few thousand
            kilometres.{' '}
            <Xref to="physics" sub="black-holes">
              The horizon’s equation, and what is not drawn
            </Xref>
            .
          </Item>
          <Item title="Sgr A* and S2">
            <Strong>Sgr A*</Strong>’s mass, 4.2996 million Suns, and distance, 8,275.9 parsecs, from{' '}
            <Strong>GRAVITY Collaboration 2024</Strong>
            <Cite k="gravity2024" />, the orbits of four stars about it, and S2’s orbit from the same table;
            its place on the sky and motion across it from <Strong>Gordon et al. 2023</Strong>
            <Cite k="gordon2023" />, radio astrometry in the ICRF3 frame — the motion being the Sun’s own
            about the Galaxy — and the Sun’s 11.1 km/s toward the centre from Schönrich, Binney &amp; Dehnen
            2010
            <Cite k="schoenrich2010" />; S2’s temperature, radius and mass, fitted to its spectrum, from
            Habibi et al. 2017
            <Cite k="habibi2017" />. S2 follows its measured orbit as a Kepler ellipse.
          </Item>
          <Item title="Gaia BH1 and Gaia BH3">
            <Strong>Gaia BH1</Strong> and its Sun-like star from <Strong>El-Badry et al. 2023</Strong>
            <Cite k="elBadry2023" />, their joint fit of the Gaia orbit and the star’s radial velocities;{' '}
            <Strong>Gaia BH3</Strong> and the giant LS II +14 13 from{' '}
            <Strong>Gaia Collaboration, Panuzzo et al. 2024</Strong>
            <Cite k="panuzzo2024" />. Both orbits are oriented on the sky as measured, and the drawn
            separations follow from Kepler’s law and the masses, within 1% of the papers’.{' '}
            <Xref to="physics" sub="third-law">
              Kepler’s third law
            </Xref>
            .
          </Item>
          <Item title="Cygnus X-1">
            <Strong>Cygnus X-1</Strong>, the first black hole known, and its supergiant HDE 226868 from{' '}
            <Strong>Miller-Jones et al. 2021</Strong>
            <Cite k="millerJones2021" />: 21.2 Suns, 2.22 kpc away by its radio parallax, the orbit’s size,
            shape and tilt from the star’s light and velocities, and its turning sense on the sky from the
            radio. The period from <Strong>Brocksopp et al. 1999</Strong>
            <Cite k="brocksopp1999" />, and the time the star passes in front of the hole and the system’s
            own velocity from <Strong>Gies et al. 2003</Strong>
            <Cite k="gies2003" />. Its spin is measured, near the maximum, from its disc’s X-rays (
            <Strong>Zhao et al. 2021</Strong>
            <Cite k="zhao2021" />); it is not drawn.{' '}
            <Xref to="estimated" sub="black-holes">
              What is assumed
            </Xref>
            .
          </Item>
          <Item title="M87*">
            M87*’s mass and distance from the <Strong>Event Horizon Telescope Collaboration 2019</Strong>
            <Cite k="eht2019" />.
          </Item>
          <Item>
            Each black hole, like every star here, is where it is seen: the light from Sgr A* left it 27,000
            years ago.
          </Item>
        </Items>

        <Sub section="measured" id="galactic-centre">
          The Galactic Centre’s stars
        </Sub>
        <Items>
          <Item title="The S-stars">
            38 stars on their orbits round Sgr A*, from <Strong>Gillessen et al. 2017</Strong>
            <Cite k="gillessen2017" />, 25 years of astrometry and spectroscopy — S29, S38 and S55 on GRAVITY’s
            newer elements <Cite k="gravity2024" />. Each is a Kepler ellipse at GRAVITY’s mass and distance;
            the periods come out within 1.6% of the published ones, or inside their errors. S2 is its own
            body; S111 is left out (
            <Xref to="estimated" sub="nuclear-cluster">
              Not known › The nuclear star cluster
            </Xref>
            ).
          </Item>
          <Item title="The young stars">
            70 of the young massive stars of the central parsec — Wolf-Rayet stars, O and B supergiants — where
            they are seen on the sky, from <Strong>Paumard et al. 2006</Strong>
            <Cite k="paumard2006" />; 22 of them with a measured depth, in the disc they orbit in. The other 20
            of their 90 lie in the S-stars’ own arcsecond or are S-stars already on orbits.
          </Item>
          <Item title="IRS 7">
            The red supergiant IRS 7, the brightest star of the central parsec in the infrared, at its maser’s
            place 5.5″ north of Sgr A* <Cite k="reid2003" />, with its brightness and temperature from Paumard
            et al. 2014 <Cite k="paumard2014" />.
          </Item>
          <Item title="Their light">
            Each from its measured K magnitude, less the extinction measured toward it, 2.42 and 2.62 magnitudes
            in K <Cite k="fritz2011" />, at GRAVITY’s distance; their colours from their spectra: S-star
            temperatures from Habibi et al. 2017 <Cite k="habibi2017" />, those of hot stars from Pecaut &amp;
            Mamajek 2013 <Cite k="pecautMamajek2013" />.{' '}
            <Xref to="physics" sub="nuclear-cluster">
              From K to V
            </Xref>
            .
          </Item>
          <Item>
            Around them, the rest of the nuclear star cluster is a model:{' '}
            <Xref to="estimated" sub="nuclear-cluster">
              Not known › The nuclear star cluster
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="pulsars">
          Pulsars and magnetars
        </Sub>
        <Items>
          <Item title="Which">
            Every pulsar in the <Strong>ATNF Pulsar Catalogue</Strong>
            <Cite k="atnf" /> that can be placed, and the magnetars of the <Strong>McGill Magnetar Catalog</Strong>
            <Cite k="mcgill" />, one entry per neutron star
            {pulsarCatalog == null || pulsarCounts == null
              ? '.'
              : ` — ATNF version ${pulsarCatalog.sources.atnf.version}, read ${pulsarCatalog.sources.atnf.queriedAt.slice(0, 10)}: ${pulsarCounts.placed.toLocaleString('en-US')} placed of ${pulsarCounts.listed.toLocaleString('en-US')}, ${pulsarCounts.magnetars} of them magnetars, ${pulsarCounts.binaries} in binaries and ${pulsarCounts.inGlobularClusters} in globular clusters.`}{' '}
            Where each is on the sky is its timing or X-ray position, moved along its proper motion where one is
            measured.
          </Item>
          <Item title="How far">
            By the catalogue’s own rule: a distance measured some other way where there is one — the
            globular cluster or supernova remnant it is in, an absorption line, a companion’s parallax — else
            its own parallax where that is more than three times its error, else its{' '}
            <Strong>dispersion measure</Strong> through the YMW16 model of the Galaxy’s free electrons
            <Cite k="ymw16" />, held between independent limits where it has them. A magnetar takes McGill’s
            distance, each from a measurement its paper cites
            {pulsarCounts == null
              ? '.'
              : `. Of those placed: ${pulsarCounts.byMethod.independent} measured another way, ${pulsarCounts.byMethod.parallax} by parallax, ${pulsarCounts.byMethod.bounded} by dispersion within limits, ${pulsarCounts.byMethod.dm.toLocaleString('en-US')} by dispersion alone and ${pulsarCounts.byMethod.magnetar} from McGill.`}{' '}
            The panel says which, and whose.{' '}
            <Xref to="estimated" sub="pulsars">
              How rough the dispersion distances are
            </Xref>
            .
          </Item>
          <Item title="How big">
            Three neutron stars have measured radii, from NICER’s X-ray pulses off their hot polar caps: PSR
            J0030+0451, 12.71 km <Cite k="riley2019" />; PSR J0740+6620, 12.39 km <Cite k="riley2021" />; PSR
            J0437−4715, 11.36 km <Cite k="choudhury2024" />. Each is drawn at its own.
          </Item>
          <Item title="Spin">
            Each one’s period and how fast it lengthens, as timed; the panel gives the field and age that
            spin-down implies.{' '}
            <Xref to="physics" sub="pulsars">
              The equations
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="galaxy">
          The Milky Way
        </Sub>
        <Items>
          <Item>
            The galaxy’s shape is measured — how the stars thin out away from the centre and the plane, the
            bar and the bulge, and the spiral arms, traced by the parallaxes of masers in young star-forming
            regions. The arms are drawn where parallaxes were measured, and fade out past that, around the far
            side of the galaxy, where none have been measured yet. The dust is the measured dust disc, with
            lanes along the inner edges of the arms.
          </Item>
          <Item>
            The Milky Way model is built from two papers, read in the original: the spiral arms from{' '}
            <Strong>Reid et al. 2019</Strong>
            <Cite k="reid2019" />, Table 2 — seven arms as log-periodic spirals with a kink, their pitch
            angles and widths, with the Galactic centre at 8.15 kpc; and the thin and thick discs, the
            box/peanut bulge, the long bar and the Sun’s 25 pc above the plane from{' '}
            <Strong>Bland-Hawthorn &amp; Gerhard 2016</Strong>
            <Cite k="blandHawthorn2016" />, its best values; and the dust disc — its scale length, its
            thickness and how it flares, and the hole in its middle — from{' '}
            <Strong>Drimmel &amp; Spergel 2001</Strong>
            <Cite k="drimmelSpergel2001" />, Table 1, fitted to COBE’s far-infrared sky. The galactic frame is
            the IAU’s, through the ICRS pole and centre.
          </Item>
          <Item>
            What of it is a model rather than a map, and why:{' '}
            <Xref to="estimated" sub="galaxy">
              Not known › The galaxy
            </Xref>{' '}
            and{' '}
            <Xref to="choices" sub="galaxy">
              Choices › The galaxy’s light
            </Xref>
            .
          </Item>
        </Items>
      </>
    );
  },
};
