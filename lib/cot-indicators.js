export const COT_INDICATORS = [
  '1.1.2',
  '1.4.2',
  '1.5.2',
  '2.3.2',
  '2.6.2',
  '3.1.2',
  '4.1.2',
  '4.5.2',
  '5.1.2',
  'experimental'
];

export function mapIndicatorToOrdinal(code) {
  if (!code) return null;
  const str = String(code).trim();
  // If the code contains the word 'experimental', match that explicitly
  if (/experimental/i.test(str)) {
    const idx = COT_INDICATORS.indexOf('experimental');
    return idx >= 0 ? idx + 1 : null;
  }
  // Normalize to digits and dots only (e.g., "5.1.2" or "(Indicator 5.1.2)" -> "5.1.2")
  const normalized = str.replace(/[^0-9.]/g, '').trim();
  if (!normalized) return null;
  const idx = COT_INDICATORS.indexOf(normalized);
  return idx >= 0 ? idx + 1 : null;
}
