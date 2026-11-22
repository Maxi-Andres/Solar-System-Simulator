import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CasedName } from './casedName.tsx';

describe('a name under capitals', () => {
  it('keeps its Greek letters lower case, so α Cen A is not "A CEN A"', () => {
    expect(renderToStaticMarkup(<CasedName name="α Cen B (Toliman)" />)).toBe(
      '<span><span style="text-transform:none">α</span> Cen B (Toliman)</span>',
    );
  });

  it('leaves a name without them as it is', () => {
    expect(renderToStaticMarkup(<CasedName name="Proxima Centauri" />)).toBe('Proxima Centauri');
  });
});
