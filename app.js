// ANNA WEB v0.3.0 — premium redesign + local offline AI. Same data, same logic, same IndexedDB as v0.1.0 (additive fields only).
import * as L from './logic.js';
import * as AI from './ai.js';
export const VERSION = '0.3.0';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- storage: IndexedDB, falling back to localStorage, then memory (with a visible warning) ----
let mode = 'indexeddb', mem = {};
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('anna-web', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function kvGet(k) {
  try { const db = await idb(); return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => rej(q.error); }); }
  catch { mode = 'localstorage'; try { return JSON.parse(localStorage.getItem('anna-web:' + k) || 'null'); } catch { mode = 'memory'; return mem[k] ?? null; } }
}
async function kvSet(k, v) {
  if (mode === 'indexeddb') { try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); return; } catch { mode = 'localstorage'; } }
  if (mode === 'localstorage') { try { localStorage.setItem('anna-web:' + k, JSON.stringify(v)); return; } catch { mode = 'memory'; } }
  mem[k] = v; banner();
}
function banner() { const b = $('#banner'); b.hidden = mode !== 'memory'; b.textContent = 'This browser is blocking storage (private mode?). Anna cannot save. Export a backup before closing.'; }

let S = L.emptyState(), tab = 'home', sheet = null, taskView = 'today', memCat = 'All', memQ = '', saveErr = '', SOD = 0, EOD = 0, chat = [];
const save = async () => { try { await kvSet('state', S); saveErr = ''; } catch (e) { saveErr = String(e); } };
const mutate = async (fn) => { fn(); sheet = null; render(); await save(); if (saveErr) render(); };
const cur = () => S.settings.currency || '$';
const money = (c) => esc(L.fmt(c, cur()));
const dstr = (t) => (t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
const ago = (t) => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; };
const err = (m) => alert(m);
const normSettings = () => { S.settings.ai = { tasks: false, money: false, biz: false, mem: false, gpu: false, ...(S.settings.ai || {}) }; };

// ---- icons & charts (inline SVG, no dependencies) ----
const P = { home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>', tasks: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', money: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>', biz: '<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>', brain: '<circle cx="12" cy="12" r="2.5"/><circle cx="5" cy="6" r="1.8"/><circle cx="19" cy="7" r="1.8"/><circle cx="6" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/><path d="M10 10.5 6.3 7.3M14 10.5l3.7-2.2M10 13.5l-2.7 3M14 13.5l2.7 3"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', trash: '<path d="M6 7h12M10 7V5h4v2M8 7l1 12h6l1-12"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>' };
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
const COL = ['#0F4D3A', '#B8985A', '#6F9B7E', '#D8C79B', '#3C7A62', '#A9BFAA'];
function donut(parts) { const t = parts.reduce((n, p) => n + p.value, 0); if (!t) return ''; let off = 25;
  return `<svg viewBox="0 0 42 42" class="donut" role="img" aria-label="Spending breakdown"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="#E7EEE4" stroke-width="5"/>${parts.map((p) => { const pc = (p.value / t) * 100, s = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${p.color}" stroke-width="5" stroke-dasharray="${Math.max(pc - 0.6, 0.1)} ${100 - pc + 0.6}" stroke-dashoffset="${off}"/>`; off -= pc; return s; }).join('')}</svg>`; }
function bars(d, dark) { const mx = Math.max(1, ...d.flatMap((x) => [x.a, x.b])), h = 100, bw = 12, gap = (300 - d.length * (bw * 2 + 3)) / (d.length + 1);
  return `<svg viewBox="0 0 300 128" class="chart ${dark ? 'dk' : ''}" role="img" aria-label="Last six months">${d.map((x, i) => { const x0 = gap * (i + 1) + i * (bw * 2 + 3), ha = Math.max(3, Math.round((x.a / mx) * h)), hb = Math.max(3, Math.round((x.b / mx) * h));
    return `<rect class="b1" x="${x0}" y="${h - ha + 4}" width="${bw}" height="${ha}" rx="4"/><rect class="b2" x="${x0 + bw + 3}" y="${h - hb + 4}" width="${bw}" height="${hb}" rx="4"/><text x="${x0 + bw + 1}" y="124" text-anchor="middle">${x.l}</text>`; }).join('')}</svg>`; }
const six = () => Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - (5 - i)); return { t: d.getTime(), l: d.toLocaleDateString(undefined, { month: 'short' }).slice(0, 3) }; });
const logo = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#0F4D3A"/><circle cx="16" cy="16" r="13.2" fill="none" stroke="#B8985A" stroke-width=".8"/><text x="16" y="22" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="17" fill="#E9D9AE">A</text></svg>';

// ---- shared pieces ----
const top = (t) => `<div class="top"><div class="brand">${logo}Anna</div><button class="ib" data-tab="data" aria-label="Settings">${ic('gear')}</button></div>`;
const title = (eye, t, sub) => `<div><div class="eyebrow">${eye}</div><h1>${t}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
const sh = (t, link = '') => `<div class="sh"><h2>${t}</h2>${link}</div>`;
const more = (tb, txt = 'See all') => `<button class="link" data-tab="${tb}">${txt}</button>`;
const empty = (t) => `<div class="empty">${t}</div>`;
const addBtn = (k, txt, cls = '') => `<button class="btn ${cls}" data-act="open" data-id="${k}">${txt}</button>`;
function tasksOf() { const open = S.tasks.filter((t) => !t.completed);
  const today = open.filter((t) => (t.due_at && t.due_at < EOD) || (!t.due_at && t.priority === 'high')).sort((a, b) => (a.due_at ?? 9e15) - (b.due_at ?? 9e15));
  const upcoming = open.filter((t) => !today.includes(t)).sort((a, b) => (a.due_at ?? 9e15) - (b.due_at ?? 9e15));
  return { today, upcoming, done: S.tasks.filter((t) => t.completed).sort((a, b) => (b.completed_at ?? 0) - (a.completed_at ?? 0)) }; }
