// ANNA WEB v0.4.0 — black & silver, ZAR, editable records, reminders, persistent chat, verified offline AI.
// Same IndexedDB database and backup format as v0.1–v0.3 (additive fields only), so no data is lost on update.
import * as L from './logic.js';
import * as AI from './ai.js';
export const VERSION = '0.4.0';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- storage: IndexedDB, falling back to localStorage, then memory (with a visible warning) ----
let mode = 'indexeddb', mem = {}, dbp = null;
const idb = () => (dbp ||= new Promise((res, rej) => { const r = indexedDB.open('anna-web', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => { dbp = null; rej(r.error); }; }));
async function kvGet(k) {
  if (mode === 'indexeddb') { try { const db = await idb(); return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => rej(q.error); }); } catch { mode = 'localstorage'; } }
  if (mode === 'localstorage') { try { return JSON.parse(localStorage.getItem('anna-web:' + k) || 'null'); } catch { mode = 'memory'; } }
  return mem[k] ?? null;
}
async function kvSet(k, v) {
  if (mode === 'indexeddb') { try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); return; } catch { mode = 'localstorage'; } }
  if (mode === 'localstorage') { try { localStorage.setItem('anna-web:' + k, JSON.stringify(v)); return; } catch { mode = 'memory'; } }
  mem[k] = v; banner();
}
function banner() { const b = $('#banner'); b.hidden = mode !== 'memory'; b.textContent = 'This browser is blocking storage (private mode?). Anna cannot save. Export a backup before closing.'; }

let S = L.emptyState(), tab = 'home', sheet = null, editId = null, taskView = 'today', memCat = 'All', memQ = '', bizQ = '', saveErr = '', SOD = 0, EOD = 0, diag = '', pendingRestore = null, hasPrev = false, undo = null;
const save = async () => { try { S.chat = S.chat.slice(-300); await kvSet('state', S); saveErr = ''; } catch (e) { saveErr = String(e); } };
const mutate = async (fn, { close = true } = {}) => { fn(); if (close) { sheet = null; editId = null; } render(); await save(); if (saveErr) render(); };
const cur = () => S.settings.currency || L.DEFAULT_CURRENCY;
const money = (c) => esc(L.fmt(c, cur()));
const dstr = (t) => (t ? new Date(t).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : '');
const dtstr = (t) => new Date(t).toLocaleString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const tstr = (t) => new Date(t).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
const ago = (t) => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; };
const normSettings = () => {
  const s = S.settings; s.currency ||= L.DEFAULT_CURRENCY;
  // v0.4.0: everything stays on this device, so Anna may read your data by default (switch off any category in Brain).
  if (!s.aiDefaultsV4) { s.ai = { ...(s.ai || {}), tasks: true, money: true, biz: true, mem: true }; s.aiDefaultsV4 = 1; }
  s.ai = { tasks: true, money: true, biz: true, mem: true, gpu: false, ...(s.ai || {}) };
};

// ---- toast (non-blocking messages, optional action button) ----
let toastT = 0;
function toast(msg, { action, ms = 3500, alert = false } = {}) {
  const t = $('#toast'); clearTimeout(toastT);
  t.innerHTML = esc(msg) + (action ? ` <button class="link" style="color:#0B0B0D;min-height:0;padding:0 0 0 8px" id="toastbtn">${esc(action.label)}</button>` : '');
  t.className = 'on' + (action || alert ? ' alert' : '');
  if (action) $('#toastbtn').onclick = () => { t.className = ''; action.fn(); };
  if (alert) t.onclick = () => { t.className = ''; }; else t.onclick = null;
  toastT = setTimeout(() => { t.className = ''; }, ms);
}

// ---- icons & charts (inline SVG, no dependencies) ----
const P = { home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>', tasks: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', money: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>', biz: '<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>', brain: '<circle cx="12" cy="12" r="2.5"/><circle cx="5" cy="6" r="1.8"/><circle cx="19" cy="7" r="1.8"/><circle cx="6" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/><path d="M10 10.5 6.3 7.3M14 10.5l3.7-2.2M10 13.5l-2.7 3M14 13.5l2.7 3"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', trash: '<path d="M6 7h12M10 7V5h4v2M8 7l1 12h6l1-12"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>', pen: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>', cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>' };
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
const COL = ['#E6E8EC', '#A7ACB4', '#6E737B', '#C9B79C', '#8BA3B8', '#4A4E55'];
function donut(parts) { const t = parts.reduce((n, p) => n + p.value, 0); if (!t) return ''; let off = 25;
  return `<svg viewBox="0 0 42 42" class="donut" role="img" aria-label="Spending breakdown"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="#25272C" stroke-width="5"/>${parts.map((p) => { const pc = (p.value / t) * 100, s = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${p.color}" stroke-width="5" stroke-dasharray="${Math.max(pc - 0.6, 0.1)} ${100 - pc + 0.6}" stroke-dashoffset="${off}"/>`; off -= pc; return s; }).join('')}</svg>`; }
function bars(d) { const mx = Math.max(1, ...d.flatMap((x) => [x.a, x.b])), h = 100, bw = 12, gap = (300 - d.length * (bw * 2 + 3)) / (d.length + 1);
  return `<svg viewBox="0 0 300 128" class="chart" role="img" aria-label="Last six months">${d.map((x, i) => { const x0 = gap * (i + 1) + i * (bw * 2 + 3), ha = Math.max(3, Math.round((x.a / mx) * h)), hb = Math.max(3, Math.round((x.b / mx) * h));
    return `<rect class="b1" x="${x0}" y="${h - ha + 4}" width="${bw}" height="${ha}" rx="4"/><rect class="b2" x="${x0 + bw + 3}" y="${h - hb + 4}" width="${bw}" height="${hb}" rx="4"/><text x="${x0 + bw + 1}" y="124" text-anchor="middle">${x.l}</text>`; }).join('')}</svg>`; }
const six = () => Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - (5 - i)); return { t: d.getTime(), l: d.toLocaleDateString('en-ZA', { month: 'short' }).slice(0, 3) }; });
const logo = '<svg viewBox="0 0 32 32"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F5F7"/><stop offset=".5" stop-color="#C4C8CE"/><stop offset="1" stop-color="#7E848C"/></linearGradient></defs><circle cx="16" cy="16" r="15" fill="#0B0B0D" stroke="url(#lg)" stroke-width="1.2"/><text x="16" y="22" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="17" fill="url(#lg)">A</text></svg>';

// ---- shared pieces ----
const top = () => `<div class="top"><div class="brand">${logo}Anna</div><button class="ib" data-tab="data" aria-label="Settings">${ic('gear')}</button></div>`;
const title = (eye, t, sub) => `<div><div class="eyebrow">${eye}</div><h1>${t}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
const sh = (t, link = '') => `<div class="sh"><h2>${t}</h2>${link}</div>`;
const more = (tb, txt = 'See all') => `<button class="link" data-tab="${tb}">${txt}</button>`;
const empty = (t) => `<div class="empty">${t}</div>`;
const addBtn = (k, txt, cls = '') => `<button class="btn ${cls}" data-act="open" data-id="${k}">${txt}</button>`;
const editBtn = (k, id, label = 'Edit') => `<button class="edit" data-act="edit" data-k="${k}" data-id="${id}" aria-label="${label}">${ic('pen')}</button>`;
const delBtn = (k, id, label = 'Delete') => `<button class="trash" data-act="del" data-k="${k}" data-id="${id}" aria-label="${label}">${ic('trash')}</button>`;
function tasksOf() { const open = S.tasks.filter((t) => !t.completed);
  const today = open.filter((t) => (t.due_at && t.due_at < EOD) || (!t.due_at && t.priority === 'high')).sort((a, b) => (a.due_at ?? 9e15) - (b.due_at ?? 9e15));
  const upcoming = open.filter((t) => !today.includes(t)).sort((a, b) => (a.due_at ?? 9e15) - (b.due_at ?? 9e15));
  return { today, upcoming, done: S.tasks.filter((t) => t.completed).sort((a, b) => (b.completed_at ?? 0) - (a.completed_at ?? 0)) }; }
const dueChip = (t) => (!t.due_at ? '' : t.due_at < SOD ? `<span class="chip bad">Overdue · ${dstr(t.due_at)}</span>` : t.due_at < EOD ? '<span class="chip gold">Today</span>' : `<span class="chip">${dstr(t.due_at)}</span>`);
const ckBtn = (act, id, on, label) => `<button class="ck ${on ? 'on' : ''}" data-act="${act}" data-id="${id}" aria-label="${label}"><span>${ic('check')}</span></button>`;
const taskCard = (t) => `<div class="tcard ${t.priority}">${ckBtn('toggle', t.id, t.completed, t.completed ? 'Mark not done' : 'Mark done')}
  <div class="grow" data-act="edit" data-k="task" data-id="${t.id}"><div class="${t.completed ? 'done' : ''}">${esc(t.title)}</div><div>${t.priority === 'high' ? '<span class="chip gold">High priority</span>' : ''}${t.completed ? '' : dueChip(t)}${t.notes ? '<span class="chip">Note</span>' : ''}</div></div>${delBtn('task', t.id)}</div>`;
