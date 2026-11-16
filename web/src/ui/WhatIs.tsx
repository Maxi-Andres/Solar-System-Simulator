import { openAboutAt } from './AboutPanel.tsx';
import { termAnchor } from './about/GlossarySection.tsx';

/**
 * "What is this?": beside a panel's kind line, a jump to the About's plain-words entry for
 * that kind (about/GlossarySection.tsx). Small and pale, so the panel stays a panel of values.
 */
export function WhatIs({ term, kind }: { term: string; kind: string }) {
  return (
    <button
      type="button"
      className="about-link"
      title={`What “${kind}” means, in the About`}
      onClick={() => openAboutAt('glossary', termAnchor(term))}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        marginLeft: 'auto',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '0.62rem',
        letterSpacing: '0.04em',
        color: '#6f8aa0',
      }}
    >
      what is this?
    </button>
  );
}
