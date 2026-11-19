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
export function timesheet(people, shifts, now = Date.now(), { isSpecialDay = (iso) => new Date(iso + 'T12:00:00').getDay() === 0 } = {}) {
  const from = weekStart(now), to = from + 7 * 864e5;
  return people.map((p) => {
    const mine = shifts.filter((s) => s.staff === p.id && new Date(s.date + 'T12:00:00').getTime() >= from && new Date(s.date + 'T12:00:00').getTime() < to);
    const hrs = (s) => B(shiftHours(s.start, s.end, s.break_min)), dbl = p.double_special ? mine.filter((s) => isSpecialDay(s.date)) : [];
    const hours = Number(mine.reduce((n, s) => n.plus(hrs(s)), B(0))), special = Number(dbl.reduce((n, s) => n.plus(hrs(s)), B(0)));
    if (!p.rate_cents) return { id: p.id, name: p.name, shifts: mine.length, hours, special, overtime: null, pay: null, steps: [], missing: ['hourly rate'] };
    const w = wages(Number(B(hours).minus(special)), p.rate_cents, { threshold: p.ot_threshold ?? 45, multiplier: p.ot_mult ?? 1.5 }), sp = cents(B(special).times(p.rate_cents).times(2));
    const steps = special ? [...w.steps.slice(0, -1), `Sundays & public holidays: ${fmtNum(special)} h × ${money(p.rate_cents)} × 2 = ${money(sp)}`, `Total = ${money(w.total + sp)}`] : w.steps;
    return { id: p.id, name: p.name, shifts: mine.length, hours, special, overtime: w.overtime, pay: w.total + sp, steps, missing: [] };
  });
}

