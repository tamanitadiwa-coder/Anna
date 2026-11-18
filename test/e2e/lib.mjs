// Shared helpers for the browser tests (Playwright, pre-installed Chromium).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
export const pw = createRequire(import.meta.url)('playwright');
export const RESULTS = new URL('../../test-results/', import.meta.url).pathname; mkdirSync(RESULTS, { recursive: true });
export function reporter(name) {
  const checks = [], t0 = Date.now(), log = [];
  const r = {
    ok(cond, what, detail = '') { checks.push({ ok: !!cond, what, detail: String(detail).slice(0, 400) }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${what}${detail ? '  — ' + String(detail).slice(0, 200) : ''}`); return !!cond; },
    note(s) { log.push(s); console.log('      ' + s); },
    async step(what, fn) { try { const v = await fn(); return v; } catch (e) { r.ok(false, what, e.stack?.split('\n').slice(0, 3).join(' | ') || e); return undefined; } },
    finish(extra = {}) {
      const pass = checks.filter((c) => c.ok).length, out = { name, when: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), passed: pass, total: checks.length, checks, notes: log, ...extra };
      writeFileSync(`${RESULTS}${name}.json`, JSON.stringify(out, null, 1)); console.log(`\n${name}: ${pass}/${checks.length} checks passed (${out.seconds}s)`); return pass === checks.length;
    },
  };
  return r;
}
// Hide JSPI so wllama takes its Safari (compat) path even in Chromium.
export const SAFARI_ENGINE = () => { try { delete WebAssembly.Suspending; delete WebAssembly.promising; } catch {} };
// Waits for Anna to start, then passes the owner lock: creates the test password on a fresh profile, otherwise unlocks.
export const TEST_PW = 'anna-test-pass-1';
export async function ready(page, timeout = 30000) {
  await page.waitForFunction(() => window.__anna, null, { timeout });
  if (await page.evaluate(() => window.__anna.locked)) {
    if (await page.locator('form[data-form="setup"]').count()) { await page.fill('form[data-form="setup"] [name="pw"]', TEST_PW); await page.fill('form[data-form="setup"] [name="pw2"]', TEST_PW); await page.click('form[data-form="setup"] button'); }
    else { await page.fill('form[data-form="unlock"] [name="pw"]', TEST_PW); await page.click('form[data-form="unlock"] button'); }
    await page.waitForFunction(() => !window.__anna.locked, null, { timeout: 30000 });
  }
  return true;
}
