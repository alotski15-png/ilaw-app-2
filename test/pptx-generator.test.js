import { describe, expect, it } from 'vitest';
import PizZip from 'pizzip';
import {
  buildSlideDeckPptx,
  contrastRatio,
  pickReadableTextColor,
} from '../lib/pptx-generator';
import { makeTestSlideDeck } from './fixtures/slide-deck';

describe('editable PowerPoint rendering', () => {
  it('keeps text readable against generated theme colors', () => {
    expect(contrastRatio('FFFFFF', '17324D')).toBeGreaterThan(4.5);
    expect(pickReadableTextColor('FFFFFF', 'F7F3EA')).toBe('111827');
    expect(pickReadableTextColor('FFFFFF', '111111')).toBe('111111');
  });

  it('writes native slide text and real presenter notes without an extra title slide', async () => {
    const slideDeck = makeTestSlideDeck();
    const pptx = buildSlideDeckPptx({
      slideDeck,
      snapshotData: { subject: 'Mathematics', term: 'Term 1', week: 'Week 3' },
    });

    expect(pptx._slides).toHaveLength(slideDeck.slides.length);

    const output = await pptx.write({ outputType: 'nodebuffer', compression: true });
    expect(output.length).toBeGreaterThan(10_000);

    const zip = new PizZip(output);
    const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    const notesFiles = Object.keys(zip.files).filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
    expect(slideFiles).toHaveLength(slideDeck.slides.length);
    expect(notesFiles).toHaveLength(slideDeck.slides.length);

    const firstSlideXml = zip.file('ppt/slides/slide1.xml').asText();
    const firstNotesXml = zip.file('ppt/notesSlides/notesSlide1.xml').asText();
    expect(firstSlideXml).toContain('One pizza, many fair shares');
    expect(firstNotesXml).toContain('Ask learners to explain their reasoning');
    expect(firstNotesXml).toContain('[Sources]');
  });
});
