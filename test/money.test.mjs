import test from 'node:test'; import assert from 'node:assert/strict';
import * as M from '../money.js';
const R = (r) => Math.round(r * 100); // rand → cents
const lines = (o) => M.DEFAULT_LINES().map((l) => ({ ...l, cents: o[l.id] != null ? R(o[l.id]) : 0 })).concat(o.custom ? o.custom.map(([n, v]) => ({ id: n, name: n, kind: 'bill', cents: R(v) })) : []);
test('spec test case: R15,000 − rent 5,000, food 2,000, transport 1,000, electricity 800, other 700 = R5,500', () => {
  const t = M.monthly(lines({ income: 15000, rent: 5000, food: 2000, transport: 1000, electricity: 800, custom: [['Other', 700]] }));
  assert.equal(t.remaining, R(5500)); assert.equal(M.money(t.remaining), 'R 5 500,00'); assert.equal(t.income, R(15000)); assert.equal(t.expenses, R(9500)); assert.equal(t.bills, R(6500)); assert.equal(t.savings, 0);
  assert.equal(t.spentPct, 63.3); assert.equal(t.status, 'surplus'); assert.equal(t.daily, R(183.33)); assert.equal(t.weekly, R(1283.33)); assert.match(t.assumptions[0], /30 days/); });
test('all outputs incl. extra income, once-off, savings, shortfall, other month lengths', () => {
  const t = M.monthly(lines({ income: 10000, extra: 1500, rent: 6000, water: 300, subs: 250.5, debt: 2000, food: 3000, once: 1200, savings: 500 }), { days: 31 });
  assert.equal(t.income, R(11500)); assert.equal(t.bills, R(8550.5)); assert.equal(t.expenses, R(12750.5)); assert.equal(t.savings, R(500)); assert.equal(t.remaining, R(-1750.5)); assert.equal(t.status, 'shortfall');
  assert.equal(t.daily, R(-56.47)); assert.match(t.assumptions[0], /31 days/); assert.equal(M.monthly([]).spentPct, null, 'no income → no made-up percentage'); });
test('custom bills: add, rename, remove change the totals exactly', () => {
  let l = lines({ income: 5000 }); l.push({ id: 'gym', name: 'Gym', kind: 'bill', cents: R(399.99) }); assert.equal(M.monthly(l).bills, R(399.99));
  l = l.map((x) => (x.id === 'gym' ? { ...x, name: 'Virgin Active' } : x)); assert.equal(M.monthly(l).bills, R(399.99)); l = l.filter((x) => x.id !== 'gym'); assert.equal(M.monthly(l).bills, 0); });
test('compare months', () => { const c = M.compareMonths([{ month: '2026-11', totals: { remaining: R(5500) } }, { month: '2026-10', totals: { remaining: R(4000) } }]); assert.deepEqual(c.map((m) => [m.month, m.change]), [['2026-10', null], ['2026-11', R(1500)]]); });
test('currency switching relabels, never converts', () => {
  assert.equal(M.money(123456, 'ZAR'), 'R 1 234,56'); assert.equal(M.money(123456, 'USD'), '$1,234.56'); assert.equal(M.money(123456, 'EUR'), '€1,234.56'); assert.equal(M.money(-5000, 'BWP'), '-P50.00'); assert.equal(M.money(100, 'KES'), 'KSh 1.00');
  M.setCurrency('GBP'); assert.equal(M.vat(R(100)).steps[0], 'VAT = 15% × £100.00 = £15.00'); assert.equal(M.setCurrency('XXX'), 'ZAR', 'unknown codes fall back to rand'); });
test('exact amounts parsing', () => { assert.equal(M.toCents('R 1 234,56'), 123456); assert.equal(M.toCents('1,234.56'), 123456); assert.equal(M.toCents('15 000'), 1500000); assert.equal(M.toCents('0.1'), 10); assert.equal(M.toCents('abc'), null); });
test('exact calculator: decimals, precedence, brackets, percent, powers', () => {
  const e = (s) => M.evaluate(s).toFixed(); assert.equal(e('0.1 + 0.2'), '0.3'); assert.equal(e('2 + 3 × 4'), '14'); assert.equal(e('(2 + 3) * 4'), '20'); assert.equal(e('15% * 2000'), '300'); assert.equal(e('2000 + 15%'), '2300'); assert.equal(e('2000 - 10%'), '1800');
  assert.equal(e('2^10'), '1024'); assert.equal(e('R1,000 / 3').slice(0, 10), '333.333333'); assert.equal(e('1 000 000 * 1.15'), '1150000'); assert.equal(e('-5 + 2'), '-3');
  assert.throws(() => M.evaluate('1/0'), /zero/); assert.throws(() => M.evaluate('2 + abc'), /only calculate/); assert.throws(() => M.evaluate('(1+2'), /bracket/); });
