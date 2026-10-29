import type { ReactNode } from 'react';

import { anchorId, type SectionId, useAboutNav } from './nav.ts';
import { referenceAnchor, referenceNumber } from './references.ts';

/**
 * The About panel's typography: a few components, so every section reads the same and
 * the house style lives in one place. The greys are the ones the panel has always used --
 * body #a4a4a4, emphasis #e0e0e0, headings #6a6a6a -- on the near-black overlay.
 */

export const TEXT = '#a4a4a4';
export const BRIGHT = '#e0e0e0';
export const MUTED = '#6a6a6a';
export const RULE = '#2a2a2a';
/** The one accent: links, citations and the current section. Pale, so it never shouts. */
export const ACCENT = '#9fc3e0';

export function Prose({ children }: { children: ReactNode }) {
  return (
    <p style={{ color: TEXT, fontSize: '0.88rem', lineHeight: 1.75, margin: '0 0 1.1rem' }}>{children}</p>
  );
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong style={{ color: BRIGHT, fontWeight: 600 }}>{children}</strong>;
}

/** A subsection heading, with the id the section's index and cross-references jump to. */
export function Sub({ section, id, children }: { section: SectionId; id: string; children: ReactNode }) {
  return (
    <h3
      id={anchorId(section, id)}
      style={{
        margin: '2.2rem 0 0.8rem',
        paddingBottom: '0.35rem',
        borderBottom: `1px solid ${RULE}`,
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: MUTED,
        // Clear of the panel's top edge when jumped to.
        scrollMarginTop: '1rem',
      }}
    >
      {children}
    </h3>
  );
}

/** A list of plain-text paragraphs, as the measured facts have always been set. */
export function List({ items }: { items: readonly string[] }) {
  return (
    <ul style={{ margin: '0 0 1.1rem', paddingLeft: '1.1rem' }}>
      {items
        .filter((item) => item !== '')
        .map((item) => (
          <li
            key={item}
            style={{ color: TEXT, fontSize: '0.84rem', lineHeight: 1.7, marginBottom: '0.5rem' }}
          >
            {item}
          </li>
        ))}
    </ul>
  );
}

export function Items({ children }: { children: ReactNode }) {
  return <ul style={{ margin: '0 0 1.1rem', paddingLeft: '1.1rem' }}>{children}</ul>;
}

/** One entry: an optional short title in bold, the text, and often a `Why`. */
export function Item({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <li style={{ color: TEXT, fontSize: '0.84rem', lineHeight: 1.7, marginBottom: '0.7rem' }}>
      {title !== undefined && (
        <>
          <Strong>{title}</Strong>
          {'. '}
        </>
      )}
      {children}
    </li>
  );
}

/** The reason for an estimate, a convention or a choice: its own line, so it can be found. */
export function Why({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'block',
        marginTop: '0.3rem',
        paddingLeft: '0.7rem',
        borderLeft: `2px solid ${RULE}`,
      }}
    >
      <span
        style={{
          color: MUTED,
          fontSize: '0.68rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        Why{' '}
      </span>
      {children}
    </span>
  );
}

const linkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: ACCENT,
  cursor: 'pointer',
  textDecoration: 'none',
} as const;

/** A citation: the reference's number in brackets, which jumps to it in Sources. */
export function Cite({ k }: { k: string | readonly string[] }) {
  const nav = useAboutNav();
  const keys = typeof k === 'string' ? [k] : k;
  return (
    <span style={{ whiteSpace: 'nowrap', fontSize: '0.92em' }}>
      {' ['}
      {keys.map((key, index) => (
        <span key={key}>
          {index > 0 && ', '}
          <button
            type="button"
            className="about-link"
            style={linkStyle}
            title="Go to this reference in Sources"
            onClick={() => nav.goTo('sources', referenceAnchor(key))}
          >
            {referenceNumber(key)}
          </button>
        </span>
      ))}
      {']'}
    </span>
  );
}

/** A link to another section, or to a subsection of one. */
export function Xref({ to, sub, children }: { to: SectionId; sub?: string; children: ReactNode }) {
  const nav = useAboutNav();
  return (
    <button
      type="button"
      className="about-link"
      style={linkStyle}
      onClick={() => nav.goTo(to, sub === undefined ? undefined : anchorId(to, sub))}
    >
      {children}
    </button>
  );
}

/** Where in the source something lives: a path, set as code. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.92em', color: '#8a8a8a' }}>
      {children}
    </code>
  );
}

/**
 * An equation as the Physics section sets them: the formula, displayed; what its symbols
 * are; where in the code it is evaluated; and where it comes from.
 */
export function Equation({
  title,
  math,
  symbols,
  code,
  cite,
  children,
}: {
  title: ReactNode;
  math: ReactNode;
  symbols?: ReactNode;
  code: string | readonly string[];
  cite?: string | readonly string[];
  children?: ReactNode;
}) {
  const files = typeof code === 'string' ? [code] : code;
  return (
    <div
      style={{
        margin: '0 0 1.2rem',
        padding: '0.8rem 1rem 0.7rem',
        border: `1px solid ${RULE}`,
        borderRadius: '0.35rem',
        background: 'rgba(255,255,255,0.015)',
      }}
    >
      <div style={{ color: BRIGHT, fontSize: '0.84rem', fontWeight: 600 }}>
        {title}
        {cite !== undefined && <Cite k={cite} />}
      </div>
      {/* Its own scroller, so a long formula never widens the page on a phone. */}
      <div
        className="scroll-hidden"
        style={{ overflowX: 'auto', color: BRIGHT, fontSize: '1.05rem', padding: '0.3rem 0' }}
      >
        {math}
      </div>
      {symbols !== undefined && (
        <div style={{ color: TEXT, fontSize: '0.8rem', lineHeight: 1.6 }}>{symbols}</div>
      )}
      {children !== undefined && (
        <div style={{ color: TEXT, fontSize: '0.8rem', lineHeight: 1.65, marginTop: '0.35rem' }}>
          {children}
        </div>
      )}
      <div style={{ color: MUTED, fontSize: '0.72rem', marginTop: '0.4rem' }}>
        In the code:{' '}
        {files.map((file, index) => (
          <span key={file}>
            {index > 0 && ', '}
            <Code>{file}</Code>
          </span>
        ))}
      </div>
    </div>
  );
}
