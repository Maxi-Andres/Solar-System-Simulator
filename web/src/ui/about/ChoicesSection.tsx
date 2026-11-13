import { Cite, Item, Items, Sub, Why, Xref } from './prose.tsx';
import type { AboutSection } from './section.ts';

/**
 * What is done on purpose and is not a measurement: exposures, brightness scales,
 * colours and lighting, each with the reason for it. A choice stated is a choice that can
 * be argued with; one left unsaid looks like data.
 */
export const choicesSection: AboutSection = {
  id: 'choices',
  tab: 'Choices',
  title: 'Deliberate choices',
  blurb:
    'Things done on purpose that are not measurements — every image of space has to choose some — and why each is the way it is.',
  subsections: [
    { id: 'scale', label: 'Scale and lighting' },
    { id: 'sun', label: 'The Sun' },
    { id: 'stars', label: 'Stars' },
    { id: 'colours', label: 'Colours that mean something' },
    { id: 'saturn', label: 'Saturn’s rings' },
    { id: 'earth', label: 'Earth' },
    { id: 'black-holes', label: 'Black holes' },
    { id: 'pulsars', label: 'Pulsars' },
    { id: 'supernova-remnants', label: 'Supernova remnants' },
    { id: 'galaxy', label: 'The galaxy’s light' },
    { id: 'local-group', label: 'The Local Group' },
    { id: 'local-volume', label: 'Beyond the Local Group' },
    { id: 'laniakea', label: 'Laniakea and beyond' },
  ],
  Body: ({ data }) => {
    const { stars } = data;
    return (
      <>
        <Sub section="choices" id="scale">
          Scale and lighting
        </Sub>
        <Items>
          <Item title="The marker">
            A body smaller than about three pixels is drawn as a marker, fading back into a real sphere as you
            approach: the only place this simulator departs from physical scale.
            <Why>
              at true scale the planets are essentially invisible — Earth seen from the Sun’s distance is
              1/20th of a pixel.
            </Why>
          </Item>
          <Item title="Lighting modes">
            Flood and Shadow lighting are legibility aids. Only Natural lighting is physical: sunlight only,
            the night side genuinely black, and the default.
            <Why>
              half of everything faces away from the Sun, and an honest render of that is a black disc you
              cannot identify. Flood lights everything evenly; Shadow adds enough fill to read the night side,
              at the price of a terminator that is a gradient rather than an edge. Each is named so nobody
              mistakes it for the truth.
            </Why>
          </Item>
          <Item title="Dots for populations">
            Asteroids, comets and Earth satellites are dots of a pixel or so whatever their distance — a map
            of where they are, not what an eye would see.{' '}
            <Xref to="estimated" sub="small-bodies">
              How the dots are drawn, and why
            </Xref>
            .
          </Item>
          <Item title="Marks fold into what they are part of">
            A mark fades into the mark of what it is part of as the two close to within a mark’s size, 24 to 12
            pixels apart as seen from the camera: a moon into its planet; a cluster, pulsar, remnant or black hole
            into the Milky Way; a satellite galaxy into its giant; the Local Group’s others into the Milky Way’s
            mark, which is the Local Group’s; a group’s galaxies into its brightest; the Virgo Cluster’s into M87.
            Its name goes with it. The body looked at, and what it is part of, never fold. Of two names that would
            still overlap, the body looked at keeps its place, then a body, then the more luminous.
            <Why>from afar a system is one place and its members’ marks one smudge on it; nearer, it opens into them.</Why>
          </Item>
        </Items>

        <Sub section="choices" id="sun">
          The Sun
        </Sub>
        <Items>
          <Item title="Overexposed, on purpose">
            The Sun’s disc is overexposed, and that is the physical answer rather than a stylistic one. Its
            photosphere radiates σT⁴/π, which at 5,772 K is 154,000 times the radiance of the sunlit Earth
            this scene’s exposure is set for — so a correct render of the Sun is a flat white circle with
            nothing in it. It is drawn at 45 times full scale, which is still three and a half thousand times{' '}
            <em>under</em> the true value, chosen so red clips across the whole map and what survives of the
            granulation is in the blue channel. The disc then averages 255, 249, 60 on screen; reading NASA’s
            own render of the Sun pixel by pixel gives 255, 249, 59.
            <Why>
              no screen can show the Sun’s surface and a sunlit planet at once; 45 is the one factor that
              keeps the last of the photosphere’s structure alive, in the only channel with headroom left.{' '}
              <Xref to="physics" sub="sun">
                The radiance
              </Xref>
              .
            </Why>
          </Item>
          <Item title="Its colour">
            The Sun’s photosphere is white in visible light, so every map of it, this one included, is a
            false-colour convention; at that exposure it comes out the yellow-white NASA’s render shows. Its
            glare, and the Sun seen as a star from afar, take its own measured colour, B−V = 0.65, through the
            same Planck-and-CIE path every star’s colour takes.{' '}
            <Xref to="physics" sub="colour">
              Star colour
            </Xref>
            .
          </Item>
          <Item title="Its glare">
            The glare’s profile is the eye’s, measured, and its brightness is the disc’s own illuminance:
            nothing about it is a setting.{' '}
            <Xref to="physics" sub="sun">
              The glare equation
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="choices" id="stars">
          Stars
        </Sub>
        <Items>
          <Item title="Brightness, compressed">
            {`How bright a star is drawn is compressed, and that is this picture’s exposure. The sky spans about thirteen orders of magnitude and a screen has three, so every image of space chooses which three to show; here the brightest star in the catalogue is white, the faintest at magnitude ${stars.magnitudeLimit} is at 2% of it — five code values out of 255, which is what a limiting magnitude already means — and the response between them is linear in magnitude — the eye’s own scale, which is what the magnitude system was built from. Sirius outshines a magnitude ${stars.magnitudeLimit} star by nearly six thousand to one in the sky and by fifty to one here. Size is not a separate setting: it is where a star’s point spread falls below the darkest step a display can show. That spread is a Gaussian core 0.54 pixels wide plus a power-law tail carrying a tenth of the light — the same shape as the Sun’s glare, because every real optical system scatters a few percent of a source into a halo and a Gaussian alone cannot. Both are measured against NASA’s render: the core reproduces its median star at 2.26 pixels, and the tail was solved from its brightest, 13.5 pixels across, which a Gaussian could not have taken past 4.2. Solving the two frames against each other — the brightest stars all falling under one transform — also says that render was at a 30.6° field where this is at 27°, which is why its sky reads a little tighter than this one at the same number of stars.`}
            <Why>
              linear in magnitude models a person looking up — the scale was fixed by Pogson at a hundredfold
              per five magnitudes because that is how the eye divides the sky into even steps. Linear in flux
              would model a photon counter: an almost empty sky with three white dots in it.
            </Why>
          </Item>
          <Item title="Star discs at full colour">
            Alpha Centauri’s three stars are drawn in their own blackbody colours at full brightness — at this
            picture’s exposure every star’s surface is overexposed, even Proxima’s, a thirtieth of the Sun’s
            per square metre.
            <Why>
              what survives an overexposure in any picture is the hue: through the renderer’s curve every disc
              would bleach toward the same yellow-white, and Proxima came out yellow.
            </Why>
          </Item>
          <Item title="The Star Map layer">
            With the Star Map layer on, past the Solar System every star is drawn at least as a dot, however
            faint: a map, not a view, dimmed where the dots crowd. Off, the stars are only what an eye would
            see from where the camera is.
          </Item>
          <Item title="No photographic Milky Way">
            A photographic Milky Way panorama was tried behind the stars and taken out again. It was correctly
            placed — on the galactic frame, checked against Sagittarius A*, Andromeda and both Magellanic
            Clouds — and still wrong: a photograph’s stars arrive already blurred by an atmosphere and a lens,
            so no resolution turns them back into points. It lit 31.8% of the sky where the reference lights
            0.9%.
          </Item>
        </Items>

        <Sub section="choices" id="colours">
          Colours that mean something
        </Sub>
        <Items>
          <Item title="Planets of other stars">
            A confirmed planet is a pale warm white; a disputed one or a candidate is grey — Tau Ceti’s four,
            Proxima c, and every planet the Archive flags as controversial.
            <Why>
              no planet of another star is drawn in a measured colour. The colour says only which are
              confirmed, so a doubtful planet never looks as solid as a real one.
            </Why>
          </Item>
          <Item title="Deimos">
            Flat colour, because its only map cannot be placed —{' '}
            <Xref to="estimated" sub="maps">
              Not known › Surface maps
            </Xref>
            .
          </Item>
        </Items>

        <Sub section="choices" id="saturn">
          Saturn’s rings
        </Sub>
        <Items>
          <Item title="Constant brightness">
            Saturn’s rings are drawn at a constant brightness — the one place here that is knowingly not
            measured. Their radii, plane, shadow and band structure are all real; only the light model is
            faked.
            <Why>
              A physical one was built and corrected four times and still brightened 3.6× too much seen
              edge-on, where the reference images do not brighten at all. Getting it right needs a measured
              particle phase curve and a proper multiple-scattering solution, which is a project of its own.
            </Why>
          </Item>
        </Items>

        <Sub section="choices" id="earth">
          Earth
        </Sub>
        <Items>
          <Item title="The colour of the city lights">
            The colour of the city lights is invented, because the instrument had none to give: the Day/Night
            Band is a single broad channel, so it measures how much light and not what colour. The amber is
            the chromaticity of high-pressure sodium street lighting, which is what most of the world was lit
            by in 2012 and is being replaced by white LEDs as you read this.
          </Item>
          <Item title="Their brightness">
            How bright those lights are drawn is chosen, like the ring brightness.
            <Why>
              A city seen from orbit is about five orders of magnitude fainter than the same ground at noon;
              scaled honestly against the daylit side, every one of them would be black.
            </Why>
          </Item>
          <Item title="A less saturated map">
            Earth’s surface map is drawn 30% less saturated than the file it comes from. How much to take off
            is a judgement, set by eye against NASA’s render; the correction is applied when drawing, never to
            the image on disk.
            <Why>
              The file is an illustrative composite with colour added by its authors, and it reads more
              vividly than a camera would.
            </Why>
          </Item>
        </Items>

        <Sub section="choices" id="black-holes">
          Black holes
        </Sub>
        <Items>
          <Item title="The shadow, unoutlined">
            The shadow is black, and nothing is traced round it: its edge is where the photon ring is, the
            sky’s light bent all the way round the hole.
            <Why>a line drawn there was a guide, not light; the lensing draws the real edge.</Why>
          </Item>
          <Item title="No disc of glowing gas">
            No accretion disc is drawn round any of them.
            <Why>
              in visible light there is none to see: Sgr A* is quiescent, and hidden behind about 30 magnitudes
              of dust <Cite k="genzel2010" />; Gaia BH1 and BH3 are dormant. Cygnus X-1 is feeding, but its
              disc shines in X-rays: in visible light the system is its supergiant. None of the four shows the
              glowing disc of films.
            </Why>
          </Item>
          <Item title="Star images capped">
            A star’s lensed image is drawn at most 100 times (5 magnitudes) brighter than the star.
            <Why>
              near the Einstein ring a real image is a thin arc, not a point; drawn as a point at the full
              magnification it would be a blinding dot no camera would record.
            </Why>
          </Item>
          <Item title="Orbits for scale">
            Around Sgr A* the orbits of Mercury and Earth are drawn for scale, as circles facing you; nothing
            of the Solar System is there.
          </Item>
          <Item title="The cluster’s stars dimmed by light">
            An image of a cluster star that the lens makes fainter is drawn at its star’s brightness times its
            magnification in light, not shifted in magnitude as a single star’s is.
            <Why>
              the picture’s response is linear in magnitude, so a star a hundred times fainter still shows; the
              lens packs the whole sky’s far-side images into a thin ring at the shadow, a thousand to a pixel,
              and summed that way they came out a solid white ring. Light spread over an image is conserved,
              and drawn by light the ring has the sky’s own dim glow.
            </Why>
          </Item>
          <Item title="The cluster’s budget">
            The model draws the stars brighter than magnitude −1 as seen from Sgr A*: 172,382.
            <Why>
              a frame-rate budget. At magnitude 0 there were 363,000, and inside the cluster’s core the picture
              fell to ten frames a second on an integrated GPU; at −1, 15 to 20 there, 40 to 50 at the black
              hole.
            </Why>
          </Item>
          <Item title="A layer of its own">
            The cluster’s model is the Nuclear Cluster Model layer; the measured stars round Sgr A* are always
            drawn.
            <Why>as the galaxy’s model is a layer: what is modelled can be turned off to see what is measured.</Why>
          </Item>
        </Items>

        <Sub section="choices" id="pulsars">
          Pulsars
        </Sub>
        <Items>
          <Item title="Markers">
            Each pulsar is a small dot, a magnetar’s with a ring round it, the same size at any distance, in the
            Pulsars layer. Not its light: a neutron star twelve kilometres in radius gives about a millionth of
            the Sun’s visible light.
            <Why>the dots say where the neutron stars are, which is what there is to see of them.</Why>
          </Item>
          <Item title="Kept with the galaxy in view">
            Unlike the exoplanet hosts’ rings, the dots stay when the whole galaxy is in view, folding into its
            mark only as it shrinks to a few pixels.
            <Why>pulsars are spread through the disc, thousands of light years out; across the galaxy is where their pattern is.</Why>
          </Item>
          <Item title="Spin and beams not drawn">
            A neutron star gone to is a sphere of its radius in its colour, not turning.
            <Why>a turning sphere shows nothing, and the beams a pulsar is known by are radio, from a region no measurement resolves.</Why>
          </Item>
        </Items>

        <Sub section="choices" id="supernova-remnants">
          Supernova remnants
        </Sub>
        <Items>
          <Item title="As bright as their pictures, not as the eye sees them">
            A remnant is as bright as its picture, a long exposure stretched by its makers, thousands of times
            what reaches the eye. Going there would not help: an extended glow’s brightness per patch of sky is
            the same from any distance — nearer, it only covers more of the sky — and from inside one the whole
            sky is that faint. At that brightness the eye sees with its rods, which see no colour: in person, or
            at a telescope, a remnant is a faint grey glow at most. The hues drawn are its light’s own — its lines’
            wavelengths through the eye’s colour response — as they would look were it bright enough to see.
            <Why>the light is the measurement; at the eye’s brightness there would be nothing to see.</Why>
          </Item>
          <Item title="Seen first from Earth’s side">
            Gone to, a remnant is seen from the Sun’s side, north up, as its pictures show it, six of its radii
            out; from there the camera can go round it and into it.
            <Why>from there it is exactly the picture; from anywhere else part of what is shown is modelled.</Why>
          </Item>
          <Item title="Pictures in other light">
            Where no visible-light picture of the whole of a remnant may be used, one in other light gives its
            shape, drawn in the colours of its visible lines.
            <Why>a whole remnant shaped by a measurement, over a part of one or a shape made up.</Why>
          </Item>
        </Items>

        <Sub section="choices" id="galaxy">
          The galaxy’s light
        </Sub>
        <Items>
          <Item title="The model’s look">
            How much light each part gives, the colours of the old populations, the knots and how dark the
            dust is drawn are this model’s choices, made to look as a barred spiral does in visible light.
            <Why>
              the papers it is built from measure where the stars and dust are, not how the whole would
              photograph
              <Cite k={['reid2019', 'blandHawthorn2016', 'drimmelSpergel2001']} />.
            </Why>
          </Item>
        </Items>

        <Sub section="choices" id="local-group">
          The Local Group
        </Sub>
        <Items>
          <Item title="One exposure for all of them">
            A surface brightness of 21 mag/arcsec² is drawn at full strength, the brightest parts softened rather
            than cut off. Andromeda’s disc, about 20 seen at its tilt, shows bright; Fornax’s centre, 23.4,
            faint; the faintest dwarfs, 28 to 31, not at all — as in any photograph: they were found by counting
            their stars. Their marks show where they are.
            <Why>the same rule for every galaxy, so how bright one looks against another is how bright it is.</Why>
          </Item>
          <Item title="Andromeda and Triangulum from their own pictures">
            Each disc is its maps from above, spread through each sheet’s thickness, seen through from wherever
            the camera is: from Earth Andromeda’s dust lanes cross its bulge on the near side, as in its
            photographs; from above, its ring of star formation at 10 kpc and its dust, and Triangulum’s arms. Never a picture laid in the sky. A cluster
            or a star knot is drawn as deep as the sheet it is in, which the pictures cannot say; the stars of
            the foreground the masks missed are taken out first, since in a sheet each would be a streak.
            <Why>what can be measured of a disc tipped 77° to us is what it looks like from here.</Why>
          </Item>
          <Item title="The Large Cloud’s HII regions pink">
            As in its photographs, because they are: their light is Hα’s red and Hβ’s blue-green.
          </Item>
          <Item title="Clusters and dwarfs, from far and near">
            From far off a globular cluster is a point of light, as another galaxy’s are in its photographs, on
            the galaxies’ exposure, so 47 Tucanae beside the Small Cloud is as bright as it is. Near a cluster or
            a dwarf galaxy its stars are drawn one by one — one at a time, the nearest whose brightest giant
            could show, at most 120,000 — and its glow gives way to them. A cluster’s glow of the stars too faint
            to draw is left out while its half-light radius spans more than 140 pixels, and comes in until it
            spans 35: closer in its stars alone carry the picture, and that light is not drawn — for Djor 2 or
            the nuclear cluster, within about 200 light years. At the picture’s limit of V 8 a dwarf’s giants
            show only within about 1.5 kpc of them.
            <Why>an ultra-faint dwarf is a few thousand stars and no glow at all: what is there to see is its stars.</Why>
          </Item>
          <Item title="Going to a dwarf">
            A galaxy whose light shows is framed whole, its light out to three half-light radii in the middle
            of the frame. A faint dwarf, fainter than 26 mag/arcsec² at its centre, shows no light from
            anywhere: it is seen by its stars, as it was found. So it is gone to where its fifth-brightest star,
            counted from its population and its light, is V 6, two magnitudes above the stars’ limit, and never
            nearer than three half-light radii, where it fills the frame: Hercules 380 pc out, not 4.8 kpc, and
            a few of its giants show. The largest faint ones stop at three radii with their stars still faint.
          </Item>
          <Item title="The Small Cloud along our line of sight">
            It is no disc, so it is not drawn from above: each point of its sky is spread along its own line
            from the Sun with the depth measured there. From Earth it is exactly its maps; from beside it, a
            cigar pointing at the Sun some three times longer than wide, as its stars measure it, the young in
            a sharp core along it. Its large-scale part is the map smoothed over 0.3°, never brighter than the
            map, its compact part the rest, the two summing to it: smoothing and adding only what rises above
            would have added light where the map dips — 16% of the dust, 37% of the glowing gas. The price: a
            hole in the map is a hole through the cloud’s whole depth.
            <Why>its stars measure how deep it is, and in no other way is its shape known.</Why>
          </Item>
          <Item title="The nuclear cluster’s edge, tapered">
            Its measured law, cut sharp where it holds the cluster’s 25 million Suns, ended in a hard egg. Its
            density is instead brought smoothly to nothing over its outer half, ending 22.3 pc out with the same
            mass and light.
            <Why>how it thins past 10 pc is not measured, apart from the nuclear disc’s.</Why>
          </Item>
          <Item title="A galaxy drawn to where its light fades">
            A bright galaxy’s volume reaches until its light is a ten-thousandth of white, not a fixed eight
            scale radii; each point of light, a galaxy’s, a cluster’s or a model star’s, is drawn round, out to
            where, encoded for the screen, it is under half a display step and rounds to black.
            <Why>cut sooner, M32 showed as a faint square and the clusters’ points as squares.</Why>
          </Item>
          <Item title="Marks only, where no size is measured">
            Hydra I, Boötes III and the Canis Major Overdensity have no size measured and a disputed nature,
            debris or a dwarf; HIZSS 3A and 3B lie behind the Milky Way’s plane, found by their gas, with no V.
            Each is a mark, its panel saying why.
          </Item>
          <Item title="Light past white, a halo">
            Every glow — the galaxies’, the clusters’, the Milky Way’s, the remnants’ gas — is added up linear
            and goes through one soft shoulder, 1 − e<sup>−x</sup>, whose output is still linear light: it is
            then encoded for the screen as the stars’ light is, so a faint glow beside a faint star is as bright
            as it. Up to white, a column of 21 mag/arcsec², it is shown as it is.
            Past white its light is not thrown away: it spreads by the stars’ own point spread — the 0.54-pixel
            core and the tail carrying a tenth of the light, falling as r<sup>−2</sup> — out to the frame’s
            size, the light it holds kept. So a cluster’s or a galaxy’s core far past white is a bright star’s
            core and halo, not a flat white plate with an edge. Drawn as a sum of blurs, one per octave of
            radius each carrying the profile’s light there, it is within 4% of the profile from 8 to 64 pixels.
            <Why>
              the photographs the glows are calibrated against carry their own spread below white; past white
              the shoulder crushed every step into one, where a star as bright keeps a halo that grows with it.
            </Why>
          </Item>
          <Item title="Every galaxy at least a dot">
            A galaxy too small for a few pixels is drawn as a dot at least faintly bright, in its own colour,
            however faint it is: on one exposure most dwarfs would not show at all. Its brightness above that
            is its own; once it is a few pixels across, it is its light alone.
            <Why>so that where a galaxy is shows, as a faint dot, without its mark.</Why>
          </Item>
          <Item title="Too small for a pixel, a point">
            A galaxy smaller on the screen than a few pixels is drawn as a dot holding all of its light, as it
            lands on a photograph’s pixel. From the Local Group’s view Triangulum and the Clouds are bright dots and
            Andromeda little more; most of the dwarfs are too faint to show at all.
            <Why>drawn as a volume, a galaxy that small fell between the pixels and was gone.</Why>
          </Item>
          <Item title="As the eye would not see them">
            To the eye only the centres of Andromeda, Triangulum and the Magellanic Clouds would show, faint and
            grey; the rest is a long exposure’s.
          </Item>
          <Item title="Seen first from Earth’s side">
            A galaxy is gone to from the Sun’s side of it, north up, as its photographs show it.
          </Item>
          <Item title="Not round the camera">
            Light nearer the camera than three-tenths of its distance from a galaxy’s centre is left out. From
            inside a disc what is left is the disc across the sky, a band, as the Milky Way is from here.
            <Why>there a galaxy is its stars, one by one, which are not drawn; summed as a glow they would fill the sky white.</Why>
          </Item>
          <Item title="Only out of the Milky Way">
            They are drawn once the camera is out among the galaxy’s own model, and their marks once it leaves
            the disc.
            <Why>from inside, they are the sky’s, and the sky is the stars’.</Why>
          </Item>
        </Items>

        <Sub section="choices" id="local-volume">
          Beyond the Local Group
        </Sub>
        <Items>
          <Item title="Three profiles">
            A dwarf — a spheroidal, a dwarf elliptical, an irregular, a blue compact dwarf, a Magellanic spiral, an
            elliptical fainter than M<sub>V</sub> −17 — is drawn as the Local Group’s dwarfs are; a giant elliptical
            by de Vaucouleurs’s law, or its own fit; an S0 to an Sdm as an exponential disc with its bulge.
            <Why>
              the classes their catalogues give, and the profile each class is known to follow{' '}
              <Cite k="devaucouleurs1948" />.
            </Why>
          </Item>
          <Item title="A giant elliptical’s envelope, as its fit carries it">
            Each is drawn out to 30 effective radii of its fit, past the last light measured, all its fit’s light
            inside: M86’s fit, of index 10.3, has an effective radius of 190 kpc along its major axis, half its
            light a faint halo across the cluster’s core. Gone to, each is framed on its light out to 24
            mag/arcsec², not on its effective radius: M87 on its inner 19 kpc.
            <Why>its fit is what is measured of its light; where the envelope truly ends is not.</Why>
          </Item>
          <Item title="Only the Virgo Cluster’s certain members">
            Its catalogue’s 561 possible members, outside the infall model that defines membership, are not drawn:
            most of them lie in the clouds twice as far. 29 it shares with the Local Volume’s catalogue are drawn
            from that, which measures their distances.
          </Item>
          <Item title="Once each">
            The 102 galaxies of the Local Volume’s catalogue that McConnachie’s lists are drawn from his; Andromeda,
            the Milky Way and Segue 3, a star cluster, are left out of it. A distance error of a magnitude or more
            is taken as not given: M51’s reads 24.23.
          </Item>
          <Item title="The Virgo Cluster and home in one frame">
            From 200 million light years the Virgo Cluster, 54 million light years off, and the Local Group are in
            one frame from either end.
          </Item>
          <Item title="From over the supergalactic pole">
            The Local Volume is seen from over the pole of the plane its galaxies lie in, the Virgo Cluster to the
            right; the Virgo Cluster the same way, from 60 million light years over M87.
            <Why>
              in that plane lie the Local Sheet, the groups about us and the cluster itself{' '}
              <Cite k={['devaucouleurs1953', 'lahav2000']} />: face-on it is a map, and the cluster’s depth runs
              across the frame.
            </Why>
          </Item>
          <Item title="The brightest named, the rest marked">
            Galaxies of V 9.5 or brighter are named on the sky from the start, as Andromeda is; the others carry a
            mark, and where two marks would overlap the less luminous gives way. A group’s marks fold into its
            brightest’s as it grows small on the screen.
            <Why>from the Virgo Cluster’s view a thousand marks would be one smudge.</Why>
          </Item>
          <Item title="The Local Group, named as one">
            From past about 11 Mpc the Milky Way’s name is the Local Group’s, and its galaxies’ names fold into it.
          </Item>
        </Items>

        <Sub section="choices" id="laniakea">
          Laniakea and beyond
        </Sub>
        <Items>
          <Item title="Where they are now, not where they were seen">
            Every galaxy is at its comoving distance: the scene is one instant, and the light of the farthest left
            it 2.2 billion years ago. Its absolute V is from its luminosity distance, so seen from the Sun it is
            brighter here than the sky shows it by 5 log<sub>10</sub>(1 + z) magnitudes — 0.06 at the Coma
            Cluster, 0.2 at 400 Mpc. Its panel gives the V the sky shows.
          </Item>
          <Item title="A group’s distance over a galaxy’s own">
            A galaxy in a Cosmicflows-4 group is at the group’s distance, the mean of its members’, not its own
            Tully–Fisher or fundamental-plane distance, each 20% uncertain.
            <Why>a cluster’s galaxies, each at its own, would scatter along the line of sight over 40 Mpc.</Why>
          </Item>
          <Item title="Each a point, the near ones volumes">
            Every galaxy is a point holding all its light, as a far galaxy of the Local Volume is, and at least a
            faint dot in its colour; the few the camera is near are volumes, by the same three profiles.
            <Why>at these distances almost all are under a pixel; their map is what the catalogue is.</Why>
          </Item>
          <Item title="Marks only near">
            A group is marked only while it is large on the screen, its galaxies with it; a named cluster’s
            galaxies fold into the cluster. The clusters, superclusters, basins, voids and walls are named from out
            of the Local Group on.
            <Why>86,899 marks would be a wall of rings.</Why>
          </Item>
          <Item title="Both answers to where we live">
            The Laniakea Basin layer draws Laniakea’s boundary as the galaxies’ reconstruction finds it; the
            Shapley Basin layer the groups’ answer, in which there is no Laniakea and the Milky Way’s flow ends at
            Shapley. Valade et al. find the data slightly prefer the second <Cite k="valade2024" />. The
            breadcrumb’s “Laniakea” is the first; every panel gives both.
            <Why>the two reconstructions are of the same data, and neither is settled.</Why>
          </Item>
          <Item title="Drawn faint">
            A basin and a void are outlines, their faces nearly clear; from inside a basin its outline is a quarter
            as strong. A wall is a line along it: the CfA2 Great Wall is a sheet 50° tall, drawn through the Coma
            Cluster’s declination.
          </Item>
          <Item title="As far as 3 billion light years">
            The camera pulls back that far: focused on the Sun, from over the supergalactic pole, the superclusters
            out to the Sculptor Supercluster, 400 Mpc off, and the Sloan Great Wall are in one frame. Laniakea’s view
            stands 1.8 billion light years over its attractor, the Nearby Universe’s 1.5 billion over the Sun.
          </Item>
          <Item title="The Local Volume, named as one">
            From past about 124 Mpc the Milky Way’s name is the Local Volume’s, and the names of its galaxies and
            the Virgo Cluster’s fold into it and into the Virgo Cluster’s own.
          </Item>
          <Item title="Left out">
            The 813 galaxies the Local Group’s and the Local Volume’s catalogues draw, drawn from those; 239
            HyperLEDA records that are not galaxies.
          </Item>
        </Items>
      </>
    );
  },
};