// ================= v0.10: chat entries, warnings, bill priorities, Books Day =================
const AMT = /(?:R|\$|€|£)\s?(\d[\d\s,]*(?:[.,]\d{1,2})?)|(\d[\d\s,]*(?:[.,]\d{1,2})?)(?!\d|\s*(?:st|nd|rd|th)\b)\s*(?:rand|bucks)?/i;
const amountIn = (t) => { const m = String(t).match(AMT); return m ? toCents((m[1] || m[2]).trim()) : null; };
const clean = (s) => String(s || '').replace(/\b(this month|per month|a month|monthly|every month|from now on)\b/gi, '').replace(/[.?!]+$/, '').replace(/\s+/g, ' ').trim();
const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());
// Turns a short chat sentence into a money entry, or null. Amounts come from the text only.
export function parseEntry(text) {
  if (REMOVE_RE.test(text || '')) return null;
  const t = String(text || '').trim(), lo = t.toLowerCase(), amt = amountIn(t);
  let m;
  if ((m = lo.match(/^(?:i\s+)?(?:have\s+)?(?:cancell?ed|stopped|ended|no longer pay(?:ing)?(?: for)?|dropped)\s+(?:my\s+|the\s+)?(.+)$/))) return { type: 'billCancel', name: cap(clean(t.slice(t.length - m[1].length))) };
  if ((m = lo.match(/^(?:i\s+)?(?:have\s+)?paid\s+(?:the\s+|my\s+)?([a-z][a-z\s&'-]*?)(?:\s+(?:bill|account))?(?:\s*(?:of\s+)?(?:r|\$|€|£)?\s?\d.*)?$/)) && !/\bon\b/.test(lo)) return { type: 'billPaid', name: cap(clean(m[1])), amount: amt };
  if (!(amt > 0)) return null;
  if (/\bnext month\b/.test(lo)) { const name = clean(t.replace(AMT, '').replace(/\bnext month\b/i, '').replace(/^(?:there(?:'s| is)|i have|i'll have|i will have|coming up:?)\s+/i, '').replace(/\b(due|for|of|on)\s*$/i, '')); return { type: 'nextMonth', name: cap(name || 'Next month cost'), amount: amt }; }
  if (/\b(saved|put (?:away|aside)|moved .* to savings|into savings)\b/.test(lo)) return { type: 'saved', amount: amt };
  if ((m = t.match(/^(?:my\s+|the\s+)?(.+?)\s+(?:is|are|went up to|goes up to|has gone up to|costs?)\s+now\s+|^(?:my\s+|the\s+)?(.+?)\s+(?:is now|are now|went up to|went down to|goes up to|now costs?)\s+/i))) return { type: 'billSet', name: cap(clean(m[1] || m[2])), amount: amt };
  if (/\b(got|received|earned|was paid|they paid me|bonus|extra income|side hustle|made)\b/.test(lo) && !/\bspent|bought\b/.test(lo)) return { type: 'income', amount: amt, label: /\bbonus\b/.test(lo) ? 'Bonus' : 'Extra income' };
  if ((m = lo.match(/\b(?:spent|paid|bought|used)\b.*?\b(?:on|for)\s+(.+)$/)) || (m = lo.match(/\b(?:spent|bought)\s+(.+?)\s+(?:for\s+)?(?:r|\$|€|£)?\s?\d/))) return { type: 'expense', amount: amt, category: cap(clean(m[1].replace(AMT, '').replace(/^(?:a|an|the|some)\s+/, '')) || 'General') };
  const name = clean(t.replace(AMT, '').replace(/^(?:new bill:?|add(?: a)? bill(?: for)?:?)\s*/i, '').replace(/\b(for|at|of|costs?)\s*$/i, ''));
  if (name && name.length <= 40 && /^[a-z]/i.test(name)) return { type: 'billNew', name: cap(name), amount: amt, thisMonthOnly: /\bthis month\b/i.test(t) && !/\b(per|every|a) month|monthly\b/i.test(t) };
  return null;
}
// "Change all due dates to after pay on the 26th", "move my bills to the 1st", "payday is the 26th" (no amount)
// "Remove the last added 5000", "delete the Netflix bill", "undo that" → find it and remove it (never a new bill)
export const REMOVE_RE = /^\s*(?:please\s+|can you\s+|pls\s+)?(?:remove|delete|undo|cancel|take (?:off|out|away)|get rid of|scrap|erase|drop|clear)\b/i;
export function parseRemove(text) {
  if (!REMOVE_RE.test(text || '')) return null;
  const rest = String(text).replace(REMOVE_RE, ' '), amount = amountOf(rest), last = /\b(?:last|latest|recent|newest|just|that|it)\b/i.test(rest);
  const name = rest.replace(AMT_ALL, ' ').replace(/\b(?:the|a|an|my|last|latest|recent|newest|one|added|i|just|that|it|item|entry|thing|bill|bills|expense|payment|from|money|please|pls|rand)\b/gi, ' ').replace(/[^\p{L}\p{N}' -]/gu, ' ').replace(/\s+/g, ' ').trim();
  return { type: 'remove', amount, name, last: last || (!name && !amount) };
}
// "How much can I spend on food from the 25th of November to the 26th of December", "…until payday", "…per day this week"
export function parseSpendWindow(text, now = Date.now()) {
  const t = String(text || ''), lo = t.toLowerCase();
  if (!/\bhow much\b[\s\S]*\b(?:spend|use|budget|have)\b|\bbudget\b[\s\S]*\b(?:for|on)\b|\bspend\b[\s\S]*\b(?:per|a) (?:day|week)\b|\bsafe to spend\b/.test(lo)) return null;
  const on = (lo.match(/\b(?:on|for)\s+(food|groceries|transport|taxi|fuel|petrol|airtime|data|electricity|clothes|going out|fun|lunch|takeaways?|drinks?)\b/) || [])[1] || '';
  const parts = t.split(/\b(?:to|until|till|untill|through|thru|up to)\b|\s[-–]\s/i), d0 = parts.length > 1 ? dateIn(parts[0], now) : null, d1 = dateIn(parts.length > 1 ? parts.slice(1).join(' ') : t, now);
  const toPay = /\b(?:to|until|till|untill)\s+(?:my\s+)?(?:next\s+)?pay ?day\b/.test(lo), week = /\bthis week\b/.test(lo), month = /\bthis month\b/.test(lo);
  if (!d1 && !toPay && !week && !month) return null;
  let from = d0 ? d0.date : null, to = d1 && (parts.length > 1 || !toPay) ? d1.date : null;
  if (from && to && to < from) { const x = from; from = to; to = x; }
  return { type: 'spendWindow', on, from, to, toPay, week, month };
}
// Money free to spend between two days, after every bill due up to the end day. Money arriving before the end day counts.
export function spendWindow({ cash, bills = [], incomes = [] }, from, to, now = Date.now()) {
  const day = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }, f = day(Math.max(from || now, now)), e = day(to);
  const inc = incomes.filter((x) => x.amount > 0 && x.date && day(x.date) >= day(now) && day(x.date) < e), un = bills.filter((b) => !b.paid);
  const due = un.filter((b) => !b.due_at || day(b.due_at) <= e), later = un.filter((b) => b.due_at && day(b.due_at) > e);
  const incTotal = inc.reduce((n, x) => n + x.amount, 0), dueTotal = due.reduce((n, b) => n + b.amount_cents, 0), free = (cash ?? 0) + incTotal - dueTotal, days = Math.max(1, Math.round((e - f) / 864e5));
  return { cash, from: f, to: e, days, incomes: inc, incTotal, due, dueTotal, later, laterTotal: later.reduce((n, b) => n + b.amount_cents, 0), free, perDay: free > 0 ? Math.floor(free / days) : 0, perWeek: free > 0 ? Math.floor(free / days * 7) : 0 };
}
export function parseMoveDue(text, now = Date.now()) {
  const lo = String(text || '').toLowerCase(), d = dateIn(text, now), pay = /\b(?:pay ?day|pay|paid|salary)\b/.test(lo), billsWord = /\b(?:due dates?|bills|payments|debts|everything)\b/.test(lo);
  if ((/\b(?:change|move|set|put|push|shift|make)\b/.test(lo) || /\bdue dates?\b/.test(lo)) && billsWord && (d || /\bafter (?:my )?pay(?:day)?\b/.test(lo))) return { type: 'moveDue', date: d ? d.date : null, pay: pay && !!d };
  if (!billsWord && d && !amountOf(lo.replace(d.text.toLowerCase(), ' ')) && (/\bpay ?day (?:is|will be|moves?|changed?)\b/.test(lo) || /\b(?:i )?get paid\b/.test(lo))) return { type: 'paydayDate', date: d.date };
  return null;
}
export const sameName = (a, b) => { const n = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); const x = n(a), y = n(b); return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x)); };

// month = { lines (monthly-calculator lines), spent: {category: cents}, extraSpend, saved, days } → effective position + warnings
export function monthState(month, { daysLeft = 30, budgets = [] } = {}) {
  const t = monthly(month.lines, { days: month.days || 30 }), spent = month.spent || {};
  const planned = Object.fromEntries(month.lines.filter((l) => l.kind === 'living').map((l) => [l.name.toLowerCase(), l]));
  let over = 0; const overs = [];
  for (const [cat, c] of Object.entries(spent)) { const l = Object.values(planned).find((p) => sameName(p.name, cat) || sameName(p.name.split(/[ &/]/)[0], cat)); if (l) { if (c > l.cents) { over += c - l.cents; overs.push({ name: l.name, planned: l.cents, spent: c, over: c - l.cents }); } } }
  for (const b of budgets) if (b.spent > b.limit_cents && !overs.some((o) => sameName(o.name, b.category))) overs.push({ name: b.category, planned: b.limit_cents, spent: b.spent, over: b.spent - b.limit_cents });
  const unplanned = Object.entries(spent).filter(([cat]) => !Object.values(planned).some((p) => sameName(p.name, cat) || sameName(p.name.split(/[ &/]/)[0], cat))).reduce((n, [, c]) => n + c, 0);
  const remaining = t.remaining - unplanned - over, dailyLeft = cents(B(remaining).div(Math.max(1, daysLeft))), plannedDaily = t.daily;
  const warnings = [], savingsLine = t.savings;
  if (remaining < 0) {
    const need = -remaining, opts = [];
    if (savingsLine > 0) opts.push(`use ${money(Math.min(need, savingsLine))} of your ${money(savingsLine)} savings${savingsLine < need ? ` (still ${money(need - savingsLine)} short)` : ''}`);
    const living = month.lines.filter((l) => l.kind === 'living' && l.cents > 0).sort((a, b) => b.cents - a.cents)[0]; if (living) opts.push(`cut ${living.name} from ${money(living.cents)} to ${money(Math.max(0, living.cents - need))}`);
    const once = month.lines.find((l) => l.kind === 'once' && l.cents > 0); if (once) opts.push(`postpone once-off costs (${money(once.cents)})`);
    warnings.push({ kind: 'minus', text: `This month is now ${money(need)} in the minus.`, options: opts });
    if (savingsLine > 0) warnings.push({ kind: 'savings', text: `Covering it would eat ${money(Math.min(need, savingsLine))} of your planned ${money(savingsLine)} savings.`, options: [] });
  }
  for (const o of overs) warnings.push({ kind: 'category', text: `${o.name} is ${money(o.over)} over its ${money(o.planned)} plan (${money(o.spent)} spent).`, options: [] });
  if (remaining >= 0 && plannedDaily > 0 && dailyLeft < plannedDaily / 2) warnings.push({ kind: 'daily', text: `Only ${money(dailyLeft)} a day is left for the next ${daysLeft} day${daysLeft === 1 ? '' : 's'} (your plan was ${money(plannedDaily)} a day).`, options: [] });
  return { ...t, remaining, dailyLeft, unplanned, over, overs, warnings };
}

// Bill priorities: unpaid bills by priority (1 first), then due date, with a running total against what is available.
export function payOrder(bills, available) {
  const list = bills.filter((b) => !b.paid).sort((a, b) => (a.priority || 2) - (b.priority || 2) || (a.due_at || 0) - (b.due_at || 0));
  let run = 0, runsOutAt = -1;
  const rows = list.map((b, i) => { run += b.amount_cents; if (available != null && runsOutAt < 0 && run > available) runsOutAt = i; return { ...b, running: run, covered: available == null ? null : run <= available }; });
  return { rows, total: run, available, runsOutAt, short: available != null && run > available ? run - available : 0 };
}

// Books Day: the 25th. Due from the 25th until the month is closed (or skipped); asked at most once per day.
export const BOOKS_DAY = 25;
export const booksMonth = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export function booksDue(t, state = {}) { const d = new Date(t), ym = booksMonth(t); if (d.getDate() < BOOKS_DAY) return false; if (state.closed?.includes(ym) || state.skipped?.includes(ym)) return false; if (state.snoozeUntil && t < state.snoozeUntil) return false; const today = d.toDateString(); return state.lastAsked !== today; }
export const BOOKS_QUESTIONS = [['income', 'Any income this month you haven’t recorded yet? (e.g. “got R500 extra”, or say “none”)'], ['expenses', 'Any expenses you haven’t recorded? (e.g. “spent R200 on food”)'], ['paid', 'Which bills are paid? (e.g. “paid rent”)'], ['bills', 'Any new or cancelled bills? (e.g. “Apple Music R60”, “cancelled Netflix”)'], ['saved', 'Did you save anything this month? (e.g. “saved R1000”)'], ['next', 'Anything coming up next month? (e.g. “school fees R3000 next month”)']];
export const isNone = (t) => /^\s*(none|no|nope|nothing|nah|next|skip( this)?|done|that'?s (it|all)|n\/a)\s*[.!]?\s*$/i.test(t);
export function booksSummary(cur, prev) {
  const line = (k, label) => `${label}: ${money(cur[k])}${prev && prev[k] != null ? ` (${cur[k] - prev[k] >= 0 ? '+' : '−'}${money(Math.abs(cur[k] - prev[k]))} vs last month)` : ''}`;
  return [line('income', 'Income'), line('expenses', 'Expenses'), line('saved', 'Saved'), line('remaining', 'Left over')];
}
// Next month's plan: recurring lines carried forward, this-month-only lines dropped, "next month" items added as once-off.
export function carryForward(lines, nextItems = []) {
  return lines.filter((l) => !l.oneMonth).map((l) => ({ ...l, cents: l.id === 'extra' || l.kind === 'once' ? 0 : l.cents })).concat(nextItems.map((n, i) => ({ id: 'c-next' + i + Date.now().toString(36), name: n.name, kind: 'once', cents: n.amount })));
}

// ================= v1.1: messages with many money items (balance, planned payments, debts, payday, expenses) =================
// Amounts: R / rand / k, spaces or commas as thousands. Ordinals (25th) are dates, never amounts.
const AMT_ALL = /(?:\bR\s?)?(\d{1,3}(?:[ , ]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(k\b|rand\b)?(?!\d|st\b|nd\b|rd\b|th\b)/gi;
export function amountOf(t) { AMT_ALL.lastIndex = 0; const m = AMT_ALL.exec(t); if (!m) return null; let c = Number(m[1].replace(/[ , ]/g, '')) * 100 + (m[2] ? Number(m[2].padEnd(2, '0')) : 0); if (m[3] && /k/i.test(m[3])) c *= 1000; return { cents: c, text: m[0] }; }
const DATE_RE = /\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?:\s+of\s+[a-z]+)?|\bon\s+the\s+(\d{1,2})\b/i;
// "10 January", "the 3rd of Feb 2027", "January 10": a full date (rolled to next year if it has passed)
const MON = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const MDATE_RE = new RegExp(`\\b(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MON})\\.?(?:,?\\s+(20\\d\\d))?\\b|\\b(?:on\\s+)?(${MON})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d\\d))?\\b`, 'i');
const MONS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function dateIn(s, now = Date.now()) {
  const m = s.match(MDATE_RE);
  if (m) { const day = Number(m[1] || m[5]), mon = MONS.indexOf((m[2] || m[4]).slice(0, 3).toLowerCase()), yr = m[3] || m[6], d = new Date(now), today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let t = new Date(yr ? Number(yr) : d.getFullYear(), mon, day, 12); if (!yr && t < today && today - t > 60 * 864e5) t = new Date(d.getFullYear() + 1, mon, day, 12); return { date: t.getTime(), text: m[0] }; }
  const dm = s.match(DATE_RE); return dm ? { date: nextDayOfMonth(Number(dm[1] || dm[2]), now), text: dm[0] } : null;
}
const noDate = (s) => { const m = s.match(MDATE_RE) || s.match(DATE_RE); return m ? s.replace(m[0], ' ') : s; };
// next date with this day of the month (today counts), as local noon
export function nextDayOfMonth(day, now = Date.now()) { const d = new Date(now); let t = new Date(d.getFullYear(), d.getMonth(), day, 12); if (t.getDate() !== day || new Date(d.getFullYear(), d.getMonth(), d.getDate()) > t) t = new Date(d.getFullYear(), d.getMonth() + 1, day, 12); return t.getTime(); }
export const daysUntil = (t, now = Date.now()) => { const a = new Date(now), b = new Date(t); return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5); };
const FILLER = /^(?:(?:and|plus|also|then|so|but|right now|now|i|i'm|im|i am|i'll|it's|its|it is|there's|there is|need to|have to|must|will|my|the|a|an|to|for|of|on|with|some|get|got|pay|send|owe|is|be)\b\s*)+/i;
const nameOf = (s) => cap(String(s).trim().replace(/[.?!,]+$/, '').replace(FILLER, '').replace(/\b(?:for|to|of|on|the|my)\s*$/i, '').replace(/\s+/g, ' ').trim());
function splitItems(text) {
  const out = [];
  for (const sent of String(text).split(/(?<=[.!?;])\s+|\n+/)) for (const part of sent.split(/\s*,(?!\d)\s*|\s+plus\s+/i)) {
    const ands = part.split(/\s+and\s+(?:also\s+)?/i);
    if (ands.length > 1 && ands.every((p) => amountOf(noDate(p)))) out.push(...ands); else out.push(part);
  }
  return out.map((s) => s.replace(/^[\s.,!?;]+|[\s.,!?;]+$/g, '').replace(/^(?:plus|and|also|then)\s+/i, '')).filter(Boolean);
}
// One item: { type: balance | planned | debt | income | expense | unknown, name, amount (cents|null), date (ts|null), person, text }
export function classifyItem(s, now = Date.now()) {
  const lo = s.toLowerCase(), dm = dateIn(s, now), date = dm ? dm.date : null, rest = dm ? s.replace(dm.text, ' ') : s, a = amountOf(rest), amount = a ? a.cents : null, bare = a ? rest.replace(a.text, ' ') : rest;
  let m;
  if (/\b(get(?:ting)? paid|paid on|payday|pay ?day|salary|wages? (?:come|comes|in)|get my pay)\b/.test(lo)) return { type: 'income', name: /salary/.test(lo) ? 'Salary' : 'Pay', amount, date, text: s };
  if ((m = s.match(/\b([A-Z][\w'-]*)\s+(?:owes|will pay|is paying|pays)\s+me\b/)) || (m = s.match(/\b(?:from|by)\s+([A-Za-z][\w'-]*)\s*$/)) && /\b(coming|expect|receive|getting|get)\b/.test(lo)) { const p = cap(m[1]); return { type: 'income', incoming: true, name: `From ${p}`, amount, date, text: s }; }
  if (/\b(coming(?!\s+up)|expecting|i expect|will (?:get|receive)|receiving|getting paid for|refund)\b/.test(lo)) return { type: 'income', incoming: true, name: nameOf(bare.replace(/\b(?:coming in|money coming|is coming|coming|expecting|expect|will get|will receive|receiving|getting paid for|from|in)\b/gi, ' ')) || 'Money coming', amount, date, text: s };
  const STOPN = "(?:r?\\d|(?:by|on|the|for|before|until|money|back|him|her|them|some|about|around|and|to|from)\\b)";
  if ((m = s.match(new RegExp(`\\b(?:i\\s+)?(?:still\\s+)?(?:owe|owing)\\s+([A-Z]?[a-z][\\w'-]*(?:\\s+(?!${STOPN})[A-Za-z][\\w'-]*)?)`, 'i'))) && !/^(?:you|it|them|him|her)$/i.test(m[1])) { const p = m[1].split(/\s+/).map(cap).join(' '); return { type: 'debt', name: `${p} (debt)`, person: p, amount, date, text: s }; }
  if (/\bdebts?\b/i.test(lo) && amount) { const p = bare.replace(/\b(?:add|a|an|new|my|the|debt|debts|to|be|paid|pay|back|by|on|before|of|for|i|owe|need|must|it|is|due)\b/gi, ' ').replace(/[^\p{L}' -]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 3).map(cap).join(' ');
    if (p) return { type: 'debt', name: `${p} (debt)`, person: p, amount, date, text: s }; }
  if ((m = s.match(/\b(?:i\s+)?(?:still\s+)?(?:owe|owing)\s+([A-Z]?[a-z][\w'-]*)/i)) || (m = s.match(/\bborrowed\s+(?:\S+\s+)?from\s+([A-Za-z][\w'-]*)/i))) { const p = cap(m[1]); return { type: 'debt', name: `${p} (debt)`, person: p, amount, date, text: s }; }
  if (/\b(want(?:s)? to buy|wanna buy|would like to buy|i'd like to buy|thinking (?:of|about) buying|wish(?:ing)? i could buy|planning to buy)\b/.test(lo)) return { type: 'wish', name: nameOf(bare.replace(/^.*?\b(?:buy|buying)\b/i, '')) || 'Something', amount, date, text: s };
  if (/\b(spent|bought|paid for)\b/.test(lo)) { const e = parseEntry(s); return { type: 'expense', name: e?.category || nameOf(bare.replace(/\b(spent|bought|on)\b/gi, ' ')) || 'Other', amount, date, text: s }; }
  if (/\b(need to|have to|must|got to|gotta|going to|send|pay|deposit|transfer|set aside|put aside)\b/.test(lo)) return { type: 'planned', name: nameOf(bare.replace(/\b(send|pay|transfer|set aside|put aside)\b/gi, ' ')) || 'Payment', amount, date, text: s };
  if (/\b(there'?s|there is|i have|i've got|i got|balance|in (?:my|the) (?:account|bank)|left)\b/.test(lo) && amount) return { type: 'balance', name: 'Current balance', amount, date, text: s };
  if (/^\s*(?:r\s?)?\d[\d\s,.]*k?\s*(?:rand\s*)?for\s+/i.test(rest)) return { type: 'planned', name: nameOf(bare.replace(/^\s*for\s+/i, '')) || 'Payment', amount, date, text: s };
  return { type: 'unknown', name: nameOf(bare) || 'Item', amount, date, text: s };
}
export const ITEM_LABEL = { wish: 'Want to buy', balance: 'Balance', planned: 'Planned payment', debt: 'Debt', income: 'Income', expense: 'Expense', unknown: 'Not sure' };
// The whole message → items (with amounts) + questions (items without an amount). null when it's not a many-item money message.
export function parseItems(text, now = Date.now()) {
  const items = splitItems(text).map((s) => classifyItem(s, now)).filter((x) => x.amount || x.name.length > 2);
  const withAmt = items.filter((x) => x.amount), need = items.filter((x) => !x.amount && x.type !== 'balance');
  const strong = withAmt.some((x) => ['balance', 'debt', 'planned', 'wish'].includes(x.type) || (x.type === 'income' && x.date));
  if (withAmt.length < 2 && !strong) return null;
  return { items: withAmt, ask: need.filter((x) => /^[a-z]/i.test(x.name)).map((x) => ({ ...x, type: 'planned', setAside: true })) };
}
export const askAside = (name) => `How much do you want to set aside for your ${name.toLowerCase()}?`;
// balance − planned payments − debts = left until payday; days, daily allowance, next income. Exact cents.
export function cashPlan(items, now = Date.now()) {
  const sum = (t) => items.filter((x) => x.type === t && x.amount).reduce((n, x) => n + x.amount, 0);
  const balance = sum('balance'), planned = sum('planned'), debts = sum('debt'), spent = sum('expense'), inc = items.filter((x) => x.type === 'income' && x.amount).sort((a, b) => (a.date || 9e15) - (b.date || 9e15))[0] || null;
  const left = balance - spent - planned - debts, days = inc?.date ? Math.max(0, daysUntil(inc.date, now)) : null, daily = days ? Math.floor(left / days) : null;
  return { balance, planned, debts, spent, left, days, daily, income: inc, minus: left < 0 };
}
export function cashPlanText(p) {
  if (!p.balance) return [];
  const L = [`Left until payday: ${money(p.left)} (${[`${money(p.balance)} balance`, p.spent && `${money(p.spent)} spent`, p.planned && `${money(p.planned)} planned payments`, p.debts && `${money(p.debts)} debts`].filter(Boolean).join(' − ')}).`];
  if (p.days != null) L.push(`${p.days} ${p.days === 1 ? 'day' : 'days'} until payday → ${p.days ? `${money(p.daily)} a day` : 'payday is today'}.`);
  if (p.income) L.push(`Next income: ${money(p.income.amount)}${p.income.date ? ' on ' + new Date(p.income.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' }) : ''}.`);
  if (p.minus) L.push(`⚠ That’s ${money(-p.left)} in the minus before payday. Options: pay part of a debt later, or move a planned payment to after payday. You decide.`);
  return L;
}

// ================= v1.2: the simple Money view =================
// cash = money now (cents); bills = all bills (unpaid ones count); payday = { amount, date } or null; wishes = [{ name, price }]
// Buffer: 10% of what is needed, rounded up to R50. Safe per day = (cash − unpaid due before payday) ÷ days to payday (or month end).
export function moneyToday({ cash, bills = [], payday = null, wishes = [], incomes = null }, now = Date.now()) {
  const order = payOrder(bills, cash), d = new Date(now), end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).getTime(), until = payday ? payday.date : end;
  const days = Math.max(0, daysUntil(until, now)), dueBefore = order.rows.filter((b) => !b.due_at || daysUntil(b.due_at, now) <= days).reduce((n, b) => n + b.amount_cents, 0);
  const left = cash == null ? null : cash - dueBefore, perDay = left == null ? null : days > 0 ? Math.floor(Math.max(0, left) / days) : Math.max(0, left);
  const buffer = order.total ? Math.ceil((order.total * 0.1) / 5000) * 5000 : 0, needed = order.total + buffer, gap = cash == null ? null : needed - cash, spare = cash == null ? null : cash - needed;
  const wish = wishes.map((w) => ({ ...w, status: spare != null && w.price <= spare ? 'now' : payday && spare != null && w.price <= spare + payday.amount ? 'payday' : 'later' }));
  return { cash, days, until, payday, left, perDay, order, buffer, needed, gap, spare, wishes: wish, plan: moneyPlan({ cash, bills, incomes: incomes || (payday ? [{ name: 'Payday', ...payday }] : []) }, now) };
}

// v1.3: the main Money card. Walks the timeline: money now, bills by due date, money coming in.
// A bill due before an income date is paid from the money you have now; one due on the income day (or later) from that income.
// Period 0 = now → first income; period k starts when income k lands. safe[k] = what you can spend in that period
// while every later bill is still covered (greedy: earlier periods first). left = cash + all incoming − all unpaid bills.
export function moneyPlan({ cash, bills = [], incomes = [] }, now = Date.now()) {
  const unpaid = bills.filter((b) => !b.paid), billsTotal = unpaid.reduce((n, b) => n + b.amount_cents, 0);
  const inc = incomes.filter((x) => x.amount > 0 && x.date && daysUntil(x.date, now) >= 0).sort((a, b) => a.date - b.date), coming = inc.reduce((n, x) => n + x.amount, 0);
  const d = new Date(now), monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).getTime();
  const oneMonthOn = (t) => { const a = new Date(t); return new Date(a.getFullYear(), a.getMonth() + 1, a.getDate(), 12).getTime(); };
  const starts = [now, ...inc.map((x) => x.date)], ends = [...inc.map((x) => x.date), inc.length ? oneMonthOn(inc[inc.length - 1].date) : monthEnd];
  const dayOf = (b) => (b.due_at ? Math.max(0, daysUntil(b.due_at, now)) : 0);
  let bal = cash ?? 0; const periods = starts.map((st, k) => {
    const from = k ? daysUntil(st, now) : -Infinity, to = k < inc.length ? daysUntil(inc[k].date, now) : Infinity;
    const due = unpaid.filter((b) => dayOf(b) >= from && dayOf(b) < to).sort((a, b) => (a.due_at || 0) - (b.due_at || 0)), dueTotal = due.reduce((n, b) => n + b.amount_cents, 0);
    if (k) bal += inc[k - 1].amount; const start = bal; bal -= dueTotal;
    return { k, income: k ? inc[k - 1] : null, start, bills: due, dueTotal, end: bal, days: Math.max(0, daysUntil(ends[k], now) - Math.max(0, daysUntil(st, now))) };
  });
  let used = 0; for (const p of periods) { const low = Math.min(...periods.slice(p.k).map((q) => q.end)); p.safe = cash == null ? null : Math.max(0, low - used); if (p.safe != null) used += p.safe; p.perDay = p.safe == null ? null : p.days > 0 ? Math.floor(p.safe / p.days) : p.safe; }
  const left = cash == null ? null : cash + coming - billsTotal, low = Math.min(...periods.map((p) => p.end));
  return { cash, billsTotal, coming, incomes: inc, left, periods, safeNow: periods[0].safe, perDayNow: periods[0].perDay, daysNow: periods[0].days, short: cash != null && low < 0 ? -low : 0 };
}
