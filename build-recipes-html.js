const fs = require('fs');
const listUi = require('./list-ui');

const data = JSON.parse(fs.readFileSync('recipes.json', 'utf8'));
const recipes = data.recipes || [];

if (!recipes.length) {
  console.error('Refusing to build: recipes.json has no recipes.');
  process.exit(1);
}

const esc = s => (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const cards = recipes.map(r => `<article class="recipe">
    <div class="head">
      <h2>${esc(r.title)}</h2>
      <div class="facts">
        <span>${esc(r.time)}</span><span>serves ${r.serves}</span>
        ${(r.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
      </div>
      <p class="blurb">${esc(r.blurb)}</p>
    </div>
    <div class="cols">
      <div>
        <h3>On sale this week</h3>
        <button class="list-btn" data-list-add data-label="+ Add sale items to list" data-items="${esc(JSON.stringify((r.saleIngredients || []).map(i => ({ store: i.store, title: i.item, deal: i.deal }))))}">+ Add sale items to list</button>
        <ul class="sale">
          ${(r.saleIngredients || []).map(i => `<li><span class="store ${i.store.toLowerCase()}">${esc(i.store)}</span> ${esc(i.item)} <span class="deal">${esc(i.deal)}</span></li>`).join('\n          ')}
        </ul>
        ${(r.pantryIngredients || []).length ? `<h3>From the pantry</h3>
        <ul class="pantry">${r.pantryIngredients.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      </div>
      <div>
        <h3>Steps</h3>
        <ol class="steps">
          ${(r.steps || []).map(s => `<li>${esc(s)}</li>`).join('\n          ')}
        </ol>
      </div>
    </div>
    ${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}
  </article>`).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>This Week's Recipes — ${esc(data.week)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #0f1115;
    --card: #171a21;
    --border: #262b36;
    --text: #e8ebf0;
    --muted: #8a93a6;
    --accent: #f59e0b;
    --accent-bg: #2b1d05;
    --publix: #22c55e;
    --publix-bg: #0d2a1a;
    --kroger: #4d9fff;
    --kroger-bg: #0d1d33;
    --pill: #1e2330;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }
  header {
    position: sticky; top: 0; z-index: 10;
    background: rgba(15,17,21,0.92);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    padding: 12px 16px;
  }
  .header-row { display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap; }
  h1 { font-size: 18px; margin: 0; font-weight: 600; letter-spacing: -0.01em; }
  .dates { color: var(--muted); font-size: 12px; }
  .xlink { color: var(--muted); font-size: 13px; text-decoration: none; white-space: nowrap; }
  .xlink:hover { color: var(--text); }
  .spacer { flex: 1; }
  .intro { max-width: 900px; margin: 20px auto 0; padding: 0 16px; color: var(--muted); }
  main { max-width: 900px; margin: 0 auto; padding: 16px 16px 48px; display: flex; flex-direction: column; gap: 18px; }
  .recipe {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px 22px;
  }
  h2 { margin: 0 0 6px; font-size: 19px; letter-spacing: -0.01em; }
  .facts { display: flex; gap: 8px; flex-wrap: wrap; color: var(--muted); font-size: 13px; align-items: center; }
  .facts .tag { background: var(--pill); border-radius: 999px; padding: 2px 10px; font-size: 12px; }
  .blurb { color: var(--muted); margin: 10px 0 0; }
  .cols { display: grid; grid-template-columns: 1fr 1.2fr; gap: 24px; margin-top: 14px; }
  @media (max-width: 640px) { .cols { grid-template-columns: 1fr; gap: 8px; } }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 14px 0 8px; }
  ul, ol { margin: 0; padding-left: 0; }
  ul.sale { list-style: none; display: flex; flex-direction: column; gap: 6px; }
  ul.sale li { font-size: 14px; }
  .store {
    display: inline-block; font-size: 11px; font-weight: 600;
    border-radius: 4px; padding: 1px 7px; margin-right: 4px;
    text-transform: uppercase; letter-spacing: .03em;
  }
  .store.publix { color: var(--publix); background: var(--publix-bg); }
  .store.kroger { color: var(--kroger); background: var(--kroger-bg); }
  .deal { color: var(--accent); font-size: 12.5px; font-weight: 500; white-space: nowrap; }
  ul.pantry { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
  ul.pantry li { background: var(--pill); color: var(--muted); border-radius: 999px; padding: 2px 10px; font-size: 12.5px; }
  ol.steps { padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
  .note {
    margin: 16px 0 0; font-size: 13px; color: var(--muted);
    background: var(--accent-bg); border-left: 3px solid var(--accent);
    padding: 8px 12px; border-radius: 0 6px 6px 0;
  }
  .allergy { max-width: 900px; margin: 8px auto 0; padding: 0 16px; color: var(--muted); font-size: 12.5px; }
  .recipe .list-btn { margin-bottom: 8px; }
${listUi.css}
</style>
</head>
<body>
<header>
  <div class="header-row">
    <h1>This Week's Recipes</h1>
    <span class="dates">${esc(data.week)} · dairy &amp; egg free</span>
    <span class="spacer"></span>
    <a class="xlink" href="../">Publix BOGO →</a>
    <a class="xlink" href="../kroger/">Kroger deals →</a>
    <a class="xlink" href="../digest/">What's new →</a>
  </div>
</header>
<p class="intro">${esc(data.intro || '')}</p>
<main>
${cards}
</main>
<p class="allergy">Built for a dairy/egg-free household. Product formulations change — always confirm labels on packaged items.</p>
${listUi.fab}
<script>
${listUi.js}
</script>
</body>
</html>
`;

fs.writeFileSync('recipes.html', html);
console.log('Wrote recipes.html —', recipes.length, 'recipes for', data.week);