const repLabel = (r) => (L.REPEATS.find(([k]) => k === r.repeat) || [])[1];
const remCard = (r) => { const late = !r.done && r.at < Date.now();
  return `<div class="tcard ${late ? 'high' : ''}">${ckBtn('rem-done', r.id, r.done, r.done ? 'Mark not done' : r.repeat && r.repeat !== 'none' ? 'Done, schedule next' : 'Mark done')}
  <div class="grow" data-act="edit" data-k="reminder" data-id="${r.id}"><div class="${r.done ? 'done' : ''}">${esc(r.title)}</div><div><span class="chip ${late ? 'bad' : 'gold'}">${ic('bell').replace('class="i"', 'class="i" style="width:12px;height:12px;vertical-align:-1px"')} ${late ? 'Due · ' : ''}${dtstr(r.at)}</span>${r.repeat && r.repeat !== 'none' ? `<span class="chip">${esc(repLabel(r))}</span>` : ''}</div></div>
  ${r.done ? '' : `<button class="edit" data-act="rem-ics" data-id="${r.id}" aria-label="Add to iPhone Calendar">${ic('cal')}</button>`}${delBtn('reminder', r.id)}</div>`; };
const bizRow = (r) => `<div class="item"><div class="dot ${r.kind === 'expense' ? 'g' : ''}">${ic(r.kind === 'expense' ? 'money' : 'biz')}</div><div class="grow tap" data-act="edit" data-k="biz" data-id="${r.id}"><b>${esc(r.description)}</b><div class="mute">${r.kind}${r.kind === 'invoice' ? ' · ' + r.status : ''}${r.party ? ' · ' + esc(r.party) : ''} · ${dstr(r.occurred_at)}</div></div><b>${money(r.amount_cents)}</b>${delBtn('biz', r.id)}</div>`;
function activity() { const a = [];
  S.tasks.forEach((t) => { a.push({ t: t.created_at || 0, i: 'tasks', x: `Added task “${esc(t.title)}”` }); if (t.completed_at) a.push({ t: t.completed_at, i: 'check', x: `Completed “${esc(t.title)}”` }); });
  S.reminders.forEach((r) => a.push({ t: r.created_at || 0, i: 'bell', x: `Reminder “${esc(r.title)}”` }));
  S.tx.forEach((t) => a.push({ t: t.occurred_at, i: 'money', x: `${t.kind === 'income' ? 'Received' : 'Spent'} ${money(t.amount_cents)} · ${esc(t.category)}` }));
  S.biz.forEach((r) => a.push({ t: r.occurred_at, i: 'biz', x: `${r.kind[0].toUpperCase() + r.kind.slice(1)} · ${esc(r.description)}` }));
  S.mem.forEach((m) => a.push({ t: m.created_at || 0, i: 'brain', x: `Remembered “${esc(m.content.slice(0, 48))}”` }));
  return a.filter((x) => x.t).sort((x, y) => y.t - x.t).slice(0, 6); }
const aiPill = () => { const a = AI.ai; return a.state === 'ready' ? '<span class="chip good">AI ready · offline</span>' : a.state === 'cached' ? '<span class="chip gold">AI installed · tap to load</span>' : ['downloading', 'verifying', 'loading'].includes(a.state) ? '<span class="chip gold">AI preparing…</span>' : '<span class="chip">AI not installed</span>'; };

