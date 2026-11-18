import test from 'node:test'; import assert from 'node:assert/strict';
import * as M from '../money.js';
const R = (r) => Math.round(r * 100);
test('chat entries parsed (amount from text only)', () => {
  const p = (t) => M.parseEntry(t);
  assert.deepEqual(p('got R500 extra'), { type: 'income', amount: R(500), label: 'Extra income' });
  assert.deepEqual(p('Apple Music R60 this month'), { type: 'billNew', name: 'Apple Music', amount: R(60), thisMonthOnly: true });
  assert.deepEqual(p('Netflix R199 per month'), { type: 'billNew', name: 'Netflix', amount: R(199), thisMonthOnly: false });
  assert.deepEqual(p('rent is now R5,500'), { type: 'billSet', name: 'Rent', amount: R(5500) });
  assert.deepEqual(p('spent R200 on food'), { type: 'expense', amount: R(200), category: 'Food' });
  assert.deepEqual(p('cancelled Netflix'), { type: 'billCancel', name: 'Netflix' });
  assert.deepEqual(p('paid rent'), { type: 'billPaid', name: 'Rent', amount: null });
  assert.deepEqual(p('saved R1 000'), { type: 'saved', amount: R(1000) });
  assert.deepEqual(p('school fees R3000 next month'), { type: 'nextMonth', name: 'School fees', amount: R(3000) });
  for (const t of ['hello', 'what time is it', 'got some extra', 'none']) assert.equal(p(t), null, t);
  assert.ok(M.isNone('none') && M.isNone("that's it") && !M.isNone('paid rent')); });
const plan = () => M.DEFAULT_LINES().map((l) => ({ ...l, cents: { income: R(15000), rent: R(5000), electricity: R(800), food: R(2000), transport: R(1000), savings: R(1000) }[l.id] || 0 }));
test('warnings: minus (by how much) with real-number options, savings, category over plan, low daily allowance', () => {
  const ok = M.monthState({ lines: plan(), spent: { Food: R(1500) } }, { daysLeft: 10 }); assert.equal(ok.remaining, R(5200)); assert.equal(ok.warnings.length, 0);
  const over = M.monthState({ lines: plan(), spent: { Food: R(2600), Clothes: R(5000) } }, { daysLeft: 10 });
  assert.equal(over.remaining, R(5200 - 600 - 5000)); assert.match(over.warnings.find((w) => w.kind === 'minus').text, /R 400,00 in the minus/);
  assert.ok(over.warnings.find((w) => w.kind === 'minus').options.some((o) => /use R 400,00 of your R 1 000,00 savings/.test(o)));
  assert.match(over.warnings.find((w) => w.kind === 'savings').text, /eat R 400,00 of your planned R 1 000,00 savings/);
  assert.match(over.warnings.find((w) => w.kind === 'category').text, /Food & groceries is R 600,00 over its R 2 000,00 plan/);
  const low = M.monthState({ lines: plan(), spent: { Clothes: R(4900) } }, { daysLeft: 10 }); assert.equal(low.dailyLeft, R(30)); assert.match(low.warnings.find((w) => w.kind === 'daily').text, /Only R 30,00 a day is left for the next 10 days \(your plan was R 173,33 a day\)/); });
test('what to pay first: priority, then due date, running total, where money runs out', () => {
  const bills = [{ name: 'Gym', amount_cents: R(400), priority: 3, due_at: 1 }, { name: 'Rent', amount_cents: R(5000), priority: 1, due_at: 5 }, { name: 'Electricity', amount_cents: R(800), priority: 1, due_at: 2 }, { name: 'Netflix', amount_cents: R(199), priority: 2, due_at: 3 }, { name: 'Paid', amount_cents: R(10), priority: 1, paid: 1 }];
  const o = M.payOrder(bills, R(6000)); assert.deepEqual(o.rows.map((r) => r.name), ['Electricity', 'Rent', 'Netflix', 'Gym']); assert.deepEqual(o.rows.map((r) => r.running), [R(800), R(5800), R(5999), R(6399)]);
  assert.equal(o.runsOutAt, 3); assert.equal(o.short, R(399)); assert.equal(M.payOrder(bills, null).runsOutAt, -1); });
