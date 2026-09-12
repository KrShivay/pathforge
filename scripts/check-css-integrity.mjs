import fs from 'node:fs';

const css = fs.readFileSync('src/index.css', 'utf8');
const declarations = new Map();

for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) {
  declarations.set(match[1], match[2]);
}

function references(value) {
  return [...value.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]);
}

function visit(token, trail = []) {
  if (trail.includes(token)) {
    throw new Error(`Cyclic custom property: ${[...trail, token].join(' -> ')}`);
  }
  for (const dependency of references(declarations.get(token) ?? '')) {
    if (declarations.has(dependency)) visit(dependency, [...trail, token]);
  }
}

for (const token of declarations.keys()) visit(token);

function resolveToken(token, trail = []) {
  if (trail.includes(token)) {
    throw new Error(`Cyclic custom property: ${[...trail, token].join(' -> ')}`);
  }

  const value = declarations.get(token);
  if (!value) throw new Error(`Missing required custom property: ${token}`);

  const reference = value.match(/^var\((--[\w-]+)\)$/);
  return reference ? resolveToken(reference[1], [...trail, token]) : value.trim();
}

function rgb(hex) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Expected a six-digit hex color, received: ${hex}`);
  return match.slice(1).map((channel) => Number.parseInt(channel, 16) / 255);
}

function luminance(hex) {
  const channels = rgb(hex).map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

const onBrand = resolveToken('--pf-theme-on-brand');
for (const backgroundToken of ['--pf-theme-brand', '--pf-theme-brand-hover', '--pf-theme-danger']) {
  const ratio = contrast(onBrand, resolveToken(backgroundToken));
  if (ratio < 4.5) {
    throw new Error(`${backgroundToken} has insufficient text contrast: ${ratio.toFixed(2)}:1`);
  }
}

for (const surfaceToken of ['--pf-theme-surface', '--pf-theme-surface-muted', '--pf-theme-surface-hover']) {
  const value = resolveToken(surfaceToken);
  if (luminance(value) < 0.8) {
    throw new Error(`${surfaceToken} is too dark for a data-row surface: ${value}`);
  }
}

const rowTheme = css.match(/\.recent-report-item,\s*\.worklist-row,[\s\S]*?\.table-row\s*\{([^}]+)\}/);
if (!rowTheme?.[1].includes('background: var(--pf-theme-surface) !important')) {
  throw new Error('Data rows must use the canonical light surface.');
}

const buttonTheme = css.match(/\.primary-button,\s*\.top-nav-new-report,[\s\S]*?\.pf-swal-btn--danger\s*\{([^}]+)\}/);
if (!buttonTheme?.[1].includes('color: var(--pf-theme-on-brand) !important')) {
  throw new Error('Filled buttons must use the canonical on-brand foreground.');
}

console.log('CSS theme integrity passed: tokens are acyclic, contrast-safe, and rows stay light.');
