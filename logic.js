// ANNA WEB — pure logic (no DOM). Same rules as ANNA NATIVE: money in whole cents, cash-basis business.
export const SCHEMA = 1;
export const emptyState = () => ({ app: 'anna-web', schema: SCHEMA, settings: { currency: '$', name: '' },
  tasks: [], tx: [], bills: [], budgets: [], biz: [], mem: [], fb: [] });
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

export function parseCents(s) {
  const t = String(s ?? '').replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [w, f = ''] = t.split('.');
  const c = Number(w) * 100 + Number((f + '00').slice(0, 2));
  return c > 0 && Number.isSafeInteger(c) ? c : null;
}
export const fmt = (cents, cur = '$') => (cents < 0 ? '-' : '') + cur + (Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dayTs = (iso) => (iso ? new Date(iso + 'T12:00:00').getTime() : null);
export const monthRange = (now = Date.now()) => { const d = new Date(now); return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()]; };
const inMonth = (t, now) => { const [a, b] = monthRange(now); return t >= a && t < b; };
const sum = (xs) => xs.reduce((n, x) => n + x.amount_cents, 0);

export function monthSummary(s, now = Date.now()) {
  const m = s.tx.filter((t) => inMonth(t.occurred_at, now));
  const income = sum(m.filter((t) => t.kind === 'income')), expense = sum(m.filter((t) => t.kind === 'expense'));
  return { income, expense, net: income - expense };
}
export function budgetStatus(s, now = Date.now()) {
  return s.budgets.map((b) => {
    const spent = sum(s.tx.filter((t) => t.kind === 'expense' && t.category.toLowerCase() === b.category.toLowerCase() && inMonth(t.occurred_at, now)));
    return { ...b, spent, left: b.limit_cents - spent, over: spent > b.limit_cents };
  });
}
export function addMonth(ts) { const d = new Date(ts); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return d.getTime(); }
// Marks a bill paid; optionally records an expense; monthly bills roll to next month.
export function payBill(s, id, { recordExpense = true, now = Date.now() } = {}) {
  const b = s.bills.find((x) => x.id === id); if (!b || b.paid) return;
  if (recordExpense) s.tx.push({ id: uid(), kind: 'expense', amount_cents: b.amount_cents, category: 'Bills', note: b.name, occurred_at: now });
  if (b.repeat_monthly) b.due_at = addMonth(b.due_at); else { b.paid = 1; b.paid_at = now; }
}
// Cash basis: a sale counts on its day; an invoice counts when marked paid.
export function businessSummary(s, now = Date.now()) {
  const when = (r) => (r.kind === 'invoice' ? r.paid_at : r.occurred_at);
  const counted = s.biz.filter((r) => (r.kind === 'invoice' ? r.status === 'paid' : true) && when(r) != null && inMonth(when(r), now));
  const revenue = sum(counted.filter((r) => r.kind !== 'expense')), expenses = sum(counted.filter((r) => r.kind === 'expense'));
  return { revenue, expenses, profit: revenue - expenses, unpaid: sum(s.biz.filter((r) => r.kind === 'invoice' && r.status === 'unpaid')) };
}
export function validateBackup(text) {
  let d; try { d = JSON.parse(text); } catch { return { ok: false, error: 'That file is not valid JSON.' }; }
  if (!d || d.app !== 'anna-web') return { ok: false, error: 'This is not an Anna Web backup.' };
  if (!Number.isInteger(d.schema) || d.schema > SCHEMA) return { ok: false, error: 'This backup is from a newer version of Anna Web.' };
  for (const k of ['tasks', 'tx', 'bills', 'budgets', 'biz', 'mem']) if (!Array.isArray(d[k])) return { ok: false, error: `Backup is damaged (missing "${k}").` };
  if (d.tx.concat(d.bills, d.budgets, d.biz).some((r) => !r || !Number.isSafeInteger(r.amount_cents ?? r.limit_cents))) return { ok: false, error: 'Backup is damaged (bad amounts).' };
  return { ok: true, state: { ...emptyState(), ...d, settings: { currency: '$', name: '', ...(d.settings || {}) }, fb: Array.isArray(d.fb) ? d.fb : [] } };
}
