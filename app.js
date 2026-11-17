// ANNA WEB v0.1.0 — independent browser app. Data lives in this browser (IndexedDB), never on a server.
import * as L from './logic.js';
export const VERSION = '0.1.0';
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

let S = L.emptyState(), tab = 'tasks', showDone = false, saveErr = '';
const save = async () => { try { await kvSet('state', S); saveErr = ''; } catch (e) { saveErr = String(e); } };
const mutate = async (fn) => { fn(); await save(); render(); };
const cur = () => S.settings.currency || '$';
const money = (c) => esc(L.fmt(c, cur()));
const dstr = (t) => (t ? new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
const err = (m) => alert(m);

// ---- screens ----
const TABS = [['tasks', '✓', 'Tasks'], ['money', '＄', 'Money'], ['biz', '▤', 'Business'], ['brain', '✿', 'Brain'], ['data', '⚙', 'Data']];
const screens = {
  tasks() {
    const open = S.tasks.filter((t) => !t.completed).sort((a, b) => (a.due_at ?? 9e15) - (b.due_at ?? 9e15));
    const done = S.tasks.filter((t) => t.completed);
    const row = (t) => `<div class="item"><input type="checkbox" data-act="toggle" data-id="${t.id}" ${t.completed ? 'checked' : ''} aria-label="Done">
      <div class="grow ${t.completed ? 'done' : ''}">${t.priority === 'high' ? '❗ ' : ''}${esc(t.title)}<div class="mute">${t.due_at ? 'Due ' + dstr(t.due_at) : ''}</div></div>
      <button class="del" data-act="del-task" data-id="${t.id}">Delete</button></div>`;
    return `<h1>Tasks</h1><form class="card" data-form="task"><input name="title" placeholder="New task" maxlength="200" required>
      <div class="row"><input name="due" type="date" class="grow"><select name="priority" class="grow"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></div><button>Add task</button></form>
      <div class="card">${open.map(row).join('') || '<div class="mute">Nothing to do. Nice.</div>'}</div>
      <button class="ghost" data-act="show-done">${showDone ? 'Hide' : 'Show'} completed (${done.length})</button>
      ${showDone ? `<div class="card">${done.map(row).join('')}</div>` : ''}`;
  },
  money() {
    const m = L.monthSummary(S), bs = L.budgetStatus(S), bills = S.bills.filter((b) => !b.paid).sort((a, b) => a.due_at - b.due_at);
    const tx = [...S.tx].sort((a, b) => b.occurred_at - a.occurred_at).slice(0, 30);
    return `<h1>Money</h1><div class="card row"><div class="stat"><span class="mute">In</span><b class="pos">${money(m.income)}</b></div><div class="stat"><span class="mute">Out</span><b>${money(m.expense)}</b></div><div class="stat"><span class="mute">Net</span><b class="${m.net < 0 ? 'neg' : 'pos'}">${money(m.net)}</b></div></div>
      <form class="card" data-form="tx"><div class="row"><select name="kind" class="grow"><option value="expense">Expense</option><option value="income">Income</option></select><input name="amount" inputmode="decimal" placeholder="Amount" class="grow" required></div>
      <input name="category" placeholder="Category (e.g. Food)" maxlength="40"><input name="note" placeholder="Note (optional)" maxlength="200"><button>Add</button></form>
      <h2>Bills</h2><form class="card" data-form="bill"><input name="name" placeholder="Bill name" maxlength="80" required><div class="row"><input name="amount" inputmode="decimal" placeholder="Amount" class="grow" required><input name="due" type="date" class="grow" required></div>
      <label class="row"><input type="checkbox" name="monthly" style="width:24px"> Repeats monthly</label><button>Add bill</button></form>
      <div class="card">${bills.map((b) => `<div class="item"><div class="grow">${esc(b.name)}<div class="mute">Due ${dstr(b.due_at)} ${b.due_at < Date.now() ? '<span class="over">overdue</span>' : ''}${b.repeat_monthly ? ' · monthly' : ''}</div></div><b>${money(b.amount_cents)}</b><button class="ghost" data-act="pay" data-id="${b.id}">Paid</button><button class="del" data-act="del-bill" data-id="${b.id}">✕</button></div>`).join('') || '<div class="mute">No unpaid bills.</div>'}</div>
      <h2>Budgets</h2><form class="card" data-form="budget"><div class="row"><input name="category" placeholder="Category" class="grow" required><input name="limit" inputmode="decimal" placeholder="Monthly limit" class="grow" required></div><button>Set budget</button></form>
      ${bs.map((b) => `<div class="card"><div class="row"><b class="grow">${esc(b.category)}</b><span class="${b.over ? 'over' : 'mute'}">${money(b.spent)} / ${money(b.limit_cents)}</span><button class="del" data-act="del-budget" data-id="${b.id}">✕</button></div><div class="bar ${b.over ? 'over' : ''}"><i style="width:${Math.min(100, Math.round((b.spent / b.limit_cents) * 100))}%"></i></div></div>`).join('')}
      <h2>Recent</h2><div class="card">${tx.map((t) => `<div class="item"><div class="grow">${esc(t.category)}<div class="mute">${dstr(t.occurred_at)} ${esc(t.note || '')}</div></div><b class="${t.kind === 'income' ? 'pos' : ''}">${t.kind === 'income' ? '+' : '-'}${money(t.amount_cents)}</b><button class="del" data-act="del-tx" data-id="${t.id}">✕</button></div>`).join('') || '<div class="mute">No entries yet.</div>'}</div>`;
  },
  biz() {
    const b = L.businessSummary(S), rs = [...S.biz].sort((a, c) => c.occurred_at - a.occurred_at).slice(0, 40);
    return `<h1>Business</h1><div class="card row"><div class="stat"><span class="mute">Revenue</span><b>${money(b.revenue)}</b></div><div class="stat"><span class="mute">Expenses</span><b>${money(b.expenses)}</b></div><div class="stat"><span class="mute">Profit</span><b class="${b.profit < 0 ? 'neg' : 'pos'}">${money(b.profit)}</b></div></div>
      <div class="mute">This month, cash basis. Unpaid invoices: ${money(b.unpaid)}</div>
      <form class="card" data-form="biz"><div class="row"><select name="kind" class="grow"><option value="sale">Sale</option><option value="expense">Expense</option><option value="invoice">Invoice (unpaid)</option></select><input name="amount" inputmode="decimal" placeholder="Amount" class="grow" required></div>
      <input name="description" placeholder="Description" maxlength="200" required><input name="party" placeholder="Customer / supplier (optional)" maxlength="80"><button>Add</button></form>
      <div class="card">${rs.map((r) => `<div class="item"><div class="grow">${esc(r.description)}<div class="mute">${r.kind}${r.party ? ' · ' + esc(r.party) : ''} · ${dstr(r.occurred_at)}${r.kind === 'invoice' ? (r.status === 'paid' ? ' · paid' : ' · <span class="over">unpaid</span>') : ''}</div></div><b>${money(r.amount_cents)}</b>${r.kind === 'invoice' && r.status === 'unpaid' ? `<button class="ghost" data-act="inv-paid" data-id="${r.id}">Paid</button>` : ''}<button class="del" data-act="del-biz" data-id="${r.id}">✕</button></div>`).join('') || '<div class="mute">No records yet.</div>'}</div>`;
  },
  brain() {
    return `<h1>Brain</h1><div class="mute">Things Anna should remember. Stored only in this browser. (The on-device AI model is not part of Anna Web, so nothing answers from these yet.)</div>
      <form class="card" data-form="mem"><textarea name="content" rows="2" placeholder="e.g. I prefer mornings for deep work" maxlength="500" required></textarea>
      <div class="row"><select name="status" class="grow"><option value="confirmed">Confirmed</option><option value="temporary">Temporary</option><option value="assumption">Assumption</option></select><input name="category" placeholder="Category" value="General" class="grow" maxlength="40"></div><button>Remember</button></form>
      <div class="card">${S.mem.map((m) => `<div class="item"><div class="grow">${esc(m.content)}<div class="mute">${esc(m.category)} · ${m.status}</div></div><button class="del" data-act="del-mem" data-id="${m.id}">Forget</button></div>`).join('') || '<div class="mute">Nothing remembered yet.</div>'}</div>`;
  },
  data() {
    return `<h1>Data</h1><div class="card"><b>Back up your data</b><div class="mute">Safari can clear website data. Export a backup regularly and keep it in Files or iCloud.</div><div class="row" style="margin-top:8px"><button data-act="export" class="grow">Export backup</button><button class="ghost grow" data-act="import">Import backup</button></div><input id="file" type="file" accept="application/json,.json" hidden></div>
      <div class="card"><b>Currency symbol</b><input id="cur" value="${esc(cur())}" maxlength="5"><button class="ghost" data-act="cur">Save symbol</button></div>
      <div class="card"><b>Storage</b><div class="mute" id="stor">Using ${mode}. Checking persistence…</div></div>
      <div class="card"><b>iPhone tip</b><div class="mute">Safari → Share → Add to Home Screen. Open Anna from the Home Screen icon every time: it keeps its own storage, separate from Safari tabs. Backups made in one are not automatically visible in the other, so import to move data.</div></div>
      <div class="card"><button class="del" data-act="erase">Erase all data on this device</button></div>
      <div class="mute">Anna Web v${VERSION} · separate from Anna Native${saveErr ? ' · <span class="over">Save error: ' + esc(saveErr) + '</span>' : ''}</div>`;
  },
};
function render() {
  $('#screen').innerHTML = screens[tab]();
  $('#tabs').innerHTML = TABS.map(([k, i, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}"><span>${i}</span>${n}</button>`).join('');
  if (tab === 'data') navigator.storage?.persisted?.().then((p) => { const e = $('#stor'); if (e) e.textContent = `Using ${mode}. ${p ? 'Browser has marked this storage as persistent.' : 'Not marked persistent: back up often.'}`; });
}

// ---- actions ----
const byId = (arr, id) => arr.find((x) => x.id === id);
const del = (key, id) => mutate(() => { S[key] = S[key].filter((x) => x.id !== id); });
const actions = {
  toggle: (id) => mutate(() => { const t = byId(S.tasks, id); t.completed = t.completed ? 0 : 1; t.completed_at = t.completed ? Date.now() : null; }),
  'del-task': (id) => del('tasks', id), 'del-bill': (id) => del('bills', id), 'del-budget': (id) => del('budgets', id), 'del-tx': (id) => del('tx', id), 'del-biz': (id) => del('biz', id), 'del-mem': (id) => del('mem', id),
  'show-done': () => { showDone = !showDone; render(); },
  pay: (id) => { const b = byId(S.bills, id); const rec = confirm(`Mark "${b.name}" paid and record it as an expense?\nOK = record expense, Cancel = just mark paid.`); mutate(() => L.payBill(S, id, { recordExpense: rec })); },
  'inv-paid': (id) => mutate(() => { const r = byId(S.biz, id); r.status = 'paid'; r.paid_at = Date.now(); }),
  export: async () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }), name = `anna-web-backup-${new Date().toISOString().slice(0, 10)}.json`, file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  },
  import: () => $('#file').click(),
  cur: () => mutate(() => { S.settings.currency = ($('#cur').value || '').trim().slice(0, 5); }),
  erase: async () => { if (confirm('Erase ALL Anna Web data on this device? Export a backup first.') && confirm('Really erase everything?')) { await kvSet('prev', S); S = L.emptyState(); await save(); render(); } },
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab],[data-act]'); if (!t) return;
  if (t.dataset.tab) { tab = t.dataset.tab; render(); scrollTo(0, 0); } else actions[t.dataset.act]?.(t.dataset.id);
});
document.addEventListener('change', async (e) => {
  if (e.target.id !== 'file' || !e.target.files[0]) return;
  const r = L.validateBackup(await e.target.files[0].text()); e.target.value = '';
  if (!r.ok) return err(r.error);
  if (!confirm('Replace everything in Anna Web with this backup? Your current data is saved as a safety copy first.')) return;
  await kvSet('prev', S); S = r.state; await save(); render();
});
const forms = {
  task: (f) => ({ id: L.uid(), title: f.title.trim(), notes: null, due_at: L.dayTs(f.due), priority: f.priority, completed: 0, completed_at: null, created_at: Date.now() }),
  mem: (f) => ({ id: L.uid(), content: f.content.trim(), category: f.category.trim() || 'General', status: f.status, created_at: Date.now() }),
};
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]'); if (!form) return; e.preventDefault();
  const f = Object.fromEntries(new FormData(form)), now = Date.now(), k = form.dataset.form;
  if (k === 'task' || k === 'mem') return mutate(() => S[k === 'task' ? 'tasks' : 'mem'].unshift(forms[k](f)));
  const cents = L.parseCents(f.amount ?? f.limit); if (cents === null) return err('Enter an amount like 12.50 (more than zero).');
  if (k === 'tx') return mutate(() => S.tx.push({ id: L.uid(), kind: f.kind, amount_cents: cents, category: f.category.trim() || 'General', note: f.note.trim() || null, occurred_at: now }));
  if (k === 'bill') return mutate(() => S.bills.push({ id: L.uid(), name: f.name.trim(), amount_cents: cents, due_at: L.dayTs(f.due), repeat_monthly: f.monthly ? 1 : 0, paid: 0, paid_at: null }));
  if (k === 'budget') return mutate(() => { const b = S.budgets.find((x) => x.category.toLowerCase() === f.category.trim().toLowerCase()); if (b) b.limit_cents = cents; else S.budgets.push({ id: L.uid(), category: f.category.trim(), limit_cents: cents }); });
  if (k === 'biz') return mutate(() => S.biz.push({ id: L.uid(), kind: f.kind, party: f.party.trim() || null, description: f.description.trim(), amount_cents: cents, status: f.kind === 'invoice' ? 'unpaid' : 'paid', occurred_at: now, paid_at: f.kind === 'invoice' ? null : now }));
});

// ---- start ----
(async () => {
  const saved = await kvGet('state'); if (saved) { const v = L.validateBackup(JSON.stringify(saved)); if (v.ok) S = v.state; else { await kvSet('corrupt', saved); } }
  navigator.storage?.persist?.().catch(() => {});
  banner(); render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
