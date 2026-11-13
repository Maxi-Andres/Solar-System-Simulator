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
    { id: 'nuclear-cluster', label: 'The nuclear star cluster' },
    { id: 'pulsars', label: 'Pulsars' },
    { id: 'globular-clusters', label: 'Globular clusters' },
    { id: 'supernova-remnants', label: 'Supernova remnants' },
    { id: 'spacecraft', label: 'Spacecraft' },
    { id: 'small-bodies', label: 'Asteroids and comets' },
    { id: 'maps', label: 'Surface maps' },
    { id: 'earth', label: 'Earth' },
    { id: 'galaxy', label: 'The galaxy' },
    { id: 'local-group', label: 'The Local Group' },
    { id: 'local-volume', label: 'Beyond the Local Group' },
    { id: 'laniakea', label: 'Laniakea and beyond' },
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
            spin: of the four only Cygnus X-1 has a measured spin, and a spinning one’s horizon is smaller,
            down to half.
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

        <Items>
          <Item title="Cygnus X-1">
            Its spin, measured above 0.998 of the maximum, is not drawn: it is lensed and sized as the others
            are, though its horizon is in truth about half as wide and its shadow a little smaller and
            flattened on one side. Its orbit’s orientation on the sky — the node — is not measured by the
            orbit: the paper takes the radio jet’s direction, assuming the jet leaves along the orbit’s axis.
            Its supergiant fills 96% of the room the hole’s pull leaves it and is drawn out toward the hole;
            it is drawn round.
          </Item>
        </Items>

        <Items>
          <Item title="Which of Sirius A and B is nearer">
            The orbit fixes the two on the sky, not which is in front: the paper does not say which node is
            ascending. It is read in the usual sense, B receding where it crosses the sky’s plane at the
            node.
          </Item>
        </Items>

        <Sub section="estimated" id="nuclear-cluster">
          The nuclear star cluster
        </Sub>
        <Items>
          <Item title="A model, not a census">
            Round Sgr A* tens of millions of stars crowd into a few parsecs. Past the stars measured one by one,
            they are a model: 172,382 stars sampled from the cluster’s measured shape — density rising as
            r<sup>−1.13</sup> into the black hole and falling as r<sup>−3.5</sup> past 3.1 pc, a million Suns
            inside one parsec <Cite k="schoedel2018" />, 25 million in all, flattened to 0.71 along the
            Galactic plane <Cite k="schoedel2014" /> — each a star of its own brightness and colour, from stellar
            models <Cite k={['bressan2012', 'kroupa2001']} /> at the ages and metallicity measured for the
            cluster <Cite k="schoedel2020" />. Its infrared luminosity function climbs 0.28 dex a magnitude
            through the giants, as the cluster’s does, 0.27 ± 0.02 <Cite k={['schoedel2010', 'gallegoCano2018']} />.
            No star of it is a particular star; the Nuclear Cluster Model layer turns it off.
            <Why>
              nothing counts the cluster’s stars below about the Sun’s mass, and in visible light, behind 30
              magnitudes of dust, nothing sees them at all.
            </Why>
          </Item>
          <Item title="The brightest, as seen from the black hole">
            Of the model’s 79 million living stars, only those brighter than magnitude −1 seen from Sgr A* are
            drawn: red giants out to the edge, dwarfs close in.
            <Why>
              millions more are brighter than the picture’s limit from the centre, more than points can be
              drawn; a budget, set in{' '}
              <Xref to="choices" sub="black-holes">
                Choices › Black holes
              </Xref>
              . Far from the black hole, among the cluster’s outer stars, the sky is thinner than it would be.
            </Why>
          </Item>
          <Item title="Standing still">
            The model’s stars and the young stars do not move; the S-stars do, on their orbits.
            <Why>their orbits are not known — only that they move at about 100 km/s, a hundredth of a parsec a century.</Why>
          </Item>
          <Item title="Depth along the line of sight">
            For 48 of the 70 young stars it is not measured, and is drawn, seeded, from the young stars’ own
            density, which falls as r<sup>−3</sup>; IRS 7 is drawn in the plane of the sky through Sgr A*.
            <Why>only positions on the sky are measured; a depth drawn this way gives the cluster its real
            thickness rather than a flat sheet.</Why>
          </Item>
          <Item title="Hot stars’ colours">
            The Wolf-Rayet stars and supergiants are given the colours of hot main-sequence stars of their
            class.
            <Why>
              their visible light has never been seen, behind 30 magnitudes of dust; hot stars of every kind are
              nearly alike in V − K. The dustiest Wolf-Rayet stars are brighter in K than that, so likely drawn
              too bright.
            </Why>
          </Item>
          <Item title="The dust in between">
            From the Sun the cluster is behind about 30 magnitudes of dust in visible light{' '}
            <Cite k={['genzel2010', 'fritz2011']} />, and invisible; from inside it there is none. In between,
            the camera takes the share of that 30 its own line to the centre crosses in the galaxy model’s dust
            disc <Cite k="drimmelSpergel2001" />. Dust inside the cluster is not drawn.
            <Why>only the view from here is measured; the dust disc is the model the galaxy is drawn with.</Why>
          </Item>
          <Item title="Left out">
            S111, whose fitted orbit is a hyperbola; the 2% of the cluster’s mass younger than a billion years,
            beyond the young stars measured; and the cluster’s dark remnants and binaries.
          </Item>
        </Items>

        <Sub section="estimated" id="pulsars">
          Pulsars
        </Sub>
        <Items>
          <Item title="Distance, from dispersion">
            Most pulsars’ distances are their radio pulses’ dispersion — how much the electrons along the way
            delay the low frequencies — read through YMW16’s model of where those electrons are
            <Cite k="ymw16" />. It is the roughest distance here: of the 189 pulsars with independent distances
            the model was fitted to, it puts 86 within their measured range and 38 more within 20% of it.
            <Why>it is the only distance most pulsars have.</Why>
          </Item>
          <Item title="Not placed">
            Where a pulsar’s dispersion is more than the model’s electrons can give along its line, YMW16 gives
            no distance but the edge of what it models, 25,000 pc in the Galaxy and 100,000 toward the
            Magellanic Clouds <Cite k="fermi3pc" />. Such a pulsar is left out unless something else places
            it, as is one with no distance of any kind — most of them seen only in gamma rays.
            <Why>a pulsar put on the model’s rim would be a place nobody measured.</Why>
          </Item>
          <Item title="Radius">
            Every neutron star but the three NICER measured is drawn 12 km in radius, within the errors of all
            three; its mass, used for nothing drawn, 1.4 solar masses.
          </Item>
          <Item title="Along the line of sight">
            No pulsar’s radial velocity is measured but a few binaries’, so none moves toward or away from us:
            each moves across the sky only. A magnetar only McGill lists, which gives no proper motion, stands
            still.
          </Item>
          <Item title="Colour">
            Drawn in the colour of a million-kelvin blackbody, which is the colour of any past about a hundred
            thousand: a young neutron star’s surface and an old pulsar’s polar caps are that hot. Its surface
            temperature is measured for few. Its glare, close by, takes that temperature’s surface
            brightness, 3,500 times the Sun’s in visible light; a cooler one, at 300,000 K, would glare a third
            as much.
          </Item>
        </Items>

        <Sub section="estimated" id="globular-clusters">
          Globular clusters
        </Sub>
        <Items>
          <Item title="Their stars: a model">
            No catalogue lists a cluster’s stars one by one, so the cluster the camera is near is drawn as a
            sample of a model built from what is measured of it. How many stars: as many as give its measured
            light — its V magnitude less its distance and its extinction, over a star’s mean light in its
            population. Where: a Plummer sphere <Cite k="plummer1911" /> of its measured half-mass radius, cut
            at its tidal radius. What they are: PARSEC isochrones at 12 billion years
            <Cite k={['bressan2012', 'vandenberg2013']} />, the nearest of four metallicities to its own, its
            [Fe/H] plus 0.21 for the alpha elements its stars are rich in <Cite k="salaris1993" />, with the
            Kroupa initial mass function <Cite k="kroupa2001" />.
            <Why>
              its light is what is seen; its mass also counts the white dwarfs and neutron stars, which are dark.
            </Why>{' '}
            Its faint dwarfs are too many: the Galaxy’s tides strip a cluster’s low-mass stars first, and its
            measured mass function is flatter than the initial one <Cite k="baumgardt2023" />. They are the
            stars least seen; the giants and the stars about the turnoff, which give its light, come out right.
            Each star’s own place is drawn at random within that shape: right in number, light and where they
            crowd, not star by star — no catalogue lists them.
          </Item>
          <Item title="Which are drawn">
            Every star brighter, seen from the cluster’s centre, than a limit solved for each cluster so that
            none is drawn with more than 120,000 — all that could show of a small one, Omega Centauri’s brightest.
            The panel gives the limit. A camera far from the centre stands among stars this left out.
          </Item>
          <Item title="Left out">
            Each one’s particular shape and flattening (a round Plummer sphere for all), the several
            populations some have, blue horizontal branches and blue stragglers, binaries, the motion of its
            stars; and the reddening of the clusters Harris does not list, drawn with none.
          </Item>
          <Item title="Their light from far off">
            Each one’s whole light, its V less its distance and the dust in front, as a soft point the size of
            its half-light radius; its colour the integrated B−V of the 12-billion-year population nearest its
            metallicity, 0.62 to 0.87, since Harris’s measured B−V is reddened. The 14 with no reddening take
            their mass times that population’s light per solar mass. From anywhere but the Sun its dust is the
            Sun’s A_V times the share of the dust disc’s column that lies between; it dims, it does not redden.
            Near a cluster whose stars are drawn, the point keeps only the light of the stars too faint to draw, and that only once the cluster is small on the screen.
          </Item>
        </Items>

        <Sub section="estimated" id="supernova-remnants">
          Supernova remnants
        </Sub>
        <Items>
          <Item title="Only nine">
            Green’s catalogue lists 310 remnants and no distances; a remnant’s distance is measured one by one, and
            for most it is rough. These nine are the ones with a measurement of their own. The compilation of
            distances for the rest (Ranasinghe &amp; Leahy 2023) is served only by CDS VizieR, which was down when
            these were added.
          </Item>
          <Item title="Its depth: modelled">
            A picture says how much light comes from each point of the sky, not how deep along the line of sight
            it is. Except for Cassiopeia A’s, which is measured, each line of sight’s light is put where it
            crosses the remnant’s shell — a sphere of its mean radius, or the Crab’s spheroid along its pulsar’s
            axis — each patch of it on the near side or the far, broken into clumps, by noise; the Crab’s
            synchrotron light, its blue, fills the spheroid instead. Seen from Earth the sum along every line of
            sight is the picture; from anywhere else, where the clumps are is not measured.
            <Why>it keeps what is measured exactly — the picture, from here — and is a shell, which a remnant is.</Why>
          </Item>
          <Item title="Its colour, where the picture is not in visible light">
            Cassiopeia A’s, Vela’s, Tycho’s, SN 1006’s and Puppis A’s pictures give only where the light is and how
            much. They are drawn in the colours of the lines each is known to shine in: Balmer lines alone for
            Tycho’s and SN 1006 <Cite k={['kirshnerChevalier1978', 'ghavamian2002']} />, oxygen and sulphur for
            Cassiopeia A <Cite k="chevalierKirshner1979" />, hydrogen with sulphur, nitrogen and oxygen for Vela and
            Puppis A <Cite k="fesen1985" />, the second colour in a share of the gas, by noise. Tycho’s and SN
            1006’s are their outer shocks in X-rays, which is where their Balmer filaments are; those are far
            fainter and fewer than the X-rays.
          </Item>
          <Item title="Its colour, where the picture is a photograph">
            The Crab’s, Kepler’s, the Cygnus Loop’s and IC 443’s colours are their photographs’, and those are
            set by their filters, not the eye: the Crab’s ESO picture, in a sulphur-line filter with broad red and
            blue ones, is nearest true colour; Kepler’s Hubble mosaic is in its makers’ choice of narrow filters;
            the Cygnus Loop’s and IC 443’s are two photographic plates, red and blue, the green between them made
            up, balanced so that the stars come out white.
          </Item>
          <Item title="What the pictures leave in or out">
            Their stars are taken out — the app draws stars from its own catalogues — at the positions Gaia and
            Hipparcos give, and filled from the light round them: where one lay on a filament, the filament there
            is a guess. Vela’s H-alpha includes the Gum Nebula’s, which lies across it on the sky; the Cygnus
            Loop’s and IC 443’s photographic plates keep faint stars too small to take out. Not drawn: their
            expansion and their motion.
          </Item>
          <Item title="A ring from far off">
            From far off, where its gas would be a few pixels across, each is a ring of its mean radius, turned to
            the camera.
            <Why>a mark of its size where its gas is too small to see.</Why>
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

        <Sub section="estimated" id="local-group">
          The Local Group
        </Sub>
        <Items>
          <Item title="A dwarf’s depth">
            How deep a dwarf galaxy is along our line of sight is measured for none of them. Each is drawn as deep
            as the geometric mean of its two measured axes on the sky.
            <Why>neither a disc seen face-on nor a cigar seen end-on, when either could be.</Why>
          </Item>
          <Item title="A dwarf’s profile">
            Every dwarf is drawn as a Plummer ellipsoid whose projected half-light radius is its catalogue’s,
            though some are fitted better by an exponential or a King profile.
            <Why>
              one profile from the catalogue’s one radius; drawn so, Fornax’s centre comes out within 0.3
              magnitudes of its measured surface brightness
              <Cite k={['plummer1911', 'mcconnachie2012']} />.
            </Why>
          </Item>
          <Item title="A disc’s thickness">
            Andromeda’s, Triangulum’s and the Large Cloud’s discs are drawn 7.3 times thinner than their scale
            length, the mean of the discs measured edge-on; their dust as thick as the Milky Way’s, 134 pc, and
            their young stars as its OB stars, 45 pc. The thickness of their light is measured for none of the
            three.
            <Why>
              the nearest measured: other galaxies’ discs, our own dust and young stars
              <Cite k={['kregel2002', 'drimmelSpergel2001', 'reed2000']} />.
            </Why>
          </Item>
          <Item title="Leo P’s size">
            No half-light radius has been measured: it was found by counting its stars, which reach the field
            70″ out <Cite k={['mcquinn2013', 'rhode2013']} />. It is drawn with half that, 35″ — a Plummer
            sphere’s stars at twice its half-light radius are 4% as crowded as at its centre, about where so
            faint a galaxy’s are lost.
          </Item>
          <Item title="A dwarf’s stars, near it">
            No catalogue lists a dwarf’s stars one by one: the one the camera is near is sampled from a model —
            as many stars as give its light, from the globular clusters’ 12-billion-year population nearest its
            [Fe/H] + 0.21, on its own Plummer ellipsoid and cut at eight scale radii, each star’s own place drawn
            at random within it: right in number, light and where they crowd, not star by star. Gaia has
            measured the brightest giants of the nearest dwarfs, which could take their own places; they do
            not yet. Fornax’s and Leo I’s stars
            are younger than that, and the irregulars’ young blue stars are not sampled: all their light goes to
            the old population. Its glow keeps only the light of the stars too faint to show, so no light is
            counted twice.
          </Item>
          <Item title="The Small Cloud’s depth">
            How each place’s light is spread along our line of sight, from how its stars spread in distance:
            its old stars evenly about their mean, a Gaussian 2 to 3.9 kpc wide either side, 3.1 typically; its
            young stars in a sharp core with long wings, a Laplace, 2.9 kpc typically — as wide, half as deep at
            its core. Each is what OGLE’s RR Lyrae or young Cepheids round each place show, less what their
            distances scatter by themselves — 0.10 and 0.068 magnitudes, measured in the same catalogues’ Large
            Cloud stars, not the catalogues’ errors, which are a zero point every star shares — and less the
            mean’s change across them <Cite k={['jacyszynDobrzeniecka2016', 'jacyszynDobrzeniecka2017']} />. For
            the old stars that scatter is at most the method’s, so their depth is if anything short; red clump
            stars and RR Lyrae measured in other ways give 3.4 to 4.6 kpc, with less of that scatter taken out{' '}
            <Cite k={['subramanian2012', 'muraveva2018']} />. What stands above the map’s large scale, a third
            of a degree (340 pc) — HII regions, clusters, knots of dust — is put at its population’s mean, 150
            pc deep, as deep as the widest of them is wide; where along the line of sight each really lies is not
            measured. Its glowing gas and its dust are put with its young stars, as the south-west bar’s dust is
            found in front of its old stars <Cite k="yanchulovaMericaJones2021" />. Where no star is near, the
            whole cloud’s mean and a typical depth fill in.
          </Item>
          <Item title="The Clouds past Spitzer’s edge">
            Spitzer mapped the Large Cloud’s central seven degrees and the Small Cloud’s body. Each mosaic keeps a
            background of its own, a floor the light stops falling into — the Small Cloud’s stays level from 3.7
            to 5.4 kpc out, where its giants fall nearly fivefold — and it is taken off: a fifth of the Large
            Cloud’s mapped light, a quarter of the Small’s. Past the edge, and where the map is down in its noise,
            their old stars are their exponential of the measured scale length, 1.4 kpc <Cite k="vdMarel2001" />{' '}
            and 1.0° <Cite k="nidever2011" />, joined to the map smoothly and drawn out until it is too faint to
            show; the Large Cloud’s star formation there is its Hα alone, which SHASSA saw out to its whole disc.
            Andromeda’s and Triangulum’s maps, which fall faster than their exponentials before their noise, fade
            out with it instead.
            <Why>
              their light goes on past what was mapped, and drawn as nothing it ended in a square; the floor,
              carried on, was a grey disc as wide as the map; and the noise, on the screen’s own curve, showed
              as streaks.
            </Why>
          </Item>
          <Item title="Andromeda’s and Triangulum’s light, from their maps">
            The old stars’ map carries the disc’s V light less its young stars’. The young stars give 2 × 10⁹
            solar luminosities in V for each solar mass a year they form — a population formed steadily over the
            last hundred million years — in B−V 0.05: 4% of Andromeda’s disc’s light. Andromeda’s dust dims V by a
            magnitude for each 1.9 × 10²¹ hydrogen atoms per cm², as in the Milky Way, and the Large Cloud’s by
            the same through its dust’s mass, its opacity set to the Milky Way’s gas-to-dust of 150: 7.4
            magnitudes per solar mass of dust per pc²; Triangulum’s by 0.74 for
            each 10⁵ solar masses of dust per kpc², over the 2.5 by which that dust model was found to
            overpredict Andromeda’s — the 3.1 its makers divide its masses by is much the same; and both dim
            blue more than red.
            <Why>
              their maps show where the light and the dust are, not what colour the light is; these are the
              conversions for the Milky Way, for a steadily forming population, and for that model as Andromeda’s
              stars measure it
              <Cite k={['bohlin1978', 'draine2014', 'dalcanton2015', 'chastenet2025', 'cardelli1989']} />.
            </Why>
          </Item>
          <Item title="The Large Cloud’s young stars and glowing gas">
            Its young stars’ light is spread 200 pc from where Hα and 24 µm show stars forming, and its glowing
            gas’s light drawn on the starlight’s exposure by its energy, as so many of the Sun’s V luminosities.
            <Why>
              the 10–100 million year old stars, which give most of a young population’s V light, have drifted
              that far from their birth clouds at about 10 km/s; and a line’s light is its energy, whatever band
              it falls in.
            </Why>
          </Item>
          <Item title="Which side of Triangulum is nearer">
            Not measured here: its west side is drawn nearer. From Earth it looks the same either way.
          </Item>
          <Item title="Their colours">
            The catalogue gives no colours. A dwarf rich in gas — a fifth of a solar mass of hydrogen or more for
            each solar luminosity — is drawn in a young population’s colour, B−V 0.45, any other in an old one’s,
            0.75 — a dwarf irregular’s and a dwarf spheroidal’s — and Andromeda’s bulge redder than its disc.
            <Why>
              gas is where stars still form
              <Cite k="mateo1998" />.
            </Why>
          </Item>
          <Item title="What is not drawn">
            The Small Cloud’s structure, deeper along our line of sight than it is wide, and no disc to draw
            from above; Andromeda’s halo, 4% of its light, and its streams; the Magellanic
            Stream; and each galaxy’s motion. A galaxy whose size or V is not measured is its mark only.
          </Item>
        </Items>

        <Sub section="estimated" id="local-volume">
          Beyond the Local Group
        </Sub>
        <Items>
          <Item title="Where in the Virgo Cluster">
            920 of its 999 members drawn have no distance of their own. Each is put at its part of the cluster’s —
            about M87 16.7 Mpc and about M49 16.4 <Cite k="mei2007" />, about M60 and the low-velocity cloud
            16.5, the W′ cloud 22.9, the mean of the five measured there, the W and M clouds twice M87’s, 33.4{' '}
            <Cite k="gavazzi1999" />, its parts where Boselli et al. draw them on the sky{' '}
            <Cite k={['boselli2014', 'binggeli1987', 'binggeli1993']} /> — in front of it or behind by a draw
            from the cluster’s measured depth, 0.6 Mpc, the same each time; for the W and M clouds that depth is
            assumed. The 545 in its outskirts are at 16.5 Mpc, deeper the farther out they are seen — as deep as
            they are wide, half the square of their distance from M87 on the sky — never past the cluster’s 7.2
            Mpc reach <Cite k="karachentsev2014" />. Their panels give that depth as the error.
            <Why>one distance for all would draw the cluster as a flat sheet seen edge-on from the side.</Why>
          </Item>
          <Item title="Distances from a group or a velocity">
            259 of the Local Volume’s galaxies have no distance of their own: each is at its group’s, or where its
            velocity puts it at 73 km/s per Mpc; its panel says which.
          </Item>
          <Item title="Their colours, and V">
            The Local Volume’s catalogue gives B and no colour. Each of its 764 is drawn in its type’s: the giants’
            from the integrated colours of each Hubble type <Cite k="fukugita1995" />, between types as its T
            falls; the dwarfs’ the median of the Local Group’s own — spheroidals and dwarf ellipticals 0.72,
            irregulars 0.47, transition types 0.59 <Cite k="mateo1998" /> — and V from B by it. On the 29 galaxies
            both catalogues measure, V so made is within 0.08 magnitudes of the measured, the colours 0.11 bluer.
            <Why>a galaxy’s colour follows its type more closely than anything else the catalogue gives.</Why>
          </Item>
          <Item title="Their sizes, from the Holmberg diameter">
            The Local Volume’s catalogue measures how far each reaches, to 26.5 B mag/arcsec², not where half its
            light lies. Its half-light radius is drawn 0.529 of that radius: the median of the 29 galaxies both
            catalogues measure, which scatter about it by a factor of 1.5. A disc’s scale length is its half-light
            radius over 1.678 <Cite k="grahamDriver2005" />.
          </Item>
          <Item title="The Virgo Cluster’s half-light radii, made elliptical">
            Its catalogue measures each in circles. On the major axis it is that over what a disc of its axis ratio
            shows in circles — 0.744 at an axis ratio of 0.5, 0.57 edge-on; with no axis ratio, it stays round.
          </Item>
          <Item title="Their bulges">
            How much of a disc galaxy’s light is its bulge is measured for few: it is drawn by its type, as
            Simien and de Vaucouleurs’s decompositions show it — 57% of an S0’s, 24% of an Sb’s, 10% of an Sc’s
            — on de Vaucouleurs’s law, its effective radius 0.22 of its disc’s scale length, the mean measured{' '}
            <Cite k={['simienDeVaucouleurs1986', 'macArthur2003']} />. In the galaxy’s own colour.
          </Item>
          <Item title="Their depth and thickness">
            As the Local Group’s: an ellipsoid as deep as the geometric mean of its two axes on the sky, a disc
            7.3 times thinner than its scale length <Cite k="kregel2002" />.
          </Item>
          <Item title="Which way, where not measured">
            No position angle is measured for 270 of the Local Volume’s galaxies and 225 of the Virgo Cluster’s,
            nor an axis ratio for 54 of these: which way each is elongated is not known. It is drawn round on the
            sky, a disc facing us, and its panel says so. A disc’s inclination not given is its axis ratio’s, for
            a disc as thick as these <Cite k="hubble1926" />. Which side of a disc is nearer is measured for none
            of them; from Earth it looks the same either way.
          </Item>
          <Item title="Their groups">
            A galaxy is in the group of the neighbour whose tide binds it, followed from neighbour to neighbour
            while each is bound, and the group named for its most luminous galaxy in the near infrared{' '}
            <Cite k="karachentsev2013" />. Groups of one or two are listed with the field.
          </Item>
          <Item title="What is not drawn">
            Each galaxy’s motion, its spiral arms and its dust; a galaxy with no size or no V is its mark only.
          </Item>
        </Items>

        <Sub section="estimated" id="laniakea">
          Laniakea and beyond
        </Sub>
        <Items>
          <Item title="Distances from redshift">
            23,350 galaxies have no measured distance: each is where its redshift puts it, in the CMB’s frame, by
            the Hubble law in a flat universe of matter and a cosmological constant — H<sub>0</sub> 74.6 km/s per
            Mpc, Cosmicflows-4’s, and Ω<sub>m</sub> 0.3 <Cite k={['tully2023', 'courtois2023']} />. Its own motion
            through the flow, a few hundred km/s, is a few Mpc of error at any distance. Its panel says “its
            redshift, estimated”.
          </Item>
          <Item title="A group’s redshift for its members">
            8,623 of those are at their 2MASS group’s mean redshift, not their own <Cite k="tully2015" />: a
            cluster’s galaxies move about it at a thousand km/s, and by their own redshifts would stand in a line
            pointing at us 30 Mpc long — the finger of God.
          </Item>
          <Item title="Depth within a group">
            41,058 galaxies placed at their group’s distance are put in front of it or behind by a draw from the
            group’s measured width on the sky, the same each time. Their panels say so.
            <Why>one distance for all would draw every group as a sheet facing the Sun.</Why>
          </Item>
          <Item title="Distances linked from a group">
            8,351 galaxies not in Cosmicflows-4 are in a 2MASS group whose other members are: they are at that
            group’s measured distance.
          </Item>
          <Item title="Their colours">
            82,739 have no B−V measured: each is drawn in its type’s <Cite k="fukugita1995" />, as the Local
            Volume’s are.
          </Item>
          <Item title="V from K">
            8,005, behind dust or never measured in B, have their V from 2MASS K<sub>s</sub> and the median V−K
            of their type, measured on this catalogue’s own galaxies that have both: E 3.10, S0 3.18, Sa 3.19, Sb
            3.14, Sc 3.00, Sm to Im 2.66, each scattered by 0.3 to 0.8 magnitudes.
          </Item>
          <Item title="Their sizes">
            Every half-light radius is estimated: 0.366 of the D25 radius for early types, 0.493 for late, the
            medians of the Virgo galaxies both catalogues measure; for the 5,014 with no D25, its 2MASS isophote’s
            radius times 1.38, the median ratio over 38,000 that have both. 3,577 have neither, and are points
            only.
          </Item>
          <Item title="Where the structures are">
            A cluster at its group’s distance; a supercluster at the mean of its Abell clusters’ redshifts; a
            basin at its attractor; a void at its deepest point, its extents rough and not centred on it{' '}
            <Cite k="tully2019" />; a wall along its line in the survey’s slice. Their panels say which are
            estimates.
          </Item>
          <Item title="What is not drawn">
            Each galaxy’s motion, its arms and dust; a galaxy with no V its faint dot only. Behind the Milky Way’s
            plane, where 2MRS does not look — 5° either side, 8° within 30° of the Galactic Centre — only the 51
            other catalogues place: the empty band there is not empty space. And 2MRS is flux-limited, and past 200
            Mpc only the SDSS north and 6dF south go on: the map thins with distance because the surveys do, not
            the universe.
          </Item>
        </Items>
      </>
    );
  },
};
