// ANNA WEB v0.4.0 — black & silver, ZAR, editable records, reminders, persistent chat, verified offline AI.
// Same IndexedDB database and backup format as v0.1–v0.3 (additive fields only), so no data is lost on update.
import * as L from './logic.js';
import * as AI from './ai.js';
import * as A from './auth.js';
import * as LF from './life.js';
import * as TM from './time.js';
import * as M from './money.js';
import * as RT from './router.js';
export const VERSION = '1.3.1';
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

let auth = null, bkKey = null, locked = true, started = false, logoUrl = null, hiddenAt = 0, lockMsg = '';
let pendingEntry = null, pendingBatch = null, entryUndo = {}, BK = null, lastRoute = 'qwen';
let bizView = 'overview', staffWeek = 0, calcTab = 'basic', CALC = {}, BD = null, AFF = { amount: '', what: '' };
let pendingReminder = null, reminderPrefill = null, lastURL = '';
let LIFE = LF.emptyLife(), brainView = 'journal', jQ = '', jTag = '', pendingRemember = null, checkinShown = false;
let S = L.emptyState(), tab = 'home', sheet = null, editId = null, taskView = 'today', memCat = 'All', memQ = '', bizQ = '', saveErr = '', SOD = 0, EOD = 0, diag = '', pendingRestore = null, hasPrev = false, undo = null;
const save = async () => { try { S.chat = S.chat.slice(-300); await kvSet('state', { ...S, mem: [] }); await syncMem(); saveErr = ''; } catch (e) { saveErr = String(e); } };
const mutate = async (fn, { close = true } = {}) => { fn(); if (close) { sheet = null; editId = null; } render(); await save(); if (saveErr) render(); };
const cur = () => S.settings.currency || L.DEFAULT_CURRENCY;
const money = (c) => esc(L.fmt(c, cur()));
const dstr = (t) => (t ? new Date(t).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : '');
const dtstr = (t) => new Date(t).toLocaleString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const tstr = (t) => new Date(t).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
const ago = (t) => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; };
const normSettings = () => {
  const s = S.settings; s.currency ||= L.DEFAULT_CURRENCY; s.owner = A.OWNER.name; if (s.name === undefined || s.name === null) s.name = '';
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
const COL = ['#EAF7FF', '#A9DFFF', '#75CFFF', '#3E8FC4', '#2B5C80', '#1B3550'];
function donut(parts) { const t = parts.reduce((n, p) => n + p.value, 0); if (!t) return ''; let off = 25;
  return `<svg viewBox="0 0 42 42" class="donut" role="img" aria-label="Spending breakdown"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="#25272C" stroke-width="5"/>${parts.map((p) => { const pc = (p.value / t) * 100, s = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${p.color}" stroke-width="5" stroke-dasharray="${Math.max(pc - 0.6, 0.1)} ${100 - pc + 0.6}" stroke-dashoffset="${off}"/>`; off -= pc; return s; }).join('')}</svg>`; }
function bars(d) { const mx = Math.max(1, ...d.flatMap((x) => [x.a, x.b])), h = 100, bw = 12, gap = (300 - d.length * (bw * 2 + 3)) / (d.length + 1);
  return `<svg viewBox="0 0 300 128" class="chart" role="img" aria-label="Last six months">${d.map((x, i) => { const x0 = gap * (i + 1) + i * (bw * 2 + 3), ha = Math.max(3, Math.round((x.a / mx) * h)), hb = Math.max(3, Math.round((x.b / mx) * h));
    return `<rect class="b1" x="${x0}" y="${h - ha + 4}" width="${bw}" height="${ha}" rx="4"/><rect class="b2" x="${x0 + bw + 3}" y="${h - hb + 4}" width="${bw}" height="${hb}" rx="4"/><text x="${x0 + bw + 1}" y="124" text-anchor="middle">${x.l}</text>`; }).join('')}</svg>`; }
const six = () => Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - (5 - i)); return { t: d.getTime(), l: d.toLocaleDateString('en-ZA', { month: 'short' }).slice(0, 3) }; });
const logo = '<svg viewBox="0 0 32 32"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F5F7"/><stop offset=".5" stop-color="#C4C8CE"/><stop offset="1" stop-color="#7E848C"/></linearGradient></defs><circle cx="16" cy="16" r="15" fill="#0B0B0D" stroke="url(#lg)" stroke-width="1.2"/><text x="16" y="22" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-weight="700" font-size="17" fill="url(#lg)">A</text></svg>';

// ---- shared pieces ----
const orb = (size = '', live = true) => `<span class="orb ${size}" ${live ? 'data-live' : ''} data-s="${orbState()}" aria-hidden="true"></span>`;
const brandLogo = (cls = 'ulogo') => (logoUrl ? `<img class="${cls}" src="${logoUrl}" alt="Anna logo">` : cls === 'ulogo' ? orb('xs') : `<div class="${cls}">${logo}</div>`);
const backBtn = () => `<button class="back" data-act="back" aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>`;
const top = () => `<div class="top"><div class="brand">${backBtn()}${brandLogo()}ANNA</div><button class="ib" data-tab="data" aria-label="Settings">${ic('gear')}</button></div>`;
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
const whereLives = (r) => ['Saved in ANNA', r.dest?.iphone ? 'sent to iPhone Reminders' : '', r.dest?.ics ? 'Calendar file made' : ''].filter(Boolean).join(' · ');
const remCard = (r) => { const late = !r.done && r.at < Date.now();
  return `<div class="tcard ${late ? 'high' : ''}">${ckBtn('rem-done', r.id, r.done, r.done ? 'Mark not done' : r.repeat && r.repeat !== 'none' ? 'Done, schedule next' : 'Mark done')}
  <div class="grow" data-act="edit" data-k="reminder" data-id="${r.id}"><div class="${r.done ? 'done' : ''}">${esc(r.title)}</div><div><span class="chip ${late ? 'bad' : 'gold'}">${ic('bell').replace('class="i"', 'class="i" style="width:12px;height:12px;vertical-align:-1px"')} ${late ? 'Due · ' : ''}${dtstr(r.at)}</span>${r.repeat && r.repeat !== 'none' ? `<span class="chip">${esc(repLabel(r))}</span>` : ''}</div><div class="mute" style="font-size:12px;margin-top:2px">${whereLives(r)}</div></div>
  ${r.done ? '' : `<button class="edit" data-act="rem-ios" data-id="${r.id}" aria-label="Send to iPhone Reminders">${ic('check')}</button><button class="edit" data-act="rem-ics" data-id="${r.id}" aria-label="Add to Calendar">${ic('cal')}</button>`}${delBtn('reminder', r.id)}</div>`; };
const bizRow = (r) => `<div class="item"><div class="dot ${r.kind === 'expense' ? 'g' : ''}">${ic(r.kind === 'expense' ? 'money' : 'biz')}</div><div class="grow tap" data-act="edit" data-k="biz" data-id="${r.id}"><b>${esc(r.description)}</b><div class="mute">${r.kind}${r.kind === 'invoice' ? ' · ' + r.status : ''}${r.party ? ' · ' + esc(r.party) : ''} · ${dstr(r.occurred_at)}</div></div><b>${money(r.amount_cents)}</b>${delBtn('biz', r.id)}</div>`;
function activity() { const a = [];
  S.tasks.forEach((t) => { a.push({ t: t.created_at || 0, i: 'tasks', x: `Added task “${esc(t.title)}”` }); if (t.completed_at) a.push({ t: t.completed_at, i: 'check', x: `Completed “${esc(t.title)}”` }); });
  S.reminders.forEach((r) => a.push({ t: r.created_at || 0, i: 'bell', x: `Reminder “${esc(r.title)}”` }));
  S.tx.forEach((t) => a.push({ t: t.occurred_at, i: 'money', x: `${t.kind === 'income' ? 'Received' : 'Spent'} ${money(t.amount_cents)} · ${esc(t.category)}` }));
  S.biz.forEach((r) => a.push({ t: r.occurred_at, i: 'biz', x: `${r.kind[0].toUpperCase() + r.kind.slice(1)} · ${esc(r.description)}` }));
  S.mem.forEach((m) => a.push({ t: m.created_at || 0, i: 'brain', x: `Remembered “${esc(m.content.slice(0, 48))}”` }));
  return a.filter((x) => x.t).sort((x, y) => y.t - x.t).slice(0, 6); }
const ownerFirst = () => (S.settings.name || A.OWNER.name.split(' ')[0]).trim();
function orbState() { const a = AI.ai; if (['loading', 'downloading', 'verifying'].includes(a.state)) return 'think'; if (a.state !== 'ready') return 'off'; if (a.phase === 'think') return 'think'; if (a.phase === 'speak') return 'speak'; return sheet === 'chat' ? 'listen' : 'rest'; }
function presenceText() { const a = AI.ai, st = orbState(), secs = a.loadStart ? Math.round((Date.now() - a.loadStart) / 1000) : 0;
  if (a.state === 'loading') return `<b>Waking up</b> · ${esc(a.stage || 'Starting')} · ${secs}s`;
  if (a.state === 'downloading' || a.state === 'verifying') return '<b>Installing</b> · see Brain';
  if (a.state === 'ready') return { think: '<b>Thinking…</b>', speak: '<b>Responding…</b>', listen: '<b>Listening</b>', rest: '<b>Awake</b> · resting · works offline' }[st];
  if (a.state === 'cached') return 'Resting · switch on to wake ANNA';
  if (a.state === 'absent' || a.state === 'partial') return 'Offline brain not installed yet';
  if (a.state === 'unsupported') return 'AI brain not available on this device'; return 'Resting'; }
function paintOrbs() { const st = orbState(); document.querySelectorAll('.orb[data-live]').forEach((o) => { if (o.dataset.s !== st) o.dataset.s = st; }); const p = $('#pstatus'); if (p) p.innerHTML = presenceText(); const w = $('#awake'); if (w) { const on = ['ready', 'loading'].includes(AI.ai.state); w.classList.toggle('on', on); w.setAttribute('aria-checked', on); } }
let tick = 0; const ensureTicker = () => { const need = AI.ai.state === 'loading'; if (need && !tick) tick = setInterval(() => { paintOrbs(); if (tab === 'brain') { paintEngine(); const e = $('#loadsecs'); if (e) e.textContent = Math.round((Date.now() - AI.ai.loadStart) / 1000) + 's'; } }, 1000); if (!need && tick) { clearInterval(tick); tick = 0; } };
const aiPill = () => { const a = AI.ai; return a.state === 'ready' ? '<span class="chip good">AI ready · offline</span>' : a.state === 'cached' ? '<span class="chip gold">AI installed · tap to load</span>' : ['downloading', 'verifying', 'loading'].includes(a.state) ? '<span class="chip gold">AI preparing…</span>' : '<span class="chip">AI not installed</span>'; };

// ---- screens ----
const TABS = [['home', 'Home'], ['tasks', 'Tasks'], ['money', 'Money'], ['biz', 'Business'], ['brain', 'Brain']];
const screens = {
  home() {
    const g = tasksOf(), rem = L.pendingReminders(S).slice(0, 2), on = ['ready', 'loading'].includes(AI.ai.state);
    return top() + `<section class="presence">${orb('', true)}<div class="aname">ANNA</div><h1>Hey, ${esc(ownerFirst())}.</h1>
      <div class="pstatus" id="pstatus">${presenceText()}</div>
      <div class="awake"><span>ANNA is awake</span><button class="sw ${on ? 'on' : ''}" id="awake" data-act="awake" role="switch" aria-checked="${on}" aria-label="ANNA is awake"><i></i></button></div>
      <button class="btn ask" data-act="chat-open">Talk to ANNA</button>${checkinHTML()}</section>
      <div class="quiet">${g.today.length ? sh('Today', more('tasks')) + g.today.slice(0, 3).map(taskCard).join('') : ''}
      ${rem.length ? sh('Reminders', `<button class="link" data-act="view" data-id="reminders">See all</button>`) + rem.map(remCard).join('') : ''}
      ${!g.today.length && !rem.length ? `<div class="empty">A quiet day. ANNA is here when you need her.</div>` : ''}</div>`;
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
    const m = L.monthSummary(S), bs = L.budgetStatus(S), bills = S.bills.filter((b) => !b.paid).sort((a, b) => (a.priority || 2) - (b.priority || 2) || a.due_at - b.due_at), paid = S.bills.filter((b) => b.paid).sort((a, b) => (b.paid_at || 0) - (a.paid_at || 0)).slice(0, 5);
    let parts = L.spendingByCategory(S).map(([k, v], i) => ({ label: k, value: v, color: COL[i % COL.length] }));
    if (parts.length > 5) { const rest = parts.slice(5).reduce((n, p) => n + p.value, 0); parts = [...parts.slice(0, 5), { label: 'Other', value: rest, color: '#3A3D43' }]; }
    const mo = six().map((x) => { const s = L.monthSummary(S, x.t); return { l: x.l, a: s.income, b: s.expense }; });
    const tx = [...S.tx].sort((a, b) => b.occurred_at - a.occurred_at).slice(0, 40);
    const v = moneyView(), o = v.order, som = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(), bought = S.tx.filter((t) => t.kind === 'expense' && t.occurred_at >= som).sort((a, b) => b.occurred_at - a.occurred_at), more = !!S.settings.moneyMore;
    const kind = (b) => (b.kind === 'debt' ? 'Debt' : b.kind === 'planned' ? 'Planned' : 'Bill');
    const P = v.plan, p0 = P.periods[0], nx = P.incomes[0], perDay = (x) => (x.perDay == null ? '—' : money(x.perDay));
    const coming = P.periods.slice(1).map((q) => `<div class="mrow"><div class="grow"><b>${esc(q.income.name)} · ${dstr(q.income.date)}</b><div class="mute">${P.cash == null ? `+${money(q.income.amount)} coming in` : `You’ll have ${money(q.dueTotal ? q.end : q.start)}${q.dueTotal ? ` after ${money(q.dueTotal)} bills` : ''} if you only pay bills`}</div>${q.safe == null ? '' : `<div class="mute">Safe to spend then <b class="pos">${money(q.safe)}</b> · ${perDay(q)} a day for ${q.days} days</div>`}</div><b class="pos">+${money(q.income.amount)}</b>${q.income.id && q.income.id !== 'payday' ? `<button class="ib" data-act="inc-del" data-id="${q.income.id}" aria-label="Remove ${esc(q.income.name)}">${ic('x')}</button>` : ''}</div>`).join('');
    const simple = `<div class="hero" id="today"><div class="k">Left after all bills</div><div class="big ${P.left != null && P.left < 0 ? 'neg' : ''}">${P.left == null ? '—' : P.left < 0 ? '−' + money(-P.left) : money(P.left)}</div>
      ${P.cash == null ? `<div class="mute">Tell ANNA how much you have right now${P.billsTotal ? ` · ${money(P.billsTotal)} in bills` : ''}.</div>` : `<div class="sum" id="msum">${money(P.cash)} now${P.coming ? ` + ${money(P.coming)} coming` : ''} − ${money(P.billsTotal)} bills</div>`}
      <div class="pills"><div class="pill wide" id="safenow"><span>Safe to spend now</span><b>${p0.safe == null ? '—' : money(p0.safe)}</b><small>${perDay(p0)} a day</small></div><div class="pill"><span>${nx ? 'Days to ' + esc(nx.name.toLowerCase()) : 'Days to month end'}</span><b>${p0.days}</b></div></div>
      ${P.short ? `<div class="runout">Short by ${money(P.short)} before all bills are paid. Pay order below shows where.</div>` : ''}
      ${coming ? `<div class="coming" id="coming"><div class="k">Money coming</div>${coming}</div>` : ''}
      <div class="adds"><button class="btn sm" data-act="open" data-id="cash">${P.cash == null ? 'Set money now' : 'Update money now'}</button><button class="btn sm soft" data-act="open" data-id="incoming">＋ Money coming</button></div></div>
      ${o.rows.length ? sh('Pay first') + `<div class="card" id="payfirst">${o.rows.map((b, i) => `${i === o.runsOutAt ? '<div class="runout">Money runs out here</div>' : ''}<div class="prow" data-act="pay" data-id="${b.id}"><div class="grow"><b>${esc(b.name)}</b><div class="mute">P${b.priority || 2} · ${kind(b)} · due ${dstr(b.due_at)}</div></div><div class="amt"><b>${money(b.amount_cents)}</b><div class="mute">${money(b.running)}</div></div></div>`).join('')}<div class="mute" style="margin-top:6px">Tap one to mark it paid.</div></div>` : ''}
      ${sh('To be stable')}<div class="card" id="stable">${v.cash == null ? '<div class="mute">Tell ANNA how much you have to see this.</div>' : `<div class="bignum ${v.gap > 0 ? 'over' : 'pos'}">${v.gap > 0 ? `You need ${money(v.gap)} more` : `You’re covered, ${money(-v.gap)} spare`}</div><div class="mute">Everything unpaid ${money(o.total)} + ${money(v.buffer)} buffer = ${money(v.needed)}</div>`}</div>
      ${v.wishes.length ? sh('Want to buy') + `<div class="card" id="wishes">${v.wishes.map((w) => `<div class="prow"><div class="grow"><b>${esc(w.name)}</b><div class="${w.status === 'now' ? 'pos' : 'mute'}">${wishLabel(w)}</div></div><b>${money(w.price)}</b><button class="ib" data-act="wish-del" data-id="${w.id}" aria-label="Remove ${esc(w.name)}">${ic('x')}</button></div>`).join('')}</div>` : ''}
      ${bought.length ? sh('Bought this month') + `<div class="card" id="bought">${bought.slice(0, 30).map((t) => `<div class="prow"><div class="grow">${esc(t.category)}<div class="mute">${dstr(t.occurred_at)}</div></div><b>${money(t.amount_cents)}</b></div>`).join('')}<div class="prow"><b class="grow">Total</b><b>${money(bought.reduce((n, t) => n + t.amount_cents, 0))}</b></div></div>` : ''}
      <div class="adds"><button class="btn" data-act="chat-open">＋ Tell ANNA</button></div>
      <div class="adds"><button class="btn sage" data-act="mmore">${more ? 'Hide details' : 'More details'}</button></div>`;
    return top() + title('Finances', 'Money', 'Calm, clear and entirely private') + simple + (!more ? '' : '<div id="mmore">' +
      `<div class="hero"><div class="k">Net this month</div><div class="big">${money(m.net)}</div><div class="pills"><div class="pill"><span>Income</span><b>${money(m.income)}</b></div><div class="pill"><span>Expenses</span><b>${money(m.expense)}</b></div></div></div>
      <div class="card row" style="gap:12px"><div class="grow"><b>Books Day · the 25th</b><div class="mute">${booksStateGet().closed?.includes(M.booksMonth()) ? 'This month is closed.' : 'Close the month with ANNA, one question at a time.'}</div></div><button class="btn sm" data-act="books-remind">Remind me</button></div>
      <div class="adds"><button class="btn" data-act="open" data-id="mbudget">Monthly calculator</button><button class="btn soft" data-act="open" data-id="calc">Calculator</button><button class="btn sage" data-act="open" data-id="afford">Can I afford it?</button></div>
      <div class="adds">${addBtn('tx', '＋ Entry')}${addBtn('bill', '＋ Bill', 'soft')}${addBtn('budget', '＋ Budget', 'sage')}</div>
      ${sh('Spending breakdown')}<div class="card">${parts.length ? `<div class="donutw">${donut(parts)}<div class="leg">${parts.map((p) => `<div><i style="background:${p.color}"></i>${esc(p.label)}<span>${money(p.value)}</span></div>`).join('')}</div></div>` : empty('No spending recorded this month.')}</div>
      ${sh('Cash flow')}<div class="card">${bars(mo)}<div class="key"><span><i style="background:#D9DCE1"></i>Income</span><span><i style="background:#5C6169"></i>Spent</span></div></div>
      ${sh('Budgets')}${bs.map((b) => `<div class="card"><div class="row"><b class="grow tap" data-act="edit" data-k="budget" data-id="${b.id}">${esc(b.category)}</b><span class="${b.over ? 'over' : 'mute'}">${money(b.spent)} of ${money(b.limit_cents)}</span>${editBtn('budget', b.id)}${delBtn('budget', b.id)}</div><div class="bar ${b.over ? 'over' : ''}"><i style="width:${Math.min(100, Math.round((b.spent / b.limit_cents) * 100))}%"></i></div><div class="mute" style="margin-top:6px">${b.over ? `${money(-b.left)} over budget` : `${money(b.left)} left this month`}</div></div>`).join('') || `<div class="card">${empty('Set a monthly budget for a category to keep spending gentle.')}</div>`}
      ${sh('Bills to pay')}<div class="card">${bills.map((b) => `<div class="item"><div class="grow tap" data-act="edit" data-k="bill" data-id="${b.id}"><b>${esc(b.name)}</b> <span class="chip ${(b.priority || 2) === 1 ? 'gold' : ''}">P${b.priority || 2}</span><div class="mute">${b.due_at < SOD ? '<span class="over">Overdue</span> · ' : ''}Due ${dstr(b.due_at)} · unpaid${b.repeat_monthly ? ' · monthly' : ''}${b.last_paid_at ? ' · last paid ' + dstr(b.last_paid_at) : ''}</div></div><b>${money(b.amount_cents)}</b><button class="btn sage sm" data-act="pay" data-id="${b.id}">Paid</button>${delBtn('bill', b.id)}</div>`).join('') || empty('No unpaid bills.')}</div>
      ${paid.length ? sh('Recently paid') + `<div class="card">${paid.map((b) => `<div class="item"><div class="grow"><b>${esc(b.name)}</b><div class="mute">Paid ${dstr(b.paid_at)}</div></div><b>${money(b.amount_cents)}</b><button class="btn sage sm" data-act="unpay" data-id="${b.id}">Undo</button>${delBtn('bill', b.id)}</div>`).join('')}</div>` : ''}
      ${sh('Transactions')}<div class="card">${tx.map((t) => `<div class="item"><div class="dot ${t.kind === 'income' ? '' : 'g'}">${ic('money')}</div><div class="grow tap" data-act="edit" data-k="tx" data-id="${t.id}"><b>${esc(t.category)}</b><div class="mute">${dstr(t.occurred_at)}${t.note ? ' · ' + esc(t.note) : ''}</div></div><b class="${t.kind === 'income' ? 'pos' : ''}">${t.kind === 'income' ? '+' : '−'}${money(t.amount_cents)}</b>${delBtn('tx', t.id)}</div>`).join('') || empty('No entries yet. Tap ＋ Entry to record income or an expense.')}</div>` + '</div>');
  },
  biz() {
    const b = L.businessSummary(S), mo = six().map((x) => { const s = L.businessSummary(S, x.t); return { l: x.l, a: s.revenue, b: s.expenses }; });
    const inv = S.biz.filter((r) => r.kind === 'invoice' && r.status === 'unpaid'), [m0, m1] = L.monthRange();
    const sales = S.biz.filter((r) => r.kind === 'sale' && r.occurred_at >= m0 && r.occurred_at < m1).length;
    const bizSeg = `<div class="seg" role="tablist">${[['overview', 'Overview'], ['staff', 'Staff']].map(([k, n]) => `<button data-act="bizview" data-id="${k}" role="tab" aria-selected="${k === bizView}" class="${k === bizView ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    if (bizView === 'staff') return top() + title('Enterprise', 'Business', 'Staff, shifts and wages') + bizSeg + staffHTML();
    return top() + title('Enterprise', 'Business', 'Cash basis, this month') + bizSeg +
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
    const views = [['journal', 'Journal'], ['goals', 'Goals'], ['mem', 'Memories'], ['ai', 'AI']];
    const seg = `<div class="seg" role="tablist">${views.map(([k, n]) => `<button data-act="bview" data-id="${k}" role="tab" aria-selected="${k === brainView}" class="${k === brainView ? 'on' : ''}">${n}</button>`).join('')}</div>`;
    const body = brainView === 'ai' ? `<div id="engine">${engineHTML()}</div>${accessHTML()}` : brainView === 'journal' ? journalHTML() : brainView === 'goals' ? goalsHTML() :
      `<div class="mute" style="margin:4px 2px 8px">Everything ANNA remembers about you. She only saves something after asking you. Tap a memory to edit it.</div><div class="neural">${net}<div class="cap"><span>${S.mem.length} memories</span><span>${cats.length - 1} categories</span></div></div>
      <div class="adds">${addBtn('mem', '＋ Remember')}${S.mem.length ? '<button class="btn bad" data-act="mem-clear">Delete all</button>' : ''}</div>
      <input id="q" class="search" type="search" placeholder="Search memories" value="${esc(memQ)}" aria-label="Search memories">
      <div class="chips">${cats.map((c) => `<button data-act="memcat" data-id="${esc(c)}" class="${c === memCat ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>
      <div id="memlist">${memList()}</div>
      ${sh('Feedback history')}<div class="card">${fbs.map((f) => `<div class="item"><div class="dot ${f.rating === 'up' ? '' : 'g'}">${ic(f.rating === 'up' ? 'check' : 'x')}</div><div class="grow">${esc(f.text)}<div class="mute">${f.rating === 'up' ? 'Marked helpful' : 'Marked not right'} · ${ago(f.at)}</div></div></div>`).join('') || empty('Feedback you give on memories appears here.')}</div>`;
    return top() + title('Mind & memory', 'Brain', 'Your journal, goals and what ANNA keeps in mind. Stored only on this device.') + seg + body;
  },
  data() {
    const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
    const curOpts = [['R', 'R — South African rand'], ['$', '$ — US dollar'], ['€', '€ — euro'], ['£', '£ — pound']];
    const isCustom = !curOpts.some(([k]) => k === cur());
    return `<div class="top"><div class="brand">${backBtn()}${brandLogo()}Settings</div><button class="ib" data-tab="home" aria-label="Close settings">${ic('x')}</button></div>` + title('Your data', 'Data & settings', 'Everything stays on this device.') +
      `<div class="card"><h2>Owner & security</h2><div class="status"><b>Original owner</b><span>${esc(A.OWNER.name)}</span><b>Password</b><span>Set ${auth ? new Date(auth.changed_at).toLocaleDateString('en-ZA') : ''} · stored only as a PBKDF2 hash</span><b>Auto-lock</b><span>after 5 minutes in the background</span></div>
        <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="lock">Lock now</button><button class="btn sage sm" data-act="open" data-id="chpw">Change password</button></div></div>
      <div class="card"><h2>Anna logo</h2><div class="row" style="margin:8px 0">${brandLogo('biglogo sm')}<div class="mute grow">${logoUrl ? 'Your own logo is shown on the lock screen and at the top of every page.' : 'Using the default logo. Upload your own image (PNG or JPG); it stays on this device and is included in backups.'}</div></div>
        <div class="row wrap"><button class="btn sm" data-act="logo-pick">${logoUrl ? 'Replace logo…' : 'Upload logo…'}</button>${logoUrl ? '<button class="btn sage sm" data-act="logo-reset">Reset to default</button>' : ''}</div><input id="logofile" type="file" accept="image/*" hidden></div>
      <div class="card"><div class="swrow"><div class="grow"><b>Auto-save chat money entries (undo available)</b><div class="mute">Off: ANNA shows what she understood and waits for your tap.</div></div><button class="sw ${S.settings.autoMoney ? 'on' : ''}" data-act="automoney" aria-label="Auto-save chat money entries"></button></div></div>
      <div class="card"><h2>Web research</h2><div class="mute" style="margin:4px 0 8px">Not switched on. Questions about news, weather or other current events need a web search service you approve first. Until then ANNA says so and never guesses. Nothing leaves this device.</div><div class="mute">Options waiting for your approval:<br>• Tavily: 1,000 searches a month free, then about $0.008 each. Needs a Tavily API key.<br>• Brave Search API: about $5 per 1,000 searches, with a $5 monthly credit. Needs a Brave API key and a card on file.</div></div>
      <div class="card"><h2>Back up & restore</h2><div class="mute" style="margin:4px 0 12px">Safari can clear website data. Export a backup regularly and keep it in Files or iCloud. Backups are <b>encrypted with your password</b> and include tasks, reminders, money, business, memories, chat history, settings, your logo and your owner identity (not the AI model). To open one on another device you need the password that was set when it was made.</div>
        <div class="row"><button class="btn grow" data-act="export">Export backup</button><button class="btn sage grow" data-act="import">Restore…</button></div><input id="file" type="file" accept="application/json,.json" hidden>
        ${hasPrev ? '<button class="link" data-act="undo-restore">Undo last restore / erase</button>' : ''}<div class="mute" style="margin-top:8px">${esc(L.describeCounts(L.counts(S)))}</div></div>
      <div class="card"><h2>What ANNA keeps</h2><div class="mute" style="margin:4px 0 8px">Each kind of personal data is stored separately on this device. Your journal is never copied into memories and is only shown to the AI when you tap Reflect with ANNA.</div><div class="status">${[['memories', 'Memories'], ['journal', 'Journal entries'], ['goals', 'Goals'], ['progress', 'Progress logs'], ['preferences', 'Preferences']].map(([k, n]) => `<b>${n}</b><span>${LIFE[k].length}${LIFE[k].length && k !== 'preferences' ? ` · <button class="link" style="min-height:0;padding:0" data-act="store-clear" data-id="${k}">Delete all</button>` : ''}</span>`).join('')}</div><button class="btn sage sm" style="margin-top:10px" data-act="bview-go" data-id="mem">Review memories</button></div>
      <div class="card"><h2>Preferences</h2><label class="f"><span>How should ANNA support you?</span><select id="style">${LF.STYLES.map(([k, n]) => `<option value="${k}" ${k === prefOf('style') ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label class="f"><span>Your name</span><input id="nm" value="${esc(S.settings.name || '')}" maxlength="40" placeholder="For your greeting" autocomplete="given-name"></label>
        <label class="f"><span>Currency</span><select id="cursel">${curOpts.map(([k, n]) => `<option value="${esc(k)}" ${k === cur() ? 'selected' : ''}>${esc(n)}</option>`).join('')}<option value="custom" ${isCustom ? 'selected' : ''}>Other symbol…</option></select></label>
        <label class="f" id="curwrap" ${isCustom ? '' : 'hidden'}><span>Currency symbol</span><input id="cur" value="${esc(isCustom ? cur() : '')}" maxlength="5"></label>
        <button class="btn soft sm" data-act="prefs">Save preferences</button></div>
      <div class="card"><h2>Reminder alerts</h2><div class="mute" style="margin:4px 0 10px">${remHelp()}</div><div class="status"><b>Notifications</b><span class="${perm === 'granted' ? 'y' : perm === 'denied' ? 'n' : 'm'}">${{ granted: 'Allowed', denied: 'Blocked by the browser (on iPhone: Settings → Notifications → Anna)', default: 'Not yet allowed', unsupported: navigator.standalone === false ? 'Open Anna from the Home Screen icon to enable' : 'Not supported in this browser' }[perm]}</span></div>
        ${perm === 'default' ? '<button class="btn sm" style="margin-top:10px" data-act="notif">Allow notifications</button>' : ''}${perm === 'granted' ? '<button class="btn sage sm" style="margin-top:10px" data-act="notif-test">Send a test alert</button>' : ''}</div>
      <div class="card"><h2>AI engine</h2><div class="status"><b>Engine</b><span>WebLLM (WebGPU)</span><b>Model</b><span>${esc(AI.ai.info.modelId || AI.MODEL.name)}</span><b>Status</b><span>${esc({ ready: 'Loaded · works offline', cached: 'On this device · not loaded', absent: 'Not downloaded yet', downloading: 'Downloading…', loading: 'Loading…', unsupported: 'AI brain not available on this device (no WebGPU)' }[AI.ai.state] || AI.ai.state)}</span></div></div>
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
let oldInfo = null, oldChecked = false;
const checkOld = async () => { if (oldChecked) return; oldChecked = true; oldInfo = await AI.oldModel(); if (oldInfo) { engKey = ''; paintEngine(); } };
function engineHTML() {
  checkOld();
  const a = AI.ai, st = a.state, M = AI.MODEL, p = a.progress, pct = p ? Math.min(100, Math.floor((p.loaded / (p.total || M.bytes)) * 100)) : 0;
  const pill = { unknown: ['Checking…', ''], unsupported: ['Not supported', 'bad'], absent: ['Not installed', ''], partial: ['Incomplete download', 'bad'], downloading: [`Downloading ${pct}%`, 'gold'], verifying: [`Verifying ${pct}%`, 'gold'], cached: ['Installed · not loaded', 'gold'], loading: ['Loading…', 'gold'], ready: ['Ready · works offline', 'good'] }[st] || ['Unknown', ''];
  const b = (act, t, c = '') => `<button class="btn ${c}" data-act="${act}">${t}</button>`;
  const row = { absent: b('ai-download', a.error ? 'Retry download' : `Download AI brain · ${mb(M.bytes)}`), partial: b('ai-download', 'Download again') + b('ai-delete', 'Delete', 'bad'), downloading: b('ai-cancel', 'Cancel download', 'sage'), verifying: '<button class="btn" disabled>Checking the file…</button>', cached: b('ai-load', a.error ? 'Retry' : 'Load into memory') + b('ai-delete', 'Delete model', 'bad'), loading: b('ai-cancel-load', 'Cancel', 'sage'), ready: b('chat-open', 'Ask Anna') + b('ai-unload', 'Unload', 'sage') + b('ai-delete', 'Delete model', 'bad') }[st] || '';
  const stg = a.storage ? `Browser storage: ${mb(a.storage.usage)} used of ${mb(a.storage.quota)} · ${a.storage.persisted ? 'persistent' : 'not marked persistent'}` : '';
  const prog = st === 'downloading' || st === 'verifying';
  return `<div class="card mind"><div class="row"><h2 class="grow">Anna’s offline AI</h2><span class="chip ${pill[1]}" id="pill">${pill[0]}</span></div>
    <div class="mute" style="margin:6px 0 10px">${esc(M.name)} (${M.quant}) · ${mb(M.bytes)} · runs only on this device. ${st === 'absent' ? 'One-time download over Wi-Fi; afterwards Anna answers with no internet.' : ''}</div>
    ${prog ? `<div class="bar"><i id="dlbar" style="width:${pct}%;animation:none"></i></div><div class="mute" id="dltxt" style="margin:6px 0 10px">${st === 'verifying' ? `Checking SHA-256: ${mb(p?.loaded)} of ${mb(p?.total)}` : `${mb(p?.loaded)} of ${mb(p?.total)} · keep the screen on and Anna open`}</div>` : ''}
    ${st === 'loading' ? `<div class="bar busy"><i></i></div><div class="loadline"><span>${esc(a.stage || 'Starting')}…</span><span id="loadsecs">${Math.round((Date.now() - a.loadStart) / 1000)}s</span></div>${Date.now() - a.loadStart > 90000 ? '<div class="note">This is slower than expected. Keep ANNA open with the screen on, and close other apps. You can cancel safely: the model stays installed.</div>' : ''}` : ''}
    ${a.crashed && st !== 'loading' ? `<div class="warn">Last time the model was loading, the page was closed (usually iOS running out of memory). Close other apps, then try again.<br><button class="link" data-act="ai-ack">Dismiss</button></div>` : ''}
    ${a.error ? `<div class="warn">${esc(a.error)}</div>` : ''}
    ${st === 'ready' && a.info.selfTest ? `<div class="ok">Self-test passed: the model answered “${esc(a.info.selfTest.reply.slice(0, 60))}”.</div>` : ''}
    <div class="btnrow">${row}</div>
    ${oldInfo ? `<div class="note">The previous AI model (wllama, ${mb(oldInfo.bytes)}) is still stored on this device and is no longer used.<div class="row wrap" style="margin-top:8px"><button class="btn sm bad" data-act="old-delete">Delete old model</button><button class="btn sm sage" data-act="old-keep">Keep for now</button></div></div>` : ''}
    <div class="mute" style="margin-top:10px">${a.info.bytes ? `On this device: ${mb(a.info.bytes)}. ` : ''}${a.info.loadMs ? `Loaded in ${(a.info.loadMs / 1000).toFixed(1)} s. ` : ''}${a.info.tps ? `Last speed: ${a.info.tps} tokens/s. ` : ''}${stg}</div>
    <details style="margin-top:8px"><summary class="mute" style="min-height:44px;display:flex;align-items:center;cursor:pointer">Advanced &amp; limitations</summary>
      <div class="mute" style="margin:4px 0 6px">Engine: WebLLM on the phone’s GPU (WebGPU). Model ${esc(a.info.modelId || M.name)}. It is downloaded once and kept on this device, so it also loads in Airplane Mode. A small model can be wrong: always check numbers on the Money screen. The model is not part of backups.</div>
    </details>
    <div class="row wrap" style="margin-top:6px"><button class="btn sage sm" data-act="diag">Run diagnostics</button>${diag ? '<button class="btn sage sm" data-act="diag-copy">Copy report</button>' : ''}</div>${diag && tab === 'brain' ? `<pre class="diag">${esc(diag)}</pre>` : ''}</div>`;
}
const accessHTML = () => `<div class="card"><h2>What Anna may read</h2><div class="mute" style="margin:4px 0 4px">Only switched-on categories are shown to the local model, and nothing ever leaves this device. Notes and customer names are never included, and Anna can read but never change your data.</div>${AI.ACCESS.map(([k, n]) => sw(k, n)).join('')}<button class="link" data-act="ctx-open">Preview exactly what Anna sees</button></div>`;
const SUGG = ['What should I focus on today?', 'How am I doing on money this month?', 'Which bills and invoices are unpaid?', 'Give me three tips to save on groceries.'];
const extraBtns = (m) => (m.undo && entryUndo[m.undo] ? `<div class="row wrap" style="margin-top:8px"><button class="btn sm sage" data-act="ent-undo" data-id="${m.undo}">Undo</button></div>` : '') + (m.books ? `<div class="row wrap" style="margin-top:8px">${m.books.map(([a, n, c]) => `<button class="btn sm ${c || ''}" data-act="${a}">${n}</button>`).join('')}</div>` : '');
const followBtns = (m) => { const r = m.follow && S.reminders.find((x) => x.id === m.follow); return r && !r.done ? `<div class="row wrap" style="margin-top:8px"><button class="btn sm" data-act="rem-ios" data-id="${r.id}">iPhone Reminders</button><button class="btn sm sage" data-act="rem-ics" data-id="${r.id}">Add to Calendar</button></div><div class="mute" style="font-size:12px;margin-top:4px">${whereLives(r)}</div>` : ''; };
const bubble = (m, i) => `<div class="bub ${m.role}${m.error ? ' err' : ''}">${m.error ? esc(m.error) : m.content ? esc(m.content).replace(/\n/g, '<br>') : '<span class="mute typing">Thinking</span>'}${m.follow ? followBtns(m) : ''}${extraBtns(m)}${m.at ? `<span class="t">${tstr(m.at)}</span>` : ''}</div>`;
function chatMain() {
  const a = AI.ai, ready = a.state === 'ready';
  let note = '';
  if (!ready) {
    const msg = { unknown: 'Checking Anna’s brain…', unsupported: 'This browser cannot run the local AI. ' + esc(a.error), absent: `Anna’s offline AI is not installed yet. It is a one-time download of about ${mb(AI.MODEL.bytes)}.`, partial: 'The model download is incomplete. Open Brain to download it again.', downloading: 'Downloading the model…', verifying: 'Checking the downloaded model…', cached: 'The model is on this device but not loaded into memory yet.', loading: 'Loading the model. This can take a minute. Keep Anna open.' }[a.state] || '';
    note = `<div class="card banner-in"><b>Anna can’t answer yet</b><div class="mute" style="margin:6px 0 12px">${msg}${S.chat.length ? ' Your past conversation is below.' : ''}</div>${a.state === 'cached' ? '<button class="btn full" data-act="ai-load">Load Anna’s brain</button>' : ['loading', 'downloading', 'verifying'].includes(a.state) ? '<div class="bar busy"><i></i></div>' : '<button class="btn full" data-act="chat-to-brain">Open Brain setup</button>'}${a.error && a.state !== 'unsupported' ? `<div class="warn" style="margin-top:10px">${esc(a.error)}</div>` : ''}</div>`;
  }
  const sugg = ready && !S.chat.length ? `<div class="empty">Ask about your day, money or business, or anything else.<br>Anna only sees what you allow in Brain.</div>${SUGG.map((q, i) => `<button class="btn sage full" style="margin:6px 0" data-act="chat-suggest" data-id="${i}">${q}</button>`).join('')}` : '';
  const rem = pendingRemember ? `<div class="card" style="margin:4px 0"><div>${pendingRemember.style ? `Want me to remember that you prefer: <b>${esc(LF.STYLES.find(([k]) => k === pendingRemember.style)[1])}</b>?` : `Want me to remember this?<div class="mute" style="margin-top:4px">“${esc(pendingRemember.text.slice(0, 160))}”</div>`}</div><div class="row" style="margin-top:10px"><button class="btn sm" data-act="rem-yes">Yes, remember</button><button class="btn sm sage" data-act="rem-no">No</button></div></div>` : '';
  const ec = pendingEntry ? `<div class="card" style="margin:4px 0"><div class="row wrap"><button class="btn sm" data-act="ent-save">Save</button><button class="btn sm sage" data-act="ent-edit">Edit</button><button class="btn sm sage" data-act="ent-cancel">Cancel</button></div></div>` : '';
  const rq = pendingReminder?.ts ? `<div class="card" style="margin:4px 0"><div class="row wrap"><button class="btn sm" data-act="rq-save">Save in ANNA</button><button class="btn sm sage" data-act="rq-edit">Change…</button><button class="btn sm sage" data-act="rq-cancel">Cancel</button></div></div>` : '';
  const bc = pendingBatch ? `<div class="card" style="margin:4px 0">${pendingBatch.items.map((x, i) => `<div class="item"><div class="grow">${esc(x.name)} <span class="mute">${esc(M.ITEM_LABEL[x.type])}</span></div><button class="btn sm sage" data-act="bat-edit" data-id="${i}">Edit item</button><button class="btn sm sage" data-act="bat-del" data-id="${i}">Remove item</button></div>`).join('')}<div class="row wrap" style="margin-top:6px"><button class="btn sm" data-act="bat-save">Save all</button><button class="btn sm sage" data-act="bat-cancel">Cancel</button></div></div>` : '';
  return `${note}<div class="msgs" id="msgs">${S.chat.map(bubble).join('')}${sugg}${rem}${rq}${ec}${bc}</div>`;
}
function chatPanel() {
  const on = AI.ACCESS.filter(([k]) => S.settings.ai[k]).map(([, n]) => n), busy = AI.ai.busy;
  return `<div class="pn chat" role="dialog" aria-label="Ask Anna"><div class="row" style="margin-bottom:8px"><div class="grow"><div class="row" style="gap:10px">${orb('md')}<h2>ANNA</h2></div><div class="mute">${on.length ? 'Can read: ' + on.join(', ') : 'Can read nothing yet'} · <button class="link" style="min-height:0;padding:0" data-act="ctx-open">what’s shared</button></div></div><button class="ib" data-act="chat-clear" aria-label="Clear conversation">${ic('trash')}</button><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div>
    <div id="chatmain" class="chatmain">${chatMain()}</div>
    <form data-form="chat" class="chatin"><textarea name="msg" rows="1" placeholder="${AI.ai.state === 'ready' ? 'Ask ANNA…' : 'Remind me…, times, dates (AI asleep)'}" maxlength="800" required aria-label="Message"></textarea>${busy ? `<button type="button" class="btn sage" data-act="chat-stop" aria-label="Stop">${ic('stop')}</button>` : `<button class="btn" id="send">Send</button>`}</form></div>`;
}
const ctxPanel = () => `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="What Anna sees"><div class="gr"></div><div class="row"><h2 class="grow">What Anna sees</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div><div class="mute" style="margin:6px 0 10px">This is the complete data block given to the local model with each question (memories are picked by relevance to your question). It never leaves your device.</div><pre class="diag">${esc(AI.buildContext(S, S.settings.ai, Date.now(), '', aiLife()))}</pre></div>`;
const restorePanel = () => { const r = pendingRestore; if (!r) return '';
  if (r.env && !r.state) return `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="Restore backup"><div class="gr"></div><div class="row"><h2 class="grow">Encrypted backup</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div><div class="mute" style="margin:8px 0">${esc(r.name)} · enter the password that was used when this backup was made.</div><form data-form="restorepw" novalidate>${fld('Backup password', '<input name="pw" type="password" autocomplete="current-password" required>')}<button class="btn full" style="margin-top:12px">Open backup</button></form></div>`; const a = L.counts(r.state), b = L.counts(S);
  return `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="Restore backup"><div class="gr"></div><div class="row"><h2 class="grow">Restore this backup?</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div>
  <div class="mute" style="margin:8px 0">File: ${esc(r.name)}${r.state.exported_at ? ' · exported ' + esc(new Date(r.state.exported_at).toLocaleString('en-ZA')) : ''}</div>
  <div class="status"><b>Backup</b><span>${esc(L.describeCounts(a))}</span><b>On this device now</b><span>${esc(L.describeCounts(b))}</span></div>
  <div class="note">Restoring <b>replaces</b> everything on this device with the backup. A safety copy of your current data is kept, so you can undo it from Settings.</div>
  <button class="btn full" data-act="restore-confirm">Replace my data with this backup</button><button class="btn sage full" style="margin-top:8px" data-act="close">Cancel</button></div>`; };
let engKey = '';
const paintEngine = () => { const e = $('#engine'); if (!e) return; const a = AI.ai, key = [a.state, a.stage, a.state === 'loading' && Date.now() - a.loadStart > 90000, a.error, a.crashed, diag, JSON.stringify(a.info), JSON.stringify(a.storage), JSON.stringify(S.settings.ai)].join('|');
  if (key === engKey && (a.state === 'downloading' || a.state === 'verifying') && $('#dlbar')) { const p = a.progress, pct = p ? Math.min(100, Math.floor((p.loaded / (p.total || AI.MODEL.bytes)) * 100)) : 0; $('#dlbar').style.width = pct + '%'; $('#dltxt').textContent = a.state === 'verifying' ? `Checking SHA-256: ${mb(p?.loaded)} of ${mb(p?.total)}` : `${mb(p?.loaded)} of ${mb(p?.total)} · keep the screen on and Anna open`; $('#pill').textContent = `${a.state === 'verifying' ? 'Verifying' : 'Downloading'} ${pct}%`; return; }
  const open = e.querySelector('details')?.open; engKey = key; e.innerHTML = engineHTML(); if (open) e.querySelector('details').open = true; };
let chatKey = '';
const paintChat = (force) => { const m = $('#chatmain'); if (!m) return; const a = AI.ai, key = a.state + a.busy + a.error;
  if (!force && key !== chatKey) { chatKey = key; const ta = $('.chatin textarea'), v = ta?.value, foc = document.activeElement === ta; $('#sheet').innerHTML = chatPanel(); const t2 = $('.chatin textarea'); if (t2) { t2.value = v || ''; if (foc) t2.focus(); } }
  const mm = $('#chatmain'), o = $('#msgs'), near = !o || o.scrollHeight - o.scrollTop - o.clientHeight < 120; mm.innerHTML = chatMain(); const x = $('#msgs'); if (x && near) mm.scrollTop = mm.scrollHeight; };
const warmChat = () => { if (AI.ai.state === 'ready' && !AI.ai.busy) AI.warm(AI.buildMessages(AI.buildContext(S, S.settings.ai, Date.now(), '', aiLife()), S.chat, '', cur()).slice(0, -1)); };
// Tools first (exact answers from code, work without the AI): reminders, clock, dates, public holidays.
function toolReply(text) {
  if (pendingReminder && !pendingReminder.ts) { const w = TM.parseWhen(text); if (w?.hasDate || w?.hasTime) { pendingReminder = { ...pendingReminder, ts: w.ts, hasTime: w.hasTime, repeat: w.repeat !== 'none' ? w.repeat : pendingReminder.repeat }; return reminderAsk(); } }
  lastRoute = pendingReminder ? 'reminders' : 'finance';
  if (BK) { const r = booksAnswer(text); if (r) return r; }
  if (/^\s*(start )?books day\s*$/i.test(text)) { BK = { step: 0, month: M.booksMonth() }; setTimeout(() => booksAsk(), 0); return 'Let’s close the month.'; }
  if (pendingBatch) { const r = batchAnswer(text); if (r) return r; }
  { const mv = M.parseMoveDue(text); if (mv) { lastRoute = 'finance'; if (mv.type === 'moveDue' && !mv.date) { const pd = moneyView().payday; if (!pd) return 'When do you get paid? For example: “move all due dates to the 26th”.'; mv.date = pd.date; } if (mv.type === 'moveDue' && !S.bills.some((b) => !b.paid)) return 'You have no unpaid bills to move.'; pendingEntry = { ...mv, text }; return describeEntry(mv); } }
  if (!['reminders', 'calc', 'staff', 'memory', 'journal', 'research'].includes(RT.route(text))) { const mb = M.parseItems(text); if (mb) { lastRoute = 'finance'; return batchStart(mb, text); } }
  lastRoute = RT.route(text);
  if (lastRoute === 'memory') return memoryReply(text);
  if (lastRoute === 'journal') return journalReply(text);
  if (lastRoute === 'research') return RT.researchReply(text, { online: navigator.onLine, service: prefOf('research') });
  const d = TM.parseReminder(text);
  if (d) { pendingReminder = d; if (!d.title) { pendingReminder = null; return 'What should I remind you about? For example: “Remind me to call Mom tomorrow at 3pm”.'; } if (!d.ts) return `When should I remind you to “${d.title}”? For example: tomorrow at 9am, next Friday, or in 2 hours.`; if (d.ts <= Date.now()) { pendingReminder = { ...d, ts: null }; return 'That time has already passed. When should I remind you instead?'; } return reminderAsk(); }
  const t = TM.answerTime(text); return t || moneyReply(text) || entryReply(text) || '';
}
// Tool first, then Qwen phrases it (spec §6). The exact answer is shown at once; Qwen's wording replaces it only if
// every number survives (router.acceptPhrase). Otherwise the exact answer stays as it is.
async function phrase(msg, question) {
  const facts = msg.content;
  try { const out = await AI.ask(RT.phraseMessages(AI.systemPrompt(cur()), question, facts), null, { maxTokens: 90 }); const ok = RT.acceptPhrase(facts, out); if (ok) { msg.content = ok; msg.facts = facts; } } catch {}
  paintChat(true); await save();
}
// "What did I tell you about…" → saved memories only. Never invented.
function memoryReply(text) {
  const mem = S.mem.filter((m) => m.status !== 'assumption'), topic = (text.match(/\b(?:about|remember)\s+(.+?)[?.!]*$/i)?.[1] || '').replace(/^(?:me|myself|that)$/i, '').trim();
  if (!mem.length) return 'You haven’t asked me to remember anything yet. When you tell me something worth keeping, I’ll ask before saving it.';
  const hits = topic ? LF.relevant(mem, [], topic, 5).filter((x) => x.s > 0).map((x) => x.text) : [...mem].sort((a, b) => (b.created_at || 0) - (a.created_at || 0)).slice(0, 5).map((m) => m.content);
  if (!hits.length) return `I don’t have anything saved about ${topic}. If you tell me, I’ll ask before I remember it.`;
  return `Here’s what you told me${topic ? ` about ${topic}` : ''}:\n` + hits.map((x) => '• ' + x).join('\n');
}
// "How did I feel…" → moods from the journal for that period (counts and averages from code; entry text stays private).
function journalReply(text) {
  const t = text.toLowerCase(), now = new Date(), y = now.getFullYear(), mo = now.getMonth(), sod = new Date(y, mo, now.getDate()).getTime(), day = 864e5, wk = LF.startOfWeek();
  const [from, to, label] = /yesterday/.test(t) ? [sod - day, sod - 1, 'yesterday'] : /today/.test(t) ? [sod, sod + day - 1, 'today'] : /last week/.test(t) ? [wk - 7 * day, wk - 1, 'last week'] : /this week/.test(t) ? [wk, sod + day - 1, 'this week'] : /last month/.test(t) ? [new Date(y, mo - 1, 1).getTime(), new Date(y, mo, 1).getTime() - 1, 'last month'] : /this month/.test(t) ? [new Date(y, mo, 1).getTime(), sod + day - 1, 'this month'] : [sod - 6 * day, sod + day - 1, 'the last 7 days'];
  const es = LIFE.journal.filter((e) => { const x = new Date(e.date + 'T12:00:00').getTime(); return x >= from && x <= to; }).sort((a, b) => (a.date < b.date ? 1 : -1)), md = es.filter((e) => e.mood);
  if (!es.length) return `You didn’t write any journal entries for ${label}, so I can’t say how you felt. I only go by what you wrote.`;
  if (!md.length) return `You wrote ${es.length} journal ${es.length === 1 ? 'entry' : 'entries'} for ${label}, but none had a mood picked, so I can’t say how you felt.`;
  const name = (v) => LF.MOODS.find(([k]) => k === v)[1].toLowerCase(), avg = md.reduce((a, e) => a + e.mood, 0) / md.length, avgS = (Math.round(avg * 10) / 10).toString().replace('.', ',');
  return [`From your journal for ${label} (${es.length} ${es.length === 1 ? 'entry' : 'entries'}, ${md.length} with a mood):`, ...md.slice(0, 7).map((e) => `• ${dstr(new Date(e.date + 'T12:00:00').getTime())}: ${name(e.mood)}`), `Average mood: ${avgS} out of 5 (${name(Math.round(avg))}).`].join('\n');
}
const reminderAsk = () => { const d = pendingReminder; return `Shall I remind you to “${d.title}” on ${TM.fmtDateTime(d.ts)}${d.repeat && d.repeat !== 'none' ? ', repeating ' + ({ daily: 'every day', weekly: 'every week', monthly: 'every month' }[d.repeat]) : ''}${d.hasTime === false ? ' (I picked 09:00, change it if you like)' : ''}?`; };
async function sendChat(text, opts) {
  text = text.trim(); if (!text || AI.ai.busy) return;
  const tool = toolReply(text);
  if (tool) { const tag = pendingReminder ? 'reminders' : pendingEntry || pendingBatch ? 'finance' : lastRoute !== 'qwen' ? lastRoute : 'clock', msg = { role: 'assistant', content: tool, at: Date.now(), tool: tag }; S.chat.push({ role: 'user', content: text, at: Date.now() }, msg); pendingRemember = null; paintChat(true); await save();
    if (S.settings.autoMoney && pendingEntry) return saveEntry(); if (S.settings.autoMoney && pendingBatch && !pendingBatch.ask.length) return batchSave();
    if (AI.ai.state === 'ready' && RT.PHRASE.has(tag) && !pendingEntry && !pendingBatch && !pendingReminder && !BK) await phrase(msg, text); return; }
  if (AI.ai.state !== 'ready') { S.chat.push({ role: 'user', content: text, at: Date.now() }, { role: 'assistant', content: 'My AI brain isn’t awake right now, so for now I can set reminders and tell you times, dates and public holidays. Turn on “ANNA is awake” on Home to talk about anything else.', at: Date.now(), tool: 'clock' }); paintChat(true); await save(); return; }
  const hist = S.chat.slice(), a = { role: 'assistant', content: '', at: 0 }; S.chat.push({ role: 'user', content: text, at: Date.now() }, a); if (opts?.noRemember) pendingRemember = null; else offerRemember(text); paintChat(true); save();
  try {
    const ctx = AI.buildContext(S, S.settings.ai, Date.now(), text, aiLife());
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
  cash: () => [ 'Money now', `${fld(`How much do you have right now? (${esc(cur())})`, `<input name="amount" inputmode="decimal" placeholder="0,00" required ${moneyView().cash != null ? val(L.centsToInput(moneyView().cash)) : ''}>`)}<div class="mute">All your accounts and cash together. ANNA subtracts every unpaid bill from this.</div>`, 'Save'],
  incoming: () => [ 'Money coming', `${fld('From / what for', `<input name="name" placeholder="e.g. Salary, client, refund" maxlength="60" required>`)}<div class="two">${fld(`Amount (${esc(cur())})`, `<input name="amount" inputmode="decimal" placeholder="0,00" required>`)}${fld('Date it comes', `<input name="date" type="date" required>`)}</div><div class="mute">Any date, also next year. It adds to what you’ll have from that day.</div>`, 'Add'],
  task: (r = {}) => [r.id ? 'Edit task' : 'New task', `${fld('Task', `<input name="title" placeholder="What needs doing?" maxlength="200" required ${val(r.title)}>`)}<div class="two">${fld('Due date', `<input name="due" type="date" ${val(L.tsToDay(r.due_at))}>`)}${fld('Priority', `<select name="priority">${opt('normal', 'Normal', r.priority || 'normal')}${opt('high', 'High', r.priority)}${opt('low', 'Low', r.priority)}</select>`)}</div>${fld('Notes', `<textarea name="notes" rows="2" placeholder="Optional" maxlength="500">${esc(r.notes || '')}</textarea>`)}`, r.id ? 'Save task' : 'Add task'],
  reminder: (r = {}) => { const at = r.at || (() => { const d = new Date(Date.now() + 36e5); d.setMinutes(0, 0, 0); return d.getTime(); })();
    return [r.id ? 'Edit reminder' : 'New reminder', `${fld('Remind me to', `<input name="title" placeholder="e.g. Pay the domestic worker" maxlength="200" required ${val(r.title)}>`)}<div class="two">${fld('Date', `<input name="day" type="date" required ${val(L.tsToDay(at))}>`)}${fld('Time', `<input name="time" type="time" required ${val(L.tsToTime(at))}>`)}</div>${fld('Repeat', `<select name="repeat">${L.REPEATS.map(([k, n]) => opt(k, n, r.repeat || 'none')).join('')}</select>`)}${fld('Notes', `<textarea name="notes" rows="2" placeholder="Optional" maxlength="500">${esc(r.notes || '')}</textarea>`)}`, r.id ? 'Save reminder' : 'Set reminder']; },
  tx: (r = {}) => [r.id ? 'Edit entry' : 'New entry', `<div class="two">${fld('Type', `<select name="kind">${opt('expense', 'Expense', r.kind || 'expense')}${opt('income', 'Income', r.kind)}</select>`)}${fld(`Amount (${esc(cur())})`, `<input name="amount" inputmode="decimal" placeholder="0,00" required ${r.id ? val(L.centsToInput(r.amount_cents)) : ''}>`)}</div>${fld('Category', `<input name="category" placeholder="e.g. Groceries" maxlength="40" list="cats" ${val(r.category)}>`)}${catList('cats', [...S.tx.map((t) => t.category), ...S.budgets.map((b) => b.category), 'Groceries', 'Transport', 'Salary', 'Rent', 'Electricity', 'Airtime & data', 'Eating out', 'Medical'])}<div class="two">${fld('Date', `<input name="date" type="date" required ${val(L.tsToDay(r.occurred_at || Date.now()))}>`)}${fld('Note', `<input name="note" placeholder="Optional" maxlength="200" ${val(r.note)}>`)}</div>`, r.id ? 'Save entry' : 'Save entry'],
  bill: (r = {}) => [r.id ? 'Edit bill' : 'New bill', `${fld('Bill', `<input name="name" placeholder="e.g. Rent" maxlength="80" required ${val(r.name)}>`)}<div class="two">${fld(`Amount (${esc(cur())})`, `<input name="amount" inputmode="decimal" placeholder="0,00" required ${r.id ? val(L.centsToInput(r.amount_cents)) : ''}>`)}${fld('Due date', `<input name="due" type="date" required ${val(L.tsToDay(r.due_at))}>`)}</div>${fld('Priority', `<select name="priority">${opt('1', '1 — must pay first (rent, electricity…)', String(r.priority || 2))}${opt('2', '2 — important', String(r.priority || 2))}${opt('3', '3 — can wait', String(r.priority || 2))}</select>`)}<label class="cb"><input type="checkbox" name="monthly" ${r.repeat_monthly ? 'checked' : ''}> Repeats monthly</label>${r.id ? `<label class="cb"><input type="checkbox" name="paid" ${r.paid ? 'checked' : ''}> Paid</label>` : ''}`, r.id ? 'Save bill' : 'Add bill'],
  budget: (r = {}) => [r.id ? 'Edit budget' : 'Monthly budget', `${fld('Category', `<input name="category" placeholder="e.g. Groceries" maxlength="40" required list="cats" ${val(r.category)}>`)}${catList('cats', S.tx.map((t) => t.category))}${fld(`Monthly limit (${esc(cur())})`, `<input name="limit" inputmode="decimal" placeholder="0,00" required ${r.id ? val(L.centsToInput(r.limit_cents)) : ''}>`)}<div class="mute">Expenses with the same category count towards this budget.</div>`, r.id ? 'Save budget' : 'Set budget'],
  biz: (r = {}) => [r.id ? 'Edit business record' : 'Business record', `<div class="two">${fld('Type', `<select name="kind">${opt('sale', 'Sale', r.kind || 'sale')}${opt('expense', 'Expense', r.kind)}${opt('invoice', 'Invoice', r.kind)}</select>`)}${fld(`Amount (${esc(cur())})`, `<input name="amount" inputmode="decimal" placeholder="0,00" required ${r.id ? val(L.centsToInput(r.amount_cents)) : ''}>`)}</div>${fld('Description', `<input name="description" placeholder="What was it for?" maxlength="200" required ${val(r.description)}>`)}${fld('Customer / supplier', `<input name="party" placeholder="Optional" maxlength="80" ${val(r.party)}>`)}<div class="two">${fld('Date', `<input name="date" type="date" required ${val(L.tsToDay(r.occurred_at || Date.now()))}>`)}${fld('Invoice status', `<select name="status">${opt('unpaid', 'Unpaid', r.status || 'unpaid')}${opt('paid', 'Paid', r.status)}</select>`)}</div>${fld('Notes', `<textarea name="notes" rows="2" placeholder="Optional" maxlength="500">${esc(r.notes || '')}</textarea>`)}<div class="mute">Invoice status only applies to invoices.</div>`, r.id ? 'Save record' : 'Save record'],
  mem: (r = {}) => [r.id ? 'Edit memory' : 'Remember', `${fld('Memory', `<textarea name="content" rows="3" placeholder="e.g. I do my best work in the morning" maxlength="500" required>${esc(r.content || '')}</textarea>`)}<div class="two">${fld('Confidence', `<select name="status">${opt('confirmed', 'Confirmed', r.status || 'confirmed')}${opt('temporary', 'Temporary', r.status)}${opt('assumption', 'Assumption', r.status)}</select>`)}${fld('Category', `<input name="category" maxlength="40" list="mcats" ${val(r.category || 'General')}>`)}</div>${catList('mcats', [...S.mem.map((m) => m.category), 'General', 'Personal', 'Work', 'Health', 'Family', 'Money'])}<div class="mute">Assumptions are never shown to the AI.</div>`, r.id ? 'Save memory' : 'Remember'],
};
FORMS.chpw = () => ['Change password', `${fld('Current password', '<input name="old" type="password" autocomplete="current-password" required>')}${fld('New password (at least 8 characters)', '<input name="pw" type="password" autocomplete="new-password" required>')}${fld('Repeat new password', '<input name="pw2" type="password" autocomplete="new-password" required>')}<div class="mute">Backups made before the change still open with the old password.</div>`, 'Change password'];
FORMS.journal = (r = {}) => [r.id ? 'Edit entry' : 'New journal entry', `<div class="mute" style="margin:2px 4px 8px">Private. ANNA only reads this if you tap Reflect with ANNA.</div>${fld('Date', `<input name="date" type="date" required ${val(r.date || LF.todayISO())}>`)}<div class="f"><span>Mood</span><div class="chips moods" style="margin:0;padding:2px 0">${LF.MOODS.map(([v, n]) => `<label class="moodopt"><input type="radio" name="mood" value="${v}" ${Number(r.mood) === v ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div><div class="f"><span>Tags</span><div class="chips" style="margin:0;padding:2px 0">${LF.TAGS.map(([v, n]) => `<label class="moodopt"><input type="checkbox" name="tag_${v}" ${(r.tags || []).includes(v) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div></div>${fld('Title', `<input name="title" maxlength="120" placeholder="Optional" ${val(r.title)}>`)}${fld('Write freely', `<textarea name="text" rows="7" maxlength="8000" placeholder="What happened? How do you feel?" required>${esc(r.text || '')}</textarea>`)}`, r.id ? 'Save entry' : 'Save entry'];
FORMS.goal = (r = {}) => [r.id ? 'Edit goal' : 'New goal', `${fld('Goal', `<input name="title" maxlength="120" placeholder="e.g. Walk 30 minutes" required ${val(r.title)}>`)}<div class="two">${fld('Type', `<select name="horizon">${LF.HORIZONS.map(([k, n]) => opt(k, n, r.horizon || 'weekly')).join('')}</select>`)}${fld('Area', `<select name="area">${[['personal', 'Personal'], ['health', 'Health'], ['emotional', 'Emotional'], ['career', 'Career'], ['business', 'Business'], ['financial', 'Financial']].map(([k, n]) => opt(k, n, r.area || 'personal')).join('')}</select>`)}</div><div class="two">${fld('Target (optional)', `<input name="target" inputmode="decimal" placeholder="e.g. 3" ${val(r.target)}>`)}${fld('Unit', `<input name="unit" maxlength="20" placeholder="times, km, R…" ${val(r.unit)}>`)}</div><div class="mute">Daily goals and habits reset each day, weekly ones each Monday, monthly ones on the 1st.</div>`, r.id ? 'Save goal' : 'Add goal'];
FORMS.glog = () => { const g = LIFE.goals.find((x) => x.id === logGoal); return ['Log progress', `<div class="mute" style="margin:0 4px 8px">${esc(g?.title || '')}</div><div class="two">${fld(`Amount${g?.unit ? ' (' + esc(g.unit) + ')' : ''}`, '<input name="value" inputmode="decimal" value="1" required>')}${fld('Date', `<input name="date" type="date" ${val(LF.todayISO())}>`)}</div>${fld('Note', '<input name="note" maxlength="200" placeholder="Optional">')}`, 'Log it']; };
let logGoal = null;
FORMS.person = (r = {}) => [r.id ? 'Edit staff member' : 'New staff member', `${fld('Name', `<input name="name" maxlength="80" required ${val(r.name)}>`)}${fld('Role', `<input name="role" maxlength="80" placeholder="Optional" ${val(r.role)}>`)}<div class="two">${fld(`Hourly rate (${esc(M.symbolOf(curCode()))})`, `<input name="rate" inputmode="decimal" placeholder="e.g. 30,23" ${r.rate_cents ? val((r.rate_cents / 100).toFixed(2)) : ''}>`)}${fld('Phone', `<input name="phone" inputmode="tel" maxlength="30" placeholder="Optional" ${val(r.phone)}>`)}</div><div class="two">${fld('Ordinary hours / week', `<input name="ot_threshold" inputmode="decimal" ${val(r.ot_threshold ?? 45)}>`)}${fld('Overtime rate ×', `<input name="ot_mult" inputmode="decimal" ${val(r.ot_mult ?? 1.5)}>`)}</div><label class="cb"><input type="checkbox" name="double_special" ${r.double_special ? 'checked' : ''}> Pay 2× on Sundays &amp; public holidays</label><div class="mute">Defaults follow South Africa’s BCEA: 45 ordinary hours a week, overtime at 1.5×.</div>`, r.id ? 'Save' : 'Add staff member'];
FORMS.shift = (r = {}) => { const people = LIFE.staff.filter((x) => x.type === 'person'); return [r.id ? 'Edit shift' : 'New shift', `${fld('Who', `<select name="staff">${people.map((p) => opt(p.id, p.name, r.staff || people[0]?.id)).join('')}</select>`)}${fld('Date', `<input name="date" type="date" required ${val(r.date || LF.todayISO())}>`)}<div class="two">${fld('Start', `<input name="start" type="time" required ${val(r.start || '08:00')}>`)}${fld('End', `<input name="end" type="time" required ${val(r.end || '17:00')}>`)}</div><div class="two">${fld('Break (minutes)', `<input name="break_min" inputmode="numeric" ${val(r.break_min ?? 60)}>`)}${fld('Task', `<input name="task" maxlength="120" placeholder="Optional" ${val(r.task)}>`)}</div>`, r.id ? 'Save shift' : 'Add shift']; };
const KEY = { task: 'tasks', reminder: 'reminders', tx: 'tx', bill: 'bills', budget: 'budgets', biz: 'biz', mem: 'mem' };
const LIFEKEY = { journal: 'journal', goal: 'goals', person: 'staff', shift: 'staff' };
const NAME = { task: 'Task', reminder: 'Reminder', tx: 'Entry', bill: 'Bill', budget: 'Budget', biz: 'Record', mem: 'Memory' };
let navStack = [], lastTab = null, goingBack = false;
function goBack() {
  if (locked) { if (welcomed) { welcomed = false; lockMsg = ''; render(true); } return; }
  if (sheet) return actions.close();
  if (navStack.length) { goingBack = true; tab = navStack.pop(); render(true); ($('#screen').scrollTop = 0); return; }
  lockNow();
}
function render(anim) {
  if (!locked) { if (lastTab && tab !== lastTab && !goingBack) { navStack.push(lastTab); if (navStack.length > 30) navStack.shift(); } lastTab = tab; goingBack = false; }
  if (locked) { $('#screen').innerHTML = lockScreen(); $('#tabs').innerHTML = ''; $('#sheet').innerHTML = (sheet === 'chpw' ? '' : ''); document.body.classList.remove('lock'); return; }
  const now = new Date(); SOD = new Date(now).setHours(0, 0, 0, 0); EOD = SOD + 864e5;
  const el = $('#screen'), y = el.scrollTop; el.innerHTML = screens[tab]();
  if (anim) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); el.scrollTop = 0; } else el.scrollTop = y;
  $('#tabs').innerHTML = TABS.map(([k, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}" aria-label="${n}" ${k === tab ? 'aria-current="page"' : ''}>${ic(k)}${n}</button>`).join('');
  const rec = editId ? (LIFEKEY[sheet] ? LIFE[LIFEKEY[sheet]] : S[KEY[sheet]])?.find((x) => x.id === editId) : undefined, f = FORMS[sheet]?.(rec || (sheet === 'reminder' && reminderPrefill ? reminderPrefill : undefined));
  const special = sheet === 'chat' ? chatPanel() : sheet === 'ctx' ? ctxPanel() : sheet === 'restore' ? restorePanel() : sheet === 'mbudget' ? budgetPanel() : sheet === 'calc' ? calcPanel() : sheet === 'afford' ? affordPanel() : sheet === 'paybill' ? payPanel() : '';
  $('#sheet').innerHTML = special ? special : f ? `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="${f[0]}"><div class="gr"></div><div class="row"><h2 class="grow">${f[0]}</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div><form data-form="${sheet}" novalidate>${f[1]}<button class="btn full" style="margin-top:14px">${f[2]}</button>${rec ? `<button type="button" class="btn bad full" style="margin-top:8px" data-act="${LIFEKEY[sheet] ? 'ldel' : 'del'}" data-k="${sheet}" data-id="${rec.id}">Delete ${(NAME[sheet] || 'entry').toLowerCase()}</button>` : ''}</form></div>` : '';
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
    out.push(`Offline app files: service worker ${reg?.active ? 'active' : 'NOT active'}${navigator.serviceWorker?.controller ? ', controlling this page' : ', not yet controlling this page (reopen Anna)'}; app cache ${app ? appN + ' files' : 'MISSING'}; AI engine cache ${eng ? `${eng.replace('anna-engine-', 'WebLLM ')} (${engN} file${engN === 1 ? "" : "s"})` : 'MISSING'}`);
    if (!eng || engN < 1) navigator.serviceWorker?.controller?.postMessage('cache-engine');
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
  'rem-ios': async (id) => { const r = byId(S.reminders, id); if (!r) return; r.dest = { ...(r.dest || {}), iphone: Date.now() }; await save(); toast('Opening your “ANNA Reminder” shortcut… Check it appears in the Reminders app: ANNA can’t see that app to confirm.', { ms: 7000 }); lastURL = TM.shortcutURL(r); location.href = lastURL; },
  'rq-save': async () => { const d = pendingReminder; if (!d?.ts) return; pendingReminder = null; const r = { id: L.uid(), title: d.title, notes: null, at: d.ts, repeat: d.repeat || 'none', notified: 0, done: 0, done_at: null, created_at: Date.now(), dest: { anna: Date.now() } };
    S.reminders.unshift(r); await save(); const st = await kvGet('state'), ok = !!st?.reminders?.some((x) => x.id === r.id);
    if (!ok) { S.reminders = S.reminders.filter((x) => x.id !== r.id); S.chat.push({ role: 'assistant', content: 'I couldn’t save that reminder on this device. Please try again.', at: Date.now(), tool: 'reminders' }); }
    else { S.chat.push({ role: 'assistant', content: `Saved in ANNA: “${r.title}”, ${TM.fmtDateTime(r.at)}${r.repeat !== 'none' ? ' (' + repLabel(r).toLowerCase() + ')' : ''}. I’ll alert you while ANNA is open. For an alert when she’s closed, also send it to iPhone Reminders or your Calendar:`, at: Date.now(), tool: 'reminders', follow: r.id }); }
    await save(); paintChat(true); },
  'rq-edit': () => { const d = pendingReminder; pendingReminder = null; reminderPrefill = d ? { title: d.title, at: d.ts || undefined, repeat: d.repeat } : null; sheet = 'reminder'; editId = null; render(); },
  'rq-cancel': async () => { pendingReminder = null; S.chat.push({ role: 'assistant', content: 'Okay, I won’t set it.', at: Date.now(), tool: 'reminders' }); await save(); paintChat(true); },
  'rem-ics': async (id) => { const r = byId(S.reminders, id); if (!r) return; const res = await download(`anna-reminder-${L.tsToDay(r.at)}.ics`, L.reminderICS(r), 'text/calendar'); if (res !== 'cancelled') { r.dest = { ...(r.dest || {}), ics: Date.now() }; save(); if (tab === 'tasks') render(); } if (res !== 'cancelled') toast('Open the file and tap “Add to Calendar” so your iPhone alerts you even when Anna is closed.', { ms: 6000 }); },
  del: (id, el) => { const k = el.dataset.k, key = KEY[k], arr = S[key], i = arr.findIndex((x) => x.id === id); if (i < 0) return; const item = arr[i];
    mutate(() => { arr.splice(i, 1); }); undo = { key, item, i };
    toast(`${NAME[k]} deleted`, { ms: 6000, action: { label: 'Undo', fn: () => { if (!undo) return; const u = undo; undo = null; mutate(() => { S[u.key].splice(Math.min(u.i, S[u.key].length), 0, u.item); }, { close: false }); } } }); },
  edit: (id, el) => { sheet = el.dataset.k; editId = id; render(); },
  view: (id) => { tab = 'tasks'; taskView = id; sheet = null; render(true); },
  'rq-x': () => {},
  'chat-open': () => { sheet = 'chat'; booksNudge(); render(); paintOrbs(); AI.refresh(); warmChat(); }, 'ctx-open': () => { sheet = 'ctx'; render(); },
  'chat-clear': () => { if (!S.chat.length || confirm('Clear the whole conversation? This cannot be undone (it is also removed from future backups).')) { S.chat = []; save(); paintChat(true); } },
  'chat-stop': () => AI.stop(),
  'chat-suggest': (i) => sendChat(SUGG[i]), 'chat-to-brain': () => { sheet = null; tab = 'brain'; render(true); ($('#screen').scrollTop = 0); },
  'ai-download': () => { if (!navigator.onLine) return toast('You are offline. Connect to Wi-Fi to download the model.'); AI.download(); },
  'ai-cancel': () => AI.cancelDownload(), 'ai-cancel-load': () => AI.cancelLoad(),
  awake: () => { const st = AI.ai.state; if (st === 'ready') return AI.unload(); if (st === 'loading') return AI.cancelLoad(); if (st === 'cached') return AI.load({ gpu: S.settings.ai.gpu }); if (st === 'absent') { tab = 'brain'; render(true); return toast('Download ANNA’s brain first (one-time, Wi-Fi recommended).', { ms: 5000 }); } if (st === 'unsupported') return toast(AI.ai.error || 'AI brain not available on this device.', { ms: 6000 }); toast('Please wait a moment…'); },
  meet: () => { welcomed = true; render(true); }, 'ai-load': () => AI.load({ gpu: S.settings.ai.gpu }), 'ai-unload': () => AI.unload(), 'ai-ack': () => AI.ackCrash(),
  'old-delete': async () => { if (!oldInfo || !confirm(`Delete the old AI model file (${mb(oldInfo.bytes)})? ANNA now uses WebLLM, so it is no longer needed. This cannot be undone.`)) return; try { await AI.deleteOldModel(); oldInfo = null; engKey = ''; paintEngine(); toast('Old model deleted.'); } catch (e) { toast('Could not delete: ' + e.message); } },
  'old-keep': () => { oldInfo = null; engKey = ''; paintEngine(); },
  'ai-delete': () => { if (confirm(`Delete the AI model (${mb(AI.MODEL.bytes)}) from this device? You will need internet to download it again. Your data is not affected.`)) AI.remove(); },
  diag: async () => { diag = 'Running diagnostics…'; tab === 'data' ? render() : paintEngine(); diag = await runDiagnostics(); tab === 'data' ? render() : paintEngine(); },
  'diag-copy': async () => { try { await navigator.clipboard.writeText(diag); toast('Report copied.'); } catch { prompt('Copy this report:', diag); } },
  acc: (id) => mutate(() => { S.settings.ai[id] = !S.settings.ai[id]; }, { close: false }),
  memcat: (id) => { memCat = id; render(); },
  open: (id) => { sheet = id; editId = null; render(); }, close: () => { sheet = null; editId = null; pendingRestore = null; render(); },
  'fb-up': (id) => rate(id, 'up'), 'fb-down': (id) => rate(id, 'down'),
  pay: (id) => { payId = id; sheet = 'paybill'; render(); },
  'pay-do': (how) => { const b = byId(S.bills, payId); sheet = null; if (!b) return render(); mutate(() => L.payBill(S, b.id, { recordExpense: how === 'exp' }), { close: false }); payId = null; toast(b.repeat_monthly ? `Paid. Next due ${dstr(b.due_at)}.` : how === 'exp' ? `Paid. ${L.fmt(b.amount_cents, cur())} taken off your money.` : 'Marked paid.'); },
  unpay: (id) => mutate(() => L.unpayBill(S, id), { close: false }),
  'inv-paid': (id) => mutate(() => { const r = byId(S.biz, id); r.status = 'paid'; r.paid_at = Date.now(); }, { close: false }),
  export: async () => { if (!auth || !bkKey) return toast('Unlock Anna first.'); const env = await A.encryptBackup({ ...S, life: { ...LIFE, memories: S.mem }, logo: logoUrl, exported_at: Date.now(), app_version: VERSION }, auth, bkKey), name = `anna-backup-${L.tsToDay(Date.now())}.json`; const r = await download(name, JSON.stringify(env), 'application/json'); if (r !== 'cancelled') { S.settings.last_backup_at = Date.now(); save(); toast(`Backup ready: ${L.describeCounts(L.counts(S))}.`, { ms: 5000 }); } },
  import: () => $('#file').click(),
  'restore-confirm': async () => {
    const r = pendingRestore; if (!r) return; pendingRestore = null; sheet = null;
    await kvSet('prev', { ...S, life: LIFE }); hasPrev = true; S = r.state; if (S.logo !== undefined) { await setLogo(S.logo || null); } await applyLife(S.life, S.mem); delete S.life; delete S.logo; delete S.exported_at; delete S.app_version; normSettings(); await save();
    const check = L.validateBackup(await kvGet('state')), want = JSON.stringify(L.counts(r.state)), got = check.ok ? JSON.stringify(L.counts({ ...check.state, mem: (await LF.loadAll()).memories })) : '';
    render(true); toast(got === want ? `Restored and verified: ${L.describeCounts(L.counts(S))}.` : 'Restore saved, but verification did not match. Export a backup and check your data.', { alert: true, ms: 8000 });
  },
  'undo-restore': async () => { const p = await kvGet('prev'); const v = p && L.validateBackup(p); if (!v?.ok) return toast('No safety copy available.'); if (!confirm(`Put back the data from before your last restore/erase? (${L.describeCounts(L.counts(v.state))})`)) return; const curS = { ...S, life: LIFE }; S = v.state; await applyLife(S.life, S.mem); delete S.life; normSettings(); await save(); await kvSet('prev', curS); render(true); toast('Previous data restored.'); },
  prefs: () => { setPref('style', $('#style').value); const sel = $('#cursel').value, c = sel === 'custom' ? ($('#cur').value || '').trim().slice(0, 5) : sel; mutate(() => { S.settings.currency = c || L.DEFAULT_CURRENCY; S.settings.name = ($('#nm').value || '').trim().slice(0, 40); }); toast('Preferences saved.'); },
  notif: async () => { try { const p = await Notification.requestPermission(); render(); if (p === 'granted') notify('Anna', 'Reminder alerts are on.'); } catch { toast('This browser cannot show notifications. Open Anna from the Home Screen icon.'); } },
  'notif-test': async () => { const ok = await notify('Anna', 'This is how reminders will look.'); toast(ok ? 'Test alert sent.' : 'Could not show a notification.'); },
  lock: () => lockNow(),
  bizview: (id) => { bizView = id; render(); },
  'ent-save': () => saveEntry(), 'ent-cancel': async () => { pendingEntry = null; say('Okay, nothing saved.'); },
  'ent-edit': () => { const e = pendingEntry; pendingEntry = null; paintChat(true); const ta = $('.chatin textarea'); if (ta && e) { ta.value = e.text; ta.focus(); } },
  'bat-save': () => batchSave(), 'bat-cancel': () => { pendingBatch = null; say('Okay, nothing saved.'); },
  'bat-del': (i) => { const b = pendingBatch; if (!b) return; b.items.splice(Number(i), 1); if (!b.items.length) { pendingBatch = null; return say('Okay, nothing saved.'); } say(batchText()); },
  'bat-edit': (i) => { const b = pendingBatch; if (!b) return; const [x] = b.items.splice(Number(i), 1); b.editing = true; paintChat(true); const ta = $('.chatin textarea'); if (ta && x) { ta.value = x.text; ta.focus(); } },
  mmore: () => mutate(() => { S.settings.moneyMore = !S.settings.moneyMore; }, { close: false }),
  'inc-del': async (id) => { LIFE.finance = LIFE.finance.filter((x) => x.id !== id); await LF.del('finance', id); render(); },
  'wish-del': async (id) => { LIFE.finance = LIFE.finance.filter((x) => x.id !== id); await LF.del('finance', id); render(); },
  automoney: () => mutate(() => { S.settings.autoMoney = !S.settings.autoMoney; }, { close: false }),
  'ent-undo': async (id) => { const u = entryUndo[id]; if (!u) return; S.tx = u.tx; S.bills = u.bills; for (const f of u.fin || []) { LIFE.finance = LIFE.finance.filter((x) => x.id !== f.id).concat(f.prev ? [f.prev] : []); if (f.prev) await LF.put('finance', f.prev); else await LF.del('finance', f.id); } if (u.month) { LIFE.finance = LIFE.finance.filter((x) => x.id !== u.month.id).concat(u.month); await LF.put('finance', u.month); } else if (u.monthId) { LIFE.finance = LIFE.finance.filter((x) => x.id !== u.monthId); await LF.del('finance', u.monthId); } delete entryUndo[id]; await save(); say('Undone. Everything is back as it was.'); },
  'books-start': () => { BK = { step: 0, month: M.booksMonth() }; booksAsk(); }, 'books-snooze': async () => { await booksState({ snoozeUntil: new Date().setHours(24, 0, 0, 0) }); say('Okay, I’ll ask again tomorrow.'); },
  'books-skip': async () => { const st = booksStateGet(); await booksState({ skipped: [...(st.skipped || []), M.booksMonth()] }); BK = null; say('Skipped Books Day for this month.'); },
  'books-close': () => booksClose(), 'books-later': () => { BK = null; say('Okay, the month stays open. Say “Books Day” when you’re ready.'); },
  'books-remind': () => booksReminder(),
  sweek: (id) => { staffWeek += Number(id); render(); },
  ctab: (id) => { calcTab = id; render(); },
  'b-add': () => { BD.lines.push({ id: 'c-' + L.uid().slice(0, 8), name: 'New bill', kind: 'bill', cents: 0 }); saveDraft(); render(); const ins = document.querySelectorAll('[data-bl="name"]'); ins[ins.length - 1]?.select(); },
  'b-del': (id) => { BD.lines = BD.lines.filter((l) => l.id !== id); saveDraft(); render(); },
  'b-save': async () => { const t = M.monthly(BD.lines, { days: BD.days }); if (!t.income) return toast('Enter your income first.'); const rec = { id: 'budget-' + BD.month, type: 'budget', month: BD.month, currency: BD.currency, days: BD.days, lines: BD.lines.map((l) => ({ ...l })), totals: t, saved_at: Date.now() };
    LIFE.finance = LIFE.finance.filter((x) => x.id !== rec.id).concat(rec); await LF.put('finance', rec); const back = (await LF.loadAll()).finance.some((x) => x.id === rec.id); render(); toast(back ? `Saved ${monthName(BD.month)}.` : 'Could not save this month. Please try again.'); },
  'b-delmonth': async (id) => { if (!confirm('Delete this saved month?')) return; LIFE.finance = LIFE.finance.filter((x) => x.id !== id); await LF.del('finance', id); render(); },
  bview: (id) => { brainView = id; render(); },
  'bview-go': (id) => { brainView = id; tab = 'brain'; render(true); },
  'mem-clear': async () => { if (!confirm(`Delete everything ANNA remembers (${S.mem.length} memories)? This cannot be undone.`)) return; S.mem.splice(0); await LF.clear('memories'); render(); await save(); toast('All memories deleted.'); },
  'store-clear': async (id) => { const n = { memories: 'memories', journal: 'journal entries', goals: 'goals and their progress', progress: 'progress logs' }[id]; if (!confirm(`Delete all ${n}? This cannot be undone.`)) return; if (id === 'memories') S.mem.splice(0); LIFE[id] = id === 'memories' ? S.mem : []; await LF.clear(id); if (id === 'goals') { LIFE.progress = []; await LF.clear('progress'); } render(); await save(); toast('Deleted.'); },
  ldel: async (id, el) => { const store = LIFEKEY[el.dataset.k], arr = LIFE[store], i = arr.findIndex((x) => x.id === id); if (i < 0) return; const item = arr.splice(i, 1)[0]; await LF.del(store, id); let logs = [];
    if (store === 'goals') { logs = LIFE.progress.filter((p) => p.goal === id); LIFE.progress = LIFE.progress.filter((p) => p.goal !== id); for (const p of logs) await LF.del('progress', p.id); }
    sheet = null; editId = null; render(); toast(`${el.dataset.k === 'goal' ? 'Goal' : 'Entry'} deleted`, { ms: 6000, action: { label: 'Undo', fn: async () => { arr.splice(i, 0, item); await LF.put(store, item); for (const p of logs) { LIFE.progress.push(p); await LF.put('progress', p); } render(); } } }); },
  jtag: (id) => { jTag = jTag === id ? '' : id; $('#jlist').innerHTML = journalList(); document.querySelectorAll('[data-act="jtag"]').forEach((b) => b.classList.toggle('on', b.dataset.id === jTag)); },
  glog: (id) => { logGoal = id; sheet = 'glog'; editId = null; render(); },
  gdone: async (id) => { const g = LIFE.goals.find((x) => x.id === id); if (!g) return; g.done = !g.done; g.done_at = g.done ? Date.now() : null; await LF.put('goals', g); render(); },
  reflect: async (id) => { const e = LIFE.journal.find((x) => x.id === id); if (!e) return; if (AI.ai.state !== 'ready') { brainView = 'ai'; render(); return toast('Load ANNA’s brain first, then tap Reflect again.', { ms: 5000 }); }
    sheet = 'chat'; render(); paintOrbs(); sendChat(`I’d like to reflect on this private journal entry with you (${e.date}${e.mood ? ', mood: ' + LF.MOODS.find(([v]) => v === e.mood)[1].toLowerCase() : ''}). Please listen first and help me reflect gently:\n\n${e.title ? e.title + ': ' : ''}${e.text.slice(0, 1500)}`, { noRemember: true }); },
  'rem-yes': async () => { const p = pendingRemember; pendingRemember = null; if (!p) return; if (p.style) { await setPref('style', p.style); toast('Got it. I’ll remember how you like to be supported.'); } else { const m = { id: L.uid(), content: p.text.slice(0, 500), category: 'From chat', status: 'confirmed', created_at: Date.now() }; S.mem.unshift(m); await save(); toast('Remembered. You can review it in Brain → Memories.'); } paintChat(true); },
  'rem-no': () => { pendingRemember = null; paintChat(true); },
  checkin: () => { checkinShown = true; sheet = 'journal'; editId = null; render(); },
  'checkin-x': () => { checkinShown = true; const c = $('#checkin'); if (c) c.remove(); },
  back: () => goBack(),
  'logo-pick': () => $('#logofile').click(),
  'logo-reset': async () => { await setLogo(null); render(); toast('Default logo restored.'); },
  'reset-anna': async () => { if (prompt('This deletes ALL Anna data, your password and logo on this device. Your encrypted backups still need the old password. Type ERASE to continue.') !== 'ERASE') return; for (const k of ['state', 'prev', 'auth', 'logo']) await kvSet(k, null); try { localStorage.removeItem('anna-web:fails'); } catch {} location.reload(); },
  'setup-restore': () => $('#sfile').click(),
  erase: async () => { if (confirm('Erase ALL Anna data on this device (tasks, reminders, money, business, memories, journal, goals, chat)? Export a backup first.') && confirm('Really erase everything? (A safety copy is kept so you can undo once.)')) { await kvSet('prev', { ...S, life: LIFE }); hasPrev = true; S = L.emptyState(); normSettings(); await applyLife(null, []); await save(); tab = 'home'; render(true); toast('All data erased.', { action: { label: 'Undo', fn: () => actions['undo-restore']() } }); } },
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab],[data-act]'); if (!t) return;
  if (t.dataset.tab) { if (t.dataset.tab !== tab || sheet) { tab = t.dataset.tab; sheet = null; editId = null; render(true); ($('#screen').scrollTop = 0); } } else actions[t.dataset.act]?.(t.dataset.id, t);
});
document.addEventListener('input', (e) => {
  const d = e.target.dataset || {};
  if (d.bl) { const l = BD.lines.find((x) => x.id === d.id); if (l) { if (d.bl === 'name') l.name = e.target.value.slice(0, 40); else { const c = e.target.value.trim() ? M.toCents(e.target.value) : 0; l.cents = c ?? 0; e.target.classList.toggle('bad', c === null); } } saveDraft(); paintBudget(); return; }
  if (d.c) { CALC[d.c] = e.target.value; paintCalc(); return; }
  if (d.a) { AFF[d.a] = e.target.value; paintAfford(); return; }
  if (e.target.id === 'q') { memQ = e.target.value; $('#memlist').innerHTML = memList(); }
  if (e.target.id === 'bq') { bizQ = e.target.value; $('#bizlist').innerHTML = bizList(); }
  if (e.target.id === 'jq') { jQ = e.target.value; $('#jlist').innerHTML = journalList(); }
  if (e.target.matches('.chatin textarea')) { e.target.style.height = 'auto'; e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px'; }
});
// No pinch zoom (Safari ignores user-scalable=no); double-tap zoom is off via touch-action.
['gesturestart', 'gesturechange'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
// Swipe from the left edge to go back (iPhone Home Screen apps have no browser back gesture).
let swipe = null;
document.addEventListener('touchstart', (e) => { const t = e.touches[0]; swipe = t && t.clientX < 24 && !(locked && !welcomed) ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
document.addEventListener('touchend', (e) => { if (!swipe) return; const t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = Math.abs(t.clientY - swipe.y); swipe = null; if (dx > 70 && dy < 60) goBack(); }, { passive: true });
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && e.target.matches('.chatin textarea') && !matchMedia('(pointer:coarse)').matches) { e.preventDefault(); e.target.form.requestSubmit(); } if (e.key === 'Escape' && sheet) actions.close(); });
document.addEventListener('change', async (e) => {
  const d = e.target.dataset || {};
  if (d.b === 'month') { BD.month = e.target.value || BD.month; const saved = LIFE.finance.find((x) => x.id === 'budget-' + BD.month); if (saved) Object.assign(BD, { lines: saved.lines.map((l) => ({ ...l })), currency: saved.currency, days: saved.days }); saveDraft(); render(); return; }
  if (d.b === 'currency') { BD.currency = e.target.value; M.setCurrency(BD.currency); saveDraft(); render(); return; }
  if (d.b === 'days') { BD.days = Number(e.target.value); saveDraft(); paintBudget(); return; }
  if (d.c) { CALC[d.c] = e.target.value; paintCalc(); return; }
  if (e.target.id === 'cursel') { $('#curwrap').hidden = e.target.value !== 'custom'; return; }
  if (e.target.id === 'logofile' && e.target.files[0]) { const f = e.target.files[0]; e.target.value = ''; try { await setLogo(await shrinkImage(f)); render(); toast('Logo saved.'); } catch { toast('That image could not be read. Try a PNG or JPG.'); } return; }
  if (e.target.id === 'sfile' && e.target.files[0]) { const f = e.target.files[0]; e.target.value = ''; pendingFile = { name: f.name, text: await f.text() }; render(); return; }
  if (e.target.id !== 'file' || !e.target.files[0]) return;
  const file = e.target.files[0], text = await file.text(); e.target.value = '';
  let env; try { env = JSON.parse(text); } catch { return toast('That file is not valid JSON.', { alert: true, ms: 6000 }); }
  if (env?.encrypted) { if (env.owner && env.owner !== A.OWNER.name) return toast('This backup belongs to a different owner.', { alert: true }); pendingRestore = { name: file.name, env }; sheet = 'restore'; return render(); }
  const r = L.validateBackup(env);
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
  const f = Object.fromEntries(new FormData(form)), now = Date.now(), k = form.dataset.form, rec = editId ? byId((LIFEKEY[k] ? LIFE[LIFEKEY[k]] : S[KEY[k]]) || [], editId) : null;
  if (k === 'chat') { const ta = form.querySelector('textarea'), t = ta.value; ta.value = ''; ta.style.height = ''; return sendChat(t); }
  if (k === 'journal' || k === 'goal' || k === 'glog' || k === 'person' || k === 'shift') return saveLifeForm(k, f, form, rec);
  if (k === 'cash' || k === 'incoming') return saveFinForm(k, f);
  const missing = req(f, { task: ['title'], reminder: ['title', 'day', 'time'], tx: ['amount'], bill: ['name', 'amount', 'due'], budget: ['category', 'limit'], biz: ['amount', 'description'], mem: ['content'] }[k] || []);
  if (missing) { const el = form.querySelector(`[name=${missing}]`); el?.focus(); return toast('Please fill in: ' + (el?.closest('label')?.querySelector('span')?.textContent || missing)); }
  const up = (obj) => mutate(() => { if (rec) Object.assign(rec, obj); else S[KEY[k]][k === 'tx' || k === 'bill' || k === 'biz' || k === 'budget' ? 'push' : 'unshift']({ id: L.uid(), ...obj }); });
  const sameDay = (iso, old) => (old && L.tsToDay(old) === iso ? old : iso === L.tsToDay(now) ? now : L.dayTs(iso));
  if (k === 'task') return up({ title: f.title.trim(), notes: f.notes.trim() || null, due_at: L.dayTs(f.due), priority: f.priority, ...(rec ? {} : { completed: 0, completed_at: null, created_at: now }) });
  if (k === 'reminder') { const at = L.dateTimeTs(f.day, f.time); if (!at) return toast('Please choose a valid date and time.'); if (!rec && at < now - 6e4) return toast('That time has already passed. Choose a time in the future.'); reminderPrefill = null; up({ title: f.title.trim(), notes: f.notes.trim() || null, at, repeat: f.repeat, notified: rec && rec.at === at ? rec.notified : 0, ...(rec ? {} : { done: 0, done_at: null, created_at: now, dest: { anna: now } }) }); return toast(`Reminder set for ${dtstr(at)}.`); }
  if (k === 'mem') return up({ content: f.content.trim(), category: f.category.trim() || 'General', status: f.status, ...(rec ? {} : { created_at: now }) });
  const cents = L.parseCents(f.amount ?? f.limit); if (cents === null) return toast('Enter an amount like 150 or 12,50 (more than zero).');
  if (k === 'tx') return up({ kind: f.kind, amount_cents: cents, category: f.category.trim() || 'General', note: f.note.trim() || null, occurred_at: sameDay(f.date, rec?.occurred_at) });
  if (k === 'bill') return up({ name: f.name.trim(), amount_cents: cents, due_at: L.dayTs(f.due), priority: Number(f.priority) || 2, repeat_monthly: f.monthly ? 1 : 0, ...(rec ? { paid: f.paid ? 1 : 0, paid_at: f.paid ? rec.paid_at || now : null } : { paid: 0, paid_at: null }) });
  if (k === 'budget') { const dup = S.budgets.find((x) => x.category.toLowerCase() === f.category.trim().toLowerCase() && x.id !== rec?.id); if (dup) return mutate(() => { dup.limit_cents = cents; if (rec) S.budgets = S.budgets.filter((x) => x.id !== rec.id); }); return up({ category: f.category.trim(), limit_cents: cents }); }
  if (k === 'biz') { const inv = f.kind === 'invoice', paid = !inv || f.status === 'paid', at = sameDay(f.date, rec?.occurred_at); return up({ kind: f.kind, party: f.party.trim() || null, description: f.description.trim(), notes: f.notes.trim() || null, amount_cents: cents, status: paid ? 'paid' : 'unpaid', occurred_at: at, paid_at: paid ? (inv ? rec?.paid_at || now : at) : null }); }
});

// ---- owner lock (auth.js does the crypto) ----
const AUTOLOCK_MS = 5 * 6e4;
let pendingFile = null;
const fails = () => { try { return JSON.parse(localStorage.getItem('anna-web:fails') || '{"n":0,"until":0}'); } catch { return { n: 0, until: 0 }; } };
const setFails = (f) => { try { localStorage.setItem('anna-web:fails', JSON.stringify(f)); } catch {} };
let welcomed = false;
const lockIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
function lockScreen() {
  if (!welcomed) return `<div class="welcome"><div class="aname">ANNA</div>${orb('', false).replace('data-s="off"', 'data-s="rest"')}<div class="hey">Hey, ${esc(ownerFirst())}.</div><div class="tagline">Your space. Your thoughts. Your ANNA.</div><button class="btn" data-act="meet">Meet ANNA</button></div><div class="powered">POWERED BY TAMANY.TECH</div>`;
  const msg = lockMsg ? `<div class="warn">${esc(lockMsg)}</div>` : '', head = `${backBtn().replace('class="back"', 'class="back fixed"')}<div class="access">${logoUrl ? brandLogo('biglogo') : orb('sm', false).replace('data-s="off"', 'data-s="rest"')}<div class="aname">ANNA</div>`;
  const priv = `<div class="privacy">${lockIc}Private to ${esc(A.OWNER.name)} · stays on this device</div>`;
  if (!auth) return head + `<div class="lockv" style="min-height:0;gap:0;padding:0;width:100%"><div class="tagline" style="margin:0 0 18px">Create your password.</div>${msg}
    <form data-form="setup" novalidate><input name="pw" type="password" placeholder="New password (8+ characters)" autocomplete="new-password" aria-label="New password" required><input name="pw2" type="password" placeholder="Repeat password" autocomplete="new-password" aria-label="Repeat password" required style="margin-top:10px"><button class="btn">Create password</button></form>${priv}
    <details><summary>Moving from another device?</summary><div class="mute" style="margin-bottom:8px">Restore an encrypted ANNA backup. Its password becomes this device’s password.</div>
    ${pendingFile ? `<form data-form="setuprestore" novalidate><div class="mute" style="margin:6px 0">${esc(pendingFile.name)}</div><input name="pw" type="password" placeholder="Backup password" autocomplete="current-password" aria-label="Backup password" required><button class="btn">Restore and unlock</button></form>` : '<button class="btn sage" data-act="setup-restore">Choose backup file…</button>'}<input id="sfile" type="file" accept="application/json,.json" hidden></details></div></div>`;
  const f = fails(), wait = Math.max(0, f.until - Date.now());
  return head + `<div class="lockv" style="min-height:0;gap:0;padding:0;width:100%">${msg}${wait ? `<div class="note">Too many attempts. Try again in ${Math.ceil(wait / 1000)} s.</div>` : ''}
    <form data-form="unlock" novalidate><input name="pw" type="password" placeholder="Password" autocomplete="current-password" aria-label="Password" required autofocus><button class="btn" ${wait ? 'disabled' : ''}>Enter</button></form>${priv}
    <details><summary>Forgot password?</summary><div class="mute">There is no way to recover it: that is what keeps your data private. You can reset ANNA on this device (everything here is deleted) and then restore an encrypted backup if you remember its password.</div><button class="btn bad" style="width:100%;margin-top:8px" data-act="reset-anna">Reset ANNA on this device</button></details></div></div>`;
}
async function unlocked(pw) {
  bkKey = await A.backupKey(auth, pw); locked = false; lockMsg = ''; pendingFile = null; setFails({ n: 0, until: 0 });
  render(true);
  if (!started) { started = true; await save(); AI.refresh(); checkReminders(); setInterval(() => { if (!locked) checkReminders(); }, 15000); }
}
function lockNow() { navStack = []; lastTab = null; welcomed = true; locked = true; bkKey = null; sheet = null; editId = null; pendingRestore = null; diag = ''; render(true); }
async function setLogo(url, persist = true) {
  logoUrl = url || null; if (persist) await kvSet('logo', logoUrl);
  for (const [rel, def] of [['apple-touch-icon', 'icons/apple-touch-icon.png'], ['icon', 'icons/icon-192.png']]) { const l = document.querySelector(`link[rel="${rel}"]`); if (l) l.href = logoUrl || def; }
}
// Scales an uploaded image to at most 512 px (keeps the aspect ratio) and stores it as PNG.
async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h }); c.getContext('2d').drawImage(img, 0, 0, w, h); return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}
const AUTHFORMS = new Set(['setup', 'unlock', 'setuprestore', 'restorepw', 'chpw']);
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]'); if (!form || !AUTHFORMS.has(form.dataset.form)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const f = Object.fromEntries(new FormData(form)), k = form.dataset.form, btn = form.querySelector('button'); if (btn) btn.disabled = true;
  try {
    if (k === 'setup') { if (f.pw !== f.pw2) throw new Error('The two passwords do not match.'); auth = await A.createAuth(f.pw); await kvSet('auth', auth); return unlocked(f.pw); }
    if (k === 'unlock') { const fl = fails(); if (fl.until > Date.now()) return render(); if (await A.verifyPassword(auth, f.pw)) return unlocked(f.pw); fl.n++; fl.until = Date.now() + A.lockoutMs(fl.n); setFails(fl); throw new Error('Wrong password.'); }
    if (k === 'setuprestore') {
      const env = JSON.parse(pendingFile.text); if (!env.encrypted) throw new Error('Choose an encrypted Anna backup (made with v0.4.1 or later).'); if (env.owner && env.owner !== A.OWNER.name) throw new Error('This backup belongs to a different owner.');
      const r = L.validateBackup(await A.decryptBackup(env, f.pw)); if (!r.ok) throw new Error(r.error);
      auth = env.auth; await kvSet('auth', auth); S = r.state; await setLogo(S.logo || null); await applyLife(S.life, S.mem); delete S.life; delete S.logo; delete S.exported_at; delete S.app_version; normSettings(); await save();
      await unlocked(f.pw); return toast(`Restored: ${L.describeCounts(L.counts(S))}.`, { alert: true, ms: 7000 });
    }
    if (k === 'restorepw') { const r = L.validateBackup(await A.decryptBackup(pendingRestore.env, f.pw)); if (!r.ok) throw new Error(r.error); pendingRestore = { name: pendingRestore.name, state: { ...r.state, logo: r.state.logo ?? null, exported_at: pendingRestore.env.exported_at } }; return render(); }
    if (k === 'chpw') { if (!(await A.verifyPassword(auth, f.old))) throw new Error('Current password is wrong.'); if (f.pw !== f.pw2) throw new Error('The new passwords do not match.'); auth = await A.createAuth(f.pw); await kvSet('auth', auth); bkKey = await A.backupKey(auth, f.pw); sheet = null; render(); return toast('Password changed.'); }
  } catch (err) { if (locked) { lockMsg = err.message; render(); } else toast(err.message, { alert: true, ms: 6000 }); }
  finally { if (btn?.isConnected) btn.disabled = false; }
}, true);

// ---- personal life record (life.js stores) ----
async function applyLife(life, legacyMem) { const l = LF.validateLife(life); if (!life && legacyMem?.length) l.memories = legacyMem; await LF.replaceAll(l); LIFE = l; S.mem = LIFE.memories; }
async function syncMem() { if (!LIFE_READY) return; const have = await LF.loadAll().then((l) => l.memories).catch(() => null); if (!have) return; const ids = new Set(S.mem.map((m) => m.id)); for (const m of have) if (!ids.has(m.id)) await LF.del('memories', m.id); for (const m of S.mem) await LF.put('memories', m); }
let LIFE_READY = false;
const prefOf = (id) => LIFE.preferences.find((p) => p.id === id)?.value;
async function setPref(id, value) { const p = { id, value, at: Date.now() }; LIFE.preferences = LIFE.preferences.filter((x) => x.id !== id).concat(p); await LF.put('preferences', p); }
const aiLife = () => ({ memories: S.mem, goals: LIFE.goals, progress: LIFE.progress, style: prefOf('style') });
function offerRemember(text, opts) { const st = LF.styleFromText(text); if (st && st !== prefOf('style')) { pendingRemember = { style: st }; return; } const c = LF.rememberCandidate(text); pendingRemember = c ? { text: c } : null; }
function checkinHTML() { if (checkinShown) return ''; const q = LF.checkinPrompt(prefOf('checkin'), LIFE.journal); if (!q) return ''; checkinShown = true; setPref('checkin', Date.now()); return `<div class="checkin" id="checkin"><button class="link" data-act="checkin">${esc(q)}</button><button class="trash" data-act="checkin-x" aria-label="Not now">${ic('x')}</button></div>`; }
const moodName = (v) => (LF.MOODS.find(([k]) => k === Number(v)) || [, ''])[1];
function journalList() { const es = LF.searchJournal(LIFE.journal, jQ, jTag);
  return es.map((e) => `<div class="card"><div class="tap" data-act="edit" data-k="journal" data-id="${e.id}"><div class="mute">${esc(new Date(e.date + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}${e.mood ? ' · ' + esc(moodName(e.mood)) : ''}</div>${e.title ? `<b>${esc(e.title)}</b>` : ''}<div style="overflow-wrap:anywhere;white-space:pre-wrap">${esc(e.text.length > 280 ? e.text.slice(0, 280) + '…' : e.text)}</div><div>${(e.tags || []).map((t) => `<span class="chip">${esc((LF.TAGS.find(([k]) => k === t) || [, t])[1])}</span>`).join('')}</div></div>
    <div class="row" style="margin-top:8px"><button class="btn sm sage" data-act="reflect" data-id="${e.id}">Reflect with ANNA</button><span class="grow"></span>${editBtn('journal', e.id)}</div></div>`).join('') || `<div class="card">${empty(LIFE.journal.length ? 'No entries match.' : 'Your journal is private. Write whenever you like.')}</div>`; }
function journalHTML() { return `<div class="adds">${addBtn('journal', '＋ New entry')}</div><input id="jq" class="search" type="search" placeholder="Search your journal" value="${esc(jQ)}" aria-label="Search journal">
  <div class="chips">${LF.TAGS.map(([k, n]) => `<button data-act="jtag" data-id="${k}" class="${k === jTag ? 'on' : ''}">${n}</button>`).join('')}</div><div class="mute" style="margin:2px 2px 8px">${ic('check').replace('class="i"', 'class="i" style="width:14px;height:14px;vertical-align:-2px"')} Private: never copied into memories, never read by ANNA unless you tap Reflect with ANNA.</div><div id="jlist">${journalList()}</div>`; }
function goalsHTML() { const rv = LF.weeklyReview(LIFE), active = LIFE.goals.filter((g) => !g.done), done = LIFE.goals.filter((g) => g.done);
  const card = (g) => { const p = LF.goalProgress(g, LIFE.progress), st = g.horizon === 'habit' ? LF.streak(g.id, LIFE.progress) : 0;
    return `<div class="card"><div class="row"><div class="grow tap" data-act="edit" data-k="goal" data-id="${g.id}"><b class="${g.done ? 'done' : ''}">${esc(g.title)}</b><div class="mute">${esc((LF.HORIZONS.find(([k]) => k === g.horizon) || [, ''])[1])}${p.target ? ` · ${p.total} of ${p.target}${g.unit ? ' ' + esc(g.unit) : ''}` : p.entries ? ` · ${p.total}${g.unit ? ' ' + esc(g.unit) : ''} logged` : ' · nothing logged yet'}${st ? ` · ${st}-day streak` : ''}</div></div>${g.done ? '' : `<button class="btn sm" data-act="glog" data-id="${g.id}">Log</button>`}<button class="edit" data-act="gdone" data-id="${g.id}" aria-label="${g.done ? 'Mark not achieved' : 'Mark achieved'}">${ic('check')}</button></div>${p.target ? `<div class="bar"><i style="width:${p.pct}%"></i></div>` : ''}</div>`; };
  return `<div class="card"><h2>This week</h2><div class="mute" style="margin:4px 0 6px">From your own records only.</div>${rv.lines.map((l) => `<div>${esc(l)}</div>`).join('')}${rv.journalEntries ? `<div class="mute" style="margin-top:6px">${rv.journalEntries} journal entr${rv.journalEntries === 1 ? 'y' : 'ies'}${rv.avgMood ? ` · average mood ${rv.avgMood}/5` : ''}</div>` : ''}</div>
  <div class="adds">${addBtn('goal', '＋ Goal or habit')}</div>${active.map(card).join('') || `<div class="card">${empty('Add a daily, weekly, monthly or long-term goal, or a habit.')}</div>`}${done.length ? sh('Achieved') + done.map(card).join('') : ''}`; }
async function saveLifeForm(k, f, form, rec) {
  const now = Date.now();
  if (k === 'journal') { if (!String(f.text || '').trim()) { form.querySelector('[name=text]').focus(); return toast('Please write something first.'); }
    const e = { ...(rec || { id: L.uid(), created_at: now }), date: f.date || LF.todayISO(), mood: f.mood ? Number(f.mood) : null, tags: LF.TAGS.map(([t]) => t).filter((t) => f['tag_' + t]), title: String(f.title || '').trim(), text: String(f.text).trim(), updated_at: now };
    if (!rec) LIFE.journal.push(e); else Object.assign(rec, e); await LF.put('journal', e); sheet = null; editId = null; brainView = 'journal'; if (tab !== 'brain') tab = 'brain'; render(); return toast(rec ? 'Entry updated.' : 'Saved to your private journal.'); }
  if (k === 'goal') { if (!String(f.title || '').trim()) return toast('Please name the goal.'); const tgt = f.target ? Number(String(f.target).replace(',', '.')) : null; if (f.target && !(tgt > 0)) return toast('Target must be a number above zero, or empty.');
    const g = { ...(rec || { id: L.uid(), created_at: now, done: false }), title: f.title.trim(), horizon: f.horizon, area: f.area, target: tgt, unit: String(f.unit || '').trim() };
    if (!rec) LIFE.goals.push(g); else Object.assign(rec, g); await LF.put('goals', g); sheet = null; editId = null; render(); return toast(rec ? 'Goal updated.' : 'Goal added.'); }
  if (k === 'person') { if (!String(f.name || '').trim()) return toast('Please enter a name.'); const rate = f.rate ? M.toCents(f.rate) : null; if (f.rate && !(rate > 0)) return toast('Hourly rate must be a number above zero, or empty.');
    const thr = Number(String(f.ot_threshold || 45).replace(',', '.')), mul = Number(String(f.ot_mult || 1.5).replace(',', '.')); if (!(thr > 0) || !(mul >= 1)) return toast('Check the overtime settings.');
    const pr = { ...(rec || { id: L.uid(), type: 'person', created_at: now }), name: f.name.trim(), role: String(f.role || '').trim(), rate_cents: rate, phone: String(f.phone || '').trim(), ot_threshold: thr, ot_mult: mul, double_special: !!f.double_special };
    if (!rec) LIFE.staff.push(pr); else Object.assign(rec, pr); await LF.put('staff', pr); sheet = null; editId = null; render(); return toast(rec ? 'Saved.' : 'Staff member added.'); }
  if (k === 'shift') { if (!f.staff) return toast('Add a staff member first.'); try { M.shiftHours(f.start, f.end, f.break_min); } catch (e) { return toast(e.message); }
    const sh = { ...(rec || { id: L.uid(), type: 'shift', created_at: now }), staff: f.staff, date: f.date, start: f.start, end: f.end, break_min: Number(f.break_min) || 0, task: String(f.task || '').trim() };
    if (!rec) LIFE.staff.push(sh); else Object.assign(rec, sh); await LF.put('staff', sh); sheet = null; editId = null; render(); return toast(rec ? 'Shift updated.' : 'Shift added.'); }
  if (k === 'glog') { const v = Number(String(f.value || '').replace(',', '.')); if (!(v > 0)) return toast('Enter an amount above zero.'); const at = f.date && f.date !== LF.todayISO() ? new Date(f.date + 'T12:00:00').getTime() : now;
    const p = { id: L.uid(), goal: logGoal, value: v, note: String(f.note || '').trim(), at }; LIFE.progress.push(p); await LF.put('progress', p); sheet = null; render(); return toast('Progress logged.'); }
}

// Money now / money coming, from the main Money card
async function saveFinForm(k, f) {
  const cents = L.parseCents(f.amount); if (cents === null && !(k === 'cash' && /^\s*0+([.,]0+)?\s*$/.test(f.amount || ''))) return toast('Enter an amount like 150 or 12,50.');
  const now = Date.now(); let r;
  if (k === 'cash') r = { id: 'cash', type: 'cash', balance: cents || 0, at: now };
  else { if (!String(f.name || '').trim()) return toast('Please say what the money is for.'); if (!f.date) return toast('Please choose the date it comes.');
    const date = new Date(f.date + 'T12:00:00').getTime(); if (M.daysUntil(date) < 0) return toast('That date has passed. Record it as income instead.');
    r = { id: 'incoming-' + L.uid().slice(0, 8), type: 'incoming', name: f.name.trim(), amount: cents, date, at: now }; }
  LIFE.finance = LIFE.finance.filter((y) => y.id !== r.id).concat(r); await LF.put('finance', r); sheet = null; render();
  toast(k === 'cash' ? 'Money now updated.' : `Added: ${L.fmt(r.amount, cur())} on ${dstr(r.date)}.`);
}

// ---- money & business tools (money.js does all maths; ANNA only explains) ----
const CODE_OF = { R: 'ZAR', '$': 'USD', '€': 'EUR', '£': 'GBP' };
const curCode = () => (BD?.currency) || CODE_OF[cur()] || 'ZAR';
const monthNow = () => LF.todayISO().slice(0, 7);
const monthName = (ym) => new Date(ym + '-15T12:00:00').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
const daysIn = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
function loadDraft() { if (BD) return BD; const d = LIFE.finance.find((x) => x.id === 'budget-draft'); BD = d ? { ...d, lines: d.lines.map((l) => ({ ...l })) } : { id: 'budget-draft', type: 'draft', month: monthNow(), currency: CODE_OF[cur()] || 'ZAR', days: 30, lines: M.DEFAULT_LINES() }; M.setCurrency(BD.currency); return BD; }
let draftT = 0; function saveDraft() { clearTimeout(draftT); const snap = { ...BD, lines: BD.lines.map((l) => ({ ...l })) }; LIFE.finance = LIFE.finance.filter((x) => x.id !== 'budget-draft').concat(snap); draftT = setTimeout(() => LF.put('finance', snap).catch(() => {}), 300); }
const budgetFor = (ym) => { const s = LIFE.finance.find((x) => x.id === 'budget-' + ym); if (s) return { ...M.monthly(s.lines, { days: s.days }), source: 'saved', currency: s.currency }; return null; };
const kv = (k, v, cls = '') => `<b>${k}</b><span class="${cls}">${v}</span>`;
function budgetResults() { const t = M.monthly(BD.lines, { days: BD.days }), mm = (c) => esc(M.money(c, BD.currency));
  return `<div class="status">${kv('Total income', mm(t.income))}${kv('Total bills', mm(t.bills))}${kv('Living costs', mm(t.living))}${kv('Once-off', mm(t.once))}${kv('Total expenses', mm(t.expenses))}${kv('Total savings', mm(t.savings))}${kv('Remaining', mm(t.remaining), t.remaining < 0 ? 'n' : 'y')}${kv('Weekly allowance', mm(t.weekly))}${kv('Daily allowance', mm(t.daily))}${kv('% of income spent', t.spentPct === null ? 'enter income' : t.spentPct + '%')}${kv(t.status === 'shortfall' ? 'Shortfall' : 'Surplus', mm(Math.abs(t.remaining)), t.remaining < 0 ? 'n' : 'y')}</div>
  <div class="mute" style="margin-top:8px;font-size:13px">${t.assumptions.map(esc).join('<br>')}</div>`; }
const paintBudget = () => { const r = $('#bres'); if (r) r.innerHTML = budgetResults(); };
function budgetPanel() { loadDraft(); M.setCurrency(BD.currency); const saved = M.compareMonths(LIFE.finance.filter((x) => x.type === 'budget')).reverse(), mm = (c, code) => esc(M.money(c, code));
  const line = (l) => `<div class="bline"><input data-bl="name" data-id="${l.id}" value="${esc(l.name)}" aria-label="Item name" maxlength="40"><input data-bl="amt" data-id="${l.id}" inputmode="decimal" placeholder="0" value="${l.cents ? esc((l.cents / 100).toFixed(2)) : ''}" aria-label="${esc(l.name)} amount">${l.id.startsWith('c-') ? `<button class="trash" data-act="b-del" data-id="${l.id}" aria-label="Remove ${esc(l.name)}">${ic('trash')}</button>` : '<span style="width:44px"></span>'}</div>`;
  const group = (title, kinds) => `<div class="f"><span>${title}</span>${BD.lines.filter((l) => kinds.includes(l.kind)).map(line).join('')}</div>`;
  return `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="Monthly calculator"><div class="gr"></div><div class="row"><h2 class="grow">Monthly calculator</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div>
  <div class="mute" style="margin:4px 0 8px">Works without the AI. Every number comes from what you type.</div>
  <div class="two">${fld('Month', `<input type="month" data-b="month" value="${BD.month}">`)}${fld('Currency', `<select data-b="currency">${M.CURRENCIES.map(([c, sy, n]) => opt(c, `${sy} — ${n}`, BD.currency)).join('')}</select>`)}</div>
  ${fld('Count a month as', `<select data-b="days">${opt('30', '30 days', String(BD.days))}${opt(String(daysIn(BD.month)), `${daysIn(BD.month)} days (actual ${monthName(BD.month).split(' ')[0]})`, String(BD.days))}</select>`)}
  ${group('Income', ['income'])}${group('Bills', ['bill'])}<button class="btn sm sage" data-act="b-add">＋ Add a bill</button>${group('Living costs', ['living'])}${group('Once-off and savings', ['once', 'savings'])}
  <div class="card" id="bres">${budgetResults()}</div><button class="btn full" data-act="b-save">Save ${esc(monthName(BD.month))}</button>
  ${saved.length ? `<div class="sh"><h2>Saved months</h2></div><div class="card"><div class="status">${saved.map((m) => `<b>${esc(monthName(m.month))}</b><span>${mm(m.remaining, m.currency)} left${m.change !== null ? ` · ${m.change >= 0 ? '+' : '−'}${mm(Math.abs(m.change), m.currency)} vs previous` : ''} · spent ${m.spentPct ?? '–'}% <button class="link" style="min-height:0;padding:0" data-act="b-delmonth" data-id="budget-${m.month}">delete</button></span>`).join('')}</div></div>` : ''}</div>`; }
const CTABS = [['basic', 'Maths'], ['vat', 'VAT'], ['wages', 'Wages'], ['margin', 'Margin'], ['pl', 'Profit & loss'], ['proj', 'Projection']];
const cin = (k, label, ph = '', mode = 'decimal') => fld(label, `<input data-c="${k}" inputmode="${mode}" placeholder="${esc(ph)}" value="${esc(CALC[k] ?? '')}">`);
function calcResult() { const c = (k) => (CALC[k] ?? '').trim(), mc = (k) => (c(k) ? M.toCents(c(k)) : 0), mm = (x) => esc(M.money(x)), out = (res, steps) => `<div class="calcres">${res}</div><div class="mute" style="margin-top:6px">${steps.map(esc).join('<br>')}</div>`;
  try {
    if (calcTab === 'basic') { if (!c('expr')) return '<div class="mute">Type a sum, e.g. 2000 × 15% or (1200 + 350) ÷ 3</div>'; const v = M.evaluate(c('expr')); return out(esc(M.fmtNum(v, 6)), [`${c('expr')} = ${M.fmtNum(v, 6)} (exact decimal maths)`]); }
    if (calcTab === 'vat') { const a = mc('amount'); if (!a) return '<div class="mute">Enter an amount.</div>'; const r = M.vat(a, c('mode') || 'add', Number(c('rate') || 15)); return out(`${mm(r.excl)} excl. · ${mm(r.vat)} VAT · ${mm(r.incl)} incl.`, r.steps); }
    if (calcTab === 'wages') { let h = c('hours') ? Number(c('hours').replace(',', '.')) : null, pre = []; if (h === null && c('start') && c('end')) { h = M.shiftHours(c('start'), c('end'), Number(c('break') || 0)); pre.push(`Hours = ${c('start')} to ${c('end')} minus ${Number(c('break') || 0)} min break = ${h} h`); }
      if (!(h > 0) || !mc('rate')) return '<div class="mute">Enter hours (or start and end times) and an hourly rate.</div>'; const w = M.wages(h, mc('rate'), { threshold: Number(c('threshold') || 45), multiplier: Number(c('mult') || 1.5) }); return out(mm(w.total), [...pre, ...w.steps]); }
    if (calcTab === 'margin') { if (!mc('cost') || !mc('price')) return '<div class="mute">Enter cost and selling price.</div>'; const r = M.margin(mc('cost'), mc('price')); return out(`${mm(r.profit)} profit · ${r.marginPct}% margin`, r.steps); }
    if (calcTab === 'pl') { if (!mc('revenue')) return '<div class="mute">Enter revenue, cost of sales and expenses.</div>'; const r = M.profitLoss({ revenue: mc('revenue'), cogs: mc('cogs'), expenses: mc('expenses') }); return out(`${mm(Math.abs(r.net))} ${r.result}`, r.steps); }
    if (calcTab === 'proj') { const months = Number(c('months') || 12); if (!(months > 0 && months <= 600)) return '<div class="mute">Months must be 1–600.</div>'; const r = M.projection({ start: mc('start'), monthly: mc('monthly'), growthPct: Number((c('growth') || '0').replace(',', '.')), months }); return out(mm(r.end), r.steps); }
  } catch (e) { return `<div class="warn">${esc(e.message)}</div>`; } return ''; }
const paintCalc = () => { const r = $('#cres'); if (r) r.innerHTML = calcResult(); };
function calcPanel() { M.setCurrency(curCode()); const sel = (k, opts) => fld(opts.label, `<select data-c="${k}">${opts.o.map(([v, n]) => opt(v, n, CALC[k] ?? opts.o[0][0])).join('')}</select>`);
  const f = { basic: cin('expr', 'Calculation', 'e.g. 2000 × 15%', 'text'), vat: `<div class="two">${cin('amount', 'Amount')}${cin('rate', 'VAT %', '15')}</div>${sel('mode', { label: 'The amount is', o: [['add', 'excluding VAT (add VAT)'], ['remove', 'including VAT (remove VAT)']] })}`,
    wages: `<div class="two">${cin('hours', 'Hours worked', 'or use times below')}${cin('rate', 'Hourly rate')}</div><div class="two">${fld('Start', `<input data-c="start" type="time" value="${esc(CALC.start || '')}">`)}${fld('End', `<input data-c="end" type="time" value="${esc(CALC.end || '')}">`)}</div><div class="two">${cin('break', 'Break (min)', '0', 'numeric')}${cin('threshold', 'Ordinary hours', '45')}</div>${cin('mult', 'Overtime ×', '1.5')}`,
    margin: `<div class="two">${cin('cost', 'Cost')}${cin('price', 'Selling price')}</div>`, pl: `${cin('revenue', 'Revenue (sales)')}<div class="two">${cin('cogs', 'Cost of sales')}${cin('expenses', 'Other expenses')}</div>`,
    proj: `<div class="two">${cin('start', 'Starting amount')}${cin('monthly', 'Added each month')}</div><div class="two">${cin('growth', 'Growth % per month', '0')}${cin('months', 'Months', '12', 'numeric')}</div>` }[calcTab];
  return `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="Calculator"><div class="gr"></div><div class="row"><h2 class="grow">Calculator</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div>
  <div class="chips" style="margin:8px 0">${CTABS.map(([k, n]) => `<button data-act="ctab" data-id="${k}" class="${k === calcTab ? 'on' : ''}">${n}</button>`).join('')}</div>${f}<div class="card" id="cres">${calcResult()}</div></div>`; }
let payId = null;
function payPanel() { const b = byId(S.bills, payId); if (!b) return '';
  return `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="Pay ${esc(b.name)}"><div class="gr"></div><div class="row"><h2 class="grow">${esc(b.name)}</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div>
  <div class="mute" style="margin:4px 0 12px">${money(b.amount_cents)} · due ${dstr(b.due_at)}</div>
  <button class="btn full" data-act="pay-do" data-id="exp">I paid it: take ${money(b.amount_cents)} off my money</button>
  <button class="btn soft full" style="margin-top:8px" data-act="pay-do" data-id="only">Already paid: my money now is up to date</button>
  <button class="btn sage full" style="margin-top:8px" data-act="close">Not paid yet</button>
  <button class="btn sage full" style="margin-top:8px" data-act="edit" data-k="bill" data-id="${b.id}">Change amount or date</button></div>`; }
function affordData() { const ym = monthNow(), [m0, m1] = L.monthRange(), ms = L.monthSummary(S);
  return { budget: budgetFor(ym), recorded: { income: ms.income, expenses: ms.expense }, unpaidBills: S.bills.filter((b) => !b.paid && b.due_at < m1) }; }
function affordText(amount, what = '') { M.setCurrency(budgetFor(monthNow())?.currency || curCode()); const r = M.afford(amount, affordData());
  return [`${r.verdict ? r.verdict : 'NOT SURE YET'}${what ? ` — ${what}` : ''} (${M.money(amount)})`, ...r.reasons, ...(r.missing.length ? ['Missing: ' + r.missing.join('; ') + '.'] : [])].join('\n'); }
const paintAfford = () => { const r = $('#ares'); if (r) r.innerHTML = affordResult(); };
function affordResult() { const a = AFF.amount.trim() ? M.toCents(AFF.amount) : null; if (!(a > 0)) return '<div class="mute">Enter the price to check.</div>'; const [head, ...rest] = affordText(a, AFF.what.trim()).split('\n'); return `<div class="calcres">${esc(head)}</div><div style="margin-top:6px">${rest.map(esc).join('<br>')}</div>`; }
function affordPanel() { return `<div class="bk" data-act="close"></div><div class="pn" role="dialog" aria-label="Can I afford it?"><div class="gr"></div><div class="row"><h2 class="grow">Can I afford it?</h2><button class="ib" data-act="close" aria-label="Close">${ic('x')}</button></div>
  <div class="mute" style="margin:4px 0 8px">Uses only your saved monthly budget and recorded money. It never guesses missing figures.</div><div class="two">${fld('Price', `<input data-a="amount" inputmode="decimal" placeholder="e.g. 2000" value="${esc(AFF.amount)}">`)}${fld('What for', `<input data-a="what" maxlength="60" placeholder="Optional" value="${esc(AFF.what)}">`)}</div><div class="card" id="ares">${affordResult()}</div></div>`; }
function staffHTML() { M.setCurrency(curCode()); const people = LIFE.staff.filter((x) => x.type === 'person'), shifts = LIFE.staff.filter((x) => x.type === 'shift'), at = Date.now() + staffWeek * 7 * 864e5, from = M.weekStart(at), to = from + 7 * 864e5, mm = (c) => esc(M.money(c));
  const ts = M.timesheet(people, shifts, at, { isSpecialDay }), wk = shifts.filter((s) => { const t = new Date(s.date + 'T12:00:00').getTime(); return t >= from && t < to; }).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const biz = S.biz.filter((r) => r.occurred_at >= from && r.occurred_at < to), sales = biz.filter((r) => r.kind === 'sale').reduce((n, r) => n + r.amount_cents, 0), exp = biz.filter((r) => r.kind === 'expense').reduce((n, r) => n + r.amount_cents, 0), wages = ts.reduce((n, t) => n + (t.pay || 0), 0);
  const label = `${new Date(from).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} – ${new Date(to - 864e5).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`;
  return `<div class="adds">${addBtn('person', '＋ Staff member')}${people.length ? addBtn('shift', '＋ Shift', 'soft') : ''}</div>
  <div class="row" style="justify-content:space-between;margin:6px 0"><button class="ib" data-act="sweek" data-id="-1" aria-label="Previous week">‹</button><b>${staffWeek === 0 ? 'This week' : esc(label)}</b><button class="ib" data-act="sweek" data-id="1" aria-label="Next week">›</button></div>
  ${sh('Timesheet', `<span class="mute">${esc(label)}</span>`)}<div class="card">${ts.map((t) => `<div class="item"><div class="grow tap" data-act="edit" data-k="person" data-id="${t.id}"><b>${esc(t.name)}</b><div class="mute">${t.shifts} shift${t.shifts === 1 ? '' : 's'} · ${M.fmtNum(t.hours)} h${t.overtime ? ` · ${M.fmtNum(t.overtime)} h overtime` : ''}</div>${t.steps.length ? `<div class="mute" style="font-size:12px">${t.steps.map(esc).join('<br>')}</div>` : ''}</div><b>${t.pay !== null ? mm(t.pay) : '<span class="mute">add rate</span>'}</b></div>`).join('') || empty('Add your staff to track hours and wages.')}</div>
  <div class="card"><div class="status">${kv('Wages this week', mm(wages))}${kv('Sales recorded', mm(sales))}${kv('Business expenses', mm(exp))}${kv('Sales − expenses − wages', mm(sales - exp - wages), sales - exp - wages < 0 ? 'n' : 'y')}</div><div class="mute" style="margin-top:6px;font-size:13px">Only shifts, rates and records you entered. Sales and expenses come from Business → Overview.</div></div>
  ${sh('Shifts')}<div class="card">${wk.map((s) => { const p = people.find((x) => x.id === s.staff); let h = ''; try { h = M.fmtNum(M.shiftHours(s.start, s.end, s.break_min)) + ' h'; } catch {} return `<div class="item"><div class="grow tap" data-act="edit" data-k="shift" data-id="${s.id}"><b>${esc(p?.name || 'Unknown')}</b><div class="mute">${esc(new Date(s.date + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' }))} · ${s.start}–${s.end}${s.break_min ? ` · ${s.break_min} min break` : ''} · ${h}${s.task ? ' · ' + esc(s.task) : ''}</div></div>${editBtn('shift', s.id)}</div>`; }).join('') || empty('No shifts this week.')}</div>`; }
const isSpecialDay = (iso) => new Date(iso + 'T12:00:00').getDay() === 0 || !!TM.holidayOn(new Date(iso + 'T12:00:00').getTime());
// ---- chat money entries: parse → confirm card → save (only on tap) → warnings, with Undo ----
function say(text, extra = {}) { S.chat.push({ role: 'assistant', content: text, at: Date.now(), tool: 'money', ...extra }); paintChat(true); return save(); }
const monthId = () => 'budget-' + monthNow();
function monthRec(create) { let m = LIFE.finance.find((x) => x.id === monthId()); if (!m && create) { loadDraft(); m = { id: monthId(), type: 'budget', month: monthNow(), currency: BD.currency, days: BD.days, lines: BD.lines.map((l) => ({ ...l })), saved_at: Date.now(), spent: {}, saved: 0, next: [] }; } return m; }
const findBill = (name, unpaidOnly) => S.bills.find((b) => (!unpaidOnly || !b.paid) && M.sameName(b.name, name));
function describeEntry(e) {
  M.setCurrency(curCode()); const m = (c) => M.money(c), b = findBill(e.name), bu = findBill(e.name, true);
  switch (e.type) {
    case 'income': return `Add ${m(e.amount)} ${e.label.toLowerCase()} to ${monthName(monthNow())}?`;
    case 'expense': return `Record ${m(e.amount)} spent on ${e.category}?`;
    case 'billNew': return `Add a new bill “${e.name}”, ${m(e.amount)}${e.thisMonthOnly ? ' for this month only' : ' every month'}?`;
    case 'billSet': return `Change ${b?.name || e.name} to ${m(e.amount)}${b ? ` (was ${m(b.amount_cents)})` : ''}?`;
    case 'billCancel': return `Remove the bill “${b?.name || e.name}”${b ? ` (${m(b.amount_cents)})` : ''}?`;
    case 'billPaid': return `Mark ${bu.name} (${m(e.amount || bu.amount_cents)}) as paid and record it as spent?`;
    case 'saved': return `Record ${m(e.amount)} saved this month?`;
    case 'moveDue': { const n = S.bills.filter((x) => !x.paid).length; return `Move ${n === 1 ? 'your unpaid bill' : `all ${n} unpaid bills`} to ${dstr(e.date)}${e.pay ? `, and set payday to ${dstr(e.date)}` : ''}?`; }
    case 'paydayDate': return `Set payday to ${dstr(e.date)}?`;
    default: return `Note ${e.name}, ${m(e.amount)}, for next month?`;
  }
}
function entryReply(text) {
  const e = M.parseEntry(text); if (!e) return '';
  if (e.type === 'billPaid' && !findBill(e.name, true)) return `I couldn’t find an unpaid bill called “${e.name}”. Unpaid bills: ${S.bills.filter((b) => !b.paid).map((b) => b.name).join(', ') || 'none'}.`;
  if (e.type === 'billCancel' && !findBill(e.name) && !(monthRec()?.lines || []).some((l) => M.sameName(l.name, e.name))) return `I couldn’t find a bill called “${e.name}”.`;
  pendingEntry = { ...e, text }; return describeEntry(e);
}
async function saveDates(e) {
  const p = LIFE.finance.find((x) => x.id === 'payday'), before = { tx: JSON.parse(JSON.stringify(S.tx)), bills: JSON.parse(JSON.stringify(S.bills)), fin: [{ id: 'payday', prev: p ? { ...p } : null }] }, out = [];
  if (e.type === 'moveDue') { const un = S.bills.filter((b) => !b.paid); un.forEach((b) => { b.due_at = e.date; }); out.push(`Moved ${un.length} unpaid bill${un.length === 1 ? '' : 's'} to ${dstr(e.date)}.`); }
  if (e.type === 'paydayDate' || e.pay) { const r = { ...(p || { id: 'payday', type: 'payday', name: 'Pay', amount: 0 }), date: e.date, at: Date.now() }; LIFE.finance = LIFE.finance.filter((x) => x.id !== 'payday').concat(r); await LF.put('finance', r); out.push(`Payday is now ${dstr(e.date)}.${r.amount ? '' : ' Tell me how much you get paid, e.g. “I get paid R10500 on the 26th”.'}`); }
  await save(); const uid = L.uid(); entryUndo[uid] = before; render(); await say(out.join('\n'), { undo: uid });
}
async function saveEntry() {
  const e = pendingEntry; if (!e) return; pendingEntry = null; M.setCurrency(curCode());
  if (e.type === 'moveDue' || e.type === 'paydayDate') return saveDates(e);
  const existing = monthRec(), month = monthRec(true);
  const before = { tx: JSON.parse(JSON.stringify(S.tx)), bills: JSON.parse(JSON.stringify(S.bills)), month: existing ? JSON.parse(JSON.stringify(existing)) : null, monthId: month.id };
  month.spent ||= {}; month.saved ||= 0; month.next ||= [];
  const now = Date.now(), endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 12).getTime(), line = (name) => month.lines.find((l) => M.sameName(l.name, name));
  let done = '';
  if (e.type === 'income') { S.tx.push({ id: L.uid(), kind: 'income', amount_cents: e.amount, category: e.label, note: null, occurred_at: now }); const x = month.lines.find((l) => l.id === 'extra'); if (x) x.cents += e.amount; else month.lines.push({ id: 'extra', name: 'Extra income', kind: 'income', cents: e.amount }); done = `Saved: ${M.money(e.amount)} ${e.label.toLowerCase()}.`; }
  else if (e.type === 'expense') { S.tx.push({ id: L.uid(), kind: 'expense', amount_cents: e.amount, category: e.category, note: null, occurred_at: now }); month.spent[e.category] = (month.spent[e.category] || 0) + e.amount; done = `Saved: ${M.money(e.amount)} on ${e.category}.`; }
  else if (e.type === 'billNew' || (e.type === 'billSet' && !findBill(e.name) && !line(e.name))) { const id = L.uid(); S.bills.push({ id, name: e.name, amount_cents: e.amount, due_at: endOfMonth, priority: 2, repeat_monthly: e.thisMonthOnly ? 0 : 1, paid: 0, paid_at: null }); const ln = line(e.name); if (ln && !e.thisMonthOnly) ln.cents = e.amount; else month.lines.push({ id: 'c-' + id.slice(0, 8), name: e.name, kind: 'bill', cents: e.amount, oneMonth: !!e.thisMonthOnly }); done = `Saved: ${e.name}, ${M.money(e.amount)}${e.thisMonthOnly ? ' (this month)' : ' a month'}. Priority 2, due ${dstr(endOfMonth)}: change it in Money → Bills.`; }
  else if (e.type === 'billSet') { const b = findBill(e.name), l = line(e.name); if (b) b.amount_cents = e.amount; if (l) l.cents = e.amount; done = `Saved: ${(b || l).name} is now ${M.money(e.amount)}.`; }
  else if (e.type === 'billCancel') { const b = findBill(e.name), l = line(e.name); if (b) S.bills = S.bills.filter((x) => x !== b); if (l) { if (l.id.startsWith('c-')) month.lines = month.lines.filter((x) => x !== l); else l.cents = 0; } done = `Saved: ${(b || l).name} removed.`; }
  else if (e.type === 'billPaid') { const b = findBill(e.name, true); if (e.amount) b.amount_cents = e.amount; L.payBill(S, b.id, { recordExpense: true, now }); done = `Saved: ${b.name} marked paid.`; }
  else if (e.type === 'saved') { month.saved += e.amount; done = `Saved: ${M.money(e.amount)} put away this month.`; }
  else { month.next.push({ name: e.name, amount: e.amount }); done = `Saved: ${e.name} (${M.money(e.amount)}) noted for next month.`; }
  month.totals = M.monthly(month.lines, { days: month.days || 30 }); month.saved_at = now;
  LIFE.finance = LIFE.finance.filter((x) => x.id !== month.id).concat(month); await LF.put('finance', month); await save();
  const ok = (await kvGet('state'))?.tx?.length === S.tx.length && (await LF.loadAll()).finance.some((x) => x.id === month.id);
  if (!ok) { S.tx = before.tx; S.bills = before.bills; await save(); return say('I couldn’t save that on this device. Nothing was changed.'); }
  const uid = L.uid(); entryUndo[uid] = before;
  await say([done, ...monthWarnings(month)].join('\n'), { undo: uid });
  if (BK) booksAsk(true);
}
const daysLeftInMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1; };
function monthWarnings(month) {
  const st = M.monthState(month, { daysLeft: daysLeftInMonth(), budgets: L.budgetStatus(S) });
  return st.warnings.map((w) => '⚠ ' + w.text + (w.options.length ? ' Options: ' + w.options.join('; or ') + '. You decide.' : ''));
}
function payFirstText() {
  M.setCurrency(curCode()); const ms = L.monthSummary(S), m = monthRec(); let available = null, basis = '';
  if (ms.income > 0) { available = ms.income - ms.expense; basis = `recorded income ${M.money(ms.income)} minus recorded spending ${M.money(ms.expense)}`; }
  else if (m) { const t = M.monthly(m.lines, { days: m.days || 30 }); available = t.income - t.savings - t.living - t.once; basis = `your plan: income ${M.money(t.income)} minus savings, living and once-off costs`; }
  const o = M.payOrder(S.bills, available); if (!o.rows.length) return 'All your bills are paid.';
  const rows = o.rows.map((b, i) => `${i + 1}. ${b.name} (P${b.priority || 2}, due ${dstr(b.due_at)}): ${M.money(b.amount_cents)} · running ${M.money(b.running)}${i === o.runsOutAt ? '  ← money runs out here' : ''}`);
  const tail = available == null ? 'I don’t know how much money you have this month: record your income or save a monthly budget.' : `Available: ${M.money(available)} (${basis}). ${o.short ? `You are ${M.money(o.short)} short for all of them.` : `Enough for all unpaid bills, with ${M.money(available - o.total)} left.`}`;
  return ['Pay in this order (priority, then due date):', ...rows, tail].join('\n');
}
// ---- Books Day ----
const booksStateGet = () => prefOf('books') || {};
const booksState = (patch) => setPref('books', { ...booksStateGet(), ...patch });
function booksNudge() {
  if (BK || !M.booksDue(Date.now(), booksStateGet())) return;
  booksState({ lastAsked: new Date().toDateString() });
  S.chat.push({ role: 'assistant', content: `It’s Books Day for ${monthName(M.booksMonth())}. Shall we close the month together? I’ll ask one question at a time.`, at: Date.now(), tool: 'money', books: [['books-start', 'Start'], ['books-snooze', 'Tomorrow', 'sage'], ['books-skip', 'Skip this month', 'sage']] }); save();
}
function booksAsk(again) {
  if (!BK) return; const q = M.BOOKS_QUESTIONS[BK.step]; if (!q) return booksFinish();
  let text = again ? 'Anything else? Or say “none” to move on.' : q[1];
  if (!again && q[0] === 'paid') { const un = S.bills.filter((b) => !b.paid); text += un.length ? ` Unpaid now: ${un.map((b) => b.name).join(', ')}.` : ' (All bills are already marked paid: say “none”.)'; }
  say(text);
}
function booksAnswer(text) {
  if (M.isNone(text)) { BK.step++; if (BK.step >= M.BOOKS_QUESTIONS.length) { setTimeout(booksFinish, 0); return 'Thanks, that’s everything.'; } setTimeout(() => booksAsk(), 0); return 'Okay.'; }
  if (/^\s*(stop|cancel|later|not now)\s*$/i.test(text)) { BK = null; return 'Okay, we’ll stop here. Say “Books Day” to continue another time.'; }
  return entryReply(text) || 'I didn’t catch an amount there. Try e.g. “got R500 extra”, or say “none”.';
}
function booksFinish() {
  const m = monthRec(true); M.setCurrency(m.currency || curCode()); const st = M.monthState(m, { daysLeft: daysLeftInMonth() });
  const cur = { income: st.income, expenses: st.expenses + st.unplanned + st.over, saved: m.saved || 0, remaining: st.remaining }; BK.summary = cur;
  const t = new Date(), prevYm = M.booksMonth(new Date(t.getFullYear(), t.getMonth() - 1, 15).getTime()), prev = LIFE.finance.find((x) => x.id === 'books-' + prevYm)?.summary || null;
  say([`Summary for ${monthName(monthNow())}:`, ...M.booksSummary(cur, prev), prev ? '' : '(No closed month before this one to compare with.)', 'Close the month and carry your bills and priorities forward?'].filter(Boolean).join('\n'), { books: [['books-close', 'Close the month'], ['books-later', 'Not yet', 'sage']] });
}
async function booksClose() {
  if (!BK) return; const m = monthRec(true), ym = BK.month, nextYm = M.booksMonth(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 15).getTime());
  const rec = { id: 'books-' + ym, type: 'books', month: ym, summary: BK.summary, closed_at: Date.now() };
  LIFE.finance = LIFE.finance.filter((x) => x.id !== rec.id).concat(rec); await LF.put('finance', rec);
  if (!LIFE.finance.some((x) => x.id === 'budget-' + nextYm)) { const nm = { id: 'budget-' + nextYm, type: 'budget', month: nextYm, currency: m.currency, days: m.days || 30, lines: M.carryForward(m.lines, m.next || []), spent: {}, saved: 0, next: [], saved_at: Date.now() }; nm.totals = M.monthly(nm.lines, { days: nm.days }); LIFE.finance.push(nm); await LF.put('finance', nm); }
  S.bills = S.bills.filter((b) => b.repeat_monthly || !b.paid); await save(); await booksState({ closed: [...(booksStateGet().closed || []), ym] }); BK = null;
  const ok = (await LF.loadAll()).finance.some((x) => x.id === rec.id);
  say(ok ? `${monthName(ym)} is closed. ${monthName(nextYm)}’s plan starts with your recurring bills and their priorities.` : 'I couldn’t close the month on this device. Please try again.', ok ? { books: [['books-remind', 'Send next Books Day to iPhone Reminders']] } : {});
}
async function booksReminder() {
  const d = new Date(); let at = new Date(d.getFullYear(), d.getMonth(), M.BOOKS_DAY, 18, 0).getTime();
  if (at <= Date.now() || booksStateGet().closed?.includes(M.booksMonth())) at = new Date(d.getFullYear(), d.getMonth() + 1, M.BOOKS_DAY, 18, 0).getTime();
  let r = S.reminders.find((x) => x.title === 'ANNA Books Day' && !x.done);
  if (!r) { r = { id: L.uid(), title: 'ANNA Books Day', notes: 'Open ANNA and close the month', at, repeat: 'monthly', notified: 0, done: 0, done_at: null, created_at: Date.now(), dest: { anna: Date.now() } }; S.reminders.unshift(r); } else r.at = at;
  await save(); actions['rem-ios'](r.id);
}
// ---- many money items in one message (balance, planned payments, debts, payday, expenses): one card, Save all ----
const itemLine = (x, i) => { M.setCurrency(curCode()); return `${i + 1}. ${x.incoming ? 'Money coming' : M.ITEM_LABEL[x.type]} · ${x.name} · ${M.money(x.amount)}${x.date ? ' · ' + dstr(x.date) : ''}`; };
function batchText() {
  const b = pendingBatch, p = M.cashPlan(b.items);
  const L = [`I found ${b.items.length} money ${b.items.length === 1 ? 'item' : 'items'}:`, ...b.items.map(itemLine), ...M.cashPlanText(p)];
  if (b.items.some((x) => x.type === 'unknown')) L.push('“Not sure” items: tap Edit item to say what they are (I’ll count them as planned payments if you save as is).');
  if (b.ask.length) L.push(M.askAside(b.ask[0].name)); else L.push(S.settings.autoMoney ? '' : 'Nothing is saved until you tap Save all.');
  return L.filter(Boolean).join('\n');
}
function batchStart(r, text) { pendingBatch = { items: r.items, ask: r.ask, text }; if (AI.ai.state === 'ready' && r.items.some((x) => x.type === 'unknown')) setTimeout(classifyUnknown, 0); return batchText(); }
// rules couldn't decide → ask Qwen for one word; anything unclear stays "Not sure"
async function classifyUnknown() {
  for (const x of pendingBatch?.items || []) if (x.type === 'unknown') { try { const w = (await AI.ask([{ role: 'system', content: 'Classify a money note. Answer with one word only: balance, payment, debt, income or expense.' }, { role: 'user', content: x.text }], null, { maxTokens: 4 })).toLowerCase(); const t = { balance: 'balance', payment: 'planned', debt: 'debt', income: 'income', expense: 'expense' }[(w.match(/balance|payment|debt|income|expense/) || [])[0]]; if (t) x.type = t; } catch {} }
  if (pendingBatch) { S.chat.at(-1).content = batchText(); paintChat(true); save(); }
}
function batchAnswer(text) {
  const b = pendingBatch;
  if (b.ask.length) { const q = b.ask[0];
    if (M.isNone(text) || /^\s*(skip|nothing|0|r\s?0)\s*$/i.test(text)) { b.ask.shift(); return batchText(); }
    const a = M.amountOf(text); if (a?.cents) { b.ask.shift(); b.items.push({ ...q, amount: a.cents, name: q.name }); return batchText(); } }
  if (b.editing) { const x = M.classifyItem(text); if (x.amount) { b.editing = false; b.items.push(x); return batchText(); } }
  return '';
}
async function batchSave() {
  const b = pendingBatch; if (!b) return; pendingBatch = null; M.setCurrency(curCode());
  const now = Date.now(), items = b.items.map((x) => (x.type === 'unknown' ? { ...x, type: 'planned' } : x)), plan = M.cashPlan(items);
  const finIds = ['cash', 'payday'], before = { tx: JSON.parse(JSON.stringify(S.tx)), bills: JSON.parse(JSON.stringify(S.bills)), fin: finIds.map((id) => ({ id, prev: LIFE.finance.find((x) => x.id === id) || null })) };
  const pay = items.find((x) => x.type === 'income' && x.date && !x.incoming) || moneyView().payday, endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 12).getTime(), due = (x) => x.date || pay?.date || endOfMonth, fin = [];
  for (const x of items) {
    if (x.type === 'wish') { const r = { id: 'wish-' + L.uid().slice(0, 8), type: 'wish', name: x.name, price: x.amount, at: now }; fin.push(r); before.fin.push({ id: r.id, prev: null }); }
    else if (x.type === 'balance') fin.push({ id: 'cash', type: 'cash', balance: x.amount, at: now });
    else if (x.type === 'income' && x.date && x.incoming) { const r = { id: 'incoming-' + L.uid().slice(0, 8), type: 'incoming', name: x.name, amount: x.amount, date: x.date, at: now }; fin.push(r); before.fin.push({ id: r.id, prev: null }); }
    else if (x.type === 'income' && x.date) fin.push({ id: 'payday', type: 'payday', amount: x.amount, date: x.date, name: x.name, at: now });
    else if (x.type === 'income') S.tx.push({ id: L.uid(), kind: 'income', amount_cents: x.amount, category: x.name, note: null, occurred_at: now });
    else if (x.type === 'expense') S.tx.push({ id: L.uid(), kind: 'expense', amount_cents: x.amount, category: x.name, note: null, occurred_at: now });
    else S.bills.push({ id: L.uid(), name: x.name, amount_cents: x.amount, due_at: due(x), priority: 2, repeat_monthly: 0, paid: 0, paid_at: null, kind: x.type === 'debt' ? 'debt' : 'planned', ...(x.person ? { person: x.person } : {}), ...(x.setAside ? { set_aside: 1 } : {}) });
  }
  for (const r of fin) { LIFE.finance = LIFE.finance.filter((y) => y.id !== r.id).concat(r); await LF.put('finance', r); }
  await save();
  const ok = (await kvGet('state'))?.bills?.length === S.bills.length && (await LF.loadAll()).finance.filter((y) => fin.some((r) => r.id === y.id)).length === fin.length;
  if (!ok) { S.tx = before.tx; S.bills = before.bills; await save(); return say('I couldn’t save that on this device. Nothing was changed.'); }
  const uid = L.uid(); entryUndo[uid] = before;
  const wv = moneyView().wishes.filter((w) => fin.some((r) => r.id === w.id)).map((w) => `${w.name}: ${wishLabel(w)}.`);
  await say([`Saved ${items.length} ${items.length === 1 ? 'item' : 'items'}. Money now shows them.`, ...M.cashPlanText(plan), ...wv].join('\n'), { undo: uid });
}
// Money tab: money now = last balance you told ANNA ± money in/out recorded since; payday from what you said.
function moneyView() {
  const c = LIFE.finance.find((x) => x.id === 'cash'), p = LIFE.finance.find((x) => x.id === 'payday');
  const cash = c ? c.balance + S.tx.filter((t) => t.occurred_at > c.at).reduce((n, t) => n + (t.kind === 'income' ? t.amount_cents : -t.amount_cents), 0) : null;
  const pd = p && M.daysUntil(p.date) >= 0 ? { amount: p.amount, date: p.date } : null, incomes = [...(pd ? [{ id: 'payday', name: p.name && p.name !== 'Pay' ? p.name : 'Payday', ...pd }] : []), ...LIFE.finance.filter((x) => x.type === 'incoming').map((x) => ({ id: x.id, name: x.name, amount: x.amount, date: x.date }))];
  return M.moneyToday({ cash, bills: S.bills, payday: pd, incomes, wishes: LIFE.finance.filter((x) => x.type === 'wish').map((w) => ({ id: w.id, name: w.name, price: w.price })) });
}
const wishLabel = (w) => ({ now: 'Can buy now', payday: `Wait until ${dstr(moneyView().until)}`, later: 'Not yet' })[w.status];
// chat questions about money/staff → exact answers from money.js
function moneyReply(text) {
  if (/\bwhat (?:must|should|do) i pay first\b|\bwhich bills? (?:first|should i pay)|\bpay first\b|\bbills? (?:priority|order)\b/i.test(text)) return payFirstText();
  const t = text.toLowerCase(), amtM = text.match(/(?:R|\$|€|£)?\s?(\d[\d\s,]*(?:[.,]\d{1,2})?)/), amount = amtM ? M.toCents(amtM[1]) : null;
  if (/\b(can i afford|could i afford|should i (buy|spend|get|pay)|is it (ok|okay|wise) to (spend|buy)|afford)\b/.test(t)) { if (!(amount > 0)) return 'How much does it cost? For example: “Can I afford R2,000?”'; const what = (text.match(/\b(?:on|for)\s+(?:a |an |the )?([a-z][\w\s-]{1,40}?)\??$/i) || [])[1] || ''; return affordText(amount, what); }
  let m;
  if ((m = t.match(/(\d[\d\s,.]*)\s*(?:%|percent)\s+of\s+r?\s?(\d[\d\s,.]*)/))) { const r = M.percentOf(M.evaluate(m[1]).toFixed(), M.evaluate(m[2]).toFixed()); return `${M.fmtNum(r.result)}\n${r.steps.join('\n')}`; }
  if (/\bvat\b/.test(t) && amount > 0) { const remove = /\b(remove|minus|take off|exclud\w*|excl|without|out of|from|inclusive|incl\.? price)\b/.test(t); M.setCurrency(curCode()); const r = M.vat(amount, remove ? 'remove' : 'add'); return `${M.money(r.excl)} excl. VAT · ${M.money(r.vat)} VAT · ${M.money(r.incl)} incl. VAT\n${r.steps.join('\n')}`; }
  if (/\b(how much (money )?(is |do i have )?left|my (monthly )?budget|money left this month|remaining this month)\b/.test(t)) { const b = budgetFor(monthNow()); if (!b) return 'You haven’t saved a monthly budget for this month yet. Open Money → Monthly calculator, fill it in and tap Save. I won’t guess the numbers.'; M.setCurrency(b.currency); return `${monthName(monthNow())}: ${M.money(b.remaining)} left after ${M.money(b.expenses)} expenses and ${M.money(b.savings)} savings (income ${M.money(b.income)}).\nThat is ${M.money(b.weekly)} a week or ${M.money(b.daily)} a day (${b.days}-day month).`; }
  if (lastRoute === 'staff' || /\bhow many hours\b|\b(wages?|overtime)\b.*\b(staff|this week|team)\b|\bstaff\b.*\b(hours|wages)\b/.test(t)) { const people = LIFE.staff.filter((x) => x.type === 'person'); if (!people.length) return 'You haven’t added any staff yet (Business → Staff).'; M.setCurrency(curCode()); const ts = M.timesheet(people, LIFE.staff.filter((x) => x.type === 'shift'), Date.now(), { isSpecialDay }); const named = ts.filter((x) => t.includes(x.name.toLowerCase())), list = named.length ? named : ts;
    return 'This week (from the shifts you entered):\n' + list.map((x) => `${x.name}: ${M.fmtNum(x.hours)} h${x.overtime ? ` (${M.fmtNum(x.overtime)} h overtime)` : ''}, ${x.pay !== null ? 'wages ' + M.money(x.pay) : 'no hourly rate entered'}`).join('\n'); }
  const ex = text.replace(/^(what(?:'s| is)|calculate|calc|work out|how much is)\s+/i, '').replace(/[?=]\s*$/, '').trim();
  if (/[\d)]\s*[-+*/x×÷^%]\s*[\d(]|\d\s*%\s*$/.test(ex) && /^[\s\dR.,+\-*/x×÷^()%]+$/i.test(ex)) { try { const v = M.evaluate(ex); return `${M.fmtNum(v, 6)}\n${ex} = ${M.fmtNum(v, 6)} (calculated exactly)`; } catch (e) { return e.message; } }
  return '';
}

// ---- start ----
(async () => {
  const saved = await kvGet('state'); if (saved) { const v = L.validateBackup(saved); if (v.ok) S = v.state; else { await kvSet('corrupt-' + Date.now(), saved); toast('Saved data could not be read; a copy was kept. Restore a backup in Settings.', { alert: true, ms: 9000 }); } }
  hasPrev = !!(await kvGet('prev'));
  normSettings(); navigator.storage?.persist?.().catch(() => {});
  auth = await kvGet('auth'); await setLogo(await kvGet('logo'), false);
  try { LIFE = await LF.loadAll(); if (S.mem.length && !LIFE.memories.length) { for (const m of S.mem) await LF.put('memories', m); LIFE.memories = await LF.loadAll().then((l) => l.memories); } LIFE.memories.sort((a, b) => (b.created_at || 0) - (a.created_at || 0)); S.mem = LIFE.memories; LIFE_READY = true; }
  catch (e) { toast('Personal record storage is unavailable in this browser: journal and goals cannot be saved.', { alert: true, ms: 8000 }); }
  let lastState = ''; AI.onAi((a) => { if (a.state === 'ready' && lastState !== 'ready') setTimeout(warmChat, 50); lastState = a.state; ensureTicker(); paintEngine(); if (sheet === 'chat') paintChat(); paintOrbs(); });
  const vv = window.visualViewport; if (vv) { const u = () => { document.documentElement.style.setProperty('--vvh', vv.height + 'px'); document.documentElement.style.setProperty('--vvt', vv.offsetTop + 'px'); }; vv.addEventListener('resize', u); vv.addEventListener('scroll', u); u(); }
  banner(); render(true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { hiddenAt = Date.now(); return; } if (!locked && hiddenAt && Date.now() - hiddenAt > AUTOLOCK_MS) return lockNow(); if (!locked) { checkReminders(); if (tab === 'home' && !sheet) render(); } });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  window.__anna = { get S() { return S; }, get locked() { return locked; }, get life() { return LIFE; }, get lastURL() { return lastURL; }, offer: (t) => { offerRemember(t); paintChat(true); }, buildCtx: (q) => AI.buildContext(S, S.settings.ai, Date.now(), q, aiLife()), AI, L, A, VERSION, checkReminders, runDiagnostics }; // used by automated tests
})();
