export function normalizeHexColor(value, fallback = '#0b1f4d') {
  if (typeof value !== 'string') return fallback;
  const clean = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(clean) ? clean.toLowerCase() : fallback;
}

export function hexToRgb(hex) {
  const clean = normalizeHexColor(hex).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function rgbToHex(r, g, b) {
  const toHex = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function mixHex(hex, targetHex, amount) {
  const source = hexToRgb(hex);
  const target = hexToRgb(targetHex);
  const pct = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    source.r + (target.r - source.r) * pct,
    source.g + (target.g - source.g) * pct,
    source.b + (target.b - source.b) * pct
  );
}

export function shiftHexTone(hex, tone = 0) {
  const amount = Math.min(0.72, Math.abs(Number(tone) || 0) / 100);
  return tone >= 0 ? mixHex(hex, '#ffffff', amount) : mixHex(hex, '#05070a', amount);
}

export function getContrastHex(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#071018' : '#ffffff';
}

export function getHexLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value) => {
    const next = value / 255;
    return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
