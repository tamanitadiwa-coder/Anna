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
