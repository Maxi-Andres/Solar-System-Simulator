import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { EphemerisStore } from '../../core/ephemerisStore.ts';
import { useStoreVersion } from '../../core/useStoreVersion.ts';
import { GLOSSARY_PHOTOS, type GlossaryPhoto } from './glossaryPhotos.ts';
import { Lightbox, photoButtonId, type LightboxPhoto } from './Lightbox.tsx';
import { termAnchor } from './terms.ts';
import { ACCENT, Items, MUTED, Prose, RULE, Strong, Sub, TEXT, Xref } from './prose.tsx';
import type { AboutData, AboutSection } from './section.ts';
import { canShow, SHOW_ME, showMe, showMeLabel, type ShowMeSources, type ShowMeTarget } from './showMe.ts';

/**
 * What each kind of thing in the app *is*, in plain words, for someone who is not an
 * astronomer: a star, a dwarf planet, a galaxy group, a void. The rest of the About says
 * what is measured of each and how it is drawn; this says what the word means.
 *
 * The one place the About is allowed to explain at length -- but each entry is still a
 * sentence or three, with one real number where it helps and where in the app to find it.
 * Ordered by scale, from the Sun outward. Only kinds the app shows, and the few words
 * (redshift, comoving distance) needed to read the rest.
 *
 * Each entry has its own anchor, `termAnchor(id)`, so the body panel's kind line and any
 * other text can jump to it.
 *
 * A photo opens large when clicked (Lightbox.tsx); an entry whose kind the scene draws has a
 * "show me" that closes the About and goes to one of them (showMe.ts).
 */

// Its anchors and the kind each body is described under, apart from the text (terms.ts).
export { KIND_TERM, termAnchor } from './terms.ts';

/** What the entries reach: the open lightbox, and the store and sources "show me" goes with. */
interface GlossaryReach {
  readonly openPhoto: (term: string) => void;
  readonly store: EphemerisStore;
  readonly sources: ShowMeSources;
}

const GlossaryContext = createContext<GlossaryReach | null>(null);

/** The photos in the order the entries give them: the lightbox's arrows follow it. */
const PHOTOS: readonly LightboxPhoto[] = Object.entries(GLOSSARY_PHOTOS).map(([term, photo]) => ({ term, photo }));

/**
 * One entry: its title in bold, a few sentences, and where in the app it is -- and, where an
 * official one exists, a small photograph beside it with its credit (glossaryPhotos.ts).
 */
function Term({ id, title, app, children }: { id: string; title: string; app?: ReactNode; children: ReactNode }) {
  const photo = GLOSSARY_PHOTOS[id];
  return (
    <li
      id={termAnchor(id)}
      style={{
        color: TEXT,
        fontSize: '0.84rem',
        lineHeight: 1.7,
        marginBottom: '0.8rem',
        scrollMarginTop: '1rem',
        // Its photo floats in it; the next entry starts below both.
        display: 'flow-root',
      }}
    >
      {photo !== undefined && <Photo term={id} photo={photo} />}
      <Strong>{title}</Strong>
      {'. '}
      {children}
      {app !== undefined && <InApp show={SHOW_ME[id]}>{app}</InApp>}
    </li>
  );
}

/**
 * A photograph, small, to the right of its entry, its credit under it. Fetched only when the
 * section is open, and then only as it scrolls near (`loading="lazy"`). A button: it opens large.
 */
