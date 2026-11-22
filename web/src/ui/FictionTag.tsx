import { FICTION_COLOR, fictionTag, type FictionRecord } from '../core/fiction.ts';

/**
 * The FICTION tag, wherever a fictional thing is listed or shown outside the scene -- the
 * breadcrumb's list, search, the info panel -- as its label carries it in the scene (App.tsx).
 */
export function FictionTag({ record }: { readonly record: FictionRecord }) {
  return (
    <span
      style={{
        flex: 'none',
        color: FICTION_COLOR,
        border: `1px solid ${FICTION_COLOR}`,
        borderRadius: '0.2rem',
        padding: '0 0.3rem',
        fontSize: '0.56rem',
        letterSpacing: '0.12em',
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
      }}
    >
      {fictionTag(record)}
    </span>
  );
}