// ---- screens ----
const TABS = [['home', 'Home'], ['tasks', 'Tasks'], ['money', 'Money'], ['biz', 'Business'], ['brain', 'Brain']];
const screens = {
  home() {
    const m = L.monthSummary(S), b = L.businessSummary(S), g = tasksOf(), h = new Date().getHours(), nm = (S.settings.name || '').trim(), rem = L.pendingReminders(S).slice(0, 3);
    const dueSoon = S.bills.filter((x) => !x.paid && x.due_at < Date.now() + 7 * 864e5).length, over = L.budgetStatus(S).filter((x) => x.over).length;
    const bits = [`${g.today.length} priorit${g.today.length === 1 ? 'y' : 'ies'} today`, rem.length ? `${L.pendingReminders(S).length} reminder${L.pendingReminders(S).length > 1 ? 's' : ''}` : '', dueSoon ? `${dueSoon} bill${dueSoon > 1 ? 's' : ''} due this week` : '', over ? `${over} budget${over > 1 ? 's' : ''} over` : ''].filter(Boolean).join(' · ');
    const mo = six().map((x) => { const s = L.monthSummary(S, x.t); return { l: x.l, a: s.income, b: s.expense }; }), act = activity();
    return top() + `<div>${title(new Date().toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' }), `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}${nm ? ',<br>' + esc(nm) : ''}`, bits)}</div>
      <div class="card ask" data-act="chat-open" role="button" aria-label="Ask Anna"><div class="dot">${ic('brain')}</div><div class="grow"><b>Ask Anna</b><div class="mute">Private answers on this device, even offline</div><div>${aiPill()}</div></div><span class="mute">›</span></div>
      <div class="hero" data-tab="money"><div class="k">This month</div><div class="big">${money(m.net)}</div><div class="pills"><div class="pill"><span>Income</span><b>${money(m.income)}</b></div><div class="pill"><span>Spent</span><b>${money(m.expense)}</b></div></div><div style="margin-top:14px">${bars(mo)}</div></div>
      <div>${sh('Today’s priorities', more('tasks'))}${g.today.slice(0, 3).map(taskCard).join('') || `<div class="card">${empty('A clear day. Add a priority when you’re ready.')}</div>`}</div>
      <div>${sh('Reminders', `<button class="link" data-act="view" data-id="reminders">See all</button>`)}${rem.map(remCard).join('') || `<div class="card">${empty('No reminders set.')}</div>`}</div>
      <div>${sh('Coming up')}${g.upcoming.slice(0, 3).map(taskCard).join('') || `<div class="card">${empty('Nothing scheduled ahead.')}</div>`}</div>
      <div>${sh('Business', more('biz', 'Open'))}<div class="card" data-tab="biz"><div class="row"><div class="grow"><div class="mute">Profit this month</div><div style="font:500 28px var(--serif)" class="${b.profit < 0 ? 'neg' : 'pos'}">${money(b.profit)}</div></div><div class="r"><div class="mute">Revenue</div><b>${money(b.revenue)}</b></div></div>${b.unpaid ? `<span class="chip gold">${money(b.unpaid)} awaiting payment</span>` : ''}</div></div>
      <div>${sh('Recent activity')}<div class="card">${act.map((x) => `<div class="item"><div class="dot">${ic(x.i)}</div><div class="grow">${x.x}</div><span class="mute">${ago(x.t)}</span></div>`).join('') || empty('Your activity will appear here.')}</div></div>`;
  },
  tasks() {
    const g = tasksOf(), rem = L.pendingReminders(S), remDone = S.reminders.filter((r) => r.done).sort((a, b) => (b.done_at || 0) - (a.done_at || 0)).slice(0, 20);
    const views = [['today', `Today ${g.today.length}`], ['upcoming', `Later ${g.upcoming.length}`], ['reminders', `Reminders ${rem.length}`], ['done', `Done ${g.done.length}`]];
    let body;
    if (taskView === 'reminders') body = (rem.map(remCard).join('') || `<div class="card">${empty('No reminders. Add one with a date and time.')}</div>`) + (remDone.length ? sh('Completed reminders') + remDone.map(remCard).join('') : '') +
      `<div class="card"><h3>Alerts</h3><div class="mute">${remHelp()}</div></div>`;
    else { const list = g[taskView], all = g.today.length + g.upcoming.length + g.done.length, msg = { today: 'Nothing urgent. Enjoy the calm.', upcoming: 'No later tasks.', done: 'Completed tasks appear here.' }[taskView];
      body = list.map(taskCard).join('') || `<div class="card">${empty(all ? msg : 'Add your first task.')}</div>`; }
    return top() + title('Productivity', 'Tasks', `${g.today.length + g.upcoming.length} open · ${rem.length} reminder${rem.length === 1 ? '' : 's'} · ${g.done.length} done`) +
      `<div class="seg" role="tablist">${views.map(([k, n]) => `<button data-act="view" data-id="${k}" role="tab" aria-selected="${k === taskView}" class="${k === taskView ? 'on' : ''}">${n}</button>`).join('')}</div>` +
      `<div class="adds">${addBtn('task', '＋ Task')}${addBtn('reminder', '＋ Reminder', 'soft')}</div>` + body;
  },
  money() {
    const m = L.monthSummary(S), bs = L.budgetStatus(S), bills = S.bills.filter((b) => !b.paid).sort((a, b) => a.due_at - b.due_at), paid = S.bills.filter((b) => b.paid).sort((a, b) => (b.paid_at || 0) - (a.paid_at || 0)).slice(0, 5);
    let parts = L.spendingByCategory(S).map(([k, v], i) => ({ label: k, value: v, color: COL[i % COL.length] }));
    if (parts.length > 5) { const rest = parts.slice(5).reduce((n, p) => n + p.value, 0); parts = [...parts.slice(0, 5), { label: 'Other', value: rest, color: '#3A3D43' }]; }
    const mo = six().map((x) => { const s = L.monthSummary(S, x.t); return { l: x.l, a: s.income, b: s.expense }; });
    const tx = [...S.tx].sort((a, b) => b.occurred_at - a.occurred_at).slice(0, 40);
    return top() + title('Finances', 'Money', 'Calm, clear and entirely private') +
      `<div class="hero"><div class="k">Net this month</div><div class="big">${money(m.net)}</div><div class="pills"><div class="pill"><span>Income</span><b>${money(m.income)}</b></div><div class="pill"><span>Expenses</span><b>${money(m.expense)}</b></div></div></div>
      <div class="adds">${addBtn('tx', '＋ Entry')}${addBtn('bill', '＋ Bill', 'soft')}${addBtn('budget', '＋ Budget', 'sage')}</div>
      ${sh('Spending breakdown')}<div class="card">${parts.length ? `<div class="donutw">${donut(parts)}<div class="leg">${parts.map((p) => `<div><i style="background:${p.color}"></i>${esc(p.label)}<span>${money(p.value)}</span></div>`).join('')}</div></div>` : empty('No spending recorded this month.')}</div>
      ${sh('Cash flow')}<div class="card">${bars(mo)}<div class="key"><span><i style="background:#D9DCE1"></i>Income</span><span><i style="background:#5C6169"></i>Spent</span></div></div>
      ${sh('Budgets')}${bs.map((b) => `<div class="card"><div class="row"><b class="grow tap" data-act="edit" data-k="budget" data-id="${b.id}">${esc(b.category)}</b><span class="${b.over ? 'over' : 'mute'}">${money(b.spent)} of ${money(b.limit_cents)}</span>${editBtn('budget', b.id)}${delBtn('budget', b.id)}</div><div class="bar ${b.over ? 'over' : ''}"><i style="width:${Math.min(100, Math.round((b.spent / b.limit_cents) * 100))}%"></i></div><div class="mute" style="margin-top:6px">${b.over ? `${money(-b.left)} over budget` : `${money(b.left)} left this month`}</div></div>`).join('') || `<div class="card">${empty('Set a monthly budget for a category to keep spending gentle.')}</div>`}
      ${sh('Bills to pay')}<div class="card">${bills.map((b) => `<div class="item"><div class="grow tap" data-act="edit" data-k="bill" data-id="${b.id}"><b>${esc(b.name)}</b><div class="mute">${b.due_at < SOD ? '<span class="over">Overdue</span> · ' : ''}Due ${dstr(b.due_at)}${b.repeat_monthly ? ' · monthly' : ''}${b.last_paid_at ? ' · last paid ' + dstr(b.last_paid_at) : ''}</div></div><b>${money(b.amount_cents)}</b><button class="btn sage sm" data-act="pay" data-id="${b.id}">Paid</button>${delBtn('bill', b.id)}</div>`).join('') || empty('No unpaid bills.')}</div>
      ${paid.length ? sh('Recently paid') + `<div class="card">${paid.map((b) => `<div class="item"><div class="grow"><b>${esc(b.name)}</b><div class="mute">Paid ${dstr(b.paid_at)}</div></div><b>${money(b.amount_cents)}</b><button class="btn sage sm" data-act="unpay" data-id="${b.id}">Undo</button>${delBtn('bill', b.id)}</div>`).join('')}</div>` : ''}
      ${sh('Transactions')}<div class="card">${tx.map((t) => `<div class="item"><div class="dot ${t.kind === 'income' ? '' : 'g'}">${ic('money')}</div><div class="grow tap" data-act="edit" data-k="tx" data-id="${t.id}"><b>${esc(t.category)}</b><div class="mute">${dstr(t.occurred_at)}${t.note ? ' · ' + esc(t.note) : ''}</div></div><b class="${t.kind === 'income' ? 'pos' : ''}">${t.kind === 'income' ? '+' : '−'}${money(t.amount_cents)}</b>${delBtn('tx', t.id)}</div>`).join('') || empty('No entries yet. Tap ＋ Entry to record income or an expense.')}</div>`;
  },
  biz() {
    const b = L.businessSummary(S), mo = six().map((x) => { const s = L.businessSummary(S, x.t); return { l: x.l, a: s.revenue, b: s.expenses }; });
    const inv = S.biz.filter((r) => r.kind === 'invoice' && r.status === 'unpaid'), [m0, m1] = L.monthRange();
    const sales = S.biz.filter((r) => r.kind === 'sale' && r.occurred_at >= m0 && r.occurred_at < m1).length;
    return top() + title('Enterprise', 'Business', 'Cash basis, this month') +
      `<div class="hero"><div class="k">Profit</div><div class="big">${money(b.profit)}</div><div class="pills"><div class="pill"><span>Revenue</span><b>${money(b.revenue)}</b></div><div class="pill"><span>Expenses</span><b>${money(b.expenses)}</b></div><div class="pill"><span>Sales</span><b>${sales}</b></div></div></div>
      <div class="adds">${addBtn('biz', '＋ Record')}</div>
      ${sh('Performance')}<div class="card">${bars(mo)}<div class="key"><span><i style="background:#D9DCE1"></i>Revenue</span><span><i style="background:#5C6169"></i>Expenses</span></div></div>
      ${sh('Unpaid invoices', `<span class="mute">${money(b.unpaid)} outstanding</span>`)}<div class="card">${inv.map((r) => `<div class="item"><div class="dot g">${ic('biz')}</div><div class="grow tap" data-act="edit" data-k="biz" data-id="${r.id}"><b>${esc(r.description)}</b><div class="mute">${esc(r.party || 'Invoice')} · ${dstr(r.occurred_at)}</div></div><b>${money(r.amount_cents)}</b><button class="btn sage sm" data-act="inv-paid" data-id="${r.id}">Paid</button></div>`).join('') || empty('No unpaid invoices.')}</div>
      ${sh('All records')}<input id="bq" class="search" type="search" placeholder="Search description, customer, amount…" value="${esc(bizQ)}" aria-label="Search business records">
      <div class="card" id="bizlist">${bizList()}</div>`;
  },
  brain() {
    const cats = ['All', ...new Set(S.mem.map((m) => m.category))], sc = { confirmed: '#F0F1F3', temporary: '#A7ACB4', assumption: '#5C6169' };
    const ns = S.mem.slice(0, 16).map((m, i) => { const an = i * 2.399, r = 30 + (i % 4) * 12 + i * 3.2; return { x: 150 + Math.cos(an) * r * 1.5, y: 90 + Math.sin(an) * r * 0.8, c: sc[m.status] || sc.confirmed, i }; });
    const ghost = S.mem.length ? '' : [[70, 50], [235, 55], [90, 135], [225, 130], [150, 30]].map(([x, y], i) => `<circle class="nd" cx="${x}" cy="${y}" r="3" fill="#D9DCE1" opacity=".3" style="animation-delay:${i * .6}s"/>`).join('');
    const net = `<svg viewBox="0 0 300 180" role="img" aria-label="Your memory network"><defs><radialGradient id="gl"><stop offset="0" stop-color="#E6E8EC" stop-opacity=".7"/><stop offset="1" stop-color="#E6E8EC" stop-opacity="0"/></radialGradient></defs>
      ${ns.map((n, i) => `<line x1="150" y1="90" x2="${n.x}" y2="${n.y}" stroke="#D9DCE1" stroke-opacity=".14"/>${i > 0 ? `<line x1="${ns[i - 1].x}" y1="${ns[i - 1].y}" x2="${n.x}" y2="${n.y}" stroke="#D9DCE1" stroke-opacity=".1"/>` : ''}`).join('')}
      ${ns.map((n) => `<circle class="nd" cx="${n.x}" cy="${n.y}" r="${4 + (n.i % 3)}" fill="${n.c}" style="animation-delay:${(n.i * 0.37).toFixed(2)}s"/>`).join('')}${ghost}
      <circle cx="150" cy="90" r="26" fill="url(#gl)"/><circle cx="150" cy="90" r="13" fill="#0B0B0D" stroke="#C4C8CE"/><text x="150" y="96" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="16" fill="#E6E8EC">A</text></svg>`;
    const fbs = (S.fb || []).slice(0, 8);
    return top() + title('Mind & memory', 'Brain', 'Anna’s offline AI and what she keeps in mind. Stored only on this device.') +
      `<div id="engine">${engineHTML()}</div>${accessHTML()}
      <div class="neural">${net}<div class="cap"><span>${S.mem.length} memories</span><span>${cats.length - 1} categories</span></div></div>
      <div class="adds">${addBtn('mem', '＋ Remember')}</div>
      <input id="q" class="search" type="search" placeholder="Search memories" value="${esc(memQ)}" aria-label="Search memories">
      <div class="chips">${cats.map((c) => `<button data-act="memcat" data-id="${esc(c)}" class="${c === memCat ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>
      <div id="memlist">${memList()}</div>
      ${sh('Feedback history')}<div class="card">${fbs.map((f) => `<div class="item"><div class="dot ${f.rating === 'up' ? '' : 'g'}">${ic(f.rating === 'up' ? 'check' : 'x')}</div><div class="grow">${esc(f.text)}<div class="mute">${f.rating === 'up' ? 'Marked helpful' : 'Marked not right'} · ${ago(f.at)}</div></div></div>`).join('') || empty('Feedback you give on memories appears here.')}</div>`;
  },
  data() {
    const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
    const curOpts = [['R', 'R — South African rand'], ['$', '$ — US dollar'], ['€', '€ — euro'], ['£', '£ — pound']];
    const isCustom = !curOpts.some(([k]) => k === cur());
    return `<div class="top"><div class="brand">${logo}Settings</div><button class="ib" data-tab="home" aria-label="Close settings">${ic('x')}</button></div>` + title('Your data', 'Data & settings', 'Everything stays on this device.') +
      `<div class="card"><h2>Back up & restore</h2><div class="mute" style="margin:4px 0 12px">Safari can clear website data. Export a backup regularly and keep it in Files or iCloud. Backups include tasks, reminders, money, business, memories, chat history and settings (not the AI model).</div>
        <div class="row"><button class="btn grow" data-act="export">Export backup</button><button class="btn sage grow" data-act="import">Restore…</button></div><input id="file" type="file" accept="application/json,.json" hidden>
        ${hasPrev ? '<button class="link" data-act="undo-restore">Undo last restore / erase</button>' : ''}<div class="mute" style="margin-top:8px">${esc(L.describeCounts(L.counts(S)))}</div></div>
      <div class="card"><h2>Preferences</h2><label class="f"><span>Your name</span><input id="nm" value="${esc(S.settings.name || '')}" maxlength="40" placeholder="For your greeting" autocomplete="given-name"></label>
        <label class="f"><span>Currency</span><select id="cursel">${curOpts.map(([k, n]) => `<option value="${esc(k)}" ${k === cur() ? 'selected' : ''}>${esc(n)}</option>`).join('')}<option value="custom" ${isCustom ? 'selected' : ''}>Other symbol…</option></select></label>
        <label class="f" id="curwrap" ${isCustom ? '' : 'hidden'}><span>Currency symbol</span><input id="cur" value="${esc(isCustom ? cur() : '')}" maxlength="5"></label>
        <button class="btn soft sm" data-act="prefs">Save preferences</button></div>
      <div class="card"><h2>Reminder alerts</h2><div class="mute" style="margin:4px 0 10px">${remHelp()}</div><div class="status"><b>Notifications</b><span class="${perm === 'granted' ? 'y' : perm === 'denied' ? 'n' : 'm'}">${{ granted: 'Allowed', denied: 'Blocked (change in iPhone Settings → Notifications → Anna)', default: 'Not yet allowed', unsupported: navigator.standalone === false ? 'Open Anna from the Home Screen icon to enable' : 'Not supported in this browser' }[perm]}</span></div>
        ${perm === 'default' ? '<button class="btn sm" style="margin-top:10px" data-act="notif">Allow notifications</button>' : ''}${perm === 'granted' ? '<button class="btn sage sm" style="margin-top:10px" data-act="notif-test">Send a test alert</button>' : ''}</div>
      <div class="card"><h2>Offline diagnostics</h2><div class="mute" style="margin:4px 0 10px">Checks internet, installed app files, the AI engine and model, storage and the database. Works with no internet.</div><div class="row wrap"><button class="btn sm" data-act="diag">Run diagnostics</button>${diag ? '<button class="btn sage sm" data-act="diag-copy">Copy report</button>' : ''}</div>${diag ? `<pre class="diag" id="diagout">${esc(diag)}</pre>` : ''}</div>
      <div class="card"><h2>Storage</h2><div class="mute" id="stor">Using ${mode}. Checking persistence…</div></div>
      <div class="card"><h2>On your iPhone</h2><div class="mute">Safari → Share → <b>Add to Home Screen</b>, then always open Anna from that icon. The Home Screen app keeps its own storage, separate from Safari tabs: install the AI model and keep your data inside the one you use. Use a backup to move data between them.</div></div>
      <div class="card"><button class="btn bad full" data-act="erase">Erase all data on this device</button><div class="mute" style="margin-top:8px">The AI model is kept. Delete it in Brain if you need the space.</div></div>
      <div class="mute" style="text-align:center;margin-top:18px">Anna Web v${VERSION}${saveErr ? ' · <span class="over">Save error: ' + esc(saveErr) + '</span>' : ''}</div>`;
  },
};
const remHelp = () => 'While Anna is open you get an alert at the reminder time. iPhone web apps cannot wake themselves up when closed, so for alerts while Anna is closed tap the calendar icon on a reminder to add it to your iPhone Calendar (it alerts on time, even offline). Reminders missed while Anna was closed are shown when you open it.';
function bizList() { const rs = L.searchBiz(S, bizQ).slice(0, 80); return rs.map(bizRow).join('') || empty(S.biz.length ? 'No records match your search.' : 'No records yet. Tap ＋ Record to add a sale, expense or invoice.'); }
function memList() {
  const q = memQ.trim().toLowerCase(), ms = S.mem.filter((m) => (memCat === 'All' || m.category === memCat) && (!q || (m.content + ' ' + m.category).toLowerCase().includes(q)));
  return ms.map((m) => `<div class="card"><div class="tap" data-act="edit" data-k="mem" data-id="${m.id}" style="overflow-wrap:anywhere">${esc(m.content)}</div><div style="margin:6px 0 8px"><span class="chip">${esc(m.category)}</span><span class="chip gold">${esc(m.status)}</span>${m.helpful_count ? `<span class="chip">👍 ${m.helpful_count}</span>` : ''}${m.incorrect_count ? `<span class="chip bad">${m.incorrect_count} not right</span>` : ''}</div>
    <div class="row"><button class="fb" data-act="fb-up" data-id="${m.id}">Helpful</button><button class="fb n" data-act="fb-down" data-id="${m.id}">Not right</button><span class="grow"></span>${editBtn('mem', m.id)}${delBtn('mem', m.id, 'Forget')}</div></div>`).join('') || `<div class="card">${empty(S.mem.length ? 'No matching memories.' : 'Nothing remembered yet. Add something Anna should know, like “My VAT number is in the blue folder”.')}</div>`;
}

// ---- Anna's mind: local AI engine card, permissions, chat ----
const mb = (b) => Math.round((b || 0) / 1e6) + ' MB';
const sw = (k, label, hint) => `<div class="swrow"><div class="grow"><b>${label}</b>${hint ? `<div class="mute">${hint}</div>` : ''}</div><button class="sw ${S.settings.ai[k] ? 'on' : ''}" data-act="acc" data-id="${k}" role="switch" aria-checked="${!!S.settings.ai[k]}" aria-label="${label}"><i></i></button></div>`;
function engineHTML() {
  const a = AI.ai, st = a.state, M = AI.MODEL, p = a.progress, pct = p ? Math.min(100, Math.floor((p.loaded / (p.total || M.bytes)) * 100)) : 0;
  const pill = { unknown: ['Checking…', ''], unsupported: ['Not supported', 'bad'], absent: ['Not installed', ''], partial: ['Incomplete download', 'bad'], downloading: [`Downloading ${pct}%`, 'gold'], verifying: [`Verifying ${pct}%`, 'gold'], cached: ['Installed · not loaded', 'gold'], loading: ['Loading…', 'gold'], ready: ['Ready · works offline', 'good'] }[st] || ['Unknown', ''];
  const b = (act, t, c = '') => `<button class="btn ${c}" data-act="${act}">${t}</button>`;
  const row = { absent: b('ai-download', `Download AI model · ${mb(M.bytes)}`), partial: b('ai-download', 'Download again') + b('ai-delete', 'Delete', 'bad'), downloading: b('ai-cancel', 'Cancel download', 'sage'), verifying: '<button class="btn" disabled>Checking the file…</button>', cached: b('ai-load', 'Load into memory') + b('ai-delete', 'Delete model', 'bad'), loading: '<button class="btn" disabled>Loading… keep Anna open</button>', ready: b('chat-open', 'Ask Anna') + b('ai-unload', 'Unload', 'sage') + b('ai-delete', 'Delete model', 'bad') }[st] || '';
  const stg = a.storage ? `Browser storage: ${mb(a.storage.usage)} used of ${mb(a.storage.quota)} · ${a.storage.persisted ? 'persistent' : 'not marked persistent'}` : '';
  const prog = st === 'downloading' || st === 'verifying';
  return `<div class="card mind"><div class="row"><h2 class="grow">Anna’s offline AI</h2><span class="chip ${pill[1]}" id="pill">${pill[0]}</span></div>
    <div class="mute" style="margin:6px 0 10px">${esc(M.name)} (${M.quant}) · ${mb(M.bytes)} · runs only on this device. ${st === 'absent' ? 'One-time download over Wi-Fi; afterwards Anna answers with no internet.' : ''}</div>
    ${prog ? `<div class="bar"><i id="dlbar" style="width:${pct}%;animation:none"></i></div><div class="mute" id="dltxt" style="margin:6px 0 10px">${st === 'verifying' ? `Checking SHA-256: ${mb(p?.loaded)} of ${mb(p?.total)}` : `${mb(p?.loaded)} of ${mb(p?.total)} · keep the screen on and Anna open`}</div>` : ''}
    ${st === 'loading' ? '<div class="bar busy"><i></i></div><div class="mute" style="margin:6px 0 10px">Loading the model and running a test answer. This can take up to a minute.</div>' : ''}
    ${a.crashed && st !== 'loading' ? `<div class="warn">Last time the model was loading, the page was closed (usually iOS running out of memory). Close other apps, then try again.<br><button class="link" data-act="ai-ack">Dismiss</button></div>` : ''}
    ${a.error ? `<div class="warn">${esc(a.error)}</div>` : ''}
    ${st === 'ready' && a.info.selfTest ? `<div class="ok">Self-test passed: the model answered “${esc(a.info.selfTest.reply.slice(0, 60))}”.</div>` : ''}
    <div class="btnrow">${row}</div>
    <div class="mute" style="margin-top:10px">${a.info.bytes ? `On this device: ${mb(a.info.bytes)}${a.info.verified ? ', SHA-256 verified' : ''}. ` : ''}${a.info.loadMs ? `Loaded in ${(a.info.loadMs / 1000).toFixed(1)} s. ` : ''}${a.info.tps ? `Last speed: ${a.info.tps} tokens/s. ` : ''}${stg}</div>
    <details style="margin-top:8px"><summary class="mute" style="min-height:44px;display:flex;align-items:center;cursor:pointer">Advanced &amp; limitations</summary>
      <div class="mute" style="margin:4px 0 6px">A small model runs on the phone’s CPU, so answers take a few seconds and can be wrong: always check numbers on the Money screen. The model file is not part of backups. Checksum: <code style="overflow-wrap:anywhere">${M.sha256}</code></div>
      ${sw('gpu', 'Use GPU (experimental)', 'Faster on some devices but may crash on iPhone. Leave off unless testing. Takes effect next time you load.')}
    </details>
    <div class="row wrap" style="margin-top:6px"><button class="btn sage sm" data-act="diag">Run diagnostics</button>${diag ? '<button class="btn sage sm" data-act="diag-copy">Copy report</button>' : ''}</div>${diag && tab === 'brain' ? `<pre class="diag">${esc(diag)}</pre>` : ''}</div>`;
}
const accessHTML = () => `<div class="card"><h2>What Anna may read</h2><div class="mute" style="margin:4px 0 4px">Only switched-on categories are shown to the local model, and nothing ever leaves this device. Notes and customer names are never included, and Anna can read but never change your data.</div>${AI.ACCESS.map(([k, n]) => sw(k, n)).join('')}<button class="link" data-act="ctx-open">Preview exactly what Anna sees</button></div>`;
const SUGG = ['What should I focus on today?', 'How am I doing on money this month?', 'Which bills and invoices are unpaid?', 'Give me three tips to save on groceries.'];
const bubble = (m, i) => `<div class="bub ${m.role}${m.error ? ' err' : ''}">${m.error ? esc(m.error) : m.content ? esc(m.content).replace(/\n/g, '<br>') : '<span class="mute typing">Thinking</span>'}${m.at ? `<span class="t">${tstr(m.at)}</span>` : ''}</div>`;
function chatMain() {
  const a = AI.ai, ready = a.state === 'ready';
  let note = '';
  if (!ready) {
    const msg = { unknown: 'Checking Anna’s brain…', unsupported: 'This browser cannot run the local AI. ' + esc(a.error), absent: `Anna’s offline AI is not installed yet. It is a one-time download of about ${mb(AI.MODEL.bytes)}.`, partial: 'The model download is incomplete. Open Brain to download it again.', downloading: 'Downloading the model…', verifying: 'Checking the downloaded model…', cached: 'The model is on this device but not loaded into memory yet.', loading: 'Loading the model. This can take a minute. Keep Anna open.' }[a.state] || '';
    note = `<div class="card banner-in"><b>Anna can’t answer yet</b><div class="mute" style="margin:6px 0 12px">${msg}${S.chat.length ? ' Your past conversation is below.' : ''}</div>${a.state === 'cached' ? '<button class="btn full" data-act="ai-load">Load Anna’s brain</button>' : ['loading', 'downloading', 'verifying'].includes(a.state) ? '<div class="bar busy"><i></i></div>' : '<button class="btn full" data-act="chat-to-brain">Open Brain setup</button>'}${a.error && a.state !== 'unsupported' ? `<div class="warn" style="margin-top:10px">${esc(a.error)}</div>` : ''}</div>`;
  }
  const sugg = ready && !S.chat.length ? `<div class="empty">Ask about your day, money or business, or anything else.<br>Anna only sees what you allow in Brain.</div>${SUGG.map((q, i) => `<button class="btn sage full" style="margin:6px 0" data-act="chat-suggest" data-id="${i}">${q}</button>`).join('')}` : '';
  return `${note}<div class="msgs" id="msgs">${S.chat.map(bubble).join('')}${sugg}</div>`;
}
function chatPanel() {
  const on = AI.ACCESS.filter(([k]) => S.settings.ai[k]).map(([, n]) => n), busy = AI.ai.busy;
  return `<div class="pn chat" role="dialog" aria-label="Ask Anna"><div class="row" style="margin-bottom:8px"><div class="grow"><h2>Ask Anna</h2><div class="mute">${on.length ? 'Can read: ' + on.join(', ') : 'Can read nothing yet'} · <button class="link" style="min-height:0;padding:0" data-act="ctx-open">what’s shared</button></div></div><button class="ib" data-act="chat-clear" aria-label="Clear conversation">${ic('trash')}</button><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div>
    <div id="chatmain" class="chatmain">${chatMain()}</div>
    <form data-form="chat" class="chatin"><textarea name="msg" rows="1" placeholder="${AI.ai.state === 'ready' ? 'Ask Anna…' : 'Load the AI to ask a question'}" maxlength="800" required aria-label="Message"></textarea>${busy ? `<button type="button" class="btn sage" data-act="chat-stop" aria-label="Stop">${ic('stop')}</button>` : `<button class="btn" id="send" ${AI.ai.state === 'ready' ? '' : 'disabled'}>Send</button>`}</form></div>`;
}
const ctxPanel = () => `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="What Anna sees"><div class="gr"></div><div class="row"><h2 class="grow">What Anna sees</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div><div class="mute" style="margin:6px 0 10px">This is the complete data block given to the local model with each question (memories are picked by relevance to your question). It never leaves your device.</div><pre class="diag">${esc(AI.buildContext(S, S.settings.ai))}</pre></div>`;
const restorePanel = () => { const r = pendingRestore; if (!r) return ''; const a = L.counts(r.state), b = L.counts(S);
  return `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="Restore backup"><div class="gr"></div><div class="row"><h2 class="grow">Restore this backup?</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div>
  <div class="mute" style="margin:8px 0">File: ${esc(r.name)}${r.state.exported_at ? ' · exported ' + esc(new Date(r.state.exported_at).toLocaleString('en-ZA')) : ''}</div>
  <div class="status"><b>Backup</b><span>${esc(L.describeCounts(a))}</span><b>On this device now</b><span>${esc(L.describeCounts(b))}</span></div>
  <div class="note">Restoring <b>replaces</b> everything on this device with the backup. A safety copy of your current data is kept, so you can undo it from Settings.</div>
  <button class="btn full" data-act="restore-confirm">Replace my data with this backup</button><button class="btn sage full" style="margin-top:8px" data-act="close">Cancel</button></div>`; };
let engKey = '';
const paintEngine = () => { const e = $('#engine'); if (!e) return; const a = AI.ai, key = [a.state, a.error, a.crashed, diag, JSON.stringify(a.info), JSON.stringify(a.storage), JSON.stringify(S.settings.ai)].join('|');
  if (key === engKey && (a.state === 'downloading' || a.state === 'verifying') && $('#dlbar')) { const p = a.progress, pct = p ? Math.min(100, Math.floor((p.loaded / (p.total || AI.MODEL.bytes)) * 100)) : 0; $('#dlbar').style.width = pct + '%'; $('#dltxt').textContent = a.state === 'verifying' ? `Checking SHA-256: ${mb(p?.loaded)} of ${mb(p?.total)}` : `${mb(p?.loaded)} of ${mb(p?.total)} · keep the screen on and Anna open`; $('#pill').textContent = `${a.state === 'verifying' ? 'Verifying' : 'Downloading'} ${pct}%`; return; }
  const open = e.querySelector('details')?.open; engKey = key; e.innerHTML = engineHTML(); if (open) e.querySelector('details').open = true; };
let chatKey = '';
const paintChat = (force) => { const m = $('#chatmain'); if (!m) return; const a = AI.ai, key = a.state + a.busy + a.error;
  if (!force && key !== chatKey) { chatKey = key; const ta = $('.chatin textarea'), v = ta?.value, foc = document.activeElement === ta; $('#sheet').innerHTML = chatPanel(); const t2 = $('.chatin textarea'); if (t2) { t2.value = v || ''; if (foc) t2.focus(); } }
  const mm = $('#chatmain'), o = $('#msgs'), near = !o || o.scrollHeight - o.scrollTop - o.clientHeight < 120; mm.innerHTML = chatMain(); const x = $('#msgs'); if (x && near) mm.scrollTop = mm.scrollHeight; };
const warmChat = () => { if (AI.ai.state === 'ready' && !AI.ai.busy) AI.warm(AI.buildMessages(AI.buildContext(S, S.settings.ai, Date.now(), ''), S.chat, '', cur()).slice(0, -1)); };
async function sendChat(text) {
  text = text.trim(); if (!text || AI.ai.state !== 'ready' || AI.ai.busy) return;
  const hist = S.chat.slice(), a = { role: 'assistant', content: '', at: 0 }; S.chat.push({ role: 'user', content: text, at: Date.now() }, a); paintChat(true); save();
  try {
    const ctx = AI.buildContext(S, S.settings.ai, Date.now(), text);
    await AI.ask(AI.buildMessages(ctx, hist, text, cur()), (t) => { a.content = t; paintChat(true); });
    a.content = a.content.trim().replace(/^[.,:;]+(?=\s*\S)/, '').trim(); if (!a.content) a.content = '(Anna produced no answer. Try rephrasing.)';
  } catch (e) { a.content = ''; a.error = AI.friendly(e); }
  a.at = Date.now(); paintChat(); await save();
}
const fld = (l, inner) => `<label class="f"><span>${l}</span>${inner}</label>`;
const opt = (v, n, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(n)}</option>`;
const val = (x) => `value="${esc(x ?? '')}"`;
const catList = (id, xs) => `<datalist id="${id}">${[...new Set(xs.filter(Boolean))].slice(0, 40).map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;
const FORMS = {
  task: (r = {}) => [r.id ? 'Edit task' : 'New task', `${fld('Task', `<input name="title" placeholder="What needs doing?" maxlength="200" required ${val(r.title)}>`)}<div class="two">${fld('Due date', `<input name="due" type="date" ${val(L.tsToDay(r.due_at))}>`)}${fld('Priority', `<select name="priority">${opt('normal', 'Normal', r.priority || 'normal')}${opt('high', 'High', r.priority)}${opt('low', 'Low', r.priority)}</select>`)}</div>${fld('Notes', `<textarea name="notes" rows="2" placeholder="Optional" maxlength="500">${esc(r.notes || '')}</textarea>`)}`, r.id ? 'Save task' : 'Add task'],
  reminder: (r = {}) => { const at = r.at || (() => { const d = new Date(Date.now() + 36e5); d.setMinutes(0, 0, 0); return d.getTime(); })();
    return [r.id ? 'Edit reminder' : 'New reminder', `${fld('Remind me to', `<input name="title" placeholder="e.g. Pay the domestic worker" maxlength="200" required ${val(r.title)}>`)}<div class="two">${fld('Date', `<input name="day" type="date" required ${val(L.tsToDay(at))}>`)}${fld('Time', `<input name="time" type="time" required ${val(L.tsToTime(at))}>`)}</div>${fld('Repeat', `<select name="repeat">${L.REPEATS.map(([k, n]) => opt(k, n, r.repeat || 'none')).join('')}</select>`)}${fld('Notes', `<textarea name="notes" rows="2" placeholder="Optional" maxlength="500">${esc(r.notes || '')}</textarea>`)}`, r.id ? 'Save reminder' : 'Set reminder']; },
  tx: (r = {}) => [r.id ? 'Edit entry' : 'New entry', `<div class="two">${fld('Type', `<select name="kind">${opt('expense', 'Expense', r.kind || 'expense')}${opt('income', 'Income', r.kind)}</select>`)}${fld(`Amount (${esc(cur())})`, `<input name="amount" inputmode="decimal" placeholder="0,00" required ${r.id ? val(L.centsToInput(r.amount_cents)) : ''}>`)}</div>${fld('Category', `<input name="category" placeholder="e.g. Groceries" maxlength="40" list="cats" ${val(r.category)}>`)}${catList('cats', [...S.tx.map((t) => t.category), ...S.budgets.map((b) => b.category), 'Groceries', 'Transport', 'Salary', 'Rent', 'Electricity', 'Airtime & data', 'Eating out', 'Medical'])}<div class="two">${fld('Date', `<input name="date" type="date" required ${val(L.tsToDay(r.occurred_at || Date.now()))}>`)}${fld('Note', `<input name="note" placeholder="Optional" maxlength="200" ${val(r.note)}>`)}</div>`, r.id ? 'Save entry' : 'Save entry'],
  bill: (r = {}) => [r.id ? 'Edit bill' : 'New bill', `${fld('Bill', `<input name="name" placeholder="e.g. Rent" maxlength="80" required ${val(r.name)}>`)}<div class="two">${fld(`Amount (${esc(cur())})`, `<input name="amount" inputmode="decimal" placeholder="0,00" required ${r.id ? val(L.centsToInput(r.amount_cents)) : ''}>`)}${fld('Due date', `<input name="due" type="date" required ${val(L.tsToDay(r.due_at))}>`)}</div><label class="cb"><input type="checkbox" name="monthly" ${r.repeat_monthly ? 'checked' : ''}> Repeats monthly</label>${r.id ? `<label class="cb"><input type="checkbox" name="paid" ${r.paid ? 'checked' : ''}> Paid</label>` : ''}`, r.id ? 'Save bill' : 'Add bill'],
  budget: (r = {}) => [r.id ? 'Edit budget' : 'Monthly budget', `${fld('Category', `<input name="category" placeholder="e.g. Groceries" maxlength="40" required list="cats" ${val(r.category)}>`)}${catList('cats', S.tx.map((t) => t.category))}${fld(`Monthly limit (${esc(cur())})`, `<input name="limit" inputmode="decimal" placeholder="0,00" required ${r.id ? val(L.centsToInput(r.limit_cents)) : ''}>`)}<div class="mute">Expenses with the same category count towards this budget.</div>`, r.id ? 'Save budget' : 'Set budget'],
  biz: (r = {}) => [r.id ? 'Edit business record' : 'Business record', `<div class="two">${fld('Type', `<select name="kind">${opt('sale', 'Sale', r.kind || 'sale')}${opt('expense', 'Expense', r.kind)}${opt('invoice', 'Invoice', r.kind)}</select>`)}${fld(`Amount (${esc(cur())})`, `<input name="amount" inputmode="decimal" placeholder="0,00" required ${r.id ? val(L.centsToInput(r.amount_cents)) : ''}>`)}</div>${fld('Description', `<input name="description" placeholder="What was it for?" maxlength="200" required ${val(r.description)}>`)}${fld('Customer / supplier', `<input name="party" placeholder="Optional" maxlength="80" ${val(r.party)}>`)}<div class="two">${fld('Date', `<input name="date" type="date" required ${val(L.tsToDay(r.occurred_at || Date.now()))}>`)}${fld('Invoice status', `<select name="status">${opt('unpaid', 'Unpaid', r.status || 'unpaid')}${opt('paid', 'Paid', r.status)}</select>`)}</div>${fld('Notes', `<textarea name="notes" rows="2" placeholder="Optional" maxlength="500">${esc(r.notes || '')}</textarea>`)}<div class="mute">Invoice status only applies to invoices.</div>`, r.id ? 'Save record' : 'Save record'],
  mem: (r = {}) => [r.id ? 'Edit memory' : 'Remember', `${fld('Memory', `<textarea name="content" rows="3" placeholder="e.g. I do my best work in the morning" maxlength="500" required>${esc(r.content || '')}</textarea>`)}<div class="two">${fld('Confidence', `<select name="status">${opt('confirmed', 'Confirmed', r.status || 'confirmed')}${opt('temporary', 'Temporary', r.status)}${opt('assumption', 'Assumption', r.status)}</select>`)}${fld('Category', `<input name="category" maxlength="40" list="mcats" ${val(r.category || 'General')}>`)}</div>${catList('mcats', [...S.mem.map((m) => m.category), 'General', 'Personal', 'Work', 'Health', 'Family', 'Money'])}<div class="mute">Assumptions are never shown to the AI.</div>`, r.id ? 'Save memory' : 'Remember'],
};
const KEY = { task: 'tasks', reminder: 'reminders', tx: 'tx', bill: 'bills', budget: 'budgets', biz: 'biz', mem: 'mem' };
const NAME = { task: 'Task', reminder: 'Reminder', tx: 'Entry', bill: 'Bill', budget: 'Budget', biz: 'Record', mem: 'Memory' };
function render(anim) {
  const now = new Date(); SOD = new Date(now).setHours(0, 0, 0, 0); EOD = SOD + 864e5;
  const el = $('#screen'), y = scrollY; el.innerHTML = screens[tab]();
  if (anim) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); } else scrollTo(0, y);
  $('#tabs').innerHTML = TABS.map(([k, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}" aria-label="${n}" ${k === tab ? 'aria-current="page"' : ''}>${ic(k)}${n}</button>`).join('');
  const rec = editId ? S[KEY[sheet]]?.find((x) => x.id === editId) : undefined, f = FORMS[sheet]?.(rec);
  const special = sheet === 'chat' ? chatPanel() : sheet === 'ctx' ? ctxPanel() : sheet === 'restore' ? restorePanel() : '';
  $('#sheet').innerHTML = special ? special : f ? `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="${f[0]}"><div class="gr"></div><div class="row"><h2 class="grow">${f[0]}</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div><form data-form="${sheet}" novalidate>${f[1]}<button class="btn full" style="margin-top:14px">${f[2]}</button>${rec ? `<button type="button" class="btn bad full" style="margin-top:8px" data-act="del" data-k="${sheet}" data-id="${rec.id}">Delete ${NAME[sheet].toLowerCase()}</button>` : ''}</form></div>` : '';
  document.body.classList.toggle('lock', !!(f || special));
  if (sheet === 'chat') { chatKey = AI.ai.state + AI.ai.busy + AI.ai.error; const x = $('#chatmain'); if (x) x.scrollTop = x.scrollHeight; }
  if ((tab === 'brain' || tab === 'home') && AI.ai.state === 'unknown') AI.refresh();
  if (tab === 'data') navigator.storage?.persisted?.().then((p) => { const e = $('#stor'); if (e) e.textContent = `Using ${mode === 'indexeddb' ? 'IndexedDB (best)' : mode}. ${p ? 'The browser has marked this storage as persistent.' : 'Not marked persistent yet: back up often. Adding Anna to the Home Screen helps.'}`; });
}

