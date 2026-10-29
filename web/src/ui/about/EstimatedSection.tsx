import { frac, math, mi, mn, mo, mtext, paren, row, sub, sup, table } from './math.ts';
import { Cite, Equation, Item, Items, Prose, Sub, Why, Xref } from './prose.tsx';
import type { AboutSection } from './section.ts';
import { beltAccuracySentence, cometAccuracySentence, seamSentence } from './sentences.ts';

/**
 * Where the data runs out and something else stands in: every estimate and convention,
 * the relation it uses, and why that one. The equations proper are Physics'.
 */
export const estimatedSection: AboutSection = {
  id: 'estimated',
  tab: 'Not known',
  title: 'What is not known, and how it is filled',
  blurb:
    'Where no measurement exists, something still has to be drawn. Each stand-in here is stated, with the relation it uses and why it is that one.',
  subsections: [
    { id: 'markers', label: 'No size known' },
    { id: 'window', label: 'Outside the data' },
    { id: 'exoplanets', label: 'Planets of other stars' },
    { id: 'stars', label: 'Stars' },
    { id: 'black-holes', label: 'Black holes' },
    { id: 'spacecraft', label: 'Spacecraft' },
    { id: 'small-bodies', label: 'Asteroids and comets' },
    { id: 'maps', label: 'Surface maps' },
    { id: 'earth', label: 'Earth' },
    { id: 'galaxy', label: 'The galaxy' },
  ],
  Body: ({ data }) => {
    const { store, beltInfo, cometInfo, exoplanetCatalog } = data;
    const earth = (symbol: string) => sub(mi(symbol), mo('⊕'));
    const power = (index: string) => row(mi('R'), mo('∝'), sup(mi('M'), mn(index)));
    const upTo = (limit: string, unit: ReturnType<typeof row>) => row(mi('M'), mo('≤'), mn(limit), unit);
    return (
      <>
        <Sub section="estimated" id="markers">
          No size known
        </Sub>
        <Items>
          <Item title="Markers, not spheres">
            A body with no measured size or shape is drawn as a marker: most of the small moons, and the named
            small bodies no team has published a shape of.
            <Why>
              a sphere of a size nobody has measured would look exactly like one that was measured. The same
              marker stands in for any body under about three pixels, however well its size is known — see{' '}
              <Xref to="overview" sub="what">
                Overview
              </Xref>
              .
            </Why>
          </Item>
          <Item title="Spacecraft with no model">
            Where no 3D model may be used, a box of the craft’s published size —{' '}
            <Xref to="estimated" sub="spacecraft">
              below
            </Xref>
            .
          </Item>
          <Item title="Planets of other stars">
            Sized from their mass where no transit measured them —{' '}
            <Xref to="estimated" sub="exoplanets">
              below
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="estimated" id="window">
          Outside the data
        </Sub>
        <Items>
          <Item title="Keplerian fallback">
            Outside the downloaded window the app falls back to Keplerian propagation and says APPROXIMATE
            while it does. The moons have a narrower window than the planets — a year either side of the
            build, against ten — because Phobos alone needs 35,000 samples a year. Their data arrives in
            pieces as the clock reaches it, so a moon can be missing for a moment, never misplaced.
            <Why>
              propagating an orbit on its own ignores every other body’s pull: against the real vectors it
              drifts from about 100 km a month out to 10⁵–10⁶ km a year out, depending on the body. Better
              something than nothing at 1850 or 2140, but never passed off as data.{' '}
              <Xref to="physics" sub="kepler">
                Kepler’s equation
              </Xref>
              .
            </Why>
          </Item>
          <Item title="Spacecraft outside their path">
            {`A spacecraft exists only where JPL has its path: from launch, and until its trajectory ends — for a mission still flying, until its latest prediction does. Outside that it is not drawn and cannot be chosen, because there is nothing honest to propagate it with. Where JPL’s path is stitched from two trajectory files that disagree, it jumps in a single minute. ${seamSentence(store)} The jumps are JPL’s and they are kept: the craft moves across them, and its trail breaks there rather than drawing a stroke nothing flew along.`}
          </Item>
        </Items>

        <Sub section="estimated" id="exoplanets">
          Planets of other stars
        </Sub>
        <Prose>
          A planet found by its star’s wobble gives its period, its distance, its eccentricity, when it passes
          in front of the star as we see it, and its minimum mass, m sin i — not the tilt i, nor which way the
          orbit runs across the sky. Most never pass in front of their star, so nothing measures their size
          either. What fills each gap:
        </Prose>
        <Equation
          title="Size from mass: the Chen & Kipping relation"
          cite="chenKipping2017"
          code="web/src/core/exoplanets.ts (estimatedRadiusEarth)"
          math={math(
            table([
              [
                row(
                  frac(mi('R'), earth('R')),
                  mo('='),
                  mn('1.008'),
                  sup(paren(frac(mi('M'), earth('M'))), mn('0.279')),
                ),
                upTo('2.04', earth('M')),
              ],
              [power('0.589'), upTo('0.414', sub(mi('M'), mtext('J')))],
              [power('−0.044'), upTo('0.080', sub(mi('M'), mo('☉')))],
              [power('0.881'), row(mtext('beyond'))],
            ]),
          )}
          symbols={
            <>
              R the planet’s radius and M its mass, in Earth’s; M<sub>J</sub> Jupiter’s mass, M☉ the Sun’s. Four power
              laws, each piece continuous with the last.
            </>
          }
        >
          None of the planets of the four nearby systems passes in front of its star, so none has a measured
          size: each is a sphere of the size its mass suggests, by the mass-radius relation of Chen &amp;
          Kipping 2017 — the estimate the Exoplanet Archive itself gives — lit by its own star, and called an
          estimate wherever its size is shown. So is every Archive planet not seen to transit, and Proxima’s.
          An estimate, not a measurement: the paper’s own scatter about it is 4% for rocky worlds, 15% for
          Neptunes, 7% for giants — and hot Jupiters, puffed up by their stars’ heat, stray further. For a
          planet known only by its minimum mass it is the size at that minimum.
          <Why>
            the mass is all a wobble gives, and this is the relation the NASA Exoplanet Archive itself fills
            in, as a “Calculated Value”, for a planet with no measured radius — the code is checked against
            the Archive’s own numbers.
          </Why>
        </Equation>
        <Items>
          <Item title="Tilt unknown: edge-on">
            Proxima’s planets are found by the wobble they give their star, and that wobble says how far out
            each is, how long its year is and how heavy it is at least — not how its orbit is tilted, since
            none passes in front of the star. So the orbits are drawn edge-on as seen from the Sun, the one
            tilt at which the minimum mass is the mass, and which way across the sky they run is a choice.
            Every Archive planet not seen to transit is drawn the same way, edge-on to the Sun.
            <Why>
              of all tilts, edge-on is the one at which the mass drawn — m sin i, with sin i = 1 — is the
              planet’s real mass rather than a lower bound.
            </Why>
          </Item>
          <Item title="Node unknown: east-west">
            No node is given for any Archive planet: east-west. The line where the orbit crosses the sky runs
            east-west at the star.
            <Why>
              neither a wobble nor a transit says which way an orbit lies across the sky, so one stated rule
              stands in for all of them rather than a guess per planet.
            </Why>
          </Item>
          <Item title="Phase unknown: periastron at J2000">
            Where each is along its orbit comes from its transit or conjunction time, else its periastron
            time, else it is at periastron at J2000. For Proxima’s it comes from the fits: for b to about a
            day, for d hardly at all. Tau Ceti’s four are fitted with no epoch for where they are along their
            orbits, so each is drawn at periastron at J2000 — a stand-in, and the panel says so.
            <Why>a fixed, stated epoch, so the same date always draws the same place.</Why>
          </Item>
          <Item title="Eccentricity unknown: circular">
            An eccentricity missing, or given only as a limit, is drawn circular.
            <Why>a limit only bounds the eccentricity from above, and zero is inside every such bound.</Why>
          </Item>
          <Item title="Whose argument of periastron">
            The Archive does not say whose argument of periastron it lists. It is read as the star’s, as
            radial velocities are fitted (and, the same number, the planet’s as transits are), so the planet’s
            own is half a turn on
            {exoplanetCatalog == null
              ? ''
              : ` — where one paper gives a periastron time, a transit time and the angle, ${exoplanetCatalog.omegaCheck.star} of ${exoplanetCatalog.omegaCheck.star + exoplanetCatalog.omegaCheck.planet + exoplanetCatalog.omegaCheck.neither} agree with that reading, ${exoplanetCatalog.omegaCheck.planet} with the other`}
            .<Why>the papers that give all three numbers say so, most of them.</Why>
          </Item>
          <Item title="Where more was measured">
            The other stars’ planets are drawn the same way, under the same rules, except where more was
            measured: Epsilon Eridani b’s tilt and the way its orbit lies on the sky, and 51 Pegasi b’s tilt.
          </Item>
          <Item title="Candidates and disputed planets">
            Proxima c is a candidate, drawn grey and named so: its discoverers themselves leave open that its
            signal is the star’s own activity. Planets the Archive flags as controversial are grey and called
            disputed.{' '}
            <Xref to="choices" sub="colours">
              Choices › Colours that mean something
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="estimated" id="stars">
          Stars
        </Sub>
        <Items>
          <Item title="Parallax too poor">
            A star whose parallax is too poor to place it stays on the sky at infinity, its direction all that
            is known, and fades out as the camera leaves for the galaxy, from where a star drawn as infinitely
            far would be wrong. Every other star is at its real distance.
          </Item>
          <Item title="Placed at J2000 by proper motion">
            The catalogue carries each on a straight line from one position and one velocity, and it places a
            star at J2000 by its proper motion only: the tens of AU a nearby star moves along the line of
            sight between its parallax and 2000 are left out, which no map of the stars can see but the inside
            of a star system can. So Alpha Centauri’s stars are not read from it.
          </Item>
          <Item title="No interstellar dust">
            No correction is made for interstellar dust, which within 100 parsecs is small.
          </Item>
          <Item title="Limb darkening borrowed from the Sun">
            Alpha Centauri’s three stars are darker toward the edge, by the Sun’s own visible limb darkening
            taken as theirs.
            <Why>
              Kervella et al. 2017 measured A’s and B’s limb darkening in the near infrared, where it is far
              weaker — not in the visible
              <Cite k="kervella2017" />.{' '}
              <Xref to="physics" sub="sun">
                The limb-darkening law
              </Xref>
              .
            </Why>
          </Item>
          <Item title="Proxima’s orbit">
            Proxima’s orbit about the pair takes 547,000 years, and its elements are uncertain by a tenth; the
            ellipse drawn is the measured one, through where Proxima is.
          </Item>
        </Items>

        <Sub section="estimated" id="black-holes">
          Black holes
        </Sub>
        <Items>
          <Item title="Spin unknown: none">
            The horizon drawn is the Schwarzschild radius, 2GM/c², the horizon of a black hole that does not
            spin: none of the three has a measured spin, and a spinning one’s horizon is smaller, down to
            half.
            <Why>
              with no spin measured, not spinning is the convention that claims least — and it is the largest
              a horizon of that mass can be.{' '}
              <Xref to="physics" sub="black-holes">
                The equation
              </Xref>
              .
            </Why>
          </Item>
          <Item title="M87* not placed">
            M87*, six and a half billion Suns, is 55 million light years away, past anywhere the camera can
            go, and is not placed: its horizon, set on the Sun, would reach 128 AU, more than two and a half
            times as far as Pluto ever goes.
          </Item>
        </Items>

        <Sub section="estimated" id="spacecraft">
          Spacecraft
        </Sub>
        <Items>
          <Item title="No model: a box">
            Where no model may be used — many craft have none published at all — the craft is a plain white
            box of its published size, marked NO MODEL: as long as its solar-array span, as wide as one array,
            as deep as its body. The named Earth satellites with no model, Tiangong among them, are boxes too.
            <Why>A box says how big a craft is and claims nothing about its shape.</Why>
          </Item>
          <Item title="On Mars: placed, not interpolated">
            The craft on Mars are placed, not interpolated. JPL has no ephemeris worth using for them —
            Horizons keeps Curiosity at its 2012 landing site, fourteen kilometres from where it has driven
            since — so each rover stands where NASA’s mission maps put the end of its latest drive
            <Cite k="marsMaps" />, facing the heading they report, and turns with Mars by the same rotation
            the surface map is drawn with. The maps give the sol of each drive, not the hour, so the rover
            moves on at the end of that sol, and between drives it is drawn where the last one ended: the line
            behind it joins those places, and the drives themselves went their own way between them. InSight
            never moved; its heading is not published, and it is drawn facing north. Mars here is the smooth
            reference ellipsoid, with no terrain — Curiosity is really at the bottom of Gale crater, 4.5 km
            below it — and the planet is a sphere of flat faces that sag up to 4 km inside that ellipsoid
            between their corners, which at a rover’s scale is everything. So under each one the ellipsoid
            itself is drawn, two degrees across, with the same map on it.
          </Item>
          <Item title="Attitude: modelled">
            Which way a spacecraft in space faces is modelled, not measured. JPL’s attitude records exist for
            some of them, as gigabytes of binary, and for none of Pioneer, Parker or JWST. So each is drawn by
            the rule it flies by: Voyager, Pioneer and New Horizons keep their dish on Earth; Parker keeps its
            heat shield on the Sun, JWST its sunshield, and the solar-powered craft their arrays. The roll
            about that axis is not published at all and is a convention here. An Earth satellite that watches
            the Earth, or relays for it, flies one side down and one axis along its track, which fixes both:
            the ISS by NASA’s own axes, +Z down and +X forward. Which end of a satellite leads is published
            for few, and is a choice. The observatories in Earth orbit — Hubble, Chandra, XMM-Newton and the
            rest — point wherever their observing plans say, which no data here carries; they are drawn with
            their solar arrays on the Sun, which each keeps within a few degrees, and their info panels say
            so.
          </Item>
        </Items>

        <Sub section="estimated" id="small-bodies">
          Asteroids and comets
        </Sub>
        <Items>
          {beltInfo !== null && <Item title="The belt">{beltAccuracySentence(beltInfo)}</Item>}
          {cometInfo !== null && <Item title="Comets">{cometAccuracySentence(cometInfo)}</Item>}
          {beltInfo === null && cometInfo === null && (
            <Item>
              The belt and the comets are described here once their layers are switched on and their data is
              in.
            </Item>
          )}
        </Items>

        <Sub section="estimated" id="maps">
          Surface maps
        </Sub>
        <Items>
          <Item title="Composites">
            Surface maps are composites, not registered cartographic products — NASA imagery with colour and
            contrast added by its authors, so they read more vividly than a camera would. On the flattened
            bodies a feature can sit about 1.5° from its true latitude; Saturn is the worst, Earth and Mars
            are under 0.1°.
          </Item>
          <Item title="Grey moons">
            The moons are mostly grey, because that is how they were mapped: Galileo, Cassini and Voyager
            photographed them through clear filters, and the colour versions that exist are enhanced into the
            ultraviolet and infrared. The Moon is in natural colour, Titan is its surface at 938 nm seen
            through the haze, and Io and Triton carry uncalibrated mission colour.
          </Item>
          <Item title="Unseen hemispheres">
            Several moons were half in darkness when they were photographed: the northern hemispheres of
            Uranus’s five and of Triton when Voyager 2 passed, Charon’s south for New Horizons. Like Pluto’s
            south, those areas are filled with the average of what was seen. Nothing there is an observation.
          </Item>
          <Item title="Pluto’s south">
            Pluto’s southern hemisphere is invented. New Horizons could not photograph it — it was in polar
            winter during the 2015 flyby — so it is filled with the average colour of the rest rather than
            left black. Nothing south of about 40°S on Pluto is an observation.
            <Why>a black cap reads as a bug rather than as missing data.</Why>
          </Item>
          <Item title="Deimos">
            Deimos has no map. The only global one cannot be placed — its two sources disagree about where
            longitude zero is — so it is drawn in flat colour rather than possibly half a turn wrong.
          </Item>
          <Item title="Saturn’s ring map">
            Saturn’s rings are at real radii, lying in its real equatorial plane — which is why they open and
            close as it orbits. The ring map is a radial strip whose radii are not published, so they were
            fitted from the image against surveyed ring boundaries: good to about 1400 km, which is wider than
            the Encke Gap it draws. Every division is present and roughly placed, none at a surveyed radius.
          </Item>
        </Items>

        <Sub section="estimated" id="earth">
          Earth
        </Sub>
        <Items>
          <Item title="Clouds">
            Earth’s cloud deck is a fixed composite of MODIS passes from 2001, never the weather on the date
            shown. It sits 5 km up — one global mean standing in for everything from 1 km of stratocumulus to
            15 km of tropical anvil — and drifts west at the equatorial trade-wind speed. A rigid deck cannot
            do winds that reverse with latitude, so that drift is right at the equator and wrong at 45°. Its
            opacity is read as an optical depth rather than straight off the file, since what the composite
            measures is how much cloud is in the column and not how much light gets through it.
          </Item>
          <Item title="Land and water">
            Earth’s land/water mask is derived rather than published — from the flat colour NASA fills deep
            water with in one of its maps, read as a coverage fraction so the shoreline is not drawn as the
            staircase the 20 km grid makes. It lands at 69.7% water against the true 70.8%, because that map
            draws the shallow continental shelves instead of filling them, so a rim of every coast counts as
            land.
          </Item>
        </Items>

        <Sub section="estimated" id="galaxy">
          The galaxy
        </Sub>
        <Items>
          <Item title="A model, not a map">
            The Milky Way past the star census is a model, not a map: nothing maps the galaxy star by star,
            and most of it is hidden from us behind the dust of its own centre. The glow is 300,000 points
            sampled from the measured shape, each standing for a cloud of a million stars. Along the arms the
            young stars bunch into knots — the arms really are strings of star clusters and glowing hydrogen
            clouds, thousands of them — but no knot here is a particular one.
          </Item>
          <Item title="Its centre, 126 parsecs short">
            The centre is 8.15 kiloparsecs away, the value the arms were fitted with; the most precise
            measurement, GRAVITY’s, puts it 1.5% farther, and that is where Sgr A* is drawn — so the model’s
            centre falls 126 parsecs short of the black hole at it, inside the arms’ own uncertainty of 150.
            <Why>
              the spiral arms were fitted with 8.15 kpc and would slide off the masers that define them under
              another number
              <Cite k="reid2019" />.
            </Why>
          </Item>
        </Items>
      </>
    );
  },
};