test('Books Day: due from the 25th until closed/skipped, at most once a day', () => {
  const d24 = new Date(2026, 10, 24, 9).getTime(), d25 = new Date(2026, 10, 25, 9).getTime(), d27 = new Date(2026, 10, 27, 9).getTime();
  assert.equal(M.booksDue(d24, {}), false); assert.equal(M.booksDue(d25, {}), true); assert.equal(M.booksDue(d25, { lastAsked: new Date(d25).toDateString() }), false, 'once a day');
  assert.equal(M.booksDue(d27, { lastAsked: new Date(d25).toDateString() }), true); assert.equal(M.booksDue(d27, { closed: ['2026-11'] }), false); assert.equal(M.booksDue(d27, { skipped: ['2026-11'] }), false); assert.equal(M.booksDue(d27, { snoozeUntil: d27 + 1 }), false);
  assert.equal(M.BOOKS_QUESTIONS.length, 6); });
test('Books Day summary vs last month and carry-forward', () => {
  assert.deepEqual(M.booksSummary({ income: R(15500), expenses: R(9000), saved: R(1000), remaining: R(5500) }, { income: R(15000), expenses: R(9500), saved: R(500), remaining: R(4000) }), ['Income: R 15 500,00 (+R 500,00 vs last month)', 'Expenses: R 9 000,00 (−R 500,00 vs last month)', 'Saved: R 1 000,00 (+R 500,00 vs last month)', 'Left over: R 5 500,00 (+R 1 500,00 vs last month)']);
  const lines = [...plan().map((l) => (l.id === 'extra' ? { ...l, cents: R(500) } : l)), { id: 'c-am', name: 'Apple Music', kind: 'bill', cents: R(60), oneMonth: true }, { id: 'c-nf', name: 'Netflix', kind: 'bill', cents: R(199) }];
  const next = M.carryForward(lines, [{ name: 'School fees', amount: R(3000) }]);
  assert.ok(next.some((l) => l.name === 'Netflix' && l.cents === R(199)) && !next.some((l) => l.name === 'Apple Music'), 'recurring kept, this-month-only dropped');
  assert.equal(next.find((l) => l.id === 'extra').cents, 0); assert.equal(next.find((l) => l.id === 'rent').cents, R(5000)); assert.ok(next.some((l) => l.name === 'School fees' && l.kind === 'once' && l.cents === R(3000))); });
test('staff: optional 2× for Sundays and public holidays', () => {
  const now = new Date(2026, 11, 16, 12).getTime(); // week of Mon 14 Dec 2026; 16 Dec is Day of Reconciliation
  const shifts = ['2026-12-14', '2026-12-15', '2026-12-16', '2026-12-20'].map((d) => ({ staff: 'a', date: d, start: '08:00', end: '16:00' }));
  const special = (iso) => new Date(iso + 'T12:00:00').getDay() === 0 || iso === '2026-12-16';
  const [on] = M.timesheet([{ id: 'a', name: 'T', rate_cents: R(40), double_special: true }], shifts, now, { isSpecialDay: special });
  assert.equal(on.hours, 32); assert.equal(on.special, 16); assert.equal(on.pay, R(16 * 40 + 16 * 40 * 2)); assert.ok(on.steps.some((s) => /Sundays & public holidays: 16 h × R 40,00 × 2 = R 1 280,00/.test(s)));
  const [off] = M.timesheet([{ id: 'a', name: 'T', rate_cents: R(40) }], shifts, now, { isSpecialDay: special }); assert.equal(off.pay, R(32 * 40), 'off by default'); });
