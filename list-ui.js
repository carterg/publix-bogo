// Shared shopping-list UI injected into all pages by the build scripts.
// State lives in localStorage under one key, so the list is shared across
// the Publix, Kroger, and recipes pages (same GitHub Pages origin).

const css = `
  .list-btn {
    background: var(--pill); color: var(--muted);
    border: 1px solid var(--border); border-radius: 6px;
    padding: 3px 10px; font: inherit; font-size: 12.5px; cursor: pointer;
  }
  .list-btn:hover { color: var(--text); }
  .list-btn.added { color: #fbbf24; border-color: #fbbf24; }
  #list-fab {
    position: fixed; right: 16px; bottom: 16px; z-index: 50;
    background: var(--card); color: var(--text);
    border: 1px solid var(--border); border-radius: 999px;
    padding: 10px 16px; font: inherit; font-size: 14px; font-weight: 600;
    cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.4);
  }
  #list-fab .n { color: #fbbf24; font-variant-numeric: tabular-nums; }
  #list-panel {
    position: fixed; right: 16px; bottom: 68px; z-index: 50;
    width: min(400px, calc(100vw - 32px));
    max-height: 70vh; display: flex; flex-direction: column;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,.5);
  }
  #list-panel header, #list-panel .panel-head {
    position: static; display: flex; align-items: center; gap: 8px;
    padding: 12px 14px; border-bottom: 1px solid var(--border);
    background: none; backdrop-filter: none;
  }
  #list-panel .panel-head strong { flex: 1; font-size: 15px; }
  #list-panel .panel-head .total { color: #fbbf24; font-size: 12.5px; white-space: nowrap; }
  #list-panel .panel-actions { display: flex; gap: 6px; padding: 8px 14px; border-bottom: 1px solid var(--border); }
  #list-panel .panel-actions button {
    background: var(--pill); color: var(--muted); border: 1px solid var(--border);
    border-radius: 6px; padding: 4px 10px; font: inherit; font-size: 12.5px; cursor: pointer;
  }
  #list-panel .panel-actions button:hover { color: var(--text); }
  #list-items { overflow-y: auto; padding: 8px 14px 14px; }
  #list-items h4 {
    margin: 10px 0 6px; font-size: 11px; text-transform: uppercase;
    letter-spacing: .06em; color: var(--muted);
  }
  #list-items .li {
    display: flex; align-items: baseline; gap: 8px;
    padding: 4px 0; font-size: 13.5px;
  }
  #list-items .li input { accent-color: #fbbf24; }
  #list-items .li .t { flex: 1; }
  #list-items .li.done .t { text-decoration: line-through; color: var(--muted); }
  #list-items .li .d { color: var(--muted); font-size: 11.5px; white-space: nowrap; }
  #list-items .li .rm {
    background: none; border: none; color: var(--muted);
    cursor: pointer; font: inherit; font-size: 14px; padding: 0 2px;
  }
  #list-items .li .rm:hover { color: #ef4444; }
  #list-items .empty-list { color: var(--muted); font-size: 13px; padding: 12px 0; }
`;

const fab = `
<button id="list-fab" title="Shopping list">🛒 <span class="n" id="list-n"></span></button>
<div id="list-panel" hidden>
  <div class="panel-head"><strong>Shopping list</strong><span class="total" id="list-total"></span></div>
  <div class="panel-actions">
    <button id="list-copy">Copy as text</button>
    <button id="list-clear">Clear</button>
    <button id="list-close">Close</button>
  </div>
  <div id="list-items"></div>
</div>`;

const js = `
(function () {
  const KEY = 'pb-shopping-list';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const store = l => localStorage.setItem(KEY, JSON.stringify(l));
  const keyOf = i => i.store + '|' + i.title;

  const panel = document.getElementById('list-panel');
  const itemsEl = document.getElementById('list-items');

  function itemsFromBtn(btn) {
    if (btn.dataset.items) { try { return JSON.parse(btn.dataset.items); } catch { return []; } }
    return [{ store: btn.dataset.store, title: btn.dataset.title, deal: btn.dataset.deal || '',
              save: parseFloat(btn.dataset.save) || 0, dept: btn.dataset.dept || '' }];
  }

  function render() {
    const list = load();
    document.getElementById('list-n').textContent = list.length || '';
    const total = list.reduce((s, i) => s + (i.save || 0), 0);
    document.getElementById('list-total').textContent = total ? 'save up to ~$' + total.toFixed(2) : '';

    const byStore = {};
    for (const i of list) (byStore[i.store] = byStore[i.store] || []).push(i);
    itemsEl.innerHTML = Object.keys(byStore).sort().map(s =>
      '<h4>' + esc(s) + '</h4>' + byStore[s].map(i =>
        '<div class="li' + (i.done ? ' done' : '') + '" data-key="' + esc(keyOf(i)) + '">' +
        '<input type="checkbox"' + (i.done ? ' checked' : '') + '>' +
        '<span class="t">' + esc(i.title) + '</span>' +
        (i.deal ? '<span class="d">' + esc(i.deal) + '</span>' : '') +
        '<button class="rm" title="Remove">×</button></div>'
      ).join('')
    ).join('') || '<div class="empty-list">Tap “+ List” on a deal to add it.</div>';

    document.querySelectorAll('[data-list-add]').forEach(btn => {
      const keys = itemsFromBtn(btn).map(keyOf);
      const have = new Set(list.map(keyOf));
      const all = keys.length && keys.every(k => have.has(k));
      btn.classList.toggle('added', all);
      btn.textContent = all ? (btn.dataset.items ? '✓ On list' : '✓ Listed') : (btn.dataset.items ? btn.dataset.label || '+ Add sale items to list' : '+ List');
    });
  }

  document.addEventListener('click', e => {
    const add = e.target.closest('[data-list-add]');
    if (add) {
      const list = load();
      const have = new Set(list.map(keyOf));
      const items = itemsFromBtn(add);
      if (items.every(i => have.has(keyOf(i)))) {
        const drop = new Set(items.map(keyOf));
        store(list.filter(i => !drop.has(keyOf(i))));
      } else {
        for (const i of items) if (!have.has(keyOf(i))) { list.push(i); have.add(keyOf(i)); }
        store(list);
      }
      render(); return;
    }
    if (e.target.closest('#list-fab')) { panel.hidden = !panel.hidden; return; }
    if (e.target.closest('#list-close')) { panel.hidden = true; return; }
    if (e.target.closest('#list-clear')) { store([]); render(); return; }
    if (e.target.closest('#list-copy')) {
      const list = load();
      const byStore = {};
      for (const i of list) (byStore[i.store] = byStore[i.store] || []).push(i);
      const text = Object.keys(byStore).sort().map(s =>
        s.toUpperCase() + '\\n' + byStore[s].map(i =>
          '- [' + (i.done ? 'x' : ' ') + '] ' + i.title + (i.deal ? ' (' + i.deal + ')' : '')
        ).join('\\n')
      ).join('\\n\\n');
      navigator.clipboard.writeText(text).then(() => {
        const b = document.getElementById('list-copy');
        b.textContent = 'Copied!'; setTimeout(() => b.textContent = 'Copy as text', 1200);
      });
      return;
    }
    const li = e.target.closest('.li');
    if (li && (e.target.matches('input') || e.target.matches('.rm'))) {
      const key = li.dataset.key;
      let list = load();
      if (e.target.matches('.rm')) list = list.filter(i => keyOf(i) !== key);
      else list = list.map(i => keyOf(i) === key ? { ...i, done: !i.done } : i);
      store(list); render();
    }
  });

  render();
})();
`;

module.exports = { css, fab, js };