const dueChip = (t) => (!t.due_at ? '' : t.due_at < SOD ? `<span class="chip bad">Overdue · ${dstr(t.due_at)}</span>` : t.due_at < EOD ? '<span class="chip gold">Today</span>' : `<span class="chip">${dstr(t.due_at)}</span>`);
const taskCard = (t) => `<div class="tcard ${t.priority}"><button class="ck ${t.completed ? 'on' : ''}" data-act="toggle" data-id="${t.id}" aria-label="${t.completed ? 'Mark not done' : 'Mark done'}">${ic('check')}</button>
  <div class="grow"><div class="${t.completed ? 'done' : ''}">${esc(t.title)}</div><div>${t.priority === 'high' ? '<span class="chip gold">High priority</span>' : ''}${t.completed ? '' : dueChip(t)}</div></div><button class="trash" data-act="del-task" data-id="${t.id}" aria-label="Delete">${ic('trash')}</button></div>`;
const bizRow = (r) => `<div class="item"><div class="dot ${r.kind === 'expense' ? 'g' : ''}">${ic(r.kind === 'expense' ? 'money' : 'biz')}</div><div class="grow"><b>${esc(r.description)}</b><div class="mute">${r.kind}${r.party ? ' · ' + esc(r.party) : ''} · ${dstr(r.occurred_at)}</div></div><b>${money(r.amount_cents)}</b><button class="trash" data-act="del-biz" data-id="${r.id}" aria-label="Delete">${ic('trash')}</button></div>`;
function activity() { const a = [];
  S.tasks.forEach((t) => { a.push({ t: t.created_at || 0, i: 'tasks', x: `Added task “${esc(t.title)}”` }); if (t.completed_at) a.push({ t: t.completed_at, i: 'check', x: `Completed “${esc(t.title)}”` }); });
  S.tx.forEach((t) => a.push({ t: t.occurred_at, i: 'money', x: `${t.kind === 'income' ? 'Received' : 'Spent'} ${money(t.amount_cents)} · ${esc(t.category)}` }));
  S.biz.forEach((r) => a.push({ t: r.occurred_at, i: 'biz', x: `${r.kind[0].toUpperCase() + r.kind.slice(1)} · ${esc(r.description)}` }));
  S.mem.forEach((m) => a.push({ t: m.created_at || 0, i: 'brain', x: `Remembered “${esc(m.content.slice(0, 48))}”` }));
  return a.sort((x, y) => y.t - x.t).slice(0, 6); }

