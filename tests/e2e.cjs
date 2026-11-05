/* 端對端煙霧測試：node tests/e2e.cjs [baseURL] [screenshotDir]
 * 需要 Playwright（npm i -D playwright && npx playwright install chromium）。
 * 先在專案根目錄啟動 python3 -m http.server 8000。 */
const { chromium } = require('playwright');
const assert = require('assert');

const BASE = process.argv[2] || 'http://localhost:8000/';
const SHOTS = process.argv[3] || '';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // 首頁
  await page.goto(BASE + '#home');
  await page.waitForSelector('.kpis');
  const count = await page.textContent('.count-line b');
  assert(parseInt(count.replace(/,/g, ''), 10) > 1000, '首頁應顯示 1000+ 題');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/home.png`, fullPage: true });

  // 篩選：L12 製造概論
  await page.click('.seg button:has-text("L12")');
  const n12 = parseInt((await page.textContent('.count-line b')).replace(/,/g, ''), 10);
  assert(n12 > 300 && n12 < 1000, 'L12 篩選後題數不合理：' + n12);

  // 練習：作答 3 題
  await page.click('button:has-text("開始新一輪")');
  await page.waitForSelector('#qcard');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('1');
    await page.waitForSelector('.feedback');
    if (SHOTS && i === 0) await page.screenshot({ path: `${SHOTS}/practice.png`, fullPage: true });
    await page.keyboard.press('Enter');
    await page.waitForSelector('#qcard .opt:not([disabled])');
  }
  const prog = await page.textContent('.qhead .mono');
  assert(/^4 \//.test(prog.trim()), '應前進到第 4 題，實際：' + prog);

  // 重新整理後進度保留
  await page.reload();
  await page.waitForSelector('#qcard');
  assert(/^4 \//.test((await page.textContent('.qhead .mono')).trim()), '重新整理後應停在第 4 題');

  // 模擬考：答 5 題後交卷
  await page.goto(BASE + '#exam');
  await page.click('button:has-text("開始考試")');
  await page.waitForSelector('.navgrid');
  for (let i = 0; i < 5; i++) { await page.keyboard.press('2'); await page.keyboard.press('ArrowRight'); }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/exam.png`, fullPage: true });
  await page.click('button:has-text("交卷")');
  await page.click('button:has-text("確定交卷")');
  await page.waitForSelector('.score b');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/result.png`, fullPage: true });

  // 錯題本：模考錯題應進入
  await page.goto(BASE + '#review');
  await page.waitForSelector('.kpis');
  const due = await page.textContent('h1');
  assert(/題到期/.test(due), '錯題本應有到期題目：' + due);
  await page.click('button:has-text("開始複習")');
  await page.waitForSelector('#qcard');
  await page.keyboard.press('3');
  await page.waitForSelector('.feedback');

  // 題庫搜尋
  await page.goto(BASE + '#browse');
  await page.fill('#b-kw', 'ENIG');
  await page.waitForTimeout(100);
  const found = parseInt((await page.textContent('.count-line b')).replace(/,/g, ''), 10);
  assert(found > 0, '搜尋 ENIG 應有結果');
  await page.selectOption('#b-only', 'fig');
  await page.waitForSelector('.qitem img');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/browse.png` });

  // 統計
  await page.goto(BASE + '#stats');
  await page.waitForSelector('.chart svg rect');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stats.png`, fullPage: true });

  // 手機寬度＋暗色，不可水平捲動
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1 });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  for (const v of ['home', 'practice', 'exam', 'browse', 'stats']) {
    await mp.goto(BASE + '#' + v);
    await mp.waitForSelector('.view');
    const over = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(over <= 0, `#${v} 在手機寬度水平溢出 ${over}px`);
    if (SHOTS && (v === 'home' || v === 'practice')) await mp.screenshot({ path: `${SHOTS}/mobile-${v}.png`, fullPage: true });
  }

  await browser.close();
  assert.deepStrictEqual(errors, [], '不應有 JS 錯誤：\n' + errors.join('\n'));
  console.log('e2e OK');
})().catch((e) => { console.error(e); process.exit(1); });
