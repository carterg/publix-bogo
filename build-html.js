const fs = require('fs');

const data = JSON.parse(fs.readFileSync('bogo-api.json', 'utf8'));
const bogo = data.filter(s => /buy 1 get 1/i.test(JSON.stringify(s)));

const decode = s => (s || '')
  .replace(/&#13;&#10;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .trim();

const esc = s => (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const departments = [...new Set(bogo.map(i => i.department).filter(Boolean))].sort();
const validRange = bogo[0] ? `${bogo[0].wa_startDateFormatted} – ${bogo[0].wa_endDateFormatted}` : '';

const cards = bogo.map(i => {
  const title = esc(decode(i.title));
  const desc = esc(decode(i.description));
  const save = esc(decode(i.additionalSavings || i.additionalDealInfo || ''));
  const dept = esc(i.department || '');
  const img = esc(i.enhancedImageUrl || i.imageUrl || '');
  return `<article class="card" data-dept="${dept}" data-search="${esc((title + ' ' + desc + ' ' + dept).toLowerCase())}">
    <div class="img-wrap">${img ? `<img loading="lazy" src="${img}" alt="${title}">` : ''}</div>
    <div class="body">
      <h3>${title}</h3>
      <div class="bogo-tag">Buy 1 Get 1 FREE</div>
      ${save ? `<div class="save">${save}</div>` : ''}
      ${desc ? `<p class="desc">${desc}</p>` : ''}
      <div class="meta">${dept ? `<span class="dept">${dept}</span>` : ''}</div>
    </div>
  </article>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Publix BOGO — ${validRange}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #0f1115;
    --card: #171a21;
    --border: #262b36;
    --text: #e8ebf0;
    --muted: #8a93a6;
    --accent: #22c55e;
    --accent-bg: #0d2a1a;
    --pill: #1e2330;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }
  header {
    position: sticky; top: 0; z-index: 10;
    background: rgba(15,17,21,0.92);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    padding: 12px 16px 0;
  }
  .header-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  h1 { font-size: 18px; margin: 0; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; }
  h1 .count { color: var(--accent); font-variant-numeric: tabular-nums; }
  .dates { color: var(--muted); font-size: 12px; margin-left: 6px; }
  input[type=search] {
    flex: 1; min-width: 140px;
    background: var(--pill); color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px;
    font: inherit;
    -webkit-appearance: none; appearance: none;
  }
  input[type=search]:focus { outline: 2px solid var(--accent); border-color: transparent; }
  .filters {
    display: flex; gap: 6px;
    padding: 10px 0 10px;
    margin: 0 -16px;
    padding-left: 16px; padding-right: 16px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .filters::-webkit-scrollbar { display: none; }
  .chip {
    background: var(--pill); color: var(--muted);
    border: 1px solid var(--border); border-radius: 999px;
    padding: 5px 12px; font-size: 13px; cursor: pointer;
    user-select: none;
    white-space: nowrap; flex-shrink: 0;
  }
  .chip:hover { color: var(--text); }
  .chip.active {
    background: var(--accent-bg); color: var(--accent); border-color: var(--accent);
  }
  main {
    display: grid; gap: 14px;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    padding: 16px 16px 48px;
  }
  @media (max-width: 500px) {
    main { grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 12px 12px 32px; }
    .body { padding: 10px 12px 12px; }
    h3 { font-size: 14px; }
    .desc { font-size: 12px; }
  }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    display: flex; flex-direction: column;
    transition: transform .15s, border-color .15s;
  }
  .card:hover { transform: translateY(-2px); border-color: #3a4150; }
  .card.hidden { display: none; }
  .img-wrap {
    aspect-ratio: 4 / 3;
    background: #0b0d12;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .img-wrap img { width: 100%; height: 100%; object-fit: contain; }
  .body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
  h3 { font-size: 15px; margin: 0; font-weight: 600; line-height: 1.3; }
  .bogo-tag {
    display: inline-block; align-self: flex-start;
    background: var(--accent-bg); color: var(--accent);
    font-size: 11px; font-weight: 600; letter-spacing: .04em;
    text-transform: uppercase;
    padding: 3px 8px; border-radius: 4px;
  }
  .save { color: #fbbf24; font-size: 13px; font-weight: 500; }
  .desc { color: var(--muted); font-size: 13px; margin: 4px 0 0; }
  .meta { margin-top: auto; padding-top: 6px; }
  .dept {
    color: var(--muted); font-size: 12px;
    background: var(--pill); padding: 2px 8px; border-radius: 4px;
  }
  .empty { padding: 40px; text-align: center; color: var(--muted); grid-column: 1 / -1; }
</style>
</head>
<body>
<header>
  <div class="header-row">
    <h1>Publix BOGO <span class="count">${bogo.length}</span><span class="dates">${validRange}</span></h1>
    <input type="search" id="q" placeholder="Search items…" autofocus>
  </div>
  <div class="filters" id="filters">
    <span class="chip active" data-dept="">All</span>
    ${departments.map(d => `<span class="chip" data-dept="${esc(d)}">${esc(d)}</span>`).join('')}
  </div>
</header>
<main id="grid">
${cards}
<div class="empty" id="empty" style="display:none">No items match.</div>
</main>
<script>
  const q = document.getElementById('q');
  const grid = document.getElementById('grid');
  const cards = Array.from(grid.querySelectorAll('.card'));
  const empty = document.getElementById('empty');
  const chips = document.querySelectorAll('.chip');
  let activeDept = '';

  function apply() {
    const term = q.value.trim().toLowerCase();
    let visible = 0;
    for (const c of cards) {
      const matchDept = !activeDept || c.dataset.dept === activeDept;
      const matchText = !term || c.dataset.search.includes(term);
      const show = matchDept && matchText;
      c.classList.toggle('hidden', !show);
      if (show) visible++;
    }
    empty.style.display = visible ? 'none' : '';
  }
  q.addEventListener('input', apply);
  chips.forEach(chip => chip.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeDept = chip.dataset.dept;
    apply();
  }));
</script>
</body>
</html>
`;

fs.writeFileSync('bogo.html', html);
console.log('Wrote bogo.html —', bogo.length, 'items,', departments.length, 'departments');
