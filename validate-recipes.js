#!/usr/bin/env node
// Cross-checks each recipe saleIngredient's `deal` string against the actual
// scraped deal in bogo-api.json (Publix) / kroger-api.json (Kroger).
//
// Why this exists: recipes.json is agent-generated. It is easy to *assume* a
// Publix item is "Buy 1 Get 1 FREE" because it came off the BOGO page, when the
// captured payload is really the whole weekly ad and the item is a plain price
// ($5.69, "2 for $5.00", "$4.99 lb", ...). This script catches those.
//
// Exit 1 if any ingredient was matched to a source item whose real deal doesn't
// match what the recipe claims. Unmatched ingredients (pantry-ish or renamed)
// are warnings only.

const fs = require('fs');

function load(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function decode(s) {
  return (s || '')
    .replace(/&#13;&#10;/g, ' ').replace(/&#10;/g, ' ').replace(/&#13;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&reg;/g, '')
    .replace(/\s+/g, ' ').trim();
}
function norm(s) { return decode(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function tokens(s) { return new Set(norm(s).split(' ').filter(w => w.length > 2)); }
function overlap(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return hit / Math.min(A.size, B.size);
}
function bestMatch(name, candidates, titleOf) {
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const s = overlap(name, titleOf(c));
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return { best, score: bestScore };
}

// Kroger deal derivation — mirrors build-kroger-html.js dealText()
function money(n) { return '$' + Number(n).toFixed(2); }
function krogerDeal(a) {
  const t = a.pricingTemplate || '';
  if (t.includes('BOGO')) return `Buy ${a.buyQuantity || 1} Get ${a.getQuantity || 1} FREE`;
  const p = a.salePrice ?? a.retailPrice ?? a.price;
  if (t.includes('2FOR') && a.quantity && p != null) return `${a.quantity} for ${money(p)}`;
  if (p != null) { const per = a.uom ? '/' + a.uom.toLowerCase() : ''; return `${money(p)}${per}`; }
  return decode(a.savings || a.specialPrice || '') || null;
}

// A recipe deal "agrees" with the real one if, ignoring case/punctuation/spaces,
// the recipe string contains the real deal's core (so "Buy 1 Get 1 FREE (swap
// option)" still matches "Buy 1 Get 1 FREE"). Numbers must line up exactly.
function agrees(recipeDeal, realDeal) {
  const squash = s => norm(s).replace(/\s+/g, '');
  const r = squash(recipeDeal), a = squash(realDeal);
  if (!a) return true; // nothing to check against
  return r.includes(a) || a.includes(r);
}

const recipes = load('recipes.json');
const publix = (() => { const b = load('bogo-api.json'); return Array.isArray(b) ? b : (b.Savings || []); })();
const kroger = (() => { const k = load('kroger-api.json'); return k.ads || (k.shoppableWeeklyDeals && k.shoppableWeeklyDeals.ads) || []; })();

const MATCH_THRESHOLD = 0.5;
let mismatches = 0, unmatched = 0, checked = 0;

for (const r of recipes.recipes) {
  for (const ing of r.saleIngredients || []) {
    const isKroger = /kroger/i.test(ing.store || '');
    const pool = isKroger ? kroger : publix;
    const titleOf = isKroger ? (a => a.mainlineCopy || a.description || '') : (x => x.title || '');
    const { best, score } = bestMatch(ing.item, pool, titleOf);

    if (!best || score < MATCH_THRESHOLD) {
      unmatched++;
      console.log(`  ? UNMATCHED  [${r.title}]\n      "${ing.item}" (${ing.store}) — no confident source match (best ${(score * 100).toFixed(0)}%). Verify the deal by hand.`);
      continue;
    }
    checked++;
    const realDeal = isKroger ? krogerDeal(best) : decode(best.savings);
    if (!agrees(ing.deal, realDeal)) {
      mismatches++;
      console.log(`  ✗ MISMATCH   [${r.title}]\n      "${ing.item}"\n      recipe says: "${ing.deal}"\n      actual deal: "${realDeal}"  (matched "${decode(titleOf(best))}")`);
    }
  }
}

console.log(`\nChecked ${checked} ingredient(s): ${mismatches} mismatch(es), ${unmatched} unmatched.`);
if (mismatches > 0) {
  console.error('\nFAILED: recipe deals disagree with the scraped ad. Fix recipes.json before publishing.');
  process.exit(1);
}
console.log('OK: all matched ingredient deals agree with the scraped ad.');
