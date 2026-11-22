import { addressSection } from './AddressSection.tsx';
import { choicesSection } from './ChoicesSection.tsx';
import { estimatedSection } from './EstimatedSection.tsx';
import { fictionSection } from './FictionSection.tsx';
import { glossarySection } from './GlossarySection.tsx';
import { measuredSection } from './MeasuredSection.tsx';
import { SECTION_IDS } from './nav.ts';
import { overviewSection } from './OverviewSection.tsx';
import { physicsSection } from './PhysicsSection.tsx';
import type { AboutSection } from './section.ts';
import { sourcesSection } from './SourcesSection.tsx';

/** The About's sections in reading order: the order of the tabs, and of SECTION_IDS. */
export const ABOUT_SECTIONS: readonly AboutSection[] = [
  overviewSection,
  glossarySection,
  addressSection,
  measuredSection,
  estimatedSection,
  physicsSection,
  choicesSection,
  sourcesSection,
  // Last, after the sources and apart from them: fiction is never mixed with data.
  fictionSection,
];

if (ABOUT_SECTIONS.some((section, index) => section.id !== SECTION_IDS[index])) {
  throw new Error('ABOUT_SECTIONS is out of step with SECTION_IDS.');
}
