// Renders the black & silver app icons (PNG) from an inline SVG using the pre-installed Chromium. Run: node scripts/icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
<defs><radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset=".35" stop-color="#75CFFF" stop-opacity=".45"/><stop offset="1" stop-color="#75CFFF" stop-opacity="0"/></radialGradient>
<radialGradient id="orb" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".09" stop-color="#EAF7FF"/><stop offset=".3" stop-color="#A9DFFF"/><stop offset=".56" stop-color="#75CFFF"/><stop offset=".82" stop-color="#2C79B4"/><stop offset="1" stop-color="#0E3150"/></radialGradient></defs>
<rect width="512" height="512" fill="#000"/><circle cx="256" cy="256" r="230" fill="url(#glow)"/><circle cx="256" cy="256" r="132" fill="url(#orb)"/></svg>`;
const b = await chromium.launch(); const p = await b.newPage();
for (const [f, s] of [['icons/icon-512.png', 512], ['icons/icon-192.png', 192], ['icons/apple-touch-icon.png', 180]]) {
  await p.setViewportSize({ width: s, height: s }); await p.setContent(`<html><body style="margin:0;background:#000">${svg(s)}</body></html>`);
  await p.screenshot({ path: f, clip: { x: 0, y: 0, width: s, height: s } }); console.log('wrote', f);
}
await b.close();
