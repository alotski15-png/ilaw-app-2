import {
  COT_PRIORITY_INDICATOR_CODES,
  getCotIndicatorByCode,
  normalizeCotIndicatorCode,
} from './cot-rubric';

// Keep the nine priority indicators used by the current PMES lesson-plan mode.
// The full Annex E-1 mapping is available through COT_FULL_RUBRIC.
export const COT_INDICATORS = [...COT_PRIORITY_INDICATOR_CODES, 'experimental'];

export function mapIndicatorToOrdinal(code) {
  if (!code) return null;
  const str = String(code).trim();
  // If the code contains the word 'experimental', match that explicitly
  if (/experimental/i.test(str)) {
    const idx = COT_INDICATORS.indexOf('experimental');
    return idx >= 0 ? idx + 1 : null;
  }
  // Map PPST codes to the ordinal used by the complete 21-indicator Annex E-1
  // rubric, not to their position in the nine-indicator priority subset.
  const normalized = normalizeCotIndicatorCode(str);
  if (!normalized) return null;
  return getCotIndicatorByCode(normalized)?.ordinal || null;
}

export {
  COT_FULL_RUBRIC,
  COT_PRIORITY_INDICATOR_CODES,
  COT_RUBRIC_LEVELS,
  getCotIndicatorByCode,
  resolveCotCareerStage,
} from './cot-rubric';
