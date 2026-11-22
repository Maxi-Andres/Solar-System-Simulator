import { FICTION, FICTION_COLOR, valueNote, workLine, type FictionRecord, type FictionWork } from '../../core/fiction.ts';
import { Item, Items, Prose, Strong, Sub } from './prose.tsx';
import type { AboutSection } from './section.ts';

/**
 * Fiction (core/fiction.ts), apart from everything measured: the rule that keeps it apart, how it
 * is placed and drawn, and each work with what of it is here -- its own list, never among the
 * sources of the data.
 */

/** The works, each once, in the order their first object is listed. */
function works(): { readonly work: FictionWork; readonly records: readonly FictionRecord[] }[] {
  const byTitle = new Map<string, { work: FictionWork; records: FictionRecord[] }>();
  for (const record of FICTION) {
    const entry = byTitle.get(record.work.title) ?? { work: record.work, records: [] };
    entry.records.push(record);
    byTitle.set(record.work.title, entry);
  }
  return [...byTitle.values()];
}

/** Every source a work's records cite, in full, each once. */
function sourcesOf(records: readonly FictionRecord[]): string[] {
  const values = records.flatMap((record) => [
    record.radiusKm,
    record.massEarth,
    record.orbit.semiMajorAxisKm,
    record.orbit.eccentricity,
    ...record.facts.map((fact) => fact.value),
  ]);
  return [
    ...new Set(
      values.flatMap((value) =>
        'source' in value ? [value.source.unverified === true ? `${value.source.full} (unverified)` : value.source.full] : [],
      ),
    ),
  ];
}

/** How many of a record's drawn numbers are still stand-ins. */
function standIns(record: FictionRecord): number {
  const values = [
    record.radiusKm,
    record.massEarth,
    record.orbit.semiMajorAxisKm,
    record.orbit.eccentricity,
    record.orbit.inclinationDeg,
    record.orbit.nodeDeg,
  ];
  return values.filter((value) => valueNote(value).kind === 'standIn').length;
}

export const fictionSection: AboutSection = {
  id: 'fiction',
  tab: 'Fiction',
  title: 'Fiction',
  blurb: 'Worlds from novels and films, placed where their stories put them — kept apart from the data, and how.',
  subsections: [
    { id: 'rule', label: 'Fiction is never mixed with data' },
    { id: 'numbers', label: 'Where each number comes from' },
    { id: 'works', label: 'The works' },
  ],
  Body: () => (
    <>
      <Sub section="fiction" id="rule">
        Fiction is never mixed with data
      </Sub>
      <Prose>
        The Fiction layer, off unless switched on, places worlds from stories beside the real things their
        stories tie them to: Avatar’s Pandora goes round a giant planet of the real α Centauri A, and moves
        with it. Everything fictional is marked as such wherever it appears — a{' '}
        <span style={{ color: FICTION_COLOR }}>magenta</span> triangle for its marker and a magenta orbit, shapes
        and a colour nothing real is drawn with; a <Strong>FICTION</Strong> tag on its name, in search and on
        its panel. No fictional body is counted in any list or statistic of real ones: α Centauri A’s planets
        are still its one unconfirmed candidate, whatever this layer draws beside it.
      </Prose>

      <Sub section="fiction" id="numbers">
        Where each number comes from
      </Sub>
      <Items>
        <Item title="From the canon">
          A number the work gives, with where it gives it: the film, the novel, the creator’s own guide.
        </Item>
        <Item title="Unverified">
          A name or fact known only at second hand — a licensed game’s own encyclopedia, as a fan wiki quotes
          it — kept because nothing better names the thing, and marked unverified beside it.
        </Item>
        <Item title="Stand-in">
          A plausible number put in while the canon is being read, so the world can be drawn: its size, its
          orbit. Its panel says so beside each one.
        </Item>
        <Item title="Invented">
          A number the story never gives but a sphere needs — a radius, the plane of an orbit — chosen to fit what
          the story does say, and marked canon silent.
        </Item>
        <Item title="Position invented">
          For a thing the canon gives no place at all, one is made up from its name, the same in every visit,
          and its label says <Strong>POSITION INVENTED</Strong>.
        </Item>
      </Items>
      <Prose>
        The looks are drawn here, procedurally, from what each story describes: no film’s model, texture or
        artwork is used. A world is lit by its own star, as the real planets of other stars are.
      </Prose>

      <Sub section="fiction" id="works">
        The works
      </Sub>
      <Items>
        {works().map(({ work, records }) => (
          <Item key={work.title} title={workLine(work)}>
            {records
              .map((record) => {
                const pending = standIns(record);
                return `${record.name} — ${record.anchorLine.charAt(0).toLowerCase()}${record.anchorLine.slice(1)}${
                  pending > 0 ? `; ${pending} of its numbers stand-ins` : ''
                }`;
              })
              .join('. ')}
            . Sources: {sourcesOf(records).join('; ')}.
          </Item>
        ))}
      </Items>
    </>
  ),
};
