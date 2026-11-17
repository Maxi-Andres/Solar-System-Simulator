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
    { id: 'surroundings', label: 'The Sun’s surroundings' },
    { id: 'stars', label: 'Stars' },
    { id: 'alpha-centauri', label: 'Alpha Centauri' },
    { id: 'sirius', label: 'Sirius and its white dwarf' },
    { id: 'exoplanets', label: 'Planets of other stars' },
    { id: 'black-holes', label: 'Black holes' },
    { id: 'galactic-centre', label: 'The Galactic Centre’s stars' },
    { id: 'pulsars', label: 'Pulsars and magnetars' },
    { id: 'globular-clusters', label: 'Globular clusters' },
    { id: 'supernova-remnants', label: 'Supernova remnants' },
    { id: 'nebulae', label: 'Nebulae' },
    { id: 'messier', label: 'Messier objects' },
    { id: 'notable-stars', label: 'Notable stars and black holes' },
    { id: 'streams', label: 'Stellar streams' },
    { id: 'bubbles', label: 'The Fermi and eROSITA bubbles' },
    { id: 'local-ism', label: 'The local interstellar medium' },
    { id: 'galaxy', label: 'The Milky Way' },
    { id: 'local-group', label: 'The Local Group' },
    { id: 'local-volume', label: 'Beyond the Local Group' },
    { id: 'laniakea', label: 'Laniakea and beyond' },
    { id: 'cosmic-web', label: 'The cosmic web' },
    { id: 'quasars', label: 'Quasars, clusters and deep fields' },
    { id: 'universe', label: 'The observable universe' },
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
          <Item>
            The far ones’ sizes: Quaoar by occultation
            <Cite k="bragaRibas2013" />, Sedna, Ixion and Gonggong by their heat
            <Cite k={['pal2012', 'lellouch2013', 'kiss2019']} />, Orcus and Salacia from JPL’s fits of their moons’
            systems. ʻOumuamua’s path includes the push Micheli et al. found
            <Cite k="micheli2018" />, measured only over its 80 days of data.
          </Item>
          <Item>
            Earth’s companions, on JPL’s paths about the Sun: 2025 PN7, a quasi-satellite that loops round
            Earth once a year while bound only to the Sun
            <Cite k="delaFuenteMarcos2025" />, and 2024 PT5, Earth’s mini-moon from 29 September to 25
            November 2024, which never went once round it
            <Cite k="delaFuenteMarcos2024" /> and whose spectrum is lunar rock
            <Cite k="kareta2025" />. Only their brightness is measured, so no size is drawn.
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
          <Item>
            Landing sites, where the hardware was found in orbiters’ images: on the Moon by LRO’s camera, to a
            few metres <Cite k={['wagner2017', 'lroc']} />; on Mars by HiRISE, tied to MOLA to 100–300 m
            <Cite k={['konopliv2026', 'wan2021']} />. Viking 2’s is the NSSDCA’s, which says neither how nor in
            what frame <Cite k="nssdca" />, and Phoenix’s its mission notebook’s; Spirit’s and Opportunity’s last
            stops are their HiRISE landing points plus the drives in NASA’s traverse files, summed here
            <Cite k="merNotebook" />. Each turns with its body by the rotation its map is drawn with, on the
            smooth ellipsoid, and is named only when that body is large on the screen.
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

        <Sub section="measured" id="surroundings">
          The Sun’s surroundings
        </Sub>
        <Items>
          <Item title="The heliosphere’s edges, where crossed">
            Voyager 1 crossed the termination shock on 2004-12-16 at 94.0 AU and the heliopause on 2012-08-25 at
            121.6 AU; Voyager 2 the shock about 2007-08-31 at 83.7 AU and the heliopause on 2018-11-05 at 119.0
            AU
            <Cite k={['stone2005', 'stone2008', 'stone2013', 'stone2019']} />. Each is a mark where the craft was
            that day, from JPL Horizons
            <Cite k="horizons" />. Those four points are all that is measured of either surface.
          </Item>
          <Item title="The interstellar wind">
            The heliosphere faces the interstellar gas flowing in from ecliptic longitude 255.7°, latitude
            5.1°, measured from the neutral helium IBEX sampled
            <Cite k="mccomas2015" />.
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

        <Sub section="measured" id="globular-clusters">
          Globular clusters
        </Sub>
        <Items>
          <Item>
            {data.clusterCatalog == null
              ? 'The Milky Way’s globular clusters'
              : `The Milky Way’s ${data.clusterCatalog.count} globular clusters`}{' '}
            from <Strong>Holger Baumgardt’s database</Strong>: where each is and how it moves, from Gaia EDR3 and
            the radial velocities <Cite k="vasilievBaumgardt2021" />; its distance, from Gaia parallaxes,
            kinematics and the literature together <Cite k="baumgardtVasiliev2021" />; its mass and radii from
            N-body fits <Cite k="baumgardtHilker2018" />; its V magnitude <Cite k="baumgardt2020" />. And from
            the <Strong>Harris catalogue</Strong> <Cite k="harris1996" />, each one’s metallicity and the
            reddening in front of it{data.clusterCatalog == null
              ? ''
              : `, for ${data.clusterCatalog.feH.filter((value) => value !== null).length} of them — the rest were found after its last edition, in 2010`}
            .{' '}
            <Xref to="estimated" sub="globular-clusters">
              How their stars are drawn
            </Xref>
            . Each one’s light, from far off, from its V and distance less the dust in front, A_V = 3.1 E(B−V):
            47 Tucanae M_V −9.3, Omega Centauri −10.5.
          </Item>
        </Items>

        <Sub section="measured" id="supernova-remnants">
          Supernova remnants
        </Sub>
        <Items>
          <Item>
            Nine supernova remnants, each where <Strong>Green’s catalogue</Strong> <Cite k="green2024" /> puts its
            centre, of the size it gives, at a distance measured for it: the Crab Nebula, 2.0 kpc, by the
            expansion of its filaments <Cite k="trimble1968" />; Cassiopeia A, 3.4 kpc, by its knots’ motions
            <Cite k="reed1995" />; Tycho’s, 3.2 kpc, by light echoes <Cite k="neumann2024" />; Kepler’s, 5.1 kpc
            <Cite k="sankrit2016" />, and SN 1006, 2.17 kpc <Cite k="winkler2003" />, by the motions of their
            filaments against their shock speeds; Vela’s, 287 pc, by its pulsar’s parallax <Cite k="dodson2003" />;
            the Cygnus Loop, 725 pc, by Gaia parallaxes of stars in it <Cite k="fesen2021" />; Puppis A, 1.3 kpc,
            kinematically <Cite k="reynoso2017" />; IC 443, 1.73 kpc, by the jump in extinction it makes
            <Cite k="yu2019" />. The panel names each, and says where a distance is disputed.{' '}
            <Xref to="estimated" sub="supernova-remnants">
              What is not drawn
            </Xref>
            .
          </Item>
          <Item>
            Each one’s gas is drawn from a picture of it: how much light comes from each point of its sky,
            reprojected from the picture’s own astrometry. The Crab’s, Kepler’s, the Cygnus Loop’s and IC 443’s
            are in visible light, from ESO’s VLT, Hubble and the Digitized Sky Survey’s photographic plates;
            Cassiopeia A’s in Hubble’s red and near-infrared filters; Vela’s in H-alpha, from SHASSA
            <Cite k="gaustad2001" />; Tycho’s, SN 1006 and Puppis A in X-rays, from Chandra and XMM-Newton, as no
            visible-light picture shows the whole of them. Each one’s credit is in its panel and under Sources.
          </Item>
          <Item>
            Cassiopeia A’s gas is mapped in 3D: <Strong>DeLaney et al. 2010</Strong> <Cite k="delaney2010" />{' '}
            measured the Doppler shifts of its ejecta’s lines — with Spitzer, Chandra and optical spectra — and,
            the ejecta coasting since the explosion, a knot’s velocity towards or away from us is its depth. Its
            light is put at those depths. The Crab Nebula is stretched along its pulsar’s spin axis, whose
            direction Chandra’s images of the X-ray ring round the pulsar give <Cite k="weisskopf2013" />: at
            position angle 298° on the sky, 119° from the line of sight towards us, its north-western end away
            from us.
          </Item>
        </Items>

        <Sub section="measured" id="nebulae">
          Nebulae
        </Sub>
        <Items>
          <Item title="Where and how far">
            Nine star-forming regions at their young stars’ Gaia parallaxes: Orion 403 pc, the Lagoon 1,336, the
            Trifid 1,264, the Eagle 1,740, the Omega 1,680, the Rosette 1,560 <Cite k="kuhn2019" />; Carina 2,350
            <Cite k="goppl2022" />; the Horsehead at σ Orionis’s 387.5, whose light it is <Cite k="schaefer2016" />;
            the Tarantula at the Large Magellanic Cloud’s <Cite k="pietrzynski2019" />. Five planetary nebulae at
            their central stars’ Gaia parallaxes <Cite k="gaiaDr3" />, less its zero-point{' '}
            <Cite k="lindegren2021" />: the Helix 199 pc, the Dumbbell 387, the Southern Ring 748, the Ring 777,
            the Cat’s Eye 1,335.
          </Item>
          <Item title="How big, and what shape">
            The star-forming regions’ sizes are the WISE catalogue’s of H II regions <Cite k="anderson2014" />.
            3D shapes where published: Orion’s blister, open toward us <Cite k="odell2001" />; the Ring’s triaxial
            shell <Cite k="odell2013" />; the Helix’s disk and the torus nearly square to it{' '}
            <Cite k="odell2004" />; the Southern Ring’s bipolar shell <Cite k="monteiro2000" />; the Cat’s Eye’s
            inner bubble <Cite k="reed1999" />; the Dumbbell’s barrel <Cite k="meaburn2005" />. The panel names
            each.{' '}
            <Xref to="estimated" sub="nebulae">
              What is modelled
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="messier">
          Messier objects
        </Sub>
        <Items>
          <Item>
            All 110, each found by its number. 29 are globular clusters, 40 galaxies, one the Crab Nebula and
            seven nebulae above, drawn already. 26 open clusters are marks at their members’ mean Gaia parallax,
            of their half-member radius, from the Unified Cluster Catalogue <Cite k="perren2023" />, less Gaia’s
            zero-point <Cite k="lindegren2021" />; M43 and M78 at the VLBA’s distances to Orion’s young stars{' '}
            <Cite k="kounkel2017" />; the Owl Nebula at its central star’s Gaia parallax; M40 and M73, stars that
            only look close, each star where Gaia puts it <Cite k="odenkirchen2002" />. Not drawn: M24, a star
            cloud at every distance along it, and M76, whose central star’s parallax gives no distance. M102 is
            taken to be NGC 5866, which is disputed.
          </Item>
        </Items>

        <Sub section="measured" id="notable-stars">
          Notable stars and black holes
        </Sub>
        <Items>
          <Item>
            Twenty-five stars, black holes and young clusters the star catalogue does not place, each a mark at a
            distance measured for it: Luhman 16 by its ground-based parallax <Cite k="lazorenko2018" />, WISE
            0855−0714 by Spitzer’s <Cite k="kirkpatrick2021" />; VY Canis Majoris <Cite k="zhang2012" />, V404
            Cygni <Cite k="millerJones2009" /> and GRS 1915+105 <Cite k="reid2014" /> by radio parallaxes; Gaia BH2
            by Gaia’s parallax fitted with its orbit <Cite k="elBadry2023b" />; A0620−00 by its star’s brightness{' '}
            <Cite k="cantrell2010" />; ω Centauri’s black hole <Cite k="haberle2024" /> at the cluster’s distance{' '}
            <Cite k="baumgardtVasiliev2021" />; R136a1 at the Large Magellanic Cloud’s; the Pistol Star, the
            Arches and the Quintuplet at the Galactic Centre’s <Cite k="gravity2024" />; Procyon B at Procyon A’s{' '}
            <Cite k="vanLeeuwen2007" />; Westerlund 1 by its members’ Gaia parallaxes <Cite k="perren2023" />; the
            rest by their own <Cite k="gaiaDr3" />. Positions SIMBAD’s <Cite k="simbad" />. The fast ones — the
            brown dwarfs, the white dwarfs, HD 140283 — move along their measured motion. The panel names each
            source.
          </Item>
        </Items>

        <Sub section="measured" id="streams">
          Stellar streams
        </Sub>
        <Items>
          <Item>
            118 streams of stars torn from globular clusters and dwarf galaxies, each along the track its own
            paper fitted to its stars, as galstreams collects them <Cite k="mateu2023" />: Sagittarius, GD-1,
            Palomar 5, Orphan–Chenab, the Monoceros Ring and the rest, 73 of them from Ibata et al.’s searches of
            Gaia <Cite k={['ibata2021', 'ibata2024']} />. Where on the sky each runs is measured; how far, along
            85; for 32 only one distance for the whole stream; for one, roughly. Their widths on the sky where
            published.{' '}
            <Xref to="estimated" sub="streams">
              What is not
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="bubbles">
          The Fermi and eROSITA bubbles
        </Sub>
        <Items>
          <Item>
            Their outlines on the sky, and nothing of their depth: the Fermi bubbles in gamma rays, 50° above and
            below the Galactic Centre and 40° wide <Cite k="su2010" />; the eROSITA bubbles in soft X-rays, about
            80° across, read as shells some 14 kpc across <Cite k="predehl2020" />.
          </Item>
        </Items>

        <Sub section="measured" id="local-ism">
          The local interstellar medium
        </Sub>
        <Items>
          <Item title="The Local Bubble">
            The hot, thin cavity the Sun is in, walled by dust: its wall where the dust begins along each line of
            sight in a 3D dust map from Gaia and 2MASS <Cite k="lallement2019" />, as Pelgrims et al. fitted it{' '}
            <Cite k="pelgrims2020" />, 88 to 310 pc from the Sun.
          </Item>
          <Item title="The Radcliffe Wave">
            A 2.7-kpc chain of star-forming clouds, Orion to Cygnus, rising and falling across the plane{' '}
            <Cite k="alves2020" />: its best-fit model and its 79 clouds where they are measured{' '}
            <Cite k="konietzka2024" />.
          </Item>
          <Item title="The Local Interstellar Cloud">
            The warm cloud the Sun is just inside: its shape as Linsky et al. fitted it to the hydrogen in front
            of 62 stars <Cite k={['linsky2019', 'redfieldLinsky2000']} />, a few parsecs across.
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

        <Sub section="measured" id="local-group">
          The Local Group
        </Sub>
        <Items>
          <Item>
            The dwarf galaxies about the Milky Way and Andromeda, and the small galaxies out to 3 Mpc, from{' '}
            <Strong>McConnachie’s catalogue</Strong> <Cite k="mcconnachie2012" /> as he keeps it, its January
            2021 version: a hundred and forty, each at the distance its adopted distance modulus gives, on its
            measured centre, with its V corrected for the reddening in front of it, its half-light radius,
            ellipticity and position angle, its central surface brightness, and — where they are measured — its
            radial velocity, its stars’ velocity dispersion, its gas, its [Fe/H] and its proper motion. Two dozen
            faint ones the catalogue marks as of uncertain nature, a dwarf galaxy or a star cluster; their panels
            say so. Two it gives no size are measured elsewhere: <Strong>KK 258</Strong>’s half-light ellipse,
            30″ along its major axis, axis ratio 0.65 at 43° <Cite k="lauberts1989" />, and{' '}
            <Strong>Leo P</Strong>’s shape, ellipticity 0.52 at 335° <Cite k="mcquinn2013" />.
          </Item>
          <Item>
            The four big ones from their own papers. <Strong>Andromeda</Strong> at 761 ± 11 kpc, from Hubble’s
            Cepheids <Cite k="li2021" />; its disc’s scale length, 5.3 kpc, and its bulge, a Sérsic profile of
            index 2.2 and effective radius 1.0 kpc with 23% of its light to the disc’s 73% <Cite k="courteau2011" />
            ; tipped 77° to us, its major axis at 38° <Cite k="devaucouleurs1958" />, its north-west side the
            nearer <Cite k="walterbosKennicutt1988" />; V 3.44 <Cite k="rc3" /> less the 0.21 magnitudes of dust
            in front of its centre <Cite k="schlegel1998" />. <Strong>Triangulum</Strong> at 839 kpc, from
            Cepheids <Cite k="breuval2023" />; tipped 52°, its major axis at 22.5° <Cite k="warner1973" />, its
            disc’s scale length 1.6 kpc <Cite k="kam2015" />. The <Strong>Large Magellanic Cloud</Strong> at
            49.59 kpc, from eclipsing binaries, to one per cent <Cite k="pietrzynski2019" />; tipped 34° about a
            line of nodes at 139°, its north-east side nearer, from its stars’ motions{' '}
            <Cite k="vdMarelKallivayalil2014" />; its scale length 1.4 kpc <Cite k="vdMarel2001" />. The{' '}
            <Strong>Small Magellanic Cloud</Strong> at 62.44 kpc, from eclipsing binaries, which also show it
            deeper along our line of sight than it is wide <Cite k="graczyk2020" />; its old stars’ scale length,
            1.25 kpc, and extent <Cite k="gonidakis2009" />, its axis at 49° <Cite k="harrisZaritsky2006" />.
            Their V from McConnachie’s catalogue.
          </Item>
          <Item>
            <Strong>Andromeda from above</Strong>: where its old stars, its star formation and its dust are,
            from pictures of it with its tilt undone — a thin disc’s picture is itself seen face-on, squeezed
            along its minor axis. Its old stars from WISE’s 3.4 µm, which dust hardly dims; its star formation
            from GALEX’s far-UV and WISE’s 22 µm for what the dust took <Cite k={['leroy2019', 'leroy2008']} />,
            0.33 solar masses a year in all, within the 0.25–0.7 measured for it; its dust from Herschel{' '}
            <Cite k="marsh2018" />. Its bulge fitted and taken off the pictures first: a Sérsic profile of index
            2.0, effective radius 0.9 kpc and flattened to 0.70, near Courteau et al.’s, drawn as a body of its
            own. <Strong>Triangulum from above</Strong> the same way, its dust from Herschel through z0MGS{' '}
            <Cite k="chastenet2025" />: 0.23 solar masses of stars a year, within the 0.2–0.45 measured for it.
            The <Strong>Large Cloud from above</Strong> from its own surveys, nine degrees across the sky: its
            old stars from Spitzer’s 3.6 µm, its star formation from SHASSA’s Hα and Spitzer’s 24 µm{' '}
            <Cite k={['meixner2006', 'gaustad2001', 'kennicutt2009']} /> — 0.17 solar masses a year, within the
            0.1–0.2 measured — and its dust from Herschel, Planck, IRAS and COBE <Cite k="clark2023" />; its
            bar and 30 Doradus at the bar’s east end, as in its photographs. The{' '}
            <Strong>Small Cloud</Strong> as seen from Earth, from the same surveys and its dust from Clark et
            al. — 0.033 solar masses a year — and how deep it lies along each line of sight, on a 51 × 51 grid:
            the mean distance and intrinsic depth of its old stars from OGLE’s RR Lyrae, of its young stars from
            its Cepheids under 150 million years, anchored to 62.44 kpc <Cite k="graczyk2020" />. The young lie
            nearer in the north-east, by 2.3 kpc a degree. Its <Strong>glowing gas</Strong>,
            its HII regions’ light, from SHASSA’s Hα <Cite k="gaustad2001" />.
          </Item>
          <Item>
            Each stands still at its place. Their motions are measured for some — a few hundred km/s at most —
            and over the clock’s centuries they would move a galaxy less than a parsec.{' '}
            <Xref to="estimated" sub="local-group">
              What is not measured
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="local-volume">
          Beyond the Local Group
        </Sub>
        <Items>
          <Item>
            The <Strong>Local Volume</Strong>, out to 11 Mpc, from the <Strong>Updated Nearby Galaxy Catalog</Strong>{' '}
            <Cite k="karachentsev2013" />: 764 galaxies, its 869 less those McConnachie’s catalogue lists, each on
            its centre, at its distance — by the tip of the red giant branch, Cepheids, surface brightness
            fluctuations or Tully–Fisher where it is measured — with its B less the Milky Way’s dust in front{' '}
            <Cite k="schlegel1998" />, its T type and class, its Holmberg diameter, axis ratio and inclination, its
            radial velocity, its gas, and its group: the neighbour whose tide binds it, where its tidal index says
            it is bound.
          </Item>
          <Item>
            The <Strong>Virgo Cluster</Strong>, from the <Strong>Extended Virgo Cluster Catalog</Strong>{' '}
            <Cite k="kim2014" />: 999 of its certain members, each on its centre with its light measured on SDSS’s
            images — V and B−V from its g and r <Cite k="jester2005" />, less the dust in front — and its
            half-light radius. 79 of its early types at the distances their surface brightness fluctuations
            measure, the cluster at 16.5 Mpc <Cite k="mei2007" />.
          </Item>
          <Item>
            Its <Strong>giant ellipticals</Strong> — M87, M49, M86, M84, M60, M85, M89, M59, NGC 4365, NGC 4636,
            NGC 4261 and NGC 4473 — from Kormendy et al.’s Sérsic fits to each one’s whole profile, out to its
            faint envelope: its index, its effective radius along its major axis and the total V it holds{' '}
            <Cite k="kormendy2009" />. The catalogue’s aperture misses that envelope: M87 came out 1.0′ in
            radius and 0.6 magnitudes fainter; its fit’s is 11.7′, its index 11.8.
          </Item>
          <Item>
            Which way each lies on the sky — the position angle of its major axis, and the Virgo galaxies’ axis
            ratios and inclinations — from HyperLEDA <Cite k="makarov2014" />, where it holds the galaxy; for
            the brightest it gives no angle, mostly seen nearly face on, RC3’s <Cite k="rc3" /> or the 2MASS
            Large Galaxy Atlas’s <Cite k="jarrett2003" />.
          </Item>
          <Item>
            Each stands still at its place, as the Local Group’s do.{' '}
            <Xref to="estimated" sub="local-volume">
              What is not measured
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="laniakea">
          Laniakea and beyond
        </Sub>
        <Items>
          <Item>
            <Strong>86,899 galaxies</Strong> out to 703 Mpc, 2.3 billion light years: the{' '}
            <Strong>Cosmicflows-4</Strong> catalogue’s 55,000 measured distances <Cite k="tully2023" /> and the{' '}
            <Strong>2MASS Redshift Survey</Strong>’s 43,000 redshifts <Cite k="huchra2012" />, merged, less the 813
            the Local Group’s and the Local Volume’s catalogues already draw. 32,399 are at their own measured
            distance — by the fundamental plane <Cite k={['howlett2022', 'springob2014']} />, Tully–Fisher{' '}
            <Cite k="kourkchi2020" />, type Ia supernovae, surface brightness fluctuations, the tip of the red giant
            branch, Cepheids — and 22,799 at their group’s, the mean of its members’ measured distances.
          </Item>
          <Item>
            Each one’s light from <Strong>HyperLEDA</Strong> <Cite k="makarov2014" />: its V, less the Milky Way’s
            dust in front <Cite k="schlafly2011" />, where it measures one (4,160); its B, its D25 diameter, axis
            ratio, position angle, inclination and T type. Its K<sub>s</sub> and its isophotal radius from 2MRS.
          </Item>
          <Item>
            The <Strong>groups</Strong> they were placed with: Cosmicflows-4’s and the 2MASS groups{' '}
            <Cite k="tully2015" />, 9,799 in all, a named cluster’s radius and mass from the latter.
          </Item>
          <Item>
            <Strong>Laniakea’s basin</Strong>, and its neighbours’: the watersheds of the Cosmicflows-4 velocity
            field <Cite k={['courtois2023', 'dupuyCourtois2023']} />, each 10.5 Mpc voxel given to the attractor its
            flow ends at — twice, once from the galaxies’ reconstruction and once from the groups’. The first puts
            the Milky Way in a basin of its own, Laniakea, 4.7 million Mpc³; the second in Shapley’s{' '}
            <Cite k="valade2024" />.
          </Item>
          <Item>
            <Strong>Where the galaxies flow</Strong>: the velocity of the same fit, 128³ voxels, published under CC BY
            4.0 with the velocity’s scatter over the fit’s samples <Cite k={['courtois2023', 'courtoisCubes']} />. In
            units of 52 km/s, and its first axis SGZ — the data say so: so read, its divergence is minus the
            density, as linear theory has it, and 98% of the flow lines that reach an attractor end in the basin
            Dupuy &amp; Courtois give their start; the other way, half. The Milky Way’s voxel moves at 460 km/s.
          </Item>
          <Item>
            The <Strong>named structures</Strong>: the clusters by their groups; the superclusters of Einasto et
            al.’s catalogue of Abell clusters <Cite k="einasto1997" />; the Great Attractor where its galaxies were
            seen to stream <Cite k="lyndenBell1988" />, the Norma Cluster near its heart behind the Milky Way’s plane{' '}
            <Cite k="kraanKorteweg1996" />; the voids of Cosmicflows-3’s density <Cite k="tully2019" />; the CfA2 and
            Sloan Great Walls <Cite k={['gellerHuchra1989', 'gott2005']} />. Laniakea itself as first drawn:
            10<sup>17</sup> M☉, 160 Mpc across <Cite k="tully2014" />.
          </Item>
          <Item>
            The redshifts in the frame of the cosmic microwave background, by its dipole{' '}
            <Cite k="planck2020" />.{' '}
            <Xref to="estimated" sub="laniakea">
              What is not measured
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="cosmic-web">
          The cosmic web
        </Sub>
        <Items>
          <Item>
            <Strong>1.8 million galaxies</Strong> of the SDSS’s two redshift surveys, each by its own spectrum’s
            redshift. The DR8 main galaxy sample, 536,633 to z 0.2, with their u g r i z, as Tempel et al.’s group
            catalogue gives it <Cite k={['tempel2012', 'tempel2014']} />; and BOSS DR12’s luminous galaxies, LOWZ
            and CMASS, north and south, 1,258,588 to z 0.95{' '}
            <Cite k={['reid2016', 'alam2015', 'dawson2013', 'eisenstein2011']} />.
          </Item>
          <Item>
            <Strong>The filaments</Strong> found in them. Tempel et al.’s 15,421 in the main sample to z 0.155, by
            the Bisous model: chains of cylinders half an h<sup>−1</sup> Mpc in radius fitted to the galaxies, each
            point with its visit map, the share of the model’s realisations with a filament there{' '}
            <Cite k="tempel2014" />. And Malavasi et al.’s skeleton of BOSS North, the ridges of the galaxies’
            density by DisPerSE at 5σ, 4,762 pieces kept between z 0.15 and 0.75, each point with that density{' '}
            <Cite k="malavasi2020" />.{' '}
            <Xref to="estimated" sub="cosmic-web">
              What is not measured
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="quasars">
          Quasars, clusters and deep fields
        </Sub>
        <Items>
          <Item>
            <Strong>749,742 quasars</Strong> of SDSS DR16Q, every one with a spectrum, out to z 7.02: its 750,414
            but the 665 it marks questionable and the 7 with no redshift{' '}
            <Cite k={['lyke2020', 'ahumada2020', 'blanton2017', 'dawson2016']} />. Each by its redshift — a person’s
            reading of the spectrum where there was one, else the pipelines’ — its PSF g and i magnitudes and the
            Milky Way’s dust in front of it <Cite k="schlafly2011" />. Its luminosity is worked out as the
            catalogue’s own: on every run within 0.0004 mag of DR16Q’s M<sub>i</sub> over 747,956 quasars.
          </Item>
          <Item>
            <Strong>1,088 galaxy clusters</Strong> Planck found over the whole sky by the shadow their hot gas casts
            on the CMB, the Sunyaev–Zeldovich effect: the 1,094 of its 1,653 with a redshift, z 0.011 to 0.972,
            each with its mass from that shadow, 0.8 to 16 × 10<sup>14</sup> M☉ <Cite k="planck2016psz2" />.
          </Item>
          <Item>
            <Strong>Three large quasar groups</Strong>, each at the mean place and redshift of its members as its
            paper lists them, SDSS DR7 quasars linked within 100 Mpc: the Clowes–Campusano LQG, 34 quasars at z
            1.19–1.42, first seen in 1991; U1.11, 38 at z 1.00–1.20; and the Huge-LQG, 73 at z 1.17–1.37{' '}
            <Cite k={['clowesCampusano1991', 'clowes2012', 'clowes2013']} />.
          </Item>
          <Item>
            <Strong>Four deep fields</Strong>, each at its centre and as wide as its area: the Hubble Ultra Deep
            Field, 11 arcmin² <Cite k="beckwith2006" />; JADES in GOODS-S, 245{' '}
            <Cite k={['eisenstein2023', 'johnson2026']} />; COSMOS-Web, 0.54 deg² <Cite k="casey2023" />; and
            Webb’s First Deep Field, SMACS 0723 <Cite k="pontoppidan2022" />. Each as deep as its farthest galaxy
            confirmed by a spectrum: JADES-GS-z13-0, z 13.2 <Cite k="curtisLake2023" />; JADES-GS-z14-0, 14.1796{' '}
            <Cite k="carniani2024" />; MoM-z14, 14.44 <Cite k="naidu2026" />; and 4590, 8.498{' '}
            <Cite k="carnall2023" />.{' '}
            <Xref to="estimated" sub="quasars">
              What is not measured
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="measured" id="universe">
          The observable universe
        </Sub>
        <Items>
          <Item>
            The <Strong>cosmic microwave background</Strong>: Planck’s 2018 map of its temperature, by the SMICA
            component separation, its 50 million pixels of 1.7′ at 5′ resolution, the Milky Way’s plane and the
            bright sources inpainted <Cite k={['planck2020compsep', 'gorski2005']} />. Each point its difference
            from the mean, 2.7255 K <Cite k="fixsen2009" />, the dipole of our own motion taken out: a hundred
            microkelvin, typically.
          </Item>
          <Item>
            The <Strong>cosmology</Strong> every distance past Laniakea is in: Planck 2018’s, fitted to that sky —
            H<sub>0</sub> 67.66 km/s/Mpc, Ω<sub>m</sub> 0.3111, an age of 13.787 billion years, last scattering at z
            1089.8 <Cite k="planck2020params" />.
          </Item>
          <Item>
            The <Strong>record-holders</Strong>, each by its redshift and its place on the sky: MoM-z14, z 14.44{' '}
            <Cite k="naidu2026" />; JADES-GS-z14-0, 14.1796 <Cite k={['carniani2024', 'carniani2025', 'schouws2025']} />;
            GN-z11, 10.6034 <Cite k="bunker2023" />; UHZ1, 10.073 <Cite k={['goulding2023', 'bogdan2024']} />; HD1, 4.0{' '}
            <Cite k={['harikane2022', 'harikane2025']} />; Earendel’s galaxy, 5.926 <Cite k={['welch2022', 'pascale2025']} />;
            the quasars EUCL J1729+6410, 7.77 <Cite k="yang2026" />, and J0313−1806, 7.6423 <Cite k="wang2021" />;
            the gamma-ray bursts 090423, 8.26 <Cite k={['tanvir2009', 'salvaterra2009']} />, 250314A, 7.3{' '}
            <Cite k={['cordier2025', 'levan2025']} />, and 221009A, 0.151 <Cite k="malesani2025" />; TON 618, 2.219{' '}
            <Cite k="shemmer2004" />; El Gordo, 0.870 <Cite k="menanteau2012" />; Abell 2744, 0.308{' '}
            <Cite k="jauzac2016" />; the Bullet Cluster, 0.296 <Cite k="clowe2006" />; the Saraswati Supercluster,
            0.28 <Cite k="bagchi2017" />; ASASSN-15lh, 0.2326 <Cite k={['dong2016', 'leloudas2016']} />; 3C 273,
            0.1583. All spectroscopic but GRB 090429B’s, 9.4 from its colours <Cite k="cucchiara2011" />. Positions
            from the papers, else NED <Cite k="ned" />.{' '}
            <Xref to="estimated" sub="universe">
              What is not measured
            </Xref>
            .
          </Item>
        </Items>
      </>
    );
  },
};
