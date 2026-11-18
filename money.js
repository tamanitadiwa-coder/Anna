// ANNA money & business maths. Exact decimal arithmetic (big.js); money is handled in whole cents.
// Nothing here guesses: every function works only from figures it is given and says what is missing.
import Big from './lib/big.mjs';
Big.DP = 20; Big.RM = Big.roundHalfUp;
const B = (x) => new Big(x ?? 0);
const cents = (b) => Number(B(b).round(0, Big.roundHalfUp)); // Big → integer cents
const pct = (b, dp = 1) => Number(B(b).round(dp));

// ---- currencies (display only; there are no live exchange rates offline, so switching never converts amounts) ----
export const CURRENCIES = [['ZAR', 'R', 'South African rand'], ['USD', '$', 'US dollar'], ['EUR', '€', 'Euro'], ['GBP', '£', 'British pound'], ['BWP', 'P', 'Botswana pula'], ['NAD', 'N$', 'Namibian dollar'], ['ZWG', 'ZiG', 'Zimbabwe gold'], ['ZMW', 'K', 'Zambian kwacha'], ['MZN', 'MT', 'Mozambican metical'], ['NGN', '₦', 'Nigerian naira'], ['KES', 'KSh', 'Kenyan shilling'], ['AUD', 'A$', 'Australian dollar'], ['CAD', 'C$', 'Canadian dollar'], ['AED', 'AED', 'UAE dirham'], ['INR', '₹', 'Indian rupee'], ['CNY', '¥', 'Chinese yuan']];
export const symbolOf = (code) => (CURRENCIES.find((c) => c[0] === code) || CURRENCIES[0])[1];
let CUR = 'ZAR'; export const setCurrency = (code) => { CUR = CURRENCIES.some((c) => c[0] === code) ? code : 'ZAR'; return CUR; };
export const currentCurrency = () => CUR;
export function money(c, code = CUR) {
  const n = (Math.abs(c) / 100).toLocaleString(code === 'ZAR' ? 'en-ZA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ');
  const sym = symbolOf(code); return (c < 0 ? '-' : '') + sym + (code === 'ZAR' || sym.length > 1 ? ' ' : '') + n;
}
// "R 1 234,56", "1,234.56", "12,5" → cents (exact, via big.js). null if not a number.
export function toCents(s) {
  let t = String(s ?? '').trim().replace(/^[^\d.,-]+/, '').replace(/[\s  ']/g, ''); if (!t) return null;
  const neg = t.startsWith('-'); if (neg) t = t.slice(1);
  const dot = t.lastIndexOf('.'), com = t.lastIndexOf(',');
  if (dot >= 0 && com >= 0) t = dot > com ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.');
  else if (com >= 0) t = /,\d{3}$/.test(t) && !t.includes('.') ? t.replace(/,/g, '') : t.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return (neg ? -1 : 1) * cents(B(t).times(100));
}

// ---- monthly calculator ----
// kinds: income (salary + extra income), bill (fixed monthly bills incl. custom ones), living (food, transport…), once (once-off), savings
export const DEFAULT_LINES = () => [['income', 'Monthly income', 'income'], ['extra', 'Extra income', 'income'], ['rent', 'Rent / bond', 'bill'], ['electricity', 'Electricity', 'bill'], ['water', 'Water', 'bill'],
  ['food', 'Food & groceries', 'living'], ['transport', 'Transport', 'living'], ['subs', 'Subscriptions', 'bill'], ['debt', 'Debt repayments', 'bill'], ['once', 'Once-off costs', 'once'], ['savings', 'Savings', 'savings']]
  .map(([id, name, kind]) => ({ id, name, kind, cents: 0 }));
export const KINDS = [['bill', 'Bill'], ['living', 'Living cost'], ['once', 'Once-off'], ['income', 'Income'], ['savings', 'Savings']];
export function monthly(lines, { days = 30 } = {}) {
  const sum = (k) => lines.filter((l) => k.includes(l.kind)).reduce((n, l) => n + (Number(l.cents) || 0), 0);
  const income = sum(['income']), bills = sum(['bill']), living = sum(['living']), once = sum(['once']), savings = sum(['savings']);
  const expenses = bills + living + once, remaining = income - expenses - savings;
  return { income, bills, living, once, expenses, savings, remaining, status: remaining > 0 ? 'surplus' : remaining < 0 ? 'shortfall' : 'balanced',
    spentPct: income ? pct(B(expenses).times(100).div(income)) : null, savedPct: income ? pct(B(savings).times(100).div(income)) : null,
    daily: cents(B(remaining).div(days)), weekly: cents(B(remaining).times(7).div(days)), days,
    assumptions: [`A month is counted as ${days} days, a week as 7 days: daily = remaining ÷ ${days}, weekly = remaining × 7 ÷ ${days}.`, 'Expenses = bills + living costs + once-off costs. Savings are set aside before “remaining”.', 'Amounts are not converted when you change currency.'] };
}
export function compareMonths(months) { // months: [{month:'2026-10', totals}], oldest → newest
  const s = [...months].sort((a, b) => a.month.localeCompare(b.month));
  return s.map((m, i) => ({ month: m.month, currency: m.currency, ...m.totals, change: i ? m.totals.remaining - s[i - 1].totals.remaining : null }));
}

// ---- exact expression calculator (+ − × ÷ ^ ( ) and %) ----
export function evaluate(expr) {
  const src = String(expr).replace(/[×x]/gi, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\bR\s?/g, '').replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/(\d)\s+(?=\d{3}\b)/g, '$1').replace(/,/g, '.');
  const toks = src.match(/\d+(?:\.\d+)?|[-+*/^()%]/g); if (!toks || toks.join('') !== src.replace(/\s+/g, '')) throw new Error('I can only calculate with numbers and + − × ÷ ^ ( ) %.');
  let i = 0; const peek = () => toks[i], take = () => toks[i++];
  const pctOf = (x) => x.isPct ? x.v.div(100) : x.v;
  function primary() { const t = take(); let v;
    if (t === '(') { v = pctOf(expr2()); if (take() !== ')') throw new Error('Missing a closing bracket.'); } else if (t === '-') { const p = primary(); return { v: p.v.neg(), isPct: p.isPct }; } else if (t === '+') return primary(); else if (/^\d/.test(t || '')) v = B(t); else throw new Error('That calculation is incomplete.');
    if (peek() === '%') { take(); return { v, isPct: true }; } return { v, isPct: false }; }
  function power() { const b = primary(); if (peek() === '^') { take(); const e = power(); const n = Number(pctOf(e)); if (!Number.isInteger(n) || Math.abs(n) > 100) throw new Error('Powers must be whole numbers.'); return { v: n < 0 ? B(1).div(pctOf(b).pow(-n)) : pctOf(b).pow(n), isPct: false }; } return b; }
  function term() { let a = power(); while (peek() === '*' || peek() === '/') { const op = take(), b = power(); if (op === '/' && pctOf(b).eq(0)) throw new Error('Cannot divide by zero.'); a = { v: op === '*' ? pctOf(a).times(pctOf(b)) : pctOf(a).div(pctOf(b)), isPct: false }; } return a; }
  function expr2() { let a = term(); while (peek() === '+' || peek() === '-') { const op = take(), b = term(); const bv = b.isPct ? pctOf(a).times(b.v).div(100) : b.v; a = { v: op === '+' ? pctOf(a).plus(bv) : pctOf(a).minus(bv), isPct: false }; } return a; }
  const r = expr2(); if (i < toks.length) throw new Error('That calculation has something extra in it.');
  return pctOf(r);
}
export const fmtNum = (b, dp = 2) => { const x = B(b); const s = x.round(dp).toFixed(); return Number(s).toLocaleString('en-ZA', { maximumFractionDigits: dp }).replace(/[  ]/g, ' '); };

// ---- business calculators (each returns { result, steps[] } in cents unless stated) ----
export const VAT_RATE = 15;
export function vat(amountCents, mode = 'add', rate = VAT_RATE) {
  const r = B(rate).div(100), a = B(amountCents);
  if (mode === 'add') { const v = cents(a.times(r)), incl = amountCents + v; return { excl: amountCents, vat: v, incl, steps: [`VAT = ${rate}% × ${money(amountCents)} = ${money(v)}`, `Price incl. VAT = ${money(amountCents)} + ${money(v)} = ${money(incl)}`] }; }
  const excl = cents(a.div(B(1).plus(r))), v = amountCents - excl; return { excl, vat: v, incl: amountCents, steps: [`Price excl. VAT = ${money(amountCents)} ÷ ${B(1).plus(r).toFixed()} = ${money(excl)}`, `VAT = ${money(amountCents)} − ${money(excl)} = ${money(v)}`] };
}
// hours between "08:00" and "17:30" minus a break; overnight shifts (end before start) roll past midnight
export function shiftHours(start, end, breakMin = 0) {
  const toM = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); if (!m || +m[1] > 23 || +m[2] > 59) throw new Error(`“${t}” is not a time like 08:00.`); return +m[1] * 60 + +m[2]; };
  let mins = toM(end) - toM(start); if (mins <= 0) mins += 1440; mins -= Number(breakMin) || 0; if (mins < 0) throw new Error('The break is longer than the shift.');
  return Number(B(mins).div(60).round(2));
}
// SA Basic Conditions of Employment Act defaults: 45 ordinary hours a week, overtime at 1.5× (both adjustable).
export function wages(hours, rateCents, { threshold = 45, multiplier = 1.5 } = {}) {
  const h = B(hours), ord = h.gt(threshold) ? B(threshold) : h, ot = h.minus(ord), m = B(multiplier);
  const ordPay = cents(ord.times(rateCents)), otPay = cents(ot.times(rateCents).times(m)), total = ordPay + otPay;
  const steps = [`Ordinary: ${fmtNum(ord)} h × ${money(rateCents)} = ${money(ordPay)}`];
  if (ot.gt(0)) steps.push(`Overtime: ${fmtNum(ot)} h × ${money(rateCents)} × ${m.toFixed()} = ${money(otPay)}`);
  steps.push(`Total = ${money(total)}`);
  return { hours: Number(h), ordinary: Number(ord), overtime: Number(ot), ordPay, otPay, total, steps };
}
export function margin(costCents, priceCents) {
  const profit = priceCents - costCents, m = priceCents ? pct(B(profit).times(100).div(priceCents)) : null, mk = costCents ? pct(B(profit).times(100).div(costCents)) : null;
  return { profit, marginPct: m, markupPct: mk, steps: [`Profit = ${money(priceCents)} − ${money(costCents)} = ${money(profit)}`, ...(m !== null ? [`Margin = profit ÷ price = ${m}%`] : []), ...(mk !== null ? [`Mark-up = profit ÷ cost = ${mk}%`] : [])] };
}
export function profitLoss({ revenue = 0, cogs = 0, expenses = 0 }) {
  const gross = revenue - cogs, net = gross - expenses, nm = revenue ? pct(B(net).times(100).div(revenue)) : null;
  return { gross, net, netMarginPct: nm, result: net >= 0 ? 'profit' : 'loss', steps: [`Gross profit = ${money(revenue)} − ${money(cogs)} = ${money(gross)}`, `Net = ${money(gross)} − ${money(expenses)} = ${money(net)} (${net >= 0 ? 'profit' : 'loss'})`, ...(nm !== null ? [`Net margin = ${nm}% of revenue`] : [])] };
}
// start amount, monthly contribution and monthly growth % for n months (exact, compounded monthly)
export function projection({ start = 0, monthly = 0, growthPct = 0, months = 12 }) {
  let v = B(start); const g = B(growthPct).div(100); for (let i = 0; i < months; i++) v = v.times(B(1).plus(g)).plus(monthly);
  const end = cents(v), paidIn = start + monthly * months;
  return { end, paidIn, growth: end - paidIn, steps: [`Each month: balance × (1 + ${B(growthPct).toFixed()}%) + ${money(monthly)}`, `After ${months} months: ${money(end)} (you put in ${money(paidIn)}, growth ${money(end - paidIn)})`] };
}
export const percentOf = (p, x) => ({ result: B(p).div(100).times(x), steps: [`${fmtNum(p)}% of ${fmtNum(x)} = ${fmtNum(p)} ÷ 100 × ${fmtNum(x)} = ${fmtNum(B(p).div(100).times(x))}`] });
export const percentChange = (a, b) => { if (B(a).eq(0)) throw new Error('Cannot work out a change from zero.'); const r = B(b).minus(a).div(a).times(100); return { result: r, steps: [`(${fmtNum(b)} − ${fmtNum(a)}) ÷ ${fmtNum(a)} × 100 = ${fmtNum(r)}%`] }; };

