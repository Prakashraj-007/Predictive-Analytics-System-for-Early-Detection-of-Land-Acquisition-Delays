/**
 * LandSentinel Design System Tokens
 * Theme: "INNER PEACE" Palette
 * - Mocha Brown (#5B4632)
 * - Champagne Gold (#F4D9A0)
 * - Burnt Amber (#C8792C)
 * - Canvas: Deep Espresso (#140F0B)
 * - Text: Champagne Gold (#F4D9A0), Warm Ivory (#F3EDE2), Soft Sand (#C4B5A5)
 */

export const THEME_COLORS = {
  canvas: '#140F0B',
  surface: '#1E1611',
  card: '#241B14',
  elevated: '#2E231A',
  borderDefault: 'rgba(244, 217, 160, 0.12)',
  borderGold: 'rgba(244, 217, 160, 0.28)',
  mochaBrown: '#5B4632',
  champagneGold: '#F4D9A0',
  burntAmber: '#C8792C',
  textGold: '#F4D9A0',
  textIvory: '#F3EDE2',
  textSand: '#C4B5A5',
  textTaupe: '#8E7E70',
};

export const RISK_COLORS = {
  low: {
    hex: '#4A855A',
    bg: 'rgba(74, 133, 90, 0.14)',
    border: 'rgba(74, 133, 90, 0.38)',
    text: '#72C485',
    label: 'Low Risk',
  },
  medium: {
    hex: '#C8792C',
    bg: 'rgba(200, 121, 44, 0.14)',
    border: 'rgba(200, 121, 44, 0.38)',
    text: '#F4D9A0',
    label: 'Medium Risk',
  },
  high: {
    hex: '#C94A3D',
    bg: 'rgba(201, 74, 61, 0.16)',
    border: 'rgba(201, 74, 61, 0.42)',
    text: '#F87171',
    label: 'High Risk',
  },
};

export function getRiskBand(score) {
  if (score < 30) return { band: 'Low', ...RISK_COLORS.low };
  if (score <= 60) return { band: 'Medium', ...RISK_COLORS.medium };
  return { band: 'High', ...RISK_COLORS.high };
}

export function getRiskColorByBand(band) {
  const norm = (band || '').toLowerCase();
  if (norm === 'low') return RISK_COLORS.low;
  if (norm === 'medium') return RISK_COLORS.medium;
  return RISK_COLORS.high;
}
