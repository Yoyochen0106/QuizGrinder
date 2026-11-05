/* 版面風格實驗測試：node tests/skins.cjs [baseURL] [screenshotDir]
 * 逐一切換四種風格，檢查首頁、練習、題庫、統計頁可正常顯示、沒有 JS 錯誤、手機寬度不水平溢出。 */
const { chromium } = require('playwright');
const assert = require('assert');

const BASE = process.argv[2] || 'http://localhost:8000/';
const SHOTS = process.argv[3] || '';
const SKINS = ['classic', 'feed', 'search', 'docs'];
const LABEL = { classic: '原版', feed: '影音牆', search: '極簡搜尋', docs: '文件站' };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [vw, vh, tag] of [[1440, 900, 'desk'], [390, 844, 'mobile']]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, colorScheme: tag === 'mobile' ? 'dark' : 'light' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
      await page.goto(BASE + '?skins#home');
    await page.waitForSelector('#skinbar button');
    for (const skin of SKINS) {
      await page.click(`#skinbar button:has-text("${LABEL[skin]}")`);
      await page.waitForFunction((s) => document.documentElement.dataset.skin === s, skin);
      for (const v of ['home', 'practice', 'browse', 'stats']) {
        await page.goto(BASE + '?skins#' + v);
        await page.waitForSelector('#app > *:not(.loading)');
        await page.waitForTimeout(150);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert(over <= 0, `${tag} ${skin} #${v} 水平溢出 ${over}px`);
        if (SHOTS && (v === 'home' || v === 'practice' || (v === 'browse' && tag === 'desk'))) await page.screenshot({ path: `${SHOTS}/${tag}-${skin}-${v}.png` });
      }
      // 各風格的特有互動
      if (skin === 'feed' && tag === 'desk') {
        await page.goto(BASE + '?skins#home');
        await page.click('.feed-chip:has-text("主題")');
        await page.click('.feed-card >> nth=0');
        await page.waitForSelector('.feed-upnext .feed-next');
        await page.click('.feed-next >> nth=1');
        await page.waitForSelector('#qcard');
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/desk-feed-watch.png` });
      }
      if (skin === 'search' && tag === 'desk') {
        await page.goto(BASE + '?skins#home');
        await page.fill('#sk-g-q', '蝕刻');
        await page.waitForSelector('.g-suggest:not([hidden]) .g-sug');
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/desk-search-suggest.png` });
        await page.keyboard.press('Enter');
        await page.waitForSelector('.g-res');
        await page.click('.g-res .g-title >> nth=0');
        await page.waitForSelector('.g-ans:not([hidden])');
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/desk-search-results.png`, fullPage: true });
      }
      if (skin === 'docs' && tag === 'desk') {
        await page.goto(BASE + '?skins#home');
        await page.waitForSelector('#toc:not([hidden]) .d-toc a');
        await page.keyboard.press('Control+k');
        await page.waitForSelector('.d-pal');
        await page.keyboard.type('ENIG');
        await page.waitForSelector('.d-pal-item:has-text("ENIG")');
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/desk-docs-palette.png` });
        await page.keyboard.press('Escape');
        await page.click('.d-side .d-link:has-text("L12 電路板製造概論")');
        await page.waitForSelector('.qitem');
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/desk-docs-browse.png` });
      }
    }
    await ctx.close();
  }
  await browser.close();
  assert.deepStrictEqual(errors, [], '不應有 JS 錯誤：\n' + errors.join('\n'));
  console.log('skins OK');
})().catch((e) => { console.error(e); process.exit(1); });
