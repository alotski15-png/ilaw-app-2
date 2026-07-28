import { describe, it, expect } from 'vitest';
import { extractBowMetadataFromText } from '../lib/bow-metadata';

describe('extractBowMetadataFromText', () => {
  it('detects terms and weeks from a typical BOW PDF text', () => {
    const text = `
      First Term
      Week 1: Introduction to the topic
      Weeks 2 to 3: Building skills
      Second Term
      Week 4: Continued practice
      Week 5: Assessment and review
      Week 6: Performance task
    `;

    const result = extractBowMetadataFromText(text);

    expect(result.terms).toEqual(['First Term', 'Second Term']);
    expect(result.weeks).toEqual(['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6']);
  });
});
