const puppeteer = require('puppeteer');
const fs = require('fs');

const URL = 'https://www.publix.com/savings/weekly-ad/view-all?filter=BOGO';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2000 });

  let apiPayload = null;
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('services.publix.com/api/') && /saving/i.test(url)) {
      try {
        const body = await res.json();
        if (body && Array.isArray(body.Savings) && body.Savings.length) {
          apiPayload = { url, body };
        }
      } catch {}
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // Scroll to trigger lazy pagination
  let lastHeight = 0;
  for (let i = 0; i < 40; i++) {
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 700));
    if (h === lastHeight) break;
    lastHeight = h;
  }

  // Extract via DOM as a fallback
  const domItems = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('li, article, div'))
      .filter(el => {
        const t = el.innerText || '';
        return /Buy 1 Get 1 Free/i.test(t) && t.length < 500 && t.length > 40;
      });
    const seen = new Set();
    const out = [];
    for (const el of tiles) {
      const t = el.innerText.trim();
      // tightest container: prefer smallest
      const lines = t.split('\n').map(s => s.trim()).filter(Boolean);
      if (lines.length < 3) continue;
      const name = lines[0];
      if (seen.has(name)) continue;
      seen.add(name);
      const save = (t.match(/Save Up To \$[\d.]+/i) || [])[0] || null;
      const valid = (t.match(/Valid [\d/ -]+/i) || [])[0] || null;
      out.push({ name, save, valid });
    }
    return out;
  });

  const result = {
    fetchedAt: new Date().toISOString(),
    source: URL,
    apiCaptured: !!apiPayload,
    apiUrl: apiPayload?.url || null,
    count: domItems.length,
    items: domItems,
  };

  // If API payload captured, filter BOGO from it for richer data
  if (apiPayload) {
    const savings = apiPayload.body.Savings || [];
    const bogo = savings.filter(s => {
      const txt = JSON.stringify(s).toLowerCase();
      return txt.includes('buy 1 get 1') || txt.includes('bogo') || txt.includes('b1g1');
    });
    result.apiBogoCount = bogo.length;
    result.apiSample = bogo.slice(0, 3);
    fs.writeFileSync('bogo-api.json', JSON.stringify(savings, null, 2));
  }

  fs.writeFileSync('bogo.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ count: result.count, apiCaptured: result.apiCaptured, apiBogoCount: result.apiBogoCount, first5: domItems.slice(0, 5) }, null, 2));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
