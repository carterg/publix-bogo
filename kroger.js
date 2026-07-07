const puppeteer = require('puppeteer');
const fs = require('fs');

const URL = 'https://www.kroger.com/weeklyad/shoppable';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--disable-blink-features=AutomationControlled'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1400, height: 2000 });

  let apiPayload = null;
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('shoppable-weekly-deals')) {
      try {
        const body = await res.json();
        const deals = body?.data?.shoppableWeeklyDeals;
        if (deals && Array.isArray(deals.ads) && deals.ads.length) {
          apiPayload = { url, deals };
        }
      } catch {}
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  // Scroll in case additional ad groups lazy-load
  let lastHeight = 0;
  for (let i = 0; i < 20; i++) {
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 700));
    if (h === lastHeight) break;
    lastHeight = h;
  }

  if (!apiPayload) {
    console.error('No shoppable-weekly-deals response captured');
    await browser.close();
    process.exit(1);
  }

  const { deals } = apiPayload;
  fs.writeFileSync('kroger-api.json', JSON.stringify(deals, null, 2));

  const result = {
    fetchedAt: new Date().toISOString(),
    source: URL,
    apiUrl: apiPayload.url,
    storeId: deals.storeId,
    divisionCode: deals.divisionCode,
    adCount: deals.ads.length,
    groups: deals.adGroups.map(g => ({ name: g.shortDisplayName || g.name, type: g.type, count: g.ads.length })),
  };
  fs.writeFileSync('kroger.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, first5: deals.ads.slice(0, 5).map(a => a.mainlineCopy) }, null, 2));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
