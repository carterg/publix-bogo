const fs = require('fs');

// Writes one trimmed snapshot per ad week per store into data/.
// Keyed by ad-week start date, so daily runs overwrite the same file.

const decode = s => (s || '')
  .replace(/&#13;&#10;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&eacute;/g, 'é')
  .replace(/&egrave;/g, 'è')
  .replace(/&ntilde;/g, 'ñ')
  .replace(/&uacute;/g, 'ú')
  .replace(/&aacute;/g, 'á')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .trim();

fs.mkdirSync('data', { recursive: true });

try {
  const data = JSON.parse(fs.readFileSync('bogo-api.json', 'utf8'));
  const bogo = data.filter(s => /buy 1 get 1/i.test(JSON.stringify(s)));
  if (bogo.length < 50) throw new Error(`only ${bogo.length} BOGO items`);
  const start = bogo[0].wa_startDate.slice(0, 10);
  const snap = {
    store: 'publix',
    weekStart: start,
    weekEnd: bogo[0].wa_endDate.slice(0, 10),
    count: bogo.length,
    items: bogo.map(i => ({
      title: decode(i.title),
      description: decode(i.description),
      save: decode(i.additionalDealInfo || ''),
      department: i.department || null,
    })),
  };
  fs.writeFileSync(`data/publix-${start}.json`, JSON.stringify(snap, null, 1));
  console.log(`Wrote data/publix-${start}.json — ${bogo.length} items`);
} catch (e) {
  console.error('Publix snapshot skipped:', e.message);
}

try {
  const data = JSON.parse(fs.readFileSync('kroger-api.json', 'utf8'));
  const ads = data.ads || [];
  if (ads.length < 15) throw new Error(`only ${ads.length} deals`);
  const start = ads[0].validFrom.slice(0, 10);
  const snap = {
    store: 'kroger',
    weekStart: start,
    weekEnd: ads[0].validTill.slice(0, 10),
    divisionCode: data.divisionCode,
    storeId: data.storeId,
    count: ads.length,
    items: ads.map(a => ({
      title: a.mainlineCopy,
      description: a.underlineCopy,
      pricingTemplate: a.pricingTemplate,
      salePrice: a.salePrice,
      retailPrice: a.retailPrice,
      saveAmount: a.saveAmount,
      quantity: a.quantity,
      buyQuantity: a.buyQuantity,
      getQuantity: a.getQuantity,
      uom: a.uom,
      event: a.event,
      departments: (a.departments || []).map(d => d.department),
    })),
  };
  fs.writeFileSync(`data/kroger-${start}.json`, JSON.stringify(snap, null, 1));
  console.log(`Wrote data/kroger-${start}.json — ${ads.length} items`);
} catch (e) {
  console.error('Kroger snapshot skipped:', e.message);
}