// ---- reminders: check every 15 s while open; notify once per occurrence ----
async function notify(title, body) {
  try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) { await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'anna-' + Date.now() }); return true; } new Notification(title, { body, icon: 'icons/icon-192.png' }); return true; } } catch {}
  return false;
}
let firstCheck = true;
async function checkReminders() {
  const due = L.dueReminders(S); if (!due.length) { firstCheck = false; return; }
  const missed = firstCheck ? due.filter((r) => r.at < Date.now() - 2 * 6e4) : [];
  due.forEach((r) => { r.notified = 1; });
  await save();
  if (missed.length) toast(`Missed while Anna was closed: ${missed.map((r) => r.title).join(', ')}`, { alert: true, ms: 9000, action: { label: 'View', fn: () => { tab = 'tasks'; taskView = 'reminders'; render(true); } } });
  for (const r of due.filter((x) => !missed.includes(x))) { await notify('Anna reminder', r.title); toast(`⏰ ${r.title}`, { alert: true, ms: 12000, action: { label: 'Done', fn: () => mutate(() => L.completeReminder(S, r.id), { close: false }) } }); }
  firstCheck = false; if (!sheet && (tab === 'home' || tab === 'tasks')) render();
}

// ---- diagnostics: works fully offline ----
async function runDiagnostics() {
  const out = [`Anna Web ${VERSION} diagnostics · ${new Date().toLocaleString('en-ZA')}`, `Device: ${navigator.userAgent}`, `Opened from Home Screen: ${navigator.standalone === true || matchMedia('(display-mode: standalone)').matches ? 'yes' : 'no'}`];
  let online = navigator.onLine; try { const r = await fetch('manifest.webmanifest?probe=' + Date.now(), { cache: 'no-store' }); online = online && r.ok && !r.headers.get('x-from-cache'); } catch { online = false; }
  out.push(`Internet: ${navigator.onLine ? (online ? 'connected' : 'browser says online but the site did not answer') : 'offline'} (Anna does not need it after setup)`);
  try { await kvSet('diag', Date.now()); const v = await kvGet('diag'); out.push(`Database: ${mode}${mode === 'indexeddb' ? ' (best)' : ''}, read/write ${v ? 'OK' : 'FAILED'}; ${L.describeCounts(L.counts(S))}`); } catch (e) { out.push('Database: FAILED ' + e.message); }
  try { const e = await navigator.storage.estimate(); out.push(`Storage: ${mb(e.usage)} used of ${mb(e.quota)} available to Anna; persistent=${await navigator.storage.persisted()}`); } catch (e) { out.push('Storage estimate unavailable: ' + e.message); }
  try {
    const reg = await navigator.serviceWorker?.getRegistration(), keys = await caches.keys(), app = keys.find((k) => k === 'anna-web-' + VERSION), eng = keys.find((k) => k.startsWith('anna-engine-'));
    const appN = app ? (await (await caches.open(app)).keys()).length : 0, engN = eng ? (await (await caches.open(eng)).keys()).length : 0;
    out.push(`Offline app files: service worker ${reg?.active ? 'active' : 'NOT active'}${navigator.serviceWorker?.controller ? ', controlling this page' : ', not yet controlling this page (reopen Anna)'}; app cache ${app ? appN + ' files' : 'MISSING'}; AI engine cache ${eng ? `${eng.replace('anna-engine-', 'wllama ')} (${engN}/4 files)` : 'MISSING'}`);
    if (!eng || engN < 4) navigator.serviceWorker?.controller?.postMessage('cache-engine');
  } catch (e) { out.push('Cache check failed: ' + e.message); }
  out.push(`Notifications: ${typeof Notification === 'undefined' ? 'not available here' : Notification.permission}; pending reminders: ${L.pendingReminders(S).length}`);
  out.push(...(await AI.aiDiagnostics()));
  const ok = (s) => out.some((l) => l.includes(s));
  const ready = !ok('MISSING') && !ok('NOT active') && AI.ai.info.verified;
  out.push('', ready ? 'VERDICT: Ready for offline use. You can turn on Airplane Mode.' : `VERDICT: Not fully ready for offline use. ${AI.ai.info.verified ? '' : 'Install the AI model in Brain (on Wi-Fi). '}${ok('MISSING') || ok('NOT active') ? 'Open Anna once more with internet so it can finish caching its files.' : ''}`);
  return out.join('\n');
}

