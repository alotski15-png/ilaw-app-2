// lib/lesson-utils.js
// Pure helper functions. No JSX, no React state.

export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function parseNameAndDesignation(rawInput, defaultName, defaultDesignation) {
  const input = rawInput || defaultName || '';
  if (input.includes(',')) {
    const parts = input.split(',');
    const name = parts[0].trim();
    const designation = parts.slice(1).join(',').trim();
    return { name, designation };
  }
  return { name: input.trim(), designation: defaultDesignation || '' };
}

export function getOnlyName(rawInput) {
  if (!rawInput) return '';
  const parsed = parseNameAndDesignation(rawInput);
  return parsed.name;
}

export function hasMissingDesignation(input) {
  if (!input || !input.trim()) return false;
  const parts = input.split(',');
  return parts.length < 2 || !parts[1].trim();
}

export function formatDocxText(content) {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') {
    let trimmed = content.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.join('\n');
      } catch (e) {}
    }
    return trimmed
      .replace(/###\s*/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^[\s-]*\*\*/gm, '')
      .replace(/^- /gm, '');
  }
  if (Array.isArray(content)) {
    return content.map(item => typeof item === 'object' ? formatDocxText(item) : String(item).replace(/^•\s*/, '')).join('\n');
  }
  if (typeof content === 'object') {
    return Object.entries(content)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1')}: ${formatDocxText(v)}`)
      .join('\n');
  }
  return String(content);
}

export const DEFAULT_GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (gemini-2.5-flash)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (gemini-2.5-pro)' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (gemini-2.0-flash)' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (gemini-1.5-flash)' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (gemini-1.5-pro)' },
];
