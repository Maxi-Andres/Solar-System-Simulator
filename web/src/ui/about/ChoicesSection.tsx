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
    { id: 'galaxy', label: 'The galaxy’s light' },
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
              of dust <Cite k="genzel2010" />; Gaia BH1 and BH3 are dormant. The bright discs of films are of
              holes that are feeding.
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
            The model draws the stars brighter than magnitude −1 as seen from Sgr A*: 171,739.
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
      </>
    );
  },
};
