import { describe, it, expect } from 'vitest';
import { formatDocxText, getOnlyName } from '../lib/docx-helpers';

describe('docx-helpers', () => {
  it('formatDocxText returns empty string for null/undefined', () => {
    expect(formatDocxText(null)).toBe('');
    expect(formatDocxText(undefined)).toBe('');
  });

  it('trims and strips markdown-like syntax', () => {
    const input = "### Heading\n**bold**\n- item1\n- item2";
    const out = formatDocxText(input);
    expect(out).toContain('Heading');
    expect(out).toContain('bold');
    expect(out).not.toContain('**');
    expect(out).not.toContain('- ');
  });

  it('parses JSON arrays in bracketed strings', () => {
    const input = '["one","two","three"]';
    const out = formatDocxText(input);
    expect(out).toBe('one\ntwo\nthree');
  });

  it('joins arrays of strings', () => {
    const input = ['a', 'b', 'c'];
    expect(formatDocxText(input)).toBe('a\nb\nc');
  });

  it('formats objects into key: value lines', () => {
    const input = { fooBar: 'test', nested: ['x','y'] };
    const out = formatDocxText(input);
    expect(out).toContain('foo Bar: test');
    expect(out).toContain('nested: x');
  });

  it('getOnlyName extracts name before comma', () => {
    expect(getOnlyName('Smith, John')).toBe('Smith');
    expect(getOnlyName('Jane Doe')).toBe('Jane Doe');
    expect(getOnlyName('')).toBe('');
  });
});
