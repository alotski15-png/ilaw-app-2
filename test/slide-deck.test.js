import { describe, expect, it } from 'vitest';
import {
  buildSlideDeckPrompt,
  buildVisualAssetPrompt,
  clampSlideCount,
  getSlideDeckQualityIssues,
  mapWithConcurrency,
  slideNeedsVisual,
} from '../lib/slide-deck';
import { makeTestSlideDeck } from './fixtures/slide-deck';

describe('narrative slide-deck planning', () => {
  it('clamps requested deck lengths to supported schema bounds', () => {
    expect(clampSlideCount('not-a-number')).toBe(16);
    expect(clampSlideCount(4)).toBe(10);
    expect(clampSlideCount(40)).toBe(24);
    expect(clampSlideCount(12)).toBe(12);
  });

  it('accepts a coherent deck and reports structural quality issues', () => {
    const deck = makeTestSlideDeck();
    expect(getSlideDeckQualityIssues(deck, 10)).toEqual([]);

    deck.slides[9].title = deck.slides[8].title;
    deck.slides[5].layout = 'steps';
    expect(getSlideDeckQualityIssues(deck, 10)).toEqual(expect.arrayContaining([
      'Every slide title must be unique.',
      'The deck needs at least one classroom activity slide.',
    ]));
  });

  it('creates image prompts for visual assets, never rasterized slide text', () => {
    const deck = makeTestSlideDeck();
    const slide = deck.slides[0];
    expect(slideNeedsVisual(slide)).toBe(true);
    const prompt = buildVisualAssetPrompt({
      slide,
      deck,
      gradeLevel: 'Grade 5',
      subject: 'Mathematics',
    });
    expect(prompt).toContain('text-free 16:9 educational visual asset');
    expect(prompt).toContain('Do not render a slide');
    expect(prompt).toContain('native editable PowerPoint text');
  });

  it('requests an exact, source-grounded teaching arc', () => {
    const prompt = buildSlideDeckPrompt({
      selectedSession: { sessionTitle: 'Comparing fractions', flow: 'Use paper fraction circles.' },
      gradeLevel: 'Grade 5',
      subject: 'Mathematics',
      term: 'Term 1',
      week: 'Week 3',
      slideCount: 12,
      designStyle: 'Modern Educational',
      additionalPrompt: 'Use familiar food-sharing examples.',
    });
    expect(prompt).toContain('Create exactly 12 slides.');
    expect(prompt).toContain('hook, objective, recall, concept, worked example');
    expect(prompt).toContain('speakerNotes');
  });

  it('limits concurrent image work while preserving slide order', async () => {
    let active = 0;
    let peak = 0;
    const result = await mapWithConcurrency([4, 3, 2, 1], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, value));
      active -= 1;
      return value * 10;
    });

    expect(peak).toBeLessThanOrEqual(2);
    expect(result).toEqual([40, 30, 20, 10]);
  });
});
