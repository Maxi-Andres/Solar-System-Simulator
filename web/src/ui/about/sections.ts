import { choicesSection } from './ChoicesSection.tsx';
import { estimatedSection } from './EstimatedSection.tsx';
import { measuredSection } from './MeasuredSection.tsx';
import { SECTION_IDS } from './nav.ts';
import { overviewSection } from './OverviewSection.tsx';
import { physicsSection } from './PhysicsSection.tsx';
import type { AboutSection } from './section.ts';
import { sourcesSection } from './SourcesSection.tsx';

/** The About's sections in reading order: the order of the tabs, and of SECTION_IDS. */
export const ABOUT_SECTIONS: readonly AboutSection[] = [
  overviewSection,
  measuredSection,
  estimatedSection,
  physicsSection,
  choicesSection,
  sourcesSection,
];

if (ABOUT_SECTIONS.some((section, index) => section.id !== SECTION_IDS[index])) {
  throw new Error('ABOUT_SECTIONS is out of step with SECTION_IDS.');
}
