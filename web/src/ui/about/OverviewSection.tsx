import { Item, Items, List, Prose, Strong, Sub, Xref } from './prose.tsx';
import type { AboutSection } from './section.ts';

/** What this is, in two paragraphs; how the rest of the About is laid out; how to move around. */
export const overviewSection: AboutSection = {
  id: 'overview',
  tab: 'Overview',
  title: 'Real-time, real data, real scale',
  blurb: 'What this is, how to move around, and where in this text to find what.',
  subsections: [
    { id: 'what', label: 'What this is' },
    { id: 'sections', label: 'How this text is laid out' },
    { id: 'navigation', label: 'Getting around' },
  ],
  Body: () => (
    <>
      <Sub section="overview" id="what">
        What this is
      </Sub>
      <Prose>
        Every position you see comes from <Strong>NASA/JPL Horizons</Strong>, the same ephemeris service
        mission planners use. Nothing here is a simulated orbit or an artist&rsquo;s approximation: the
        planets are where DE441 says they are, moving at the speeds it says they move.
      </Prose>
      <Prose>
        <Strong>Distances and sizes are real and never compressed.</Strong> That is unusual, and it has a
        consequence worth understanding: at true scale the planets are essentially invisible. Earth seen from
        the Sun&rsquo;s distance is 1/20th of a pixel. So when a body shrinks below about three pixels it is
        drawn as a marker instead of a sphere, and it fades back into a real sphere as you approach. That
        marker is the only place this simulator departs from physical scale.
      </Prose>

      <Sub section="overview" id="sections">
        How this text is laid out
      </Sub>
      <Items>
        <Item title={<Xref to="measured">What is measured</Xref>}>
          The real data, domain by domain — planets and moons, small bodies, spacecraft, satellites, stars,
          Alpha Centauri, planets of other stars, black holes, the galaxy — and how well it is held.
        </Item>
        <Item title={<Xref to="estimated">What is not known</Xref>}>
          Where the data runs out, and what fills the gap: each estimate or convention, the relation it uses,
          and why.
        </Item>
        <Item title={<Xref to="physics">Physics</Xref>}>
          The equations the scene is computed with, what their symbols mean, where each lives in the code and
          where it comes from.
        </Item>
        <Item title={<Xref to="choices">Deliberate choices</Xref>}>
          What is done on purpose and is not a measurement — exposure, brightness, colours, lighting — and
          why.
        </Item>
        <Item title={<Xref to="sources">Sources</Xref>}>
          Every paper, catalogue and service, numbered; a number in brackets anywhere in this text jumps to
          it. Credits and licences.
        </Item>
      </Items>

      <Sub section="overview" id="navigation">
        Getting around
      </Sub>
      <List
        items={[
          'Drag to rotate. There is no pole to get stuck at — in space there is no up, so the view tumbles freely in any direction.',
          'Scroll to zoom. Each notch changes distance by a fixed ratio, so a few thousand km and hundreds of AU are equally easy to navigate, and a notch that keeps a scroll going goes further, up to eight times — from the Space Station to a thousand light years is a few seconds of scrolling. It pulls back to 400,000 light years, far enough to see the whole galaxy from outside.',
          'The scale bar, bottom right, measures at the distance of what you are focused on: a perspective picture has no single scale, and the focus is the one point whose distance is always known. It switches from metres to kilometres, astronomical units and light years as you zoom; hover it for the same length in parsecs.',
          'The Distance Rings are circles about the Sun at 1, 5, 10, 50 and 100 light years, in the plane of the ecliptic, where every orbit here is drawn. They are a ruler, not a thing, and appear only once the camera is out among the stars. The dashed circle at 326 light years is different: it is the edge of the 100-parsec star census, drawn with the Star Map, and the dark past it is where the catalogue stops, not the stars. The breadcrumb’s Solar Neighbourhood takes you fifty light years out, and Milky Way 180,000, where the galaxy model is seen whole; the arrow beside Milky Way lists the black holes.',
          'Click any body, label or table row to focus it. The camera reframes relative to that body’s own radius.',
          'Use the time controls to run fast, run backwards, or jump back to LIVE.',
        ]}
      />
    </>
  ),
};
