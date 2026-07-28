function normalizeText(text) {
  return String(text || '').replace(/\r/g, '\n').trim();
}

function toTitleCaseTerm(match) {
  const normalized = String(match || '').trim().toLowerCase();
  if (normalized.startsWith('term')) {
    const num = normalized.match(/\d+/);
    return num ? `Term ${num[0]}` : 'Term 1';
  }

  const wordMap = {
    first: 'First',
    second: 'Second',
    third: 'Third',
    fourth: 'Fourth',
    fifth: 'Fifth',
    sixth: 'Sixth',
    seventh: 'Seventh',
    eighth: 'Eighth',
    ninth: 'Ninth',
    tenth: 'Tenth',
  };

  const key = normalized.replace(/\s+/g, ' ').trim();
  const termWord = key.split(' ')[0];
  return wordMap[termWord] ? `${wordMap[termWord]} Term` : 'Term 1';
}

export function extractBowMetadataFromText(text) {
  const normalized = normalizeText(text);
  const termMatches = [];
  const weekMatches = [];

  const termLineRegex = /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|term)\s*(?:term)?\s*(\d+)?\b/gi;
  const weekLineRegex = /\bweeks?\s*(\d+)(?:\s*(?:to|-|–)\s*(\d+))?\b/gi;

  const lines = normalized.split(/\n+/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const termTerms = trimmed.matchAll(termLineRegex);
    for (const match of termTerms) {
      const raw = match[0];
      if (/\bterm\b/i.test(raw) || /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/i.test(raw)) {
        const value = toTitleCaseTerm(raw);
        if (!termMatches.includes(value)) termMatches.push(value);
      }
    }

    const weekTerms = trimmed.matchAll(weekLineRegex);
    for (const match of weekTerms) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : start;
      if (Number.isNaN(start) || Number.isNaN(end)) continue;

      const rangeStart = Math.min(start, end);
      const rangeEnd = Math.max(start, end);
      for (let weekNum = rangeStart; weekNum <= rangeEnd; weekNum += 1) {
        const value = `Week ${weekNum}`;
        if (!weekMatches.includes(value)) weekMatches.push(value);
      }
    }
  });

  const terms = termMatches.length > 0 ? termMatches : ['Term 1'];
  const weeks = weekMatches.length > 0 ? weekMatches : ['Week 1'];

  return { terms, weeks };
}
