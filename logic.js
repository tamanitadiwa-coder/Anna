// ANNA WEB — pure logic (no DOM). Money in whole cents, cash-basis business. Default currency: South African rand (R).
export const SCHEMA = 1; // additive changes only, so every older backup still loads
export const DEFAULT_CURRENCY = 'R';
export const emptyState = () => ({ app: 'anna-web', schema: SCHEMA, settings: { currency: DEFAULT_CURRENCY, name: '' },
  tasks: [], tx: [], bills: [], budgets: [], biz: [], mem: [], fb: [], reminders: [], chat: [] });
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

// Accepts "12.50", "12,50", "R 1 234,56", "1,234.56", "1 234". Returns cents (> 0) or null.
export function parseCents(s) {
  const t = String(s ?? '').trim().replace(/^[^\d-]+/, '').replace(/[\s  ']/g, '');
  if (!t) return null;
  const dot = t.lastIndexOf('.'), com = t.lastIndexOf(',');
  let dec = dot > com ? '.' : com > dot ? ',' : '';
  // A single separator followed by exactly 3 digits (e.g. "1,000") is a thousands separator; "1.234" stays ambiguous and is rejected, not decimals.
  if (dec === ',' && !t.includes('.') && /,\d{3}$/.test(t)) dec = '';
  const grp = dec === '.' ? ',' : dec === ',' ? '.' : (t.includes(',') ? ',' : '.');
  const [whole, frac = '', extra] = dec ? t.split(dec) : [t];
  if (extra !== undefined || !/^\d{0,2}$/.test(frac) || (dec && frac === '')) return null;
  if (whole.includes(grp) ? !new RegExp(`^\\d{1,3}(\\${grp}\\d{3})+$`).test(whole) : !/^\d+$/.test(whole)) return null;
  const c = Number(whole.split(grp).join('')) * 100 + Number((frac + '00').slice(0, 2));
  return c > 0 && Number.isSafeInteger(c) ? c : null;
}
// R 1 234,56 for rand (South African convention), 1,234.56 style for other symbols.
export const fmt = (cents, cur = DEFAULT_CURRENCY) => {
  const n = (Math.abs(cents) / 100).toLocaleString(cur === 'R' ? 'en-ZA' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' ');
  return (cents < 0 ? '-' : '') + cur + (cur === 'R' ? ' ' : '') + n;
};
export const centsToInput = (c) => (c / 100).toFixed(2);
export const dayTs = (iso) => (iso ? new Date(iso + 'T12:00:00').getTime() : null);
export const tsToDay = (t) => { if (!t) return ''; const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const tsToTime = (t) => { if (!t) return ''; const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const dateTimeTs = (day, time) => { if (!day) return null; const t = new Date(`${day}T${time || '09:00'}:00`).getTime(); return Number.isFinite(t) ? t : null; };
export const monthRange = (now = Date.now()) => { const d = new Date(now); return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()]; };
const inMonth = (t, now) => { const [a, b] = monthRange(now); return t >= a && t < b; };
const sum = (xs) => xs.reduce((n, x) => n + x.amount_cents, 0);

export function monthSummary(s, now = Date.now()) {
  const m = s.tx.filter((t) => inMonth(t.occurred_at, now));
  const income = sum(m.filter((t) => t.kind === 'income')), expense = sum(m.filter((t) => t.kind === 'expense'));
  return { income, expense, net: income - expense };
}
export function spendingByCategory(s, now = Date.now()) {
  const cat = {}; s.tx.filter((t) => t.kind === 'expense' && inMonth(t.occurred_at, now)).forEach((t) => { cat[t.category] = (cat[t.category] || 0) + t.amount_cents; });
  return Object.entries(cat).sort((x, y) => y[1] - x[1]);
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
  if (b.repeat_monthly) { b.due_at = addMonth(b.due_at); b.last_paid_at = now; } else { b.paid = 1; b.paid_at = now; }
}
export const unpayBill = (s, id) => { const b = s.bills.find((x) => x.id === id); if (b) { b.paid = 0; b.paid_at = null; } };
// Cash basis: a sale counts on its day; an invoice counts when marked paid.
export function businessSummary(s, now = Date.now()) {
  const when = (r) => (r.kind === 'invoice' ? r.paid_at : r.occurred_at);
  const counted = s.biz.filter((r) => (r.kind === 'invoice' ? r.status === 'paid' : true) && when(r) != null && inMonth(when(r), now));
  const revenue = sum(counted.filter((r) => r.kind !== 'expense')), expenses = sum(counted.filter((r) => r.kind === 'expense'));
  return { revenue, expenses, profit: revenue - expenses, unpaid: sum(s.biz.filter((r) => r.kind === 'invoice' && r.status === 'unpaid')) };
}
export function searchBiz(s, q) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const hay = (r) => [r.description, r.party, r.kind, r.status, r.notes, (r.amount_cents / 100).toFixed(2)].join(' ').toLowerCase();
  return [...s.biz].filter((r) => words.every((w) => hay(r).includes(w))).sort((a, b) => b.occurred_at - a.occurred_at);
}

// ---- reminders ----
const REPEAT = { daily: (t) => t + 864e5, weekly: (t) => t + 7 * 864e5, monthly: addMonth };
export const REPEATS = [['none', 'Does not repeat'], ['daily', 'Every day'], ['weekly', 'Every week'], ['monthly', 'Every month']];
export const pendingReminders = (s) => s.reminders.filter((r) => !r.done).sort((a, b) => a.at - b.at);
// Reminders whose time has come and that have not been announced yet.
export const dueReminders = (s, now = Date.now()) => pendingReminders(s).filter((r) => r.at <= now && !r.notified);
// Complete: one-off reminders are marked done; repeating ones move to their next future time.
export function completeReminder(s, id, now = Date.now()) {
  const r = s.reminders.find((x) => x.id === id); if (!r) return;
  if (r.done) { r.done = 0; r.done_at = null; return; }
  const step = REPEAT[r.repeat];
  if (step) { let t = r.at; do t = step(t); while (t <= now); r.at = t; r.notified = 0; r.last_done_at = now; }
  else { r.done = 1; r.done_at = now; }
}
export function snoozeReminder(s, id, minutes = 10, now = Date.now()) { const r = s.reminders.find((x) => x.id === id); if (r) { r.at = now + minutes * 6e4; r.notified = 0; } }
// iCalendar file so the iPhone Calendar can alert even when Anna is closed (web apps cannot schedule local notifications).
export function reminderICS(r, now = Date.now()) {
  const z = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const txt = (x) => String(x ?? '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');
  const rule = { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY' }[r.repeat];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Anna Web//Reminders//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${r.id}@anna-web`, `DTSTAMP:${z(now)}`, `DTSTART:${z(r.at)}`, `DTEND:${z(r.at + 15 * 6e4)}`,
    `SUMMARY:${txt(r.title)}`, ...(r.notes ? [`DESCRIPTION:${txt(r.notes)}`] : []), ...(rule ? [`RRULE:${rule}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${txt(r.title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

// ---- backups ----
const ARRAYS = ['tasks', 'tx', 'bills', 'budgets', 'biz', 'mem'], OPTIONAL = ['fb', 'reminders', 'chat'];
export function validateBackup(text) {
  let d; try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch { return { ok: false, error: 'That file is not valid JSON.' }; }
  if (!d || typeof d !== 'object' || d.app !== 'anna-web') return { ok: false, error: 'This is not an Anna Web backup.' };
  if (!Number.isInteger(d.schema) || d.schema > SCHEMA) return { ok: false, error: 'This backup is from a newer version of Anna Web.' };
  for (const k of ARRAYS) if (!Array.isArray(d[k])) return { ok: false, error: `Backup is damaged (missing "${k}").` };
  for (const k of OPTIONAL) if (d[k] != null && !Array.isArray(d[k])) return { ok: false, error: `Backup is damaged (bad "${k}").` };
  if (ARRAYS.concat(OPTIONAL).some((k) => (d[k] || []).some((r) => !r || typeof r !== 'object'))) return { ok: false, error: 'Backup is damaged (bad records).' };
  if (d.tx.concat(d.bills, d.budgets, d.biz).some((r) => !Number.isSafeInteger(r.amount_cents ?? r.limit_cents))) return { ok: false, error: 'Backup is damaged (bad amounts).' };
  if ((d.reminders || []).some((r) => !Number.isFinite(r.at) || typeof r.title !== 'string')) return { ok: false, error: 'Backup is damaged (bad reminders).' };
  const chat = (d.chat || []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
  return { ok: true, state: { ...emptyState(), ...d, settings: { currency: DEFAULT_CURRENCY, name: '', ...(d.settings || {}) }, fb: d.fb || [], reminders: d.reminders || [], chat } };
}
export const counts = (s) => ({ tasks: s.tasks.length, reminders: s.reminders.length, entries: s.tx.length, bills: s.bills.length, budgets: s.budgets.length, business: s.biz.length, memories: s.mem.length, messages: s.chat.length });
const ONE = { tasks: 'task', reminders: 'reminder', entries: 'entry', bills: 'bill', budgets: 'budget', business: 'business record', memories: 'memory', messages: 'message' };
export const describeCounts = (c) => Object.entries(c).map(([k, v]) => `${v} ${v === 1 ? ONE[k] : k === 'business' ? 'business records' : k}`).join(', ');
