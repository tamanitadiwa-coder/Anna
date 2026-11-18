// Renders the black & silver app icons (PNG) from an inline SVG using the pre-installed Chromium. Run: node scripts/icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
<defs><radialGradient id="bg" cx=".5" cy=".28" r=".85"><stop offset="0" stop-color="#2A2B30"/><stop offset=".6" stop-color="#111114"/><stop offset="1" stop-color="#050506"/></radialGradient>
<linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".35" stop-color="#D9DCE1"/><stop offset=".7" stop-color="#9198A1"/><stop offset="1" stop-color="#E6E8EC"/></linearGradient></defs>
<rect width="512" height="512" fill="url(#bg)"/>
<circle cx="256" cy="256" r="158" fill="none" stroke="url(#m)" stroke-width="7" opacity=".9"/>
<circle cx="256" cy="256" r="140" fill="none" stroke="#D9DCE1" stroke-width="1.5" opacity=".25"/>
<text x="256" y="338" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-style="italic" font-weight="700" font-size="236" fill="url(#m)">A</text></svg>`;
const b = await chromium.launch(); const p = await b.newPage();
for (const [f, s] of [['icons/icon-512.png', 512], ['icons/icon-192.png', 192], ['icons/apple-touch-icon.png', 180]]) {
  await p.setViewportSize({ width: s, height: s }); await p.setContent(`<html><body style="margin:0;background:#000">${svg(s)}</body></html>`);
  await p.screenshot({ path: f, clip: { x: 0, y: 0, width: s, height: s } }); console.log('wrote', f);
}
await b.close();
