/**
 * Steps through the whole deck in a browser, as the speaker does (the → key from the first slide), and reports what the
 * room would notice: console errors, figures that stopped ("This figure stopped"), and the meter of J (no step shows it
 * any more). With --shots DIR, it also saves the steps named after it as 1600 x 900 PNGs (5 or 5.1: the first step of
 * slide 5; 5.2: its second).
 *
 * Serve the repository first, from its root:  python3 -m http.server 8765
 * Then:  node tools/check_deck.js [--base http://localhost:8765/slides/] [--shots DIR 5.2 13 21.2 ...]
 * Playwright and its Chromium come with the cloud sessions; elsewhere: npm i playwright && npx playwright install chromium.
 */
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (name, fallback) => { const k = args.indexOf(name); return k >= 0 ? args.splice(k, 2)[1] : fallback; };
const base = opt('--base', 'http://localhost:8765/slides/');
const shots = opt('--shots', null);
const wanted = new Set(args.map(s => '#' + s.replace(/\.1$/, '')));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push('request failed: ' + r.url()));
  await page.goto(base + '#1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const stopped = [], meter = [], seen = [];
  for (let n = 0; n < 300; n++) {
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => ({
      hash: location.hash,
      id: document.querySelector('.scene.active')?.dataset.id,
      stopped: !!document.querySelector('.scene.active .err'),
      meter: !document.getElementById('meter').hidden,
    }));
    if (s.hash === seen.at(-1)) break;
    seen.push(s.hash);
    if (s.stopped) stopped.push(s.hash);
    if (s.meter) meter.push(s.hash);
    if (shots && wanted.has(s.hash)) {
      await page.waitForTimeout(['digits', 'real'].includes(s.id) ? 9000 : 2500);
      await page.screenshot({ path: `${shots}/${s.hash.slice(1)}.png` });
    }
    await page.keyboard.press('ArrowRight');
  }
  console.log(`steps: ${seen.length} (last ${seen.at(-1)})`);
  console.log(`errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  console.log(`stopped figures: ${stopped.join(' ') || 'none'}`);
  console.log(`meter shown: ${meter.join(' ') || 'none'}`);
  await browser.close();
  process.exit(errors.length || stopped.length || meter.length ? 1 : 0);
})();