// ---- actions ----
const byId = (arr, id) => arr.find((x) => x.id === id);
const rate = (id, rating) => mutate(() => { const m = byId(S.mem, id); if (!m) return; if (rating === 'up') m.helpful_count = (m.helpful_count || 0) + 1; else m.incorrect_count = (m.incorrect_count || 0) + 1; S.fb.unshift({ id: L.uid(), mem: id, text: m.content.slice(0, 80), rating, at: Date.now() }); S.fb = S.fb.slice(0, 200); }, { close: false });
function download(name, text, type) {
  const blob = new Blob([text], { type }), file = new File([blob], name, { type });
  return (async () => {
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; } }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return 'downloaded';
  })();
}
const actions = {
  toggle: (id) => mutate(() => { const t = byId(S.tasks, id); t.completed = t.completed ? 0 : 1; t.completed_at = t.completed ? Date.now() : null; }, { close: false }),
  'rem-done': (id) => { const r = byId(S.reminders, id), rep = r && !r.done && r.repeat && r.repeat !== 'none'; mutate(() => L.completeReminder(S, id), { close: false }); if (rep) toast(`Next: ${dtstr(byId(S.reminders, id).at)}`); },
  'rem-ics': async (id) => { const r = byId(S.reminders, id); if (!r) return; const res = await download(`anna-reminder-${L.tsToDay(r.at)}.ics`, L.reminderICS(r), 'text/calendar'); if (res !== 'cancelled') toast('Open the file and tap “Add to Calendar” so your iPhone alerts you even when Anna is closed.', { ms: 6000 }); },
  del: (id, el) => { const k = el.dataset.k, key = KEY[k], arr = S[key], i = arr.findIndex((x) => x.id === id); if (i < 0) return; const item = arr[i];
    mutate(() => { S[key] = arr.filter((x) => x.id !== id); }); undo = { key, item, i };
    toast(`${NAME[k]} deleted`, { ms: 6000, action: { label: 'Undo', fn: () => { if (!undo) return; const u = undo; undo = null; mutate(() => { S[u.key].splice(Math.min(u.i, S[u.key].length), 0, u.item); }, { close: false }); } } }); },
  edit: (id, el) => { sheet = el.dataset.k; editId = id; render(); },
  view: (id) => { tab = 'tasks'; taskView = id; sheet = null; render(true); },
  'chat-open': () => { sheet = 'chat'; render(); AI.refresh(); warmChat(); }, 'ctx-open': () => { sheet = 'ctx'; render(); },
  'chat-clear': () => { if (!S.chat.length || confirm('Clear the whole conversation? This cannot be undone (it is also removed from future backups).')) { S.chat = []; save(); paintChat(true); } },
  'chat-stop': () => AI.stop(),
  'chat-suggest': (i) => sendChat(SUGG[i]), 'chat-to-brain': () => { sheet = null; tab = 'brain'; render(true); scrollTo(0, 0); },
  'ai-download': () => { if (!navigator.onLine) return toast('You are offline. Connect to Wi-Fi to download the model.'); AI.download(); },
  'ai-cancel': () => AI.cancelDownload(), 'ai-load': () => AI.load({ gpu: S.settings.ai.gpu }), 'ai-unload': () => AI.unload(), 'ai-ack': () => AI.ackCrash(),
  'ai-delete': () => { if (confirm(`Delete the AI model (${mb(AI.MODEL.bytes)}) from this device? You will need internet to download it again. Your data is not affected.`)) AI.remove(); },
  diag: async () => { diag = 'Running diagnostics…'; tab === 'data' ? render() : paintEngine(); diag = await runDiagnostics(); tab === 'data' ? render() : paintEngine(); },
  'diag-copy': async () => { try { await navigator.clipboard.writeText(diag); toast('Report copied.'); } catch { prompt('Copy this report:', diag); } },
  acc: (id) => mutate(() => { S.settings.ai[id] = !S.settings.ai[id]; }, { close: false }),
  memcat: (id) => { memCat = id; render(); },
  open: (id) => { sheet = id; editId = null; render(); }, close: () => { sheet = null; editId = null; pendingRestore = null; render(); },
  'fb-up': (id) => rate(id, 'up'), 'fb-down': (id) => rate(id, 'down'),
  pay: (id) => { const b = byId(S.bills, id); const rec = confirm(`Mark “${b.name}” as paid and record ${L.fmt(b.amount_cents, cur())} as an expense in Money?\n\nOK = paid + record expense\nCancel = just mark paid`); mutate(() => L.payBill(S, id, { recordExpense: rec }), { close: false }); toast(b.repeat_monthly ? `Paid. Next due ${dstr(b.due_at)}.` : 'Marked paid.'); },
  unpay: (id) => mutate(() => L.unpayBill(S, id), { close: false }),
  'inv-paid': (id) => mutate(() => { const r = byId(S.biz, id); r.status = 'paid'; r.paid_at = Date.now(); }, { close: false }),
  export: async () => { const data = { ...S, exported_at: Date.now(), app_version: VERSION }, name = `anna-backup-${L.tsToDay(Date.now())}.json`; const r = await download(name, JSON.stringify(data, null, 1), 'application/json'); if (r !== 'cancelled') { S.settings.last_backup_at = Date.now(); save(); toast(`Backup ready: ${L.describeCounts(L.counts(S))}.`, { ms: 5000 }); } },
  import: () => $('#file').click(),
  'restore-confirm': async () => {
    const r = pendingRestore; if (!r) return; pendingRestore = null; sheet = null;
    await kvSet('prev', S); hasPrev = true; S = r.state; delete S.exported_at; delete S.app_version; normSettings(); await save();
    const check = L.validateBackup(await kvGet('state')), want = JSON.stringify(L.counts(r.state)), got = check.ok ? JSON.stringify(L.counts(check.state)) : '';
    render(true); toast(got === want ? `Restored and verified: ${L.describeCounts(L.counts(S))}.` : 'Restore saved, but verification did not match. Export a backup and check your data.', { alert: true, ms: 8000 });
  },
  'undo-restore': async () => { const p = await kvGet('prev'); const v = p && L.validateBackup(p); if (!v?.ok) return toast('No safety copy available.'); if (!confirm(`Put back the data from before your last restore/erase? (${L.describeCounts(L.counts(v.state))})`)) return; const curS = S; S = v.state; normSettings(); await save(); await kvSet('prev', curS); render(true); toast('Previous data restored.'); },
  prefs: () => { const sel = $('#cursel').value, c = sel === 'custom' ? ($('#cur').value || '').trim().slice(0, 5) : sel; mutate(() => { S.settings.currency = c || L.DEFAULT_CURRENCY; S.settings.name = ($('#nm').value || '').trim().slice(0, 40); }); toast('Preferences saved.'); },
  notif: async () => { try { const p = await Notification.requestPermission(); render(); if (p === 'granted') notify('Anna', 'Reminder alerts are on.'); } catch { toast('This browser cannot show notifications. Open Anna from the Home Screen icon.'); } },
  'notif-test': async () => { const ok = await notify('Anna', 'This is how reminders will look.'); toast(ok ? 'Test alert sent.' : 'Could not show a notification.'); },
  erase: async () => { if (confirm('Erase ALL Anna data on this device (tasks, reminders, money, business, memories, chat)? Export a backup first.') && confirm('Really erase everything? (A safety copy is kept so you can undo once.)')) { await kvSet('prev', S); hasPrev = true; S = L.emptyState(); normSettings(); await save(); tab = 'home'; render(true); toast('All data erased.', { action: { label: 'Undo', fn: () => actions['undo-restore']() } }); } },
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab],[data-act]'); if (!t) return;
  if (t.dataset.tab) { if (t.dataset.tab !== tab || sheet) { tab = t.dataset.tab; sheet = null; editId = null; render(true); scrollTo(0, 0); } } else actions[t.dataset.act]?.(t.dataset.id, t);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { memQ = e.target.value; $('#memlist').innerHTML = memList(); }
  if (e.target.id === 'bq') { bizQ = e.target.value; $('#bizlist').innerHTML = bizList(); }
  if (e.target.matches('.chatin textarea')) { e.target.style.height = 'auto'; e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px'; }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && e.target.matches('.chatin textarea') && !matchMedia('(pointer:coarse)').matches) { e.preventDefault(); e.target.form.requestSubmit(); } if (e.key === 'Escape' && sheet) actions.close(); });
document.addEventListener('change', async (e) => {
  if (e.target.id === 'cursel') { $('#curwrap').hidden = e.target.value !== 'custom'; return; }
  if (e.target.id !== 'file' || !e.target.files[0]) return;
  const file = e.target.files[0], r = L.validateBackup(await file.text()); e.target.value = '';
  if (!r.ok) return toast(r.error, { alert: true, ms: 6000 });
  pendingRestore = { name: file.name, state: r.state }; sheet = 'restore'; render();
});
// Keyboard handling: hide the floating tab bar while typing and keep the focused field in view.
const typing = (t) => t.matches?.('input:not([type=checkbox]):not([type=file]),textarea,select');
document.addEventListener('focusin', (e) => { if (typing(e.target)) { document.body.classList.add('kb'); setTimeout(() => !e.target.closest('.chat') && e.target.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 320); } });
document.addEventListener('focusout', () => setTimeout(() => { if (!typing(document.activeElement || document.body)) document.body.classList.remove('kb'); }, 80));
const req = (f, names) => names.find((n) => !String(f[n] ?? '').trim());
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]'); if (!form) return; e.preventDefault();
  const f = Object.fromEntries(new FormData(form)), now = Date.now(), k = form.dataset.form, rec = editId ? byId(S[KEY[k]] || [], editId) : null;
  if (k === 'chat') { const ta = form.querySelector('textarea'), t = ta.value; ta.value = ''; ta.style.height = ''; return sendChat(t); }
  const missing = req(f, { task: ['title'], reminder: ['title', 'day', 'time'], tx: ['amount'], bill: ['name', 'amount', 'due'], budget: ['category', 'limit'], biz: ['amount', 'description'], mem: ['content'] }[k] || []);
  if (missing) { const el = form.querySelector(`[name=${missing}]`); el?.focus(); return toast('Please fill in: ' + (el?.closest('label')?.querySelector('span')?.textContent || missing)); }
  const up = (obj) => mutate(() => { if (rec) Object.assign(rec, obj); else S[KEY[k]][k === 'tx' || k === 'bill' || k === 'biz' || k === 'budget' ? 'push' : 'unshift']({ id: L.uid(), ...obj }); });
  const sameDay = (iso, old) => (old && L.tsToDay(old) === iso ? old : iso === L.tsToDay(now) ? now : L.dayTs(iso));
  if (k === 'task') return up({ title: f.title.trim(), notes: f.notes.trim() || null, due_at: L.dayTs(f.due), priority: f.priority, ...(rec ? {} : { completed: 0, completed_at: null, created_at: now }) });
  if (k === 'reminder') { const at = L.dateTimeTs(f.day, f.time); if (!at) return toast('Please choose a valid date and time.'); if (!rec && at < now - 6e4) return toast('That time has already passed. Choose a time in the future.'); up({ title: f.title.trim(), notes: f.notes.trim() || null, at, repeat: f.repeat, notified: rec && rec.at === at ? rec.notified : 0, ...(rec ? {} : { done: 0, done_at: null, created_at: now }) }); return toast(`Reminder set for ${dtstr(at)}.`); }
  if (k === 'mem') return up({ content: f.content.trim(), category: f.category.trim() || 'General', status: f.status, ...(rec ? {} : { created_at: now }) });
  const cents = L.parseCents(f.amount ?? f.limit); if (cents === null) return toast('Enter an amount like 150 or 12,50 (more than zero).');
  if (k === 'tx') return up({ kind: f.kind, amount_cents: cents, category: f.category.trim() || 'General', note: f.note.trim() || null, occurred_at: sameDay(f.date, rec?.occurred_at) });
  if (k === 'bill') return up({ name: f.name.trim(), amount_cents: cents, due_at: L.dayTs(f.due), repeat_monthly: f.monthly ? 1 : 0, ...(rec ? { paid: f.paid ? 1 : 0, paid_at: f.paid ? rec.paid_at || now : null } : { paid: 0, paid_at: null }) });
  if (k === 'budget') { const dup = S.budgets.find((x) => x.category.toLowerCase() === f.category.trim().toLowerCase() && x.id !== rec?.id); if (dup) return mutate(() => { dup.limit_cents = cents; if (rec) S.budgets = S.budgets.filter((x) => x.id !== rec.id); }); return up({ category: f.category.trim(), limit_cents: cents }); }
  if (k === 'biz') { const inv = f.kind === 'invoice', paid = !inv || f.status === 'paid', at = sameDay(f.date, rec?.occurred_at); return up({ kind: f.kind, party: f.party.trim() || null, description: f.description.trim(), notes: f.notes.trim() || null, amount_cents: cents, status: paid ? 'paid' : 'unpaid', occurred_at: at, paid_at: paid ? (inv ? rec?.paid_at || now : at) : null }); }
});

