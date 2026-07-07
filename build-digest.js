const fs = require('fs');

// Composes a weekly digest from the data/ snapshots + recipes.json into
// digests.json (one entry per ad week, newest first, capped), then renders
// digest/index.html and the RSS feed feed.xml from that history.

const SITE = 'https://carterg.github.io/publix-bogo';
const MAX_WEEKS = 12;
const MAX_LIST = 20;

const esc = s => (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const snapFiles = fs.existsSync('data') ? fs.readdirSync('data').sort() : [];
const latest = prefix => {
  const f = snapFiles.filter(f => f.startsWith(prefix)).pop();
  return f ? JSON.parse(fs.readFileSync('data/' + f, 'utf8')) : null;
};
const previous = (prefix, curStart) => {
  const f = snapFiles.filter(f => f.startsWith(prefix) && f < `${prefix}${curStart}.json`).pop();
  return f ? JSON.parse(fs.readFileSync('data/' + f, 'utf8')) : null;
};

const publix = latest('publix-');
const kroger = latest('kroger-');
if (!publix && !kroger) {
  console.error('No snapshots in data/ — run snapshot.js first.');
  process.exit(1);
}

let staples = [];
try { staples = (JSON.parse(fs.readFileSync('preferences.json', 'utf8')).favoriteStaples || []).map(s => s.toLowerCase()); } catch {}

const krogerDeal = i => {
  const t = i.pricingTemplate || '';
  const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
  if (t.includes('BOGO')) return `Buy ${i.buyQuantity || 1} Get ${i.getQuantity || 1} FREE`;
  const p = i.salePrice ?? i.retailPrice;
  if (t.includes('2FOR') && i.quantity && p != null) return `${i.quantity} for ${money(p)}`;
  return p != null ? money(p) + (i.uom ? '/' + i.uom.toLowerCase() : '') : '';
};

function watchedIn(snap, storeName, dealOf) {
  if (!snap || !staples.length) return [];
  return snap.items
    .filter(i => staples.some(s => ((i.title || '') + ' ' + (i.description || '')).toLowerCase().includes(s)))
    .map(i => ({ store: storeName, title: i.title, deal: dealOf(i) }));
}

function newIn(snap, prefix) {
  if (!snap) return [];
  const prev = previous(prefix, snap.weekStart);
  if (!prev) return [];
  const old = new Set(prev.items.map(i => i.title.toLowerCase()));
  return snap.items.map(i => i.title).filter(t => !old.has(t.toLowerCase()));
}

let recipes = null;
try { recipes = JSON.parse(fs.readFileSync('recipes.json', 'utf8')); } catch {}

const weekStart = (publix || kroger).weekStart;
const fmt = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
const week = `${fmt((publix || kroger).weekStart)} – ${fmt((publix || kroger).weekEnd)}`;

const entry = {
  weekStart,
  week,
  generatedAt: new Date().toISOString(),
  publixCount: publix ? publix.count : null,
  krogerCount: kroger ? kroger.count : null,
  watched: [
    ...watchedIn(publix, 'Publix', i => 'BOGO' + (i.save ? ', ' + i.save.toLowerCase() : '')),
    ...watchedIn(kroger, 'Kroger', krogerDeal),
  ],
  newItems: {
    publix: newIn(publix, 'publix-').slice(0, MAX_LIST * 2),
    kroger: newIn(kroger, 'kroger-').slice(0, MAX_LIST * 2),
  },
  recipes: recipes && recipes.week === week ? recipes.recipes.map(r => r.title) : [],
};

let digests = [];
try { digests = JSON.parse(fs.readFileSync('digests.json', 'utf8')); } catch {}
digests = [entry, ...digests.filter(d => d.weekStart !== weekStart)].slice(0, MAX_WEEKS);
fs.writeFileSync('digests.json', JSON.stringify(digests, null, 1));

// --- HTML for one digest entry (shared by page + feed) ---
function entryHtml(d, forFeed) {
  const base = forFeed ? SITE + '/' : '../';
  const section = (title, inner) => inner ? `<h3>${title}</h3>${inner}` : '';
  const list = arr => `<ul>${arr.slice(0, MAX_LIST).map(t => `<li>${esc(t)}</li>`).join('')}${arr.length > MAX_LIST ? `<li>…and ${arr.length - MAX_LIST} more</li>` : ''}</ul>`;
  return `
    <p>${d.publixCount != null ? `<a href="${base}">${d.publixCount} Publix BOGOs</a>` : 'Publix scrape unavailable'} ·
       ${d.krogerCount != null ? `<a href="${base}kroger/">${d.krogerCount} Kroger deals</a>` : 'Kroger scrape unavailable'}</p>
    ${section('★ Watched items on sale', d.watched.length ? `<ul>${d.watched.map(w => `<li><strong>${esc(w.store)}</strong>: ${esc(w.title)} — ${esc(w.deal)}</li>`).join('')}</ul>` : '')}
    ${section('New at Publix this week', d.newItems.publix.length ? list(d.newItems.publix) : '')}
    ${section('New at Kroger this week', d.newItems.kroger.length ? list(d.newItems.kroger) : '')}
    ${section(`<a href="${base}recipes/">This week's recipes</a>`, d.recipes.length ? `<ul>${d.recipes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '')}`;
}

// --- digest page ---
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>What's New — Grocery Deals Digest</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="alternate" type="application/rss+xml" title="Grocery deals digest" href="../feed.xml">
<style>
  :root {
    --bg: #0f1115; --card: #171a21; --border: #262b36;
    --text: #e8ebf0; --muted: #8a93a6; --accent: #fbbf24; --pill: #1e2330;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.55 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; }
  header { position: sticky; top: 0; background: rgba(15,17,21,0.92); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); padding: 12px 16px; display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap; }
  h1 { font-size: 18px; margin: 0; font-weight: 600; }
  .spacer { flex: 1; }
  .xlink { color: var(--muted); font-size: 13px; text-decoration: none; }
  .xlink:hover { color: var(--text); }
  main { max-width: 760px; margin: 0 auto; padding: 16px 16px 48px; }
  .digest { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 18px 22px; margin-bottom: 16px; }
  h2 { margin: 0; font-size: 17px; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 16px 0 6px; }
  h3 a { color: inherit; }
  ul { margin: 0; padding-left: 20px; }
  li { font-size: 14px; margin: 2px 0; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .rss { color: var(--muted); font-size: 12.5px; margin-top: 4px; }
</style>
</head>
<body>
<header>
  <h1>What's New</h1>
  <span class="spacer"></span>
  <a class="xlink" href="../">Publix BOGO →</a>
  <a class="xlink" href="../kroger/">Kroger deals →</a>
  <a class="xlink" href="../recipes/">Recipes →</a>
</header>
<main>
<p class="rss">Subscribe: <a href="../feed.xml">RSS feed</a> — one entry per ad week.</p>
${digests.map(d => `<section class="digest"><h2>Week of ${esc(d.week)}</h2>${entryHtml(d, false)}</section>`).join('\n')}
</main>
</body>
</html>
`;
fs.mkdirSync('digest', { recursive: true });
fs.writeFileSync('digest/index.html', page);

// --- RSS feed ---
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>Publix &amp; Kroger Weekly Deals Digest</title>
<link>${SITE}/digest/</link>
<description>Weekly grocery deals: watched items, new BOGOs, and recipe ideas.</description>
${digests.map(d => `<item>
<title>Grocery deals — week of ${esc(d.week)}</title>
<link>${SITE}/digest/</link>
<guid isPermaLink="false">week-${d.weekStart}</guid>
<pubDate>${new Date(d.generatedAt).toUTCString()}</pubDate>
<description><![CDATA[${entryHtml(d, true)}]]></description>
</item>`).join('\n')}
</channel>
</rss>
`;
fs.writeFileSync('feed.xml', rss);

console.log(`Wrote digest/index.html + feed.xml — ${digests.length} week(s), latest ${week}: ${entry.watched.length} watched, ${entry.newItems.publix.length}+${entry.newItems.kroger.length} new, ${entry.recipes.length} recipes`);
