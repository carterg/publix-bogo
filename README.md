# publix-scrape

Scrapes BOGO (buy-one-get-one) items from the Publix weekly ad and renders them as a browsable HTML page.

## Why

Publix's weekly ad at https://www.publix.com/savings/weekly-ad/view-all is rendered client-side — a plain HTTP fetch only returns the page shell. This project drives a real browser via Puppeteer to capture the data, then builds a static HTML viewer from it.

## Prerequisites

- Node.js (any recent LTS)
- macOS or Linux — Puppeteer downloads its own Chromium on `npm install`

## Setup

```sh
npm install
```

## Usage

Three-step flow: **scrape → build → view**.

```sh
node bogo.js          # scrape: writes bogo.json + bogo-api.json
node build-html.js    # render: writes bogo.html
open bogo.html        # view locally
```

To publish to GitHub Pages, copy `bogo.html` to `index.html` and push:

```sh
node bogo.js && node build-html.js && cp bogo.html index.html
git add index.html && git commit -m "Refresh BOGO" && git push
```

A scheduled remote agent runs this daily — see `CLAUDE.md`.

## Files

| File | Purpose |
| --- | --- |
| `bogo.js` | Puppeteer scraper. Opens the weekly-ad page, intercepts Publix's internal savings API, and also scrapes the rendered DOM as a fallback. |
| `build-html.js` | Reads `bogo-api.json` and produces `bogo.html` — a searchable, department-filterable card grid. |
| `scrape.js` | Early exploratory version (keeps the BOGO-candidate DOM text extractor + API-URL discovery). Safe to ignore for normal use. |
| `bogo-api.json` | Full savings payload captured from `services.publix.com/api/v4/savings` — richest source (images, departments, dates, fine print). |
| `bogo.json` | Summary + lightweight DOM-extracted items. |
| `bogo.html` | The viewer. |

## How it works

1. `bogo.js` launches headless Chromium and navigates to `https://www.publix.com/savings/weekly-ad/view-all?filter=BOGO`.
2. A `page.on('response', ...)` listener watches for calls to `services.publix.com/api/.../savings` and saves the first non-empty `Savings` array it sees. The API refuses direct `curl` calls without the browser's store-selection cookies, so we only get useful data inside a real session.
3. The script scrolls the page repeatedly to force any lazy loading.
4. DOM extraction runs in parallel as a fallback: it grabs elements whose text matches `Buy 1 Get 1 Free` and pulls `{name, save, valid}`.
5. `build-html.js` decodes HTML entities, dedupes, groups by `department`, and emits a single self-contained `bogo.html` (no external CSS/JS).

## Store selection

Currently the scraper does not set a store — Publix defaults to one near the session's IP (observed: Twickenham Square, Huntsville AL). BOGO deals are uniform across the Publix footprint in practice, so this is usually fine. If you need a specific store, uncomment/adapt the zip-entry block in `scrape.js` and port it to `bogo.js`.

## Troubleshooting

- **`net::ERR_NETWORK_CHANGED` on `page.goto`** — transient; just re-run.
- **API payload not captured (`apiCaptured: false`)** — Publix may have changed the URL. Check `scrape.js` output for the live endpoint; it prints all JSON responses matching `weekly|ad|circular|promo|deal`.
- **Empty `bogo.html`** — `bogo-api.json` is empty or missing; re-run `node bogo.js` first.
- **Fresh Chromium download needed** — delete `node_modules` and `npm install` again.

## Refreshing the data

The Publix weekly ad rotates weekly (Wednesday). Re-run the scrape+build pair to get the current week.
