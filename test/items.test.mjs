import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../money.js';

const NOW = new Date(2026, 10, 19, 10, 0).getTime(); // 19 Nov 2026
const MSG = "Right now there's 4100. I need to send my mom 1200 and pay 1500 house deposit. I get paid on the 25th 10500, I owe Ashraf 500, it's my birthday, plus 500 for moving";

test('the exact message: 6 items, a birthday question, R400 left, 6 days, about R66 a day', () => {
  const r = M.parseItems(MSG, NOW);
  assert.equal(r.items.length, 6);
  assert.deepEqual(r.items.map((x) => [x.type, x.name, x.amount]), [
    ['balance', 'Current balance', 410000], ['planned', 'Mom', 120000], ['planned', 'House deposit', 150000],
    ['income', 'Pay', 1050000], ['debt', 'Ashraf (debt)', 50000], ['planned', 'Moving', 50000]]);
  assert.equal(r.items.find((x) => x.type === 'debt').person, 'Ashraf');
  assert.equal(new Date(r.items.find((x) => x.type === 'income').date).getDate(), 25);
  assert.equal(r.ask.length, 1); assert.equal(M.askAside(r.ask[0].name), 'How much do you want to set aside for your birthday?');
  const p = M.cashPlan(r.items, NOW);
  assert.equal(p.left, 40000); assert.equal(p.days, 6); assert.equal(p.daily, 6666); assert.equal(p.income.amount, 1050000); assert.equal(p.minus, false);
  const t = M.cashPlanText(p).join('\n').replace(/[  ]/g, ' ');
  assert.match(t, /Left until payday: R 400,00/); assert.match(t, /6 days until payday → R 66,66 a day/); assert.match(t, /Next income: R 10 500,00 on 25 November/);
});
test('amount formats: R, rand, k, spaces and commas; ordinals are dates', () => {
  const a = (s) => M.parseItems(s, NOW).items.map((x) => x.amount);
  assert.deepEqual(a('I have R2,5k and owe Sipho R300'), [250000, 30000]);
  assert.deepEqual(a('balance 3 200 rand, payday on the 1st R9 000'), [320000, 900000]);
  assert.deepEqual(a('I have R4,100 and need to pay rent R3 500'), [410000, 350000]);
});
test('types by keyword, minus warning, single entries left to the old parser', () => {
  const r = M.parseItems('There is R1000. I spent R200 on food and need to pay R1500 rent', NOW);
  assert.deepEqual(r.items.map((x) => x.type), ['balance', 'expense', 'planned']);
  const p = M.cashPlan(r.items, NOW); assert.equal(p.left, -70000); assert.match(M.cashPlanText(p).join(' '), /in the minus/);
  for (const s of ['spent R200 on food', 'got R500 extra', 'Rent R5000', 'cancelled Netflix']) assert.equal(M.parseItems(s, NOW), null, s);
});
test('wishlist keyword and the simple Money view numbers', () => {
  assert.deepEqual(M.parseItems('I want to buy a new phone for R3000', NOW).items.map((x) => [x.type, x.name, x.amount]), [['wish', 'New phone', 300000]]);
  assert.deepEqual(M.parseItems('thinking of buying sneakers R1 200', NOW).items.map((x) => [x.type, x.name, x.amount]), [['wish', 'Sneakers', 120000]]);
  const pd = new Date(2026, 10, 25, 12).getTime();
  const v = M.moneyToday({ cash: 410000, bills: [{ name: 'Mom', amount_cents: 120000, priority: 2, due_at: pd }, { name: 'Ashraf', amount_cents: 50000, priority: 1, due_at: pd }], payday: { amount: 1050000, date: pd }, wishes: [{ name: 'Phone', price: 300000 }, { name: 'Shoes', price: 100000 }, { name: 'Car', price: 5000000 }] }, NOW);
  assert.deepEqual([v.days, v.left, v.perDay, v.buffer, v.gap], [6, 240000, 40000, 20000, -220000]);
  assert.deepEqual(v.order.rows.map((r) => r.name), ['Ashraf', 'Mom']);
  assert.deepEqual(v.wishes.map((w) => w.status), ['payday', 'now', 'later']);
});
test('v1.3 main Money card: left after all bills, safe now, money coming', () => {
  const pd = new Date(2026, 10, 25, 12).getTime(), dec1 = new Date(2026, 11, 1, 12).getTime(), jan10 = new Date(2027, 0, 10, 12).getTime();
  const bills = [{ name: 'House deposit', amount_cents: 150000, due_at: pd }, { name: 'Ashraf', amount_cents: 50000, due_at: pd }, { name: 'Moving', amount_cents: 50000, due_at: pd }, { name: 'Rent', amount_cents: 600000, due_at: dec1 }];
  const p = M.moneyPlan({ cash: 480000, bills, incomes: [{ name: 'Payday', amount: 1050000, date: pd }, { name: 'Client', amount: 500000, date: jan10 }] }, NOW);
  assert.deepEqual([p.billsTotal, p.coming, p.left, p.short], [850000, 1550000, 1180000, 0]);
  assert.deepEqual(p.periods.map((q) => [q.start, q.end, q.safe, q.days]), [[480000, 230000, 230000, 6], [1280000, 680000, 450000, 46], [1180000, 1180000, 500000, 31]]);
  assert.equal(p.perDayNow, 38333); assert.equal(p.periods.reduce((n, q) => n + q.safe, 0), p.left);
  // a big bill after payday that payday can't cover is reserved from money now
  const t = M.moneyPlan({ cash: 300000, bills: [{ name: 'Car', amount_cents: 1200000, due_at: dec1 }], incomes: [{ name: 'Payday', amount: 1000000, date: pd }] }, NOW);
  assert.deepEqual([t.safeNow, t.periods[1].safe, t.left], [100000, 0, 100000]);
  const s = M.moneyPlan({ cash: 100000, bills: [{ name: 'Rent', amount_cents: 300000, due_at: pd }] }, NOW); assert.deepEqual([s.left, s.short, s.safeNow], [-200000, 200000, 0]);
  assert.equal(M.moneyPlan({ cash: null, bills }, NOW).left, null);
});
test('money coming from chat, with dates next year', () => {
  const x = M.classifyItem('R5000 coming on 10 January from a client', NOW); assert.deepEqual([x.type, x.incoming, x.name, x.amount, new Date(x.date).getFullYear(), new Date(x.date).getMonth()], ['income', true, 'Client', 500000, 2027, 0]);
  assert.deepEqual(['Sipho owes me R500 on the 30th', 'refund R450 on the 28th'].map((t) => [M.classifyItem(t, NOW).type, M.classifyItem(t, NOW).name]), [['income', 'From Sipho'], ['income', 'Refund']]);
  assert.equal(M.classifyItem('I get paid on the 25th R10500', NOW).incoming, undefined);
  assert.equal(new Date(M.classifyItem('send mom R1200 on the 25th of December', NOW).date).getMonth(), 11);
});