function Photo({ term, photo }: { term: string; photo: GlossaryPhoto }) {
  const reach = useContext(GlossaryContext);
  return (
    <figure style={{ float: 'right', width: 'min(10rem, 38%)', margin: '0.25rem 0 0.5rem 0.9rem' }}>
      <button
        type="button"
        id={photoButtonId(term)}
        aria-label={`Enlarge: ${photo.alt}`}
        title="Enlarge"
        onClick={() => reach?.openPhoto(term)}
        style={{
          display: 'block',
          width: '100%',
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'zoom-in',
          borderRadius: '0.2rem',
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}glossary/${photo.file}`}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading="lazy"
          decoding="async"
          style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '0.2rem', background: '#0b0b0e' }}
        />
      </button>
      <figcaption style={{ color: MUTED, fontSize: '0.6rem', lineHeight: 1.35, marginTop: '0.25rem' }}>
        {photo.credit}
      </figcaption>
    </figure>
  );
}

/** Where to find it: its own line, set as the other sections set a `Why`, with its "show me". */
function InApp({ show, children }: { show: ShowMeTarget | undefined; children: ReactNode }) {
  return (
    <span style={{ display: 'block', marginTop: '0.25rem', paddingLeft: '0.7rem', borderLeft: `2px solid ${RULE}` }}>
      <span style={{ color: MUTED, fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        In the app{' '}
      </span>
      {children}
      {show !== undefined && <ShowMe target={show} />}
    </span>
  );
}

/** "show me": the About closed and the camera taken to one of the kind, as "go there" does. */
function ShowMe({ target }: { target: ShowMeTarget }) {
  const reach = useContext(GlossaryContext);
  // A star the app places once the star names are in: drawn again when it is.
  useStoreVersion(reach?.store ?? null);
  const label = showMeLabel(target);
  const ready = reach !== null && canShow(target, reach.store, reach.sources);
  return (
    <button
      type="button"
      className="about-link"
      disabled={!ready}
      title={ready ? `Close the About and go to ${label}` : `${label} is not placed yet`}
      onClick={() => {
        if (reach !== null) showMe(target, reach.store, reach.sources);
      }}
      style={{
        marginLeft: '0.5rem',
        background: 'none',
        border: 'none',
        padding: 0,
        font: 'inherit',
        fontSize: '0.72rem',
        color: ready ? ACCENT : MUTED,
        cursor: ready ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      show me
    </button>
  );
}

/** A layer's name as the Layers panel shows it. */
function Layer({ children }: { children: ReactNode }) {
  return <span style={{ color: '#c8c8c8' }}>{children}</span>;
}

/** The line closing a subsection: where the data behind it is described. */
function More({ children }: { children: ReactNode }) {
  return <Prose>{children}</Prose>;
}

export const glossarySection: AboutSection = {
  id: 'glossary',
  tab: 'What’s what',
  title: 'What everything is',
  blurb: 'Every kind of thing the app shows, in plain words, from the Sun out to the edge of what can be seen.',
  subsections: [
    { id: 'distances', label: 'Measuring distance' },
    { id: 'solar-system', label: 'The Solar System' },
    { id: 'stars', label: 'Stars' },
    { id: 'milky-way', label: 'The Milky Way' },
    { id: 'galaxies', label: 'Galaxies and their groups' },
    { id: 'large-scale', label: 'The largest structures' },
    { id: 'universe', label: 'The observable universe' },
  ],
  Body: ({ data }) => <GlossaryBody data={data} />,
};

/** The section's text, with the lightbox over it while a photo is open. */
function GlossaryBody({ data }: { data: AboutData }) {
  const [open, setOpen] = useState<number | null>(null);
  const reach = useMemo<GlossaryReach>(
    () => ({
      openPhoto: (term) => setOpen(PHOTOS.findIndex((entry) => entry.term === term)),
      store: data.store,
      sources: { pulsars: data.pulsarSource, globularClusters: data.clusterSource },
    }),
    [data.store, data.pulsarSource, data.clusterSource],
  );
  return (
    <GlossaryContext.Provider value={reach}>
      {open !== null && open >= 0 && (
        <Lightbox photos={PHOTOS} index={open} onClose={() => setOpen(null)} onMove={setOpen} />
      )}
      <GlossaryText />
    </GlossaryContext.Provider>
  );
}

/** The entries themselves. */
function GlossaryText() {
  return (
    <>
      <Sub section="glossary" id="distances">
        Measuring distance
      </Sub>
      <Items>
        <Term id="au" title="Astronomical unit (AU)">
          The average distance from Earth to the Sun, 149,597,870.7 km by definition. Light crosses it in 8
          minutes 19 seconds. Handy inside the Solar System: Jupiter is about 5 AU out, Neptune 30.
        </Term>
        <Term id="light-year" title="Light year">
          A distance, not a time: how far light goes in a year, 9.46 trillion km or about 63,000 AU. The
          nearest star, Proxima Centauri, is 4.2 light years away, so we see it as it was 4.2 years ago.
        </Term>
        <Term
          id="parsec"
          title="Parsec"
          app="The scale bar, bottom right, switches unit as you zoom; hover it for the same length in parsecs."
        >
          3.26 light years. As Earth goes round the Sun, a nearby star seems to shift a little against the
          far background; a parsec is the distance at which that shift is one arcsecond, and measuring the shift
          (the <em>parallax</em>) is how star distances are found. Astronomers count in kiloparsecs (thousands)
          and megaparsecs (millions; one is 3.26 million light years).
        </Term>
      </Items>

      <Sub section="glossary" id="solar-system">
        The Solar System
      </Sub>
      <Items>
        <Term id="sun" title="The Sun" app="Always there; click it to focus.">
          Our star: a ball of hydrogen and helium 1.39 million km across, 109 times Earth, holding 99.86% of
          the Solar System’s mass. It has been shining for 4.6 billion years by fusing hydrogen into helium in
          its core. Its surface is about 5,800 K.
        </Term>
        <Term id="orbit" title="Orbit" app={<>The <Layer>Orbits</Layer> layer; for spacecraft, <Layer>Trails</Layer>.</>}>
          The path one body follows around another under gravity. A closed orbit is an ellipse; a body moving
          too fast to be held follows an open curve (a parabola or hyperbola) and never comes back.
        </Term>
        <Term id="planet" title="Planet" app={<>The <Layer>Planets</Layer> layer.</>}>
          By the IAU’s 2006 definition, a body that orbits the Sun, is massive enough to have pulled itself
          round, and has cleared its orbit of other things its size. There are eight: four rocky (Mercury,
          Venus, Earth, Mars), two gas giants (Jupiter, Saturn) and two ice giants (Uranus, Neptune).
        </Term>
        <Term id="dwarf-planet" title="Dwarf planet" app={<>The <Layer>Dwarf Planets</Layer> layer.</>}>
          Round like a planet, but sharing its orbit with many other bodies. The IAU recognises five: Ceres,
          Pluto, Haumea, Makemake and Eris. Dozens more out past Neptune probably qualify.
        </Term>
        <Term
          id="moon"
          title="Moon"
          app={<>The <Layer>Moons</Layer> layer for the large ones, <Layer>Small Moons</Layer> for the other 437.</>}
        >
          A natural body orbiting a planet, dwarf planet or asteroid. Ours is 3,474 km across; Ganymede, the
          largest, is bigger than Mercury. Saturn alone has more than 270 known, most a few kilometres wide.
        </Term>
        <Term
          id="asteroid"
          title="Asteroid"
          app={<>The <Layer>Asteroids</Layer> layer: the named ones as bodies, the rest as dots, each on its own orbit.</>}
        >
          A rocky or metallic leftover from the Solar System’s formation, too small to be round. Most are under a
          kilometre; the largest, Ceres (940 km), is also a dwarf planet.
        </Term>
        <Term id="main-belt" title="Main belt" app={<>The <Layer>Asteroids</Layer> layer, family “Main belt”.</>}>
          The ring of asteroids between Mars and Jupiter, about 2.1 to 3.3 AU from the Sun. Over a million are
          known, yet all of them together weigh about 3% of our Moon, and the belt is mostly empty space:
          spacecraft cross it without having to dodge anything.
        </Term>
        <Term id="near-earth" title="Near-Earth asteroid" app={<>Family “Near-Earth” in <Layer>Asteroids</Layer>.</>}>
          One whose orbit comes within 1.3 AU of the Sun, and so near Earth’s. Apophis, 340 m across, will pass
          about 32,000 km above Earth’s surface on 13 April 2029.
        </Term>
        <Term id="trojan" title="Trojan" app={<>Family “Jupiter Trojans” in <Layer>Asteroids</Layer>.</>}>
          An asteroid sharing a planet’s orbit, gathered about one of two points 60° ahead of or behind it, where
          the planet’s pull and the Sun’s balance (the Lagrange points L4 and L5). Jupiter has more than ten
          thousand; Earth has two known.
        </Term>
        <Term id="centaur" title="Centaur" app={<>Family “Centaurs” in <Layer>Asteroids</Layer>.</>}>
          An icy body wandering between Jupiter and Neptune, on an orbit the giant planets will upset within a few
          million years. Part asteroid, part comet: Chiron has shown a comet’s haze.
        </Term>
        <Term
          id="kuiper-belt"
          title="Kuiper belt and trans-Neptunian objects"
          app={<>Family “Trans-Neptunian” in <Layer>Asteroids</Layer>; Pluto, Eris and the rest in <Layer>Dwarf Planets</Layer>.</>}
        >
          A trans-Neptunian object is anything orbiting the Sun farther out, on average, than Neptune. Most
          lie in the Kuiper belt, a thick ring of icy bodies 30 to 50 AU out; others, like Sedna, range much
          farther. Pluto is the best known; Arrokoth, visited by New Horizons in 2019, the most distant body
          ever visited.
        </Term>
        <Term id="comet" title="Comet" app={<>The <Layer>Comets</Layer> layer: about 4,000, each on its own orbit.</>}>
          A lump of ice and dust a few kilometres across. Near the Sun its ice turns to gas, which streams off in
          a haze and a tail that can stretch millions of kilometres. Long-period comets are thought to come from
          the Oort cloud, a vast shell of icy bodies out to perhaps 100,000 AU, never seen directly.
        </Term>
        <Term id="oort-cloud" title="Oort cloud" app={<>The <Layer>Heliosphere</Layer> layer: a faint shell, from about 1,000 AU out.</>}>
          The comets’ reservoir, inferred from where long-period comets come from: an inner cloud from about
          2,000 to 20,000 AU and an outer one to about 100,000 AU. No object has been seen in it.
        </Term>
        <Term id="heliosphere" title="Heliosphere" app={<>The <Layer>Heliosphere</Layer> layer: both boundaries and the four Voyager crossings, searchable.</>}>
          The bubble the solar wind blows in the interstellar gas. At the termination shock, about 90 AU out, the
          wind drops below the speed of sound; at the heliopause, about 120 AU, it meets the interstellar medium.
          Each has been crossed twice, by the two Voyagers; its shape between is modelled.
        </Term>
        <Term id="lagrange-point" title="Lagrange point" app={<>The <Layer>Lagrange Points</Layer> layer: the Sun–Earth and Earth–Moon five.</>}>
          One of five places where a small body can keep its place against two big ones, going round with them.
          L1 and L2, 1.5 million km either side of Earth, hold observatories such as SOHO and JWST. A point, not
          an object.
        </Term>
        <Term id="magnetosphere" title="Magnetosphere" app={<>The <Layer>Magnetosphere</Layer> layer, off at first.</>}>
          The space Earth’s magnetic field holds against the solar wind: the magnetopause about 10 Earth radii
          sunward, the bow shock ahead of it, the Van Allen belts of trapped particles inside.
        </Term>
        <Term id="interstellar-object" title="Interstellar object" app="2I/Borisov is a body; 3I/ATLAS is in the Comets layer.">
          A visitor from another star, passing through on an open orbit, too fast for the Sun to hold. Three are
          known: ʻOumuamua (2017, not drawn here), 2I/Borisov (2019) and 3I/ATLAS (2025).
        </Term>
        <Term id="spacecraft" title="Spacecraft" app={<>The <Layer>Spacecraft</Layer> layer; their paths, <Layer>Trails</Layer>.</>}>
          A probe sent by people, flying on its own orbit about the Sun, a planet or a moon. Voyager 1, launched in
          1977, is the farthest, about 170 AU out and leaving at 17 km/s.
        </Term>
        <Term id="satellite" title="Earth satellite" app={<>The <Layer>Satellites</Layer> layer: a hundred named ones as models, tens of thousands as dots.</>}>
          An artificial object orbiting Earth. The Space Station circles at about 400 km once every 92 minutes;
          GPS satellites at 20,200 km; geostationary ones at 35,786 km, where an orbit takes exactly one day,
          so they hang over one spot.
        </Term>
      </Items>
      <More>
        What is measured of these: <Xref to="measured" sub="planets">planets and moons</Xref>,{' '}
        <Xref to="measured" sub="small-bodies">asteroids and comets</Xref>,{' '}
        <Xref to="measured" sub="spacecraft">spacecraft</Xref>,{' '}
        <Xref to="measured" sub="satellites">satellites</Xref>.
      </More>

      <Sub section="glossary" id="stars">
        Stars
      </Sub>
      <Items>
        <Term
          id="star"
          title="Star"
          app={<>The sky, as an eye would see it; with the <Layer>Star Map</Layer> layer, every catalogued star at its real place.</>}
        >
          A ball of hot gas held together by its own gravity and lit by nuclear fusion in its core. Stars range
          from under a tenth of the Sun’s mass to over a hundred. The Milky Way has a few hundred billion.
        </Term>
        <Term id="spectral-type" title="Colour and spectral type" app="A star’s panel gives its spectral type where one is catalogued; its colour is worked out from its measured B−V.">
          A star’s colour is its surface temperature: red stars are about 3,000 K, the Sun 5,800 K (yellow-white),
          blue ones 20,000 K and more. Astronomers sort them by letter, O B A F G K M from hottest to coolest,
          and add a Roman numeral for size: V a main-sequence star, III a giant, I a supergiant. The Sun is G2V.
        </Term>
        <Term id="main-sequence" title="Main-sequence star">
          A star in the long, steady part of its life, fusing hydrogen in its core, as the Sun is. About nine
          stars in ten are. The heavier the star, the hotter, bluer and shorter-lived: the Sun lasts about 10 billion
          years, a star of ten Suns a few tens of millions.
        </Term>
        <Term id="red-dwarf" title="Red dwarf" app="Proxima Centauri, Barnard’s Star and Wolf 359; search them.">
          The smallest, coolest main-sequence stars, from 8% to about 60% of the Sun’s mass. About three stars in
          four near the Sun are red dwarfs, yet not one is bright enough to see without a telescope. They may shine
          for trillions of years.
        </Term>
        <Term id="giant" title="Giant" app="Arcturus and Aldebaran; search them.">
          A star that has used up the hydrogen in its core and swollen, its surface growing cooler and redder.
          Arcturus is 25 times the Sun’s width. The Sun will become one in about 5 billion years.
        </Term>
        <Term id="supergiant" title="Supergiant" app="Betelgeuse, Antares and Rigel; search them.">
          A star of more than about eight Suns late in its life, hundreds of times the Sun’s width. Betelgeuse,
          set where the Sun is, would reach past the orbit of Mars. Supergiants end as supernovae, leaving a
          neutron star or a black hole.
        </Term>
        <Term id="white-dwarf" title="White dwarf" app="Sirius B, drawn on its orbit about Sirius A; Van Maanen’s Star. Thousands more are faint dots in the 100-parsec census.">
          What a Sun-like star leaves behind: its bare core, about the Sun’s mass packed into a ball the size of Earth.
          Nothing burns in it any more; it glows from stored heat and cools over billions of years. Sirius B has
          1.02 times the Sun’s mass and is a little smaller than Earth.
        </Term>
        <Term id="neutron-star" title="Neutron star, pulsar and magnetar" app={<>The <Layer>Pulsars</Layer> layer: every pulsar that can be placed, and the magnetars.</>}>
          The collapsed core of a massive star after a supernova: about 1.4 Suns in a ball some 20 km across, so
          dense that a teaspoon would weigh billions of tonnes. A <em>pulsar</em> is one whose beams sweep past
          us like a lighthouse’s, from once every few seconds to 716 times a second. A <em>magnetar</em> has the
          strongest magnetic field known.
        </Term>
        <Term id="black-hole" title="Black hole" app="Sagittarius A*, Gaia BH1, Gaia BH3 and Cygnus X-1, each its true size, drawn as its shadow with the sky bent round it.">
          Matter squeezed so tight that nothing, not even light, escapes from inside its edge, the <em>event
          horizon</em>. Stellar black holes are left by massive stars and weigh a few to tens of Suns; Gaia BH1,
          about 1,560 light years away, is the nearest known. Supermassive ones, millions to billions of Suns, sit at
          the centres of galaxies.
        </Term>
        <Term id="star-system" title="Binary and multiple stars" app="Alpha Centauri’s three and Sirius’s two move on their measured orbits.">
          Stars born together and orbiting each other. Nearly half of Sun-like stars have at least one companion.
          Our nearest neighbours are a triple: Alpha Centauri A and B, orbiting 11 to 35 AU apart, and Proxima 13,000 AU out.
        </Term>
        <Term id="exoplanet" title="Exoplanet" app={<>The <Layer>Exoplanet Hosts</Layer> layer rings each star with a known planet, a dot per planet.</>}>
          A planet of another star. More than 6,000 are confirmed, most found by the dip in light as one crosses its
          star or by the wobble it gives the star; only a few dozen have been photographed.
        </Term>
        <Term
          id="constellation"
          title="Constellation"
          app={<>The <Layer>Constellations</Layer> layer, off at first: borders, names and figures, from near the Sun.</>}
        >
          One of the 88 regions the IAU divides the sky into, with borders fixed in 1930, so that every star and
          galaxy lies in exactly one. The figures drawn through the brightest stars — the hunter, the bears — are
          far older and official nowhere: every atlas draws them its own way. A constellation is a line-up seen
          from here, not a group: Orion’s brightest stars lie from about 250 to well over 1,000 light years away.
        </Term>
        <Term id="dwarf" title="“Dwarf”: one word, six things">
          A <em>dwarf star</em> is just a main-sequence star (the Sun is a yellow dwarf); a <em>red dwarf</em> is
          the smallest kind of those. A <em>white dwarf</em> is a dead star’s core. A <em>brown dwarf</em>, 13 to
          about 80 times Jupiter’s mass, is too small ever to fuse hydrogen: Gaia sees only the nearest and warmest,
          so the map holds few and does not single them out. A <em>dwarf planet</em> and a <em>dwarf galaxy</em> are
          each just the small end of their kind.
        </Term>
      </Items>
      <More>
        What is measured of these: <Xref to="measured" sub="stars">stars</Xref>,{' '}
        <Xref to="measured" sub="sirius">Sirius B</Xref>, <Xref to="measured" sub="exoplanets">exoplanets</Xref>,{' '}
        <Xref to="measured" sub="black-holes">black holes</Xref>, <Xref to="measured" sub="pulsars">pulsars</Xref>.
      </More>

      <Sub section="glossary" id="milky-way">
        The Milky Way
      </Sub>
      <Items>
        <Term
          id="milky-way"
          title="The Milky Way"
          app={<>The <Layer>Milky Way Model</Layer> layer: a model of its measured shape, drawn as a glow, never as stars. The breadcrumb’s Milky Way shows it whole.</>}
        >
          Our galaxy: a flat, barred spiral of a few hundred billion stars, about 100,000 light years across, with
          no sharp edge. The Sun is some 27,000 light years from the centre and goes round it once in about 230
          million years. The pale band across the night sky is its disc, seen from inside.
        </Term>
        <Term id="disc-bulge-arms" title="Disc, bar, bulge and spiral arms">
          Most stars, gas and dust lie in the <em>disc</em>, about a thousand light years thick near the Sun. At the
          middle an elongated <em>bar</em> of old stars, with a peanut-shaped <em>bulge</em>. The <em>spiral
          arms</em> are not solid: they are where gas piles up and new, bright blue stars are born, and stars drift
          through them. The Sun lies in a minor spur between the Perseus and Sagittarius arms.
        </Term>
        <Term id="galactic-centre" title="Galactic Centre" app={<>Sgr A* and its stars; the <Layer>Nuclear Cluster Model</Layer> layer for the crowd about them.</>}>
          The Milky Way’s heart, hidden from our eyes by dust. At the very centre is Sagittarius A*, a black hole of
          4.3 million Suns, packed round by tens of millions of stars within a few dozen light years. The star S2 orbits
          it every 16 years.
        </Term>
        <Term id="star-cluster" title="Star cluster" app={<>The <Layer>Globular Clusters</Layer> layer: about 160, the one you approach drawn as its stars. The Pleiades’ bright stars are on the map, not marked as a cluster.</>}>
          Stars born together and still held together. An <em>open cluster</em> is young and loose, a few hundred
          to a few thousand stars in the disc, drifting apart over a few hundred million years: the Pleiades. A{' '}
          <em>globular cluster</em> is a dense ball of hundreds of thousands to millions of stars, most over 10
          billion years old, orbiting in the galaxy’s halo; Omega Centauri has about ten million.
        </Term>
        <Term id="supernova-remnant" title="Supernova remnant and nebula" app={<>The <Layer>Supernova Remnants</Layer> layer: nine, each a 3D shape of its real size; the <Layer>Nebulae</Layer> layer: fourteen star-forming regions and planetary nebulae, each a volume of its measured size.</>}>
          A <em>nebula</em> is a cloud of gas and dust in space. A <em>supernova</em> is a star blowing itself
          apart, for weeks as bright as a whole galaxy; its <em>remnant</em> is the expanding shell of debris, which
          glows for tens of thousands of years. The Crab Nebula is what is left of a star seen to explode in 1054.
        </Term>
      </Items>
      <More>
        What is measured of these: <Xref to="measured" sub="galaxy">the Milky Way</Xref>,{' '}
        <Xref to="measured" sub="galactic-centre">the Galactic Centre’s stars</Xref>,{' '}
        <Xref to="measured" sub="globular-clusters">globular clusters</Xref>,{' '}
        <Xref to="measured" sub="supernova-remnants">supernova remnants</Xref>.
      </More>

      <Sub section="glossary" id="galaxies">
        Galaxies and their groups
      </Sub>
      <Items>
        <Term
          id="galaxy"
          title="Galaxy"
          app={<>The <Layer>Local Group</Layer> layer, and the galaxies past it out to the Virgo Cluster, each a volume of its measured light and shape; the <Layer>Laniakea</Layer> layer’s 86,899 as points.</>}
        >
          A vast system of stars, gas and dust held together by gravity, from a few thousand stars to over a
          trillion. Most of a galaxy’s mass is thought to be <em>dark matter</em>, unseen but felt by its pull. The
          observable universe holds hundreds of billions of galaxies, perhaps up to two trillion.
        </Term>
        <Term id="spiral" title="Spiral galaxy" app="The Milky Way, Andromeda (M31), Triangulum (M33), M51, M101; a galaxy’s panel gives its type.">
          A flat, spinning disc with spiral arms around a central bulge, still forming stars. About two in three
          have a bar across the middle, as ours does.
        </Term>
        <Term id="lenticular" title="Lenticular galaxy">
          A disc and a bulge but no arms and little gas left to make stars: a lens shape, between a spiral and an
          elliptical. Drawn here as a disc with a large bulge.
        </Term>
        <Term id="elliptical" title="Elliptical galaxy" app="M87 and the Virgo Cluster’s other giants; M32 beside Andromeda.">
          A smooth, featureless ball or egg of mostly old, reddish stars, with little gas and few new stars. The
          largest, at the centres of clusters, hold trillions of stars; M87’s black hole, the first ever imaged, has
          six and a half billion Suns.
        </Term>
        <Term id="irregular" title="Irregular galaxy" app="The Small Magellanic Cloud, NGC 6822, WLM.">
          No clear shape, often rich in gas and busy forming stars; many are small and have been pulled out of shape
          by larger neighbours.
        </Term>
        <Term id="dwarf-galaxy" title="Dwarf galaxy" app="Most of the Local Group’s galaxies. Go near one and its stars appear one by one.">
          A small galaxy, up to a few billion stars; most galaxies are dwarfs. The faintest, the <em>ultra-faint</em>{' '}
          dwarfs, have only a few thousand stars and were found by counting stars, not by their glow.
        </Term>
        <Term id="satellite-galaxy" title="Satellite galaxy" app="The Large and Small Magellanic Clouds; M32 and M110 about Andromeda.">
          A smaller galaxy orbiting a bigger one. The Milky Way has dozens; the largest, the Large Magellanic Cloud,
          is 160,000 light years away and visible to the eye from the southern hemisphere.
        </Term>
        <Term id="galaxy-group" title="Galaxy group">
          Up to about fifty galaxies bound together by gravity, a few million light years across.
        </Term>
        <Term id="local-group" title="Local Group" app={<>The <Layer>Local Group</Layer> layer; on the breadcrumb, Local Group lists its galaxies.</>}>
          Our own group: the Milky Way, Andromeda and Triangulum, and about a hundred dwarfs, some 10 million light
          years across. Andromeda, 2.5 million light years away, is closing on us at about 110 km/s; the two may
          merge in several billion years, though recent measurements make that far from certain.
        </Term>
        <Term id="galaxy-cluster" title="Galaxy cluster" app={<>The <Layer>Laniakea</Layer> layer: the named clusters, found by search; the Virgo Cluster is on the breadcrumb. Planck’s 1,088 to z 1 as rings, the <Layer>SZ Clusters</Layer> layer.</>}>
          Hundreds to thousands of galaxies bound together, up to a thousand trillion Suns in all, most of it dark
          matter. The space between the galaxies is filled with gas so hot it shines in X-rays, and it weighs more
          than all their stars. The nearest big one, Virgo, is 54 million light years away.
        </Term>
      </Items>
      <More>
        What is measured of these: <Xref to="measured" sub="local-group">the Local Group</Xref>,{' '}
        <Xref to="measured" sub="local-volume">beyond it</Xref>.
      </More>

      <Sub section="glossary" id="large-scale">
        The largest structures
      </Sub>
      <Items>
        <Term id="supercluster" title="Supercluster" app={<>The <Layer>Laniakea</Layer> layer: superclusters, clusters, voids and walls, named, each found by search.</>}>
          Groups and clusters of galaxies strung together across hundreds of millions of light years. Unlike a
          cluster, a supercluster is mostly not held together: the universe’s expansion will pull it apart. Shapley,
          the most massive nearby, is about 650 million light years away.
        </Term>
        <Term id="laniakea" title="Laniakea and basins of attraction" app={<><Layer>Basins of Attraction</Layer>, off: a chip a basin, the groups’ Shapley off within it.</>}>
          Galaxies do not only drift apart with the expansion; they also fall toward where there is more mass. A{' '}
          <em>basin of attraction</em> is a region whose galaxies all flow toward the same place, like the land that
          drains into one river. Laniakea (Hawaiian for “immeasurable heaven”) is ours, about 520 million light years
          across, holding the Local Group and the Virgo Cluster. Whether it is a basin of its own or part of
          Shapley’s depends on how the flow is reconstructed; the app draws both answers.
        </Term>
        <Term id="attractor" title="Attractors and repellers">
          An <em>attractor</em> is where the flow of galaxies converges, a concentration of mass, not an object:
          the Great Attractor, about 200 million light years away behind the Milky Way’s own disc, is the one our
          region falls toward. A <em>repeller</em> is an emptier region galaxies stream away from, such as the
          Dipole Repeller.
        </Term>
        <Term id="flow-lines" title="Flow lines" app={<>The <Layer>Flow Lines</Layer> layer: 53 of them, Laniakea’s in gold, brightening toward where each ends.</>}>
          The paths the galaxies’ own motions trace once the expansion is taken out, worked out from tens of
          thousands of measured galaxy distances (Cosmicflows-4). They show where each region is falling.
        </Term>
        <Term id="void" title="Void" app="Voids are drawn as soft shells in the Laniakea layer; the Local Void is beside us.">
          A vast, nearly empty region with a few galaxies, tens to hundreds of millions of light years across.
          Voids fill most of the universe’s volume. The Local Group sits at the edge of one, the Local Void.
        </Term>
        <Term id="wall" title="Great wall" app="The CfA2 and Sloan Great Walls, their galaxies tinted.">
          A sheet of galaxies, the largest patterns known: the CfA2 Great Wall is about 500 million light years long,
          the Sloan Great Wall about 1.4 billion. They are not bound objects, only where the cosmic web is densest.
        </Term>
        <Term id="cosmic-web" title="Filaments and the cosmic web" app={<>The <Layer>SDSS Galaxies</Layer> layer, 1.8 million galaxies out to 9 billion light years; the <Layer>Filaments</Layer> layer, the threads found in them.</>}>
          On the largest scales galaxies lie along <em>filaments</em>, threads tens of millions of light years long
          meeting at clusters, around walls and voids: a web, or a foam. It grew by gravity from tiny ripples in
          the early universe. The galaxies here come in wedges because each survey only looked at part of the sky.
        </Term>
      </Items>
      <More>
        What is measured of these: <Xref to="measured" sub="laniakea">Laniakea and beyond</Xref>,{' '}
        <Xref to="measured" sub="cosmic-web">the cosmic web</Xref>.
      </More>

      <Sub section="glossary" id="universe">
        The observable universe
      </Sub>
      <Items>
        <Term id="redshift" title="Redshift (z)" app="A far galaxy’s panel gives its z.">
          The universe is expanding, and light crossing it is stretched along with it, to longer, redder
          wavelengths. The redshift <em>z</em> says by how much: light at z = 1 left when the universe was half
          its present size. Nearby, a galaxy recedes at about 70 km/s for every megaparsec of distance (Hubble’s
          law); the exact rate, 67 or 73, depends on how it is measured, a dispute not yet settled.
        </Term>
        <Term id="comoving-distance" title="Comoving distance">
          How far away something is <em>now</em>, with the expansion since its light left included. It is larger
          than the distance the light has travelled: the oldest light took 13.8 billion years to arrive, but its
          source is now about 46 billion light years away. Everything past Laniakea is placed here at its comoving
          distance.
        </Term>
        <Term id="quasar" title="Quasar" app={<>SDSS DR16Q’s 750,000, in the SDSS’s wedges, the <Layer>Quasars</Layer> layer; 3C 273, TON 618, J0313−1806 and EUCL J1729+6410 in the <Layer>Observable Universe</Layer> layer.</>}>
          A supermassive black hole swallowing gas so fast that the hot disc around it outshines its whole galaxy,
          often a hundred times over. 3C 273, the first identified (1963), is the brightest in our sky; the
          farthest are seen as they were less than 700 million years after the Big Bang.
        </Term>
        <Term id="gamma-ray-burst" title="Gamma-ray burst" app="GRB 221009A, GRB 090423, GRB 090429B and GRB 250314A.">
          The brightest explosions known: a flash of gamma rays lasting seconds to minutes, when a very massive star
          collapses into a black hole or two neutron stars merge. GRB 221009A, in 2022, was the brightest ever
          recorded, nicknamed “the BOAT”.
        </Term>
        <Term id="record-holders" title="Record holders" app={<>Nineteen of them, in the <Layer>Observable Universe</Layer> layer; search them by name.</>}>
          The farthest, biggest or brightest known of their kind, each at its own distance: the farthest galaxy,
          MoM-z14, seen as it was about 280 million years after the Big Bang; Earendel, the farthest single star,
          if it is one; TON 618, among the heaviest black holes, tens of billions of Suns by an uncertain estimate;
          El Gordo and the Bullet Cluster among the clusters.
        </Term>
        <Term id="cmb" title="Cosmic microwave background" app={<>The <Layer>Observable Universe</Layer> layer: Planck’s map on the sky’s wall all about, seen from inside, in true colour or Planck’s false colour.</>}>
          The oldest light there is. For its first 380,000 years the universe was a glowing fog; when it had cooled
          to about 3,000 K it turned clear, and that light has been travelling ever since. Stretched about 1,100
          times, it now arrives from every direction as microwaves at 2.725 K. Its spots, one part in 100,000, are
          the seeds the cosmic web grew from.
        </Term>
        <Term id="observable-universe" title="The observable universe" app="Zoom out until the scale bar reads a billion light years, and the CMB’s wall comes up all about; the camera goes to 40 billion, never outside.">
          The part of the universe from which light has had time to reach us in the 13.8 billion years since the
          Big Bang: a sphere about 46 billion light years in radius, centred on us, as every observer has their own.
          The whole universe is at least this big and may be infinite; nobody knows.
        </Term>
      </Items>
      <More>
        What is measured of these: <Xref to="measured" sub="universe">the observable universe</Xref>.
      </More>
    </>
  );
}