// ---- screens ----
const TABS = [['home', 'Home'], ['tasks', 'Tasks'], ['money', 'Money'], ['biz', 'Business'], ['brain', 'Brain']];
const screens = {
  home() {
    const m = L.monthSummary(S), b = L.businessSummary(S), g = tasksOf(), h = new Date().getHours(), nm = (S.settings.name || '').trim();
    const dueSoon = S.bills.filter((x) => !x.paid && x.due_at < Date.now() + 7 * 864e5).length, over = L.budgetStatus(S).filter((x) => x.over).length;
    const bits = [`${g.today.length} priorit${g.today.length === 1 ? 'y' : 'ies'} today`, dueSoon ? `${dueSoon} bill${dueSoon > 1 ? 's' : ''} due this week` : '', over ? `${over} budget${over > 1 ? 's' : ''} over` : ''].filter(Boolean).join(' · ');
    const mo = six().map((x) => { const s = L.monthSummary(S, x.t); return { l: x.l, a: s.income, b: s.expense }; }), act = activity();
    return top() + `<div>${title(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}${nm ? ',<br>' + esc(nm) : ''}`, bits)}</div>
      <div class="card ask" data-act="chat-open"><div class="dot">${ic('brain')}</div><div class="grow"><b>Ask Anna</b><div class="mute">Private answers from your own data, offline</div></div><span class="mute">›</span></div>
      <div class="hero" data-tab="money"><div class="k">This month</div><div class="big ${m.net < 0 ? '' : ''}">${money(m.net)}</div><div class="pills"><div class="pill"><span>Income</span><b>${money(m.income)}</b></div><div class="pill"><span>Spent</span><b>${money(m.expense)}</b></div></div><div style="margin-top:14px">${bars(mo, true)}</div></div>
      <div>${sh('Today’s priorities', more('tasks'))}${g.today.slice(0, 3).map(taskCard).join('') || `<div class="card">${empty('A clear day. Add a priority when you’re ready.')}</div>`}</div>
      <div>${sh('Coming up')}${g.upcoming.slice(0, 3).map(taskCard).join('') || `<div class="card">${empty('Nothing scheduled ahead.')}</div>`}</div>
      <div>${sh('Business', more('biz', 'Open'))}<div class="card" data-tab="biz"><div class="row"><div class="grow"><div class="mute">Profit this month</div><div style="font:500 28px var(--serif)" class="${b.profit < 0 ? 'neg' : 'pos'}">${money(b.profit)}</div></div><div class="r"><div class="mute">Revenue</div><b>${money(b.revenue)}</b></div></div>${b.unpaid ? `<span class="chip gold">${money(b.unpaid)} awaiting payment</span>` : ''}</div></div>
      <div>${sh('Recent activity')}<div class="card">${act.map((x) => `<div class="item"><div class="dot">${ic(x.i)}</div><div class="grow">${x.x}</div><span class="mute">${ago(x.t)}</span></div>`).join('') || empty('Your activity will appear here.')}</div></div>`;
  },
  tasks() {
    const g = tasksOf(), list = g[taskView], all = g.today.length + g.upcoming.length + g.done.length;
    const msg = { today: 'Nothing urgent. Enjoy the calm.', upcoming: 'No upcoming tasks.', done: 'Completed tasks appear here.' }[taskView];
    return top() + title('Productivity', 'Tasks', `${g.today.length + g.upcoming.length} open · ${g.done.length} completed`) +
      `<div class="seg">${[['today', `Today ${g.today.length}`], ['upcoming', `Upcoming ${g.upcoming.length}`], ['done', `Done ${g.done.length}`]].map(([k, n]) => `<button data-act="seg" data-id="${k}" class="${k === taskView ? 'on' : ''}">${n}</button>`).join('')}</div>` +
      (list.map(taskCard).join('') || `<div class="card">${empty(all ? msg : 'Add your first task.')}</div>`) + `<div class="adds">${addBtn('task', '＋ New task')}</div>`;
  },
  money() {
    const m = L.monthSummary(S), bs = L.budgetStatus(S), bills = S.bills.filter((b) => !b.paid).sort((a, b) => a.due_at - b.due_at), [a0, a1] = L.monthRange();
    const cat = {}; S.tx.filter((t) => t.kind === 'expense' && t.occurred_at >= a0 && t.occurred_at < a1).forEach((t) => { cat[t.category] = (cat[t.category] || 0) + t.amount_cents; });
    let parts = Object.entries(cat).sort((x, y) => y[1] - x[1]).map(([k, v], i) => ({ label: k, value: v, color: COL[i % COL.length] }));
    if (parts.length > 5) { const rest = parts.slice(5).reduce((n, p) => n + p.value, 0); parts = [...parts.slice(0, 5), { label: 'Other', value: rest, color: '#A9BFAA' }]; }
    const mo = six().map((x) => { const s = L.monthSummary(S, x.t); return { l: x.l, a: s.income, b: s.expense }; });
    const tx = [...S.tx].sort((a, b) => b.occurred_at - a.occurred_at).slice(0, 25);
    return top() + title('Finances', 'Money', 'Calm, clear and entirely private') +
      `<div class="hero"><div class="k">Net this month</div><div class="big">${money(m.net)}</div><div class="pills"><div class="pill"><span>Income</span><b>${money(m.income)}</b></div><div class="pill"><span>Expenses</span><b>${money(m.expense)}</b></div></div></div>
      <div class="adds">${addBtn('tx', '＋ Entry')}${addBtn('bill', '＋ Bill', 'soft')}${addBtn('budget', '＋ Budget', 'sage')}</div>
      ${sh('Spending breakdown')}<div class="card">${parts.length ? `<div class="donutw">${donut(parts)}<div class="leg">${parts.map((p) => `<div><i style="background:${p.color}"></i>${esc(p.label)}<span>${money(p.value)}</span></div>`).join('')}</div></div>` : empty('No spending recorded this month.')}</div>
      ${sh('Cash flow')}<div class="card">${bars(mo)}<div class="key"><span><i style="background:var(--em)"></i>Income</span><span><i style="background:var(--gold)"></i>Spent</span></div></div>
      ${sh('Budgets')}${bs.map((b) => `<div class="card"><div class="row"><b class="grow">${esc(b.category)}</b><span class="${b.over ? 'over' : 'mute'}">${money(b.spent)} of ${money(b.limit_cents)}</span><button class="trash" data-act="del-budget" data-id="${b.id}" aria-label="Delete">${ic('trash')}</button></div><div class="bar ${b.over ? 'over' : ''}"><i style="width:${Math.min(100, Math.round((b.spent / b.limit_cents) * 100))}%"></i></div></div>`).join('') || `<div class="card">${empty('Set a monthly budget to keep spending gentle.')}</div>`}
      ${sh('Upcoming bills')}<div class="card">${bills.map((b) => `<div class="item"><div class="grow"><b>${esc(b.name)}</b><div class="mute">${b.due_at < Date.now() ? '<span class="over">Overdue</span> · ' : ''}Due ${dstr(b.due_at)}${b.repeat_monthly ? ' · monthly' : ''}</div></div><b>${money(b.amount_cents)}</b><button class="btn sage sm" data-act="pay" data-id="${b.id}">Paid</button><button class="trash" data-act="del-bill" data-id="${b.id}" aria-label="Delete">${ic('trash')}</button></div>`).join('') || empty('No unpaid bills.')}</div>
      ${sh('Recent')}<div class="card">${tx.map((t) => `<div class="item"><div class="dot ${t.kind === 'income' ? '' : 'g'}">${ic('money')}</div><div class="grow"><b>${esc(t.category)}</b><div class="mute">${dstr(t.occurred_at)}${t.note ? ' · ' + esc(t.note) : ''}</div></div><b class="${t.kind === 'income' ? 'pos' : ''}">${t.kind === 'income' ? '+' : '−'}${money(t.amount_cents)}</b><button class="trash" data-act="del-tx" data-id="${t.id}" aria-label="Delete">${ic('trash')}</button></div>`).join('') || empty('No entries yet.')}</div>`;
  },
  biz() {
    const b = L.businessSummary(S), mo = six().map((x) => { const s = L.businessSummary(S, x.t); return { l: x.l, a: s.revenue, b: s.expenses }; });
    const inv = S.biz.filter((r) => r.kind === 'invoice' && r.status === 'unpaid'), rec = [...S.biz].filter((r) => !(r.kind === 'invoice' && r.status === 'unpaid')).sort((a, c) => c.occurred_at - a.occurred_at).slice(0, 30);
    const sales = S.biz.filter((r) => r.kind === 'sale' && r.occurred_at >= L.monthRange()[0] && r.occurred_at < L.monthRange()[1]).length;
    return top() + title('Enterprise', 'Business', 'Cash basis, this month') +
      `<div class="hero"><div class="k">Profit</div><div class="big">${money(b.profit)}</div><div class="pills"><div class="pill"><span>Revenue</span><b>${money(b.revenue)}</b></div><div class="pill"><span>Expenses</span><b>${money(b.expenses)}</b></div><div class="pill"><span>Sales</span><b>${sales}</b></div></div></div>
      <div class="adds">${addBtn('biz', '＋ Record')}</div>
      ${sh('Performance')}<div class="card">${bars(mo)}<div class="key"><span><i style="background:var(--em)"></i>Revenue</span><span><i style="background:var(--gold)"></i>Expenses</span></div></div>
      ${sh('Invoices', `<span class="mute">${money(b.unpaid)} outstanding</span>`)}<div class="card">${inv.map((r) => `<div class="item"><div class="dot g">${ic('biz')}</div><div class="grow"><b>${esc(r.description)}</b><div class="mute">${esc(r.party || 'Invoice')} · ${dstr(r.occurred_at)}</div></div><b>${money(r.amount_cents)}</b><button class="btn sage sm" data-act="inv-paid" data-id="${r.id}">Paid</button><button class="trash" data-act="del-biz" data-id="${r.id}" aria-label="Delete">${ic('trash')}</button></div>`).join('') || empty('No unpaid invoices.')}</div>
      ${sh('Sales & expenses')}<div class="card">${rec.map(bizRow).join('') || empty('No records yet.')}</div>`;
  },
  brain() {
    const cats = ['All', ...new Set(S.mem.map((m) => m.category))], sc = { confirmed: '#F0E6CC', temporary: '#B8985A', assumption: '#8FAE96' };
    const ns = S.mem.slice(0, 16).map((m, i) => { const an = i * 2.399, r = 30 + (i % 4) * 12 + i * 3.2; return { x: 150 + Math.cos(an) * r * 1.5, y: 90 + Math.sin(an) * r * 0.8, c: sc[m.status], i }; });
    const ghost = S.mem.length ? '' : [[70, 50], [235, 55], [90, 135], [225, 130], [150, 30]].map(([x, y], i) => `<circle class="nd" cx="${x}" cy="${y}" r="3" fill="#F0E6CC" opacity=".35" style="animation-delay:${i * .6}s"/>`).join('');
    const net = `<svg viewBox="0 0 300 180" role="img" aria-label="Your memory network"><defs><radialGradient id="gl"><stop offset="0" stop-color="#E9D9AE" stop-opacity=".9"/><stop offset="1" stop-color="#E9D9AE" stop-opacity="0"/></radialGradient></defs>
      ${ns.map((n, i) => `<line x1="150" y1="90" x2="${n.x}" y2="${n.y}" stroke="#E9D9AE" stroke-opacity=".16"/>${i > 0 ? `<line x1="${ns[i - 1].x}" y1="${ns[i - 1].y}" x2="${n.x}" y2="${n.y}" stroke="#E9D9AE" stroke-opacity=".12"/>` : ''}`).join('')}
      ${ns.map((n) => `<circle class="nd" cx="${n.x}" cy="${n.y}" r="${4 + (n.i % 3)}" fill="${n.c}" style="animation-delay:${(n.i * 0.37).toFixed(2)}s"/>`).join('')}${ghost}
      <circle cx="150" cy="90" r="26" fill="url(#gl)"/><circle cx="150" cy="90" r="13" fill="#0F4D3A" stroke="#B8985A"/><text x="150" y="96" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="16" fill="#E9D9AE">A</text></svg>`;
    const fbs = (S.fb || []).slice(0, 8);
    return top() + title('Memory', 'Brain', 'What Anna keeps in mind. Stored only on this device.') +
      `<div class="neural">${net}<div class="cap"><span>${S.mem.length} memories</span><span>${cats.length - 1} categories</span></div></div>
      <div id="engine">${engineHTML()}</div>${accessHTML()}<div class="adds">${addBtn('mem', '＋ Remember')}</div>
      <input id="q" type="search" placeholder="Search memories" value="${esc(memQ)}" aria-label="Search memories">
      <div class="chips">${cats.map((c) => `<button data-act="memcat" data-id="${esc(c)}" class="${c === memCat ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>
      <div id="memlist">${memList()}</div>
      ${sh('Feedback history')}<div class="card">${fbs.map((f) => `<div class="item"><div class="dot ${f.rating === 'up' ? '' : 'g'}">${ic(f.rating === 'up' ? 'check' : 'x')}</div><div class="grow">${esc(f.text)}<div class="mute">${f.rating === 'up' ? 'Marked helpful' : 'Marked not right'} · ${ago(f.at)}</div></div></div>`).join('') || empty('Feedback you give on memories appears here.')}</div>`;
  },
  data() {
    return `<div class="top"><div class="brand">${logo}Settings</div><button class="ib" data-tab="home" aria-label="Close">${ic('x')}</button></div>` + title('Your data', 'Data & settings', 'Everything stays on this device.') +
      `<div class="card"><h2>Back up</h2><div class="mute" style="margin:4px 0 12px">Safari can clear website data. Export a backup regularly and keep it in Files or iCloud.</div><div class="row"><button class="btn grow" data-act="export">Export</button><button class="btn sage grow" data-act="import">Import</button></div><input id="file" type="file" accept="application/json,.json" hidden></div>
      <div class="card"><label class="f" style="margin:0"><span>Your name</span><input id="nm" value="${esc(S.settings.name || '')}" maxlength="40" placeholder="For your greeting"></label><label class="f"><span>Currency symbol</span><input id="cur" value="${esc(cur())}" maxlength="5"></label><button class="btn soft sm" data-act="prefs">Save</button></div>
      <div class="card"><h2>Storage</h2><div class="mute" id="stor">Using ${mode}. Checking persistence…</div></div>
      <div class="card"><h2>On your iPhone</h2><div class="mute">Safari → Share → Add to Home Screen, then always open Anna from that icon. It keeps its own storage, separate from Safari tabs. Use a backup to move data between them.</div></div>
      <div class="card"><button class="btn bad full" data-act="erase">Erase all data on this device</button></div>
      <div class="mute" style="text-align:center;margin-top:18px">Anna Web v${VERSION}${saveErr ? ' · <span class="over">Save error: ' + esc(saveErr) + '</span>' : ''}</div>`;
  },
};
function memList() {
  const q = memQ.trim().toLowerCase(), ms = S.mem.filter((m) => (memCat === 'All' || m.category === memCat) && (!q || (m.content + ' ' + m.category).toLowerCase().includes(q)));
  return ms.map((m) => `<div class="card"><div>${esc(m.content)}</div><div style="margin:6px 0 10px"><span class="chip">${esc(m.category)}</span><span class="chip gold">${m.status}</span>${m.helpful_count ? `<span class="chip">👍 ${m.helpful_count}</span>` : ''}${m.incorrect_count ? `<span class="chip bad">${m.incorrect_count} not right</span>` : ''}</div>
    <div class="row"><button class="fb" data-act="fb-up" data-id="${m.id}">Helpful</button><button class="fb n" data-act="fb-down" data-id="${m.id}">Not right</button><span class="grow"></span><button class="trash" data-act="del-mem" data-id="${m.id}" aria-label="Forget">${ic('trash')}</button></div></div>`).join('') || `<div class="card">${empty(S.mem.length ? 'No matching memories.' : 'Nothing remembered yet. Add something Anna should know.')}</div>`;
}