// ---- start ----
(async () => {
  const saved = await kvGet('state'); if (saved) { const v = L.validateBackup(saved); if (v.ok) S = v.state; else { await kvSet('corrupt-' + Date.now(), saved); toast('Saved data could not be read; a copy was kept. Restore a backup in Settings.', { alert: true, ms: 9000 }); } }
  hasPrev = !!(await kvGet('prev'));
  normSettings(); navigator.storage?.persist?.().catch(() => {});
  let lastState = ''; AI.onAi((a) => { if (a.state === 'ready' && lastState !== 'ready') setTimeout(warmChat, 50); lastState = a.state; paintEngine(); if (sheet === 'chat') paintChat(); if (tab === 'home' && !sheet) { const p = document.querySelector('.ask .chip'); if (p) p.outerHTML = aiPill(); } });
  const vv = window.visualViewport; if (vv) { const u = () => { document.documentElement.style.setProperty('--vvh', vv.height + 'px'); document.documentElement.style.setProperty('--vvt', vv.offsetTop + 'px'); }; vv.addEventListener('resize', u); vv.addEventListener('scroll', u); u(); }
  banner(); render(true); await save();
  AI.refresh();
  checkReminders(); setInterval(checkReminders, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminders(); if (tab === 'home' && !sheet) render(); } });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  window.__anna = { get S() { return S; }, AI, L, VERSION, checkReminders, runDiagnostics }; // used by automated tests
})();