test('VAT 15%: add and remove, with working', () => {
  const a = M.vat(R(1000)); assert.deepEqual([a.vat, a.incl], [R(150), R(1150)]); M.setCurrency('ZAR'); assert.equal(M.vat(R(1000)).steps[1], 'Price incl. VAT = R 1 000,00 + R 150,00 = R 1 150,00');
  const r = M.vat(R(1150), 'remove'); assert.deepEqual([r.excl, r.vat], [R(1000), R(150)]); const odd = M.vat(R(99.99), 'remove'); assert.equal(odd.excl + odd.vat, R(99.99), 'parts always add back up'); });
test('hours, wages and overtime (BCEA 45 h, 1.5×)', () => {
  assert.equal(M.shiftHours('08:00', '17:00', 60), 8); assert.equal(M.shiftHours('22:00', '06:30', 30), 8); assert.equal(M.shiftHours('09:15', '13:45'), 4.5); assert.throws(() => M.shiftHours('25:00', '10:00'), /not a time/);
  const w = M.wages(50, R(30)); assert.deepEqual([w.ordinary, w.overtime, w.ordPay, w.otPay, w.total], [45, 5, R(1350), R(225), R(1575)]); assert.match(w.steps[1], /Overtime: 5 h × R 30,00 × 1\.5 = R 225,00/);
  const n = M.wages(40, R(30)); assert.equal(n.overtime, 0); assert.equal(n.total, R(1200)); assert.equal(M.wages(46, R(25), { threshold: 40, multiplier: 2 }).total, R(1000 + 300)); });
test('margins, profit & loss, projections', () => {
  const m = M.margin(R(60), R(100)); assert.deepEqual([m.profit, m.marginPct, m.markupPct], [R(40), 40, 66.7]);
  const p = M.profitLoss({ revenue: R(50000), cogs: R(20000), expenses: R(35000) }); assert.deepEqual([p.gross, p.net, p.result, p.netMarginPct], [R(30000), R(-5000), 'loss', -10]);
  const j = M.projection({ start: R(1000), monthly: R(500), growthPct: 1, months: 12 }); assert.equal(j.paidIn, R(7000)); assert.equal(j.end, 746808); // checked independently: Python Decimal gives 746807.65… cents
  assert.equal(M.percentOf(15, 2000).result.toFixed(), '300'); assert.equal(M.percentChange(80, 100).result.toFixed(), '25'); });
test('Can I afford it? BUY / REDUCE COST / WAIT / AVOID and missing info, never invented', () => {
  const budget = M.monthly(lines({ income: 15000, rent: 5000, food: 2000, transport: 1000, electricity: 800, savings: 1000, custom: [['Other', 700]] })); // remaining 4,500
  assert.equal(M.afford(R(2000), { budget }).verdict, 'BUY');
  const rc = M.afford(R(3500), { budget }); assert.equal(rc.verdict, 'REDUCE COST'); assert.match(rc.reasons.join(' '), /Spending up to R 3 000,00 keeps your buffer/);
  assert.equal(M.afford(R(6000), { budget }).verdict, 'WAIT'); assert.equal(M.afford(R(20000), { budget }).verdict, 'AVOID');
  assert.match(M.afford(R(2000), { budget }).reasons.join(' '), /savings of R 1 000,00 are left untouched/);
  const none = M.afford(R(2000), { recorded: { income: 0, expenses: 0 } }); assert.equal(none.verdict, null); assert.ok(none.missing.some((m) => /income/.test(m)) && none.missing.some((m) => /budget/.test(m)));
  const rec = M.afford(R(2000), { recorded: { income: R(12000), expenses: R(7000) }, unpaidBills: [{ name: 'Rent', amount_cents: R(4000) }] }); assert.equal(rec.available, R(1000)); assert.equal(rec.verdict, 'AVOID'); assert.ok(rec.missing.some((m) => /budget/.test(m)));
  assert.deepEqual(M.afford(0, { budget }).missing, ['the price']); });
test('staff timesheet uses only entered shifts and rates', () => {
  const now = new Date(2026, 10, 18, 12).getTime(); const people = [{ id: 'a', name: 'Thandi', rate_cents: R(40) }, { id: 'b', name: 'Sipho' }];
  const shifts = [...['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'].map((d) => ({ staff: 'a', date: d, start: '07:00', end: '17:00', break_min: 30 })), { staff: 'a', date: '2026-11-21', start: '08:00', end: '12:00' }, { staff: 'a', date: '2026-11-09', start: '08:00', end: '17:00' }, { staff: 'b', date: '2026-11-18', start: '09:00', end: '13:00' }];
  const [t, s] = M.timesheet(people, shifts, now); assert.equal(t.hours, 51.5); assert.equal(t.overtime, 6.5); assert.equal(t.pay, R(45 * 40 + 6.5 * 40 * 1.5)); assert.equal(t.shifts, 6);
  assert.equal(s.hours, 4); assert.equal(s.pay, null, 'no rate → no invented wage'); assert.deepEqual(s.missing, ['hourly rate']); });