// ---- Anna's mind: local AI engine card, permissions, chat ----
const mb = (b) => Math.round((b || 0) / 1e6) + ' MB';
const sw = (k, label, hint) => `<div class="item"><div class="grow"><b>${label}</b>${hint ? `<div class="mute">${hint}</div>` : ''}</div><button class="sw ${S.settings.ai[k] ? 'on' : ''}" data-act="acc" data-id="${k}" role="switch" aria-checked="${!!S.settings.ai[k]}" aria-label="${label}"><i></i></button></div>`;
function engineHTML() {
  const a = AI.ai, st = a.state, M = AI.MODEL, p = a.progress, pct = p ? Math.min(100, Math.round((p.loaded / (p.total || M.approxBytes)) * 100)) : 0;
  const pill = { unknown: ['Checking…', ''], unsupported: ['Not supported', 'bad'], absent: ['Not installed', 'gold'], partial: ['Incomplete download', 'bad'], downloading: [`Downloading ${pct}%`, 'gold'], cached: ['Downloaded · not loaded', 'gold'], loading: ['Loading…', 'gold'], ready: ['Ready · works offline', ''] }[st] || ['Unknown', ''];
  const b = (act, t, c = '') => `<button class="btn ${c}" data-act="${act}">${t}</button>`;
  const row = { absent: b('ai-download', `Download model · ${mb(M.approxBytes)}`), partial: b('ai-download', 'Download again') + b('ai-delete', 'Delete', 'bad'), downloading: b('ai-cancel', 'Cancel download', 'sage'), cached: b('ai-load', 'Load into memory') + b('ai-delete', 'Delete', 'bad'), loading: '<button class="btn" disabled>Loading… keep Anna open</button>', ready: b('chat-open', 'Ask Anna') + b('ai-unload', 'Unload', 'sage') + b('ai-delete', 'Delete', 'bad') }[st] || '';
  const stg = a.storage ? `Browser storage: ${mb(a.storage.usage)} used of ${mb(a.storage.quota)} · ${a.storage.persisted ? 'persistent' : 'not marked persistent'}` : '';
  return `<div class="card mind"><div class="row"><h2 class="grow">Anna’s mind</h2><span class="chip ${pill[1]}" id="pill">${pill[0]}</span></div>
    <div class="mute" style="margin:6px 0 10px">${esc(M.name)} · about ${mb(M.approxBytes)} · runs only on this device. ${st === 'absent' ? 'One-time download over Wi-Fi; afterwards Anna answers with no internet.' : ''}</div>
    ${st === 'downloading' ? `<div class="bar"><i id="dlbar" style="width:${pct}%;animation:none"></i></div><div class="mute" id="dltxt" style="margin:6px 0 10px">${mb(p?.loaded)} of ${mb(p?.total)} · keep the screen on and Anna open</div>` : ''}
    ${a.crashed && st !== 'loading' ? `<div class="warn">Last time the model was loading, the page was closed (usually iOS running out of memory). Close other apps, then try again.<br><button class="link" data-act="ai-ack">Dismiss</button></div>` : ''}
    ${st === 'unsupported' ? `<div class="warn">${esc(a.error)}</div>` : a.error ? `<div class="warn">${esc(a.error)}</div>` : ''}
    <div class="btnrow">${row}</div>
    <div class="mute" style="margin-top:10px">${a.info.bytes ? `On this device: ${mb(a.info.bytes)}. ` : ''}${a.info.loadMs ? `Loaded in ${(a.info.loadMs / 1000).toFixed(1)} s. ` : ''}${a.info.tps ? `Last speed: ${a.info.tps} words/s. ` : ''}${stg}</div>
    <div class="mute" style="margin-top:8px">Runs on the CPU in Safari’s compatibility mode, so expect a slow start and short answers. A model this small can be wrong: check numbers on the Money screen. The model file is not part of backups.</div>
    ${sw('gpu', 'Use GPU (experimental)', 'May crash on iPhone. Leave off unless testing.')}
    <div class="row" style="margin-top:6px"><button class="btn sage sm" data-act="ai-diag">Run self-test</button>${a.diag ? '<button class="btn sage sm" data-act="ai-copy">Copy report</button>' : ''}</div>${a.diag ? `<pre class="diag">${esc(a.diag)}</pre>` : ''}</div>`;
}
const accessHTML = () => `<div class="card"><h2>What Anna may read</h2><div class="mute" style="margin:4px 0 4px">Everything is off until you switch it on. Only switched-on categories are shown to the local model. Notes and customer names are never included, and Anna can read but never change your data.</div>${AI.ACCESS.map(([k, n]) => sw(k, n)).join('')}<button class="link" data-act="ctx-open">Preview exactly what Anna sees</button></div>`;
const SUGG = ['What should I focus on today?', 'How am I doing on money this month?', 'Which invoices are unpaid?'];
const bubble = (m) => `<div class="bub ${m.role}${m.error ? ' err' : ''}">${m.error ? esc(m.error) : esc(m.content).replace(/\n/g, '<br>') || '<span class="mute">…</span>'}</div>`;
function chatMain() {
  const a = AI.ai;
  if (a.state !== 'ready') {
    const msg = { unknown: 'Checking Anna’s brain…', unsupported: 'This browser cannot run the local AI. ' + esc(a.error), absent: 'Anna’s offline brain is not installed yet. It is a one-time download of about 398 MB.', partial: 'The model download is incomplete. Open Brain setup to download it again.', downloading: 'Downloading the model…', cached: 'The model is on this device but not loaded into memory yet.', loading: 'Loading the model. This can take a minute. Keep Anna open.' }[a.state] || '';
    return `<div class="card"><b>Anna isn’t ready to answer yet</b><div class="mute" style="margin:6px 0 12px">${msg}</div>${a.state === 'cached' ? '<button class="btn full" data-act="ai-load">Load Anna’s brain</button>' : a.state === 'loading' || a.state === 'downloading' ? '' : '<button class="btn full" data-act="chat-to-brain">Open Brain setup</button>'}${a.error && a.state !== 'unsupported' ? `<div class="warn" style="margin-top:10px">${esc(a.error)}</div>` : ''}</div>`;
  }
  return `<div class="msgs" id="msgs">${chat.length ? chat.map(bubble).join('') : `<div class="empty">Ask about your tasks, money or business.<br>Anna only sees what you allow in Brain.</div>${SUGG.map((q, i) => `<button class="btn sage full" style="margin:6px 0" data-act="chat-suggest" data-id="${i}">${q}</button>`).join('')}`}</div>`;
}
function chatPanel() {
  const on = AI.ACCESS.filter(([k]) => S.settings.ai[k]).map(([, n]) => n);
  return `<div class="pn chat" role="dialog" aria-label="Ask Anna"><div class="row" style="margin-bottom:8px"><div class="grow"><h2>Ask Anna</h2><div class="mute">${on.length ? 'Can read: ' + on.join(', ') : 'Can read nothing yet'} · <button class="link" data-act="ctx-open">what’s shared</button></div></div><button class="ib" data-act="chat-clear" aria-label="Clear conversation">${ic('trash')}</button><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div>
    <div id="chatmain" class="chatmain">${chatMain()}</div>
    <form data-form="chat" class="chatin"><textarea name="msg" rows="1" placeholder="Ask about your day…" maxlength="800" required></textarea><button class="btn" ${AI.ai.state === 'ready' && !AI.ai.busy ? '' : 'disabled'}>Send</button></form></div>`;
}
const ctxPanel = () => `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="What Anna sees"><div class="gr"></div><div class="row"><h2 class="grow">What Anna sees</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div><div class="mute" style="margin:6px 0 10px">This is the complete data block given to the local model. It never leaves your device.</div><pre class="diag">${esc(AI.buildContext(S, S.settings.ai))}</pre></div>`;
let engKey = '';
const paintEngine = () => { const e = $('#engine'); if (!e) return; const a = AI.ai, key = [a.state, a.error, a.crashed, a.diag, JSON.stringify(a.info), JSON.stringify(a.storage), JSON.stringify(S.settings.ai)].join('|');
  if (key === engKey && a.state === 'downloading' && $('#dlbar')) { const p = a.progress, pct = p ? Math.min(100, Math.round((p.loaded / (p.total || AI.MODEL.approxBytes)) * 100)) : 0; $('#dlbar').style.width = pct + '%'; $('#dltxt').textContent = `${mb(p?.loaded)} of ${mb(p?.total)} · keep the screen on and Anna open`; $('#pill').textContent = `Downloading ${pct}%`; return; }
  engKey = key; e.innerHTML = engineHTML(); };