// ---- "Can I afford it?" ----
// data: { amount (cents), budget: monthly() totals for this month or null, recorded: {income, expenses} for this month,
//         unpaidBills: [{name, amount_cents, due_at}] due before month end, savings: planned savings (cents) }
export function afford(amount, data, now = Date.now()) {
  const missing = []; if (!(amount > 0)) return { verdict: null, reasons: [], missing: ['the price'] };
  const b = data.budget, rec = data.recorded || { income: 0, expenses: 0 };
  let available = null, basis = '';
  const unpaid = (data.unpaidBills || []).reduce((n, x) => n + x.amount_cents, 0);
  if (b && b.income > 0) { available = b.remaining; basis = `your saved monthly budget leaves ${money(available)} after bills, living costs and savings`; }
  else if (rec.income > 0) { available = rec.income - rec.expenses - unpaid; basis = `you recorded ${money(rec.income)} income and ${money(rec.expenses)} spending this month${unpaid ? `, with ${money(unpaid)} in unpaid bills still due` : ''}`; }
  if (!b) missing.push('a monthly budget for this month (Money → Monthly calculator)');
  if (!rec.income && !(b && b.income)) missing.push('your income this month');
  if (!(b && b.savings) && !data.savingsGoal) missing.push('a savings amount or goal');
  if (available === null) return { verdict: null, reasons: ['I don’t have enough of your figures to judge this yet.'], missing };
  const income = (b && b.income) || rec.income, buffer = Math.round(income * 0.1), left = available - amount, reasons = [`Based on what you entered: ${basis}.`];
  let verdict;
  if (left >= buffer && amount <= available * 0.5) { verdict = 'BUY'; reasons.push(`After ${money(amount)} you would still have ${money(left)}, above a safety buffer of ${money(buffer)} (10% of income).`); }
  else if (left >= 0) { verdict = 'REDUCE COST'; const max = Math.max(0, available - buffer); reasons.push(`You can cover it, but only ${money(left)} would be left, below a ${money(buffer)} buffer.`, max > 0 ? `Spending up to ${money(max)} keeps your buffer.` : 'Any spend now eats into your buffer.'); }
  else if (b && b.remaining > 0 && amount <= b.remaining + Math.max(0, available)) { verdict = 'WAIT'; reasons.push(`It is ${money(-left)} more than you have available this month. Next month your budget frees up ${money(b.remaining)}, so it may be affordable then.`); }
  else { verdict = 'AVOID'; reasons.push(`It is ${money(-left)} more than you have available, and your saved figures do not show room for it soon.`); }
  if (b?.savings) reasons.push(`Your planned savings of ${money(b.savings)} are left untouched.`);
  return { verdict, reasons, missing, available, left };
}

// ---- staff ----
export const weekStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
// shifts: [{staff, date:'YYYY-MM-DD', start, end, break_min}] → per person for the week containing `now`
export function timesheet(people, shifts, now = Date.now()) {
  const from = weekStart(now), to = from + 7 * 864e5;
  return people.map((p) => {
    const mine = shifts.filter((s) => s.staff === p.id && new Date(s.date + 'T12:00:00').getTime() >= from && new Date(s.date + 'T12:00:00').getTime() < to);
    const hours = Number(mine.reduce((n, s) => n.plus(shiftHours(s.start, s.end, s.break_min)), B(0)));
    const w = p.rate_cents ? wages(hours, p.rate_cents, { threshold: p.ot_threshold ?? 45, multiplier: p.ot_mult ?? 1.5 }) : null;
    return { id: p.id, name: p.name, shifts: mine.length, hours, overtime: w?.overtime ?? null, pay: w?.total ?? null, steps: w?.steps || [], missing: p.rate_cents ? [] : ['hourly rate'] };
  });
}
