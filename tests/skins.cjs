/* 版面風格實驗測試：node tests/skins.cjs [baseURL] [screenshotDir]
 * 從切換列讀出所有已註冊的版面，逐一檢查首頁、練習、錯題本、模擬考、題庫、統計頁可正常顯示、
 * 沒有 JS 錯誤、手機寬度不水平溢出；部分版面另測特有互動。
 * 只測特定版面：SKIN_ONLY=duolingo,quizlet node tests/skins.cjs http://localhost:8000/ */
const { chromium } = require('playwright');
const assert = require('assert');

const BASE = process.argv[2] || 'http://localhost:8000/';
const SHOTS = process.argv[3] || '';
const ONLY = (process.env.SKIN_ONLY || '').split(',').filter(Boolean);

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [vw, vh, tag] of [[1440, 900, 'desk'], [390, 844, 'mobile']]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, colorScheme: tag === 'mobile' ? 'dark' : 'light' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
      await page.goto(BASE + '?skins#home');
    await page.waitForSelector('#sk-select', { state: 'attached' });
    const all = await page.$$eval('#sk-select option', (os) => os.map((o) => o.value));
    const SKINS = ONLY.length ? all.filter((x) => ONLY.includes(x)) : all;
    assert(SKINS.length, '找不到要測的版面：' + ONLY.join(','));
    for (const skin of SKINS) {
      await page.selectOption('#sk-select', skin);
      await page.waitForFunction((s) => document.documentElement.dataset.skin === s, skin);
      for (const v of ['home', 'practice', 'review', 'exam', 'browse', 'stats']) {
        await page.goto(BASE + '?skins#' + v);
        await page.waitForSelector('#app > *:not(.loading)');
        await page.waitForTimeout(150);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert(over <= 0, `${tag} ${skin} #${v} 水平溢出 ${over}px`);
        if (SHOTS && (v === 'home' || v === 'practice' || v === 'browse' || v === 'stats')) await page.screenshot({ path: `${SHOTS}/${tag}-${skin}-${v}.png` });
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
      if (skin === 'ig') {
        await page.goto(BASE + '?skins#home');
        await page.click('.ig-post >> nth=0 >> .ans-opt >> nth=0');
        await page.waitForSelector('.ig-post >> nth=0 >> .ig-comments:not([hidden])');
        await page.click('.ig-story >> nth=0');
        await page.waitForSelector('.st .ans-opt');
        await page.keyboard.press('2');
        await page.waitForSelector('.st .ans-opt.ok');
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-ig-story.png` });
        await page.keyboard.press('Escape');
        await page.waitForSelector('.st', { state: 'detached' });
        await page.goto(BASE + '?skins#stats');
        await page.waitForSelector('.ig-prof-head');
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-ig-profile.png` });
      }
      if (skin === 'threads') {
        await page.goto(BASE + '?skins#home');
        await page.click('.th-thread >> nth=0 >> .ans-opt >> nth=1');
        await page.waitForSelector('.th-thread.has-reply');
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-threads-reply.png` });
        await page.goto(BASE + '?skins#browse');
        await page.waitForSelector('.th-acct');
      }
      if (skin === 'game') {
        await page.goto(BASE + '?skins#home');
        await page.click('.gm-bld >> nth=0');
        await page.waitForSelector('.gm-dialog');
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-game-building.png` });
        await page.click('.gm-dialog .gm-btn.green');
        await page.waitForSelector('#qcard');
        await page.keyboard.press('1');
        await page.waitForSelector('.feedback');
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-game-practice.png` });
        if (tag === 'desk') {
          await page.goto(BASE + '?skins#exam');
          await page.click('button:has-text("開始考試")');
          await page.waitForSelector('.navgrid');
          await page.click('button:has-text("交卷")');
          await page.click('button:has-text("確定交卷")');
          await page.waitForSelector('.gm-victory');
          if (SHOTS) await page.screenshot({ path: `${SHOTS}/${tag}-game-result.png` });
        }
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
