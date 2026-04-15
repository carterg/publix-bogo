const puppeteer = require('puppeteer');

const ZIP = '35758';
const URL = 'https://www.publix.com/savings/weekly-ad/view-all';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2000 });

  const apiResponses = [];
  page.on('response', async (res) => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('json') && /weekly|ad|flipp|circular|promo|deal/i.test(url)) {
      try {
        const body = await res.json();
        apiResponses.push({ url, body });
      } catch {}
    }
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

  // Try to set zip code — look for common selectors
  const zipSelectors = [
    'input[name="zip"]',
    'input[placeholder*="ZIP" i]',
    'input[placeholder*="zip" i]',
    'input[aria-label*="zip" i]',
    'input[id*="zip" i]',
  ];
  for (const sel of zipSelectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click({ clickCount: 3 });
      await el.type(ZIP, { delay: 50 });
      await page.keyboard.press('Enter');
      console.error('Entered zip via', sel);
      break;
    }
  }

  await new Promise(r => setTimeout(r, 8000));

  // Scroll to load lazy content
  await page.evaluate(async () => {
    for (let y = 0; y < 20000; y += 800) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 300));
    }
  });
  await new Promise(r => setTimeout(r, 3000));

  // Screenshot for debugging
  await page.screenshot({ path: '/tmp/publix.png', fullPage: false });

  // Dump page HTML size and sample of body text
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 4000));
  console.error('--- body sample ---');
  console.error(bodyText);
  console.error('--- end sample ---');

  // Try extracting BOGO tiles by text match
  const items = await page.evaluate(() => {
    const results = [];
    const nodes = document.querySelectorAll('*');
    const seen = new Set();
    for (const n of nodes) {
      const t = n.innerText || '';
      if (/BOGO|Buy one get one|B1G1|2 for 1/i.test(t) && t.length < 400) {
        // walk up to a reasonable container
        let el = n;
        for (let i = 0; i < 4 && el.parentElement; i++) el = el.parentElement;
        const key = el.innerText.trim().slice(0, 200);
        if (!seen.has(key) && key.length > 20) {
          seen.add(key);
          results.push(key);
        }
      }
    }
    return results.slice(0, 100);
  });

  console.log(JSON.stringify({
    apiResponsesCount: apiResponses.length,
    apiUrls: apiResponses.map(r => r.url),
    bogoCandidates: items,
  }, null, 2));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