const paintChat = () => { const m = $('#chatmain'); if (!m) return; const o = $('#msgs'), near = !o || o.scrollHeight - o.scrollTop - o.clientHeight < 80, top = o?.scrollTop ?? 0; m.innerHTML = chatMain(); const b = $('.chatin .btn'); if (b) b.disabled = !(AI.ai.state === 'ready' && !AI.ai.busy); const x = $('#msgs'); if (x) x.scrollTop = near ? x.scrollHeight : top; };
async function sendChat(text) {
  text = text.trim(); if (!text || AI.ai.state !== 'ready' || AI.ai.busy) return;
  const hist = chat.slice(), a = { role: 'assistant', content: '' }; chat.push({ role: 'user', content: text }, a); paintChat();
  try { await AI.ask(AI.buildMessages(AI.buildContext(S, S.settings.ai), hist, text), (t) => { a.content = t; paintChat(); }); if (!a.content.trim()) a.content = '(Anna produced no answer. Try rephrasing.)'; }
  catch (e) { a.content = ''; a.error = AI.friendly(e); }
  paintChat();
}
const fld = (l, inner) => `<label class="f"><span>${l}</span>${inner}</label>`;
const FORMS = {
  task: ['New task', `${fld('Task', '<input name="title" placeholder="What needs doing?" maxlength="200" required>')}${fld('Due date', '<input name="due" type="date">')}${fld('Priority', '<select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select>')}`, 'Add task'],
  tx: ['New entry', `${fld('Type', '<select name="kind"><option value="expense">Expense</option><option value="income">Income</option></select>')}${fld('Amount', '<input name="amount" inputmode="decimal" placeholder="0.00" required>')}${fld('Category', '<input name="category" placeholder="e.g. Groceries" maxlength="40">')}${fld('Note', '<input name="note" placeholder="Optional" maxlength="200">')}`, 'Save entry'],
  bill: ['New bill', `${fld('Bill', '<input name="name" placeholder="e.g. Rent" maxlength="80" required>')}${fld('Amount', '<input name="amount" inputmode="decimal" placeholder="0.00" required>')}${fld('Due date', '<input name="due" type="date" required>')}<label class="cb"><input type="checkbox" name="monthly"> Repeats monthly</label>`, 'Add bill'],
  budget: ['Monthly budget', `${fld('Category', '<input name="category" placeholder="e.g. Groceries" maxlength="40" required>')}${fld('Monthly limit', '<input name="limit" inputmode="decimal" placeholder="0.00" required>')}`, 'Set budget'],
  biz: ['Business record', `${fld('Type', '<select name="kind"><option value="sale">Sale</option><option value="expense">Expense</option><option value="invoice">Invoice (unpaid)</option></select>')}${fld('Amount', '<input name="amount" inputmode="decimal" placeholder="0.00" required>')}${fld('Description', '<input name="description" placeholder="What was it for?" maxlength="200" required>')}${fld('Customer / supplier', '<input name="party" placeholder="Optional" maxlength="80">')}`, 'Save record'],
  mem: ['Remember', `${fld('Memory', '<textarea name="content" rows="3" placeholder="e.g. I do my best work in the morning" maxlength="500" required></textarea>')}${fld('Confidence', '<select name="status"><option value="confirmed">Confirmed</option><option value="temporary">Temporary</option><option value="assumption">Assumption</option></select>')}${fld('Category', '<input name="category" value="General" maxlength="40">')}`, 'Remember'],
};
function render(anim) {
  const now = new Date(); SOD = new Date(now).setHours(0, 0, 0, 0); EOD = SOD + 864e5;
  const el = $('#screen'); el.innerHTML = screens[tab]();
  if (anim) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
  $('#tabs').innerHTML = TABS.map(([k, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}" aria-label="${n}" ${k === tab ? 'aria-current="page"' : ''}>${ic(k)}${n}</button>`).join('');
  const f = FORMS[sheet];
  const special = sheet === 'chat' ? chatPanel() : sheet === 'ctx' ? ctxPanel() : '';
  $('#sheet').innerHTML = special ? special : f ? `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="${f[0]}"><div class="gr"></div><div class="row"><h2 class="grow">${f[0]}</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div><form data-form="${sheet}">${f[1]}<button class="btn full" style="margin-top:12px">${f[2]}</button></form></div>` : '';
  document.body.classList.toggle('lock', !!(f || special));
  if (sheet === 'chat') { const x = $('#msgs'); if (x) x.scrollTop = x.scrollHeight; }
  if (tab === 'brain' && AI.ai.state === 'unknown') AI.refresh();
  if (tab === 'data') navigator.storage?.persisted?.().then((p) => { const e = $('#stor'); if (e) e.textContent = `Using ${mode}. ${p ? 'Browser has marked this storage as persistent.' : 'Not marked persistent: back up often.'}`; });
}

// ---- actions (unchanged behaviour from v0.1.0, plus UI helpers) ----
const byId = (arr, id) => arr.find((x) => x.id === id);
const del = (key, id) => mutate(() => { S[key] = S[key].filter((x) => x.id !== id); });
const rate = (id, rating) => mutate(() => { const m = byId(S.mem, id); if (!m) return; if (rating === 'up') m.helpful_count = (m.helpful_count || 0) + 1; else m.incorrect_count = (m.incorrect_count || 0) + 1; S.fb.unshift({ id: L.uid(), mem: id, text: m.content.slice(0, 80), rating, at: Date.now() }); S.fb = S.fb.slice(0, 200); });
const actions = {
  toggle: (id) => mutate(() => { const t = byId(S.tasks, id); t.completed = t.completed ? 0 : 1; t.completed_at = t.completed ? Date.now() : null; }),
  'del-task': (id) => del('tasks', id), 'del-bill': (id) => del('bills', id), 'del-budget': (id) => del('budgets', id), 'del-tx': (id) => del('tx', id), 'del-biz': (id) => del('biz', id), 'del-mem': (id) => del('mem', id),
  seg: (id) => { taskView = id; render(); },
  'chat-open': () => { sheet = 'chat'; render(); AI.refresh(); }, 'ctx-open': () => { sheet = 'ctx'; render(); },
  'chat-clear': () => { chat = []; paintChat(); }, 'chat-suggest': (i) => sendChat(SUGG[i]), 'chat-to-brain': () => { sheet = null; tab = 'brain'; render(true); scrollTo(0, 0); },
  'ai-download': () => AI.download(), 'ai-cancel': () => AI.cancelDownload(), 'ai-load': () => AI.load({ gpu: S.settings.ai.gpu }), 'ai-unload': () => AI.unload(), 'ai-ack': () => AI.ackCrash(),
  'ai-delete': () => { if (confirm('Delete the downloaded model from this device? You will need an internet connection to download it again.')) AI.remove(); },
  'ai-diag': async () => { AI.ai.diag = 'Running self-test…'; paintEngine(); AI.ai.diag = await AI.diagnostics(VERSION); paintEngine(); },
  'ai-copy': async () => { try { await navigator.clipboard.writeText(AI.ai.diag); } catch { prompt('Copy this report:', AI.ai.diag); } },
  acc: (id) => mutate(() => { S.settings.ai[id] = !S.settings.ai[id]; }),
  memcat: (id) => { memCat = id; render(); },
  open: (id) => { sheet = id; render(); }, close: () => { sheet = null; render(); },
  'fb-up': (id) => rate(id, 'up'), 'fb-down': (id) => rate(id, 'down'),
  pay: (id) => { const b = byId(S.bills, id); const rec = confirm(`Mark "${b.name}" paid and record it as an expense?\nOK = record expense, Cancel = just mark paid.`); mutate(() => L.payBill(S, id, { recordExpense: rec })); },
  'inv-paid': (id) => mutate(() => { const r = byId(S.biz, id); r.status = 'paid'; r.paid_at = Date.now(); }),
  export: async () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), name = `anna-web-backup-${new Date().toISOString().slice(0, 10)}.json`, file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
  import: () => $('#file').click(),
  prefs: () => mutate(() => { S.settings.currency = ($('#cur').value || '').trim().slice(0, 5); S.settings.name = ($('#nm').value || '').trim().slice(0, 40); }),
  erase: async () => { if (confirm('Erase ALL Anna Web data on this device? Export a backup first.') && confirm('Really erase everything?')) { await kvSet('prev', S); S = L.emptyState(); normSettings(); chat = []; await save(); tab = 'home'; render(true); } },
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab],[data-act]'); if (!t) return;
  if (t.dataset.tab) { if (t.dataset.tab !== tab || sheet) { tab = t.dataset.tab; sheet = null; render(true); scrollTo(0, 0); } } else actions[t.dataset.act]?.(t.dataset.id);
});
document.addEventListener('input', (e) => { if (e.target.id === 'q') { memQ = e.target.value; $('#memlist').innerHTML = memList(); } });
document.addEventListener('change', async (e) => {
  if (e.target.id !== 'file' || !e.target.files[0]) return;
  const r = L.validateBackup(await e.target.files[0].text()); e.target.value = '';
  if (!r.ok) return err(r.error);
  if (!confirm('Replace everything in Anna Web with this backup? Your current data is saved as a safety copy first.')) return;
  await kvSet('prev', S); S = r.state; normSettings(); await save(); render();
});
// Keyboard handling: hide the floating tab bar while typing and keep the focused field in view.
const typing = (t) => t.matches?.('input:not([type=checkbox]):not([type=file]),textarea,select');
document.addEventListener('focusin', (e) => { if (typing(e.target)) { document.body.classList.add('kb'); setTimeout(() => !e.target.closest('.chat') && e.target.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 320); } });
document.addEventListener('focusout', () => setTimeout(() => { if (!typing(document.activeElement || document.body)) document.body.classList.remove('kb'); }, 80));
const forms = {
  task: (f) => ({ id: L.uid(), title: f.title.trim(), notes: null, due_at: L.dayTs(f.due), priority: f.priority, completed: 0, completed_at: null, created_at: Date.now() }),
  mem: (f) => ({ id: L.uid(), content: f.content.trim(), category: f.category.trim() || 'General', status: f.status, created_at: Date.now() }),
};
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]'); if (!form) return; e.preventDefault();
  const f = Object.fromEntries(new FormData(form)), now = Date.now(), k = form.dataset.form;
  if (k === 'chat') { const ta = form.querySelector('textarea'), t = ta.value; ta.value = ''; return sendChat(t); }
  if (k === 'task' || k === 'mem') { if (!(f.title ?? f.content).trim()) return; return mutate(() => S[k === 'task' ? 'tasks' : 'mem'].unshift(forms[k](f))); }
  const cents = L.parseCents(f.amount ?? f.limit); if (cents === null) return err('Enter an amount like 12.50 (more than zero).');
  if (k === 'tx') return mutate(() => S.tx.push({ id: L.uid(), kind: f.kind, amount_cents: cents, category: f.category.trim() || 'General', note: f.note.trim() || null, occurred_at: now }));
  if (k === 'bill') return mutate(() => S.bills.push({ id: L.uid(), name: f.name.trim(), amount_cents: cents, due_at: L.dayTs(f.due), repeat_monthly: f.monthly ? 1 : 0, paid: 0, paid_at: null }));
  if (k === 'budget') return mutate(() => { const b = S.budgets.find((x) => x.category.toLowerCase() === f.category.trim().toLowerCase()); if (b) b.limit_cents = cents; else S.budgets.push({ id: L.uid(), category: f.category.trim(), limit_cents: cents }); });
  if (k === 'biz') return mutate(() => S.biz.push({ id: L.uid(), kind: f.kind, party: f.party.trim() || null, description: f.description.trim(), amount_cents: cents, status: f.kind === 'invoice' ? 'unpaid' : 'paid', occurred_at: now, paid_at: f.kind === 'invoice' ? null : now }));
});

// ---- start ----
(async () => {
  const saved = await kvGet('state'); if (saved) { const v = L.validateBackup(JSON.stringify(saved)); if (v.ok) S = v.state; else { await kvSet('corrupt', saved); } }
  normSettings(); navigator.storage?.persist?.().catch(() => {});
  AI.onAi(() => { paintEngine(); if (sheet === 'chat') paintChat(); });
  const vv = window.visualViewport; if (vv) { const u = () => { document.documentElement.style.setProperty('--vvh', vv.height + 'px'); document.documentElement.style.setProperty('--vvt', vv.offsetTop + 'px'); }; vv.addEventListener('resize', u); vv.addEventListener('scroll', u); u(); }
  banner(); render(true);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
