/**
 * A name shown where text is set in capitals (the scene's labels, the breadcrumb) with its Greek
 * letters left lower case: `text-transform: uppercase` makes the α of "α Cen A" a capital Α,
 * which is a Latin A to the eye -- "A CEN A". The Bayer letter stays a letter: "α CEN A".
 */

/** Runs of lower-case Greek letters, kept by a split as its odd parts. */
const GREEK_LOWER = /([α-ω]+)/;

/** What keeps a run as it is written. */
const AS_WRITTEN = { textTransform: 'none' } as const;

/**
 * `name`, its lower-case Greek letters in spans that capitals leave alone: one span about the
 * whole, so that in a flex row it is still one item; a plain string where there are none.
 */
export function CasedName({ name }: { readonly name: string }) {
  const parts = name.split(GREEK_LOWER);
  if (parts.length === 1) return name;
  return (
    <span>
      {parts.map((part, k) =>
        k % 2 === 1 ? (
          <span key={k} style={AS_WRITTEN}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  );
}

/** The same written into `element` directly, for a text the frame loop sets (scene/LabelProjector.tsx). */
export function setCasedText(element: HTMLElement, text: string): void {
  const parts = text.split(GREEK_LOWER);
  if (parts.length === 1) {
    element.textContent = text;
    return;
  }
  element.replaceChildren(
    ...parts.map((part, k) => {
      if (k % 2 === 0) return part;
      const span = document.createElement('span');
      span.style.textTransform = 'none';
      span.textContent = part;
      return span;
    }),
  );
}
