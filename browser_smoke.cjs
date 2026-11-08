/* Check both deployed readers with the same public snapshot. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');

async function main() {
  const base = new URL(process.argv[2]);
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.RADAR_CHROME_PATH || undefined,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base.href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.radarReady === '1');
    const snapshot = await page.evaluate(() => RadarDB.snapshot());
    assert.equal(snapshot.publication.snapshotVersion, snapshot.snapshotVersion);
    assert.equal(Object.values(snapshot.permissions).filter(value => value === 'PUBLISHED').length, 8);
    const industryCount = snapshot.heatmaps.INDUSTRY.items.length;
    assert(industryCount > 0);
    await page.waitForFunction(count => {
      const rows = [...document.querySelectorAll('[data-market-quote]')];
      return rows.length === 5 && rows.every(row => /\d/.test(row.querySelector('.c1-quote-price').textContent)
        && /%/.test(row.querySelector('b').textContent))
        && document.querySelectorAll('#c1HeatGrid button').length === count
        && /\d/.test(document.querySelector('.gsr-number')?.textContent || '');
    }, industryCount);
    fs.mkdirSync('screenshots', { recursive: true });
    for (const view of ['intel', 'leaders', 'data', 'results', 'rules', 'settings']) {
      if (await page.locator('#view-intel').isVisible()) {
        await page.locator('#view-intel .side-tab').focus();
        await page.locator(`#view-intel .side-nav [data-home-go="${view}"]`).click();
      } else {
        await page.locator(`.nav-item[data-view="${view}"]`).click();
      }
      assert(await page.locator(`#view-${view}`).isVisible());
      if (view === 'intel') {
        await page.waitForFunction(() => document.querySelector('.scene').naturalWidth > 0);
      } else if (view === 'results') {
        const symbol = await page.locator('#quadCharts [data-detail]').evaluateAll(
          (buttons, symbols) => buttons.find(button => symbols.includes(button.dataset.detail))?.dataset.detail,
          Object.keys(snapshot.bars).filter(key => snapshot.bars[key].bars.length >= 2),
        );
        assert(symbol, 'Expected a rendered candidate with saved candles');
        await page.locator(`#quadCharts [data-detail="${symbol}"]`).click();
        await page.waitForFunction(() => document.querySelector('#priceChart')?.width >= 620);
        await page.locator('#modalClose').click();
      }
      await page.screenshot({ path: `screenshots/${view}.png` });
    }
    await page.goto(new URL('radar/', base).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(count => document.querySelectorAll('#heat .tile').length === count
      && document.querySelectorAll('#quotes .quote').length > 0
      && /\d/.test(document.querySelector('#metals').textContent), industryCount);
    await page.screenshot({ path: 'screenshots/legacy-overview.png' });
    await page.locator('[data-view="results"]').click();
    await page.waitForFunction(() => [...document.querySelectorAll('#charts canvas')].some(canvas => canvas._geom));
    await page.screenshot({ path: 'screenshots/legacy-results.png' });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ snapshotVersion: snapshot.snapshotVersion, industryCount, pages: 7, status: 'PASS' }));
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
