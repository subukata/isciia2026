/**
 * The deck as a PDF: one 16:9 page per step (each step's final state, with motion reduced), 1200 x 675 pt, each page a
 * 1920 x 1080 JPEG (quality 88; about 13 MB in all). The text is in the images (it cannot be searched).
 * A plain PDF that every viewer opens: DCT images in DeviceRGB, no ICC profile, the media box at the origin. (A first
 * version, lossless 3200 x 1800 images through Chromium's printing, was 25 MB and would not open for the speaker.)
 *
 * Serve the repository first, from its root:  python3 -m http.server 8765
 * Then:  node tools/export_pdf.js OUT.pdf [--base http://localhost:8765/slides/]
 * Needs Playwright (as tools/check_deck.js) and Python 3 with Pillow.
 */
const { chromium } = require('playwright');
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const args = process.argv.slice(2);
const opt = (name, fallback) => { const k = args.indexOf(name); return k >= 0 ? args.splice(k, 2)[1] : fallback; };
const base = opt('--base', 'http://localhost:8765/slides/');
const out = path.resolve(args[0] ?? 'slides.pdf');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-pdf-'));
  const browser = await chromium.launch();
  // 1600 x 934: the 34-pixel band of buttons above, and the frame at exactly 1600 x 900.
  const context = await browser.newContext({ viewport: { width: 1600, height: 934 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(base + '#1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.mouse.move(0, 0);
  const frame = page.locator('#frame'), files = [];
  for (let n = 0; n < 300; n++) {
    const id = await page.evaluate(() => document.querySelector('.scene.active')?.dataset.id);
    // Digits is computed in a worker started when the deck opens: give it time.
    await page.waitForTimeout(['digits', 'real'].includes(id) ? 9000 : 1800);
    const hash = await page.evaluate(() => location.hash);
    if (files.length && hash === files.at(-1).hash) break;
    const file = path.join(dir, `${String(n + 1).padStart(3, '0')}.png`);
    await frame.screenshot({ path: file });
    files.push({ hash, file });
    await page.keyboard.press('ArrowRight');
  }
  await browser.close();
  // The screenshots (3200 x 1800) down to full HD, one JPEG page each, in one PDF (Pillow).
  const build = `
import sys, glob, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
pages = [Image.open(f).convert('RGB').resize((1920, 1080), Image.LANCZOS) for f in sorted(glob.glob(os.path.join(src, '[0-9][0-9][0-9].png')))]
pages[0].save(dst, 'PDF', save_all=True, append_images=pages[1:], resolution=115.2, quality=88,
              title='Uncertainty, Topology, and Graphs in Prototype-Based Learning', author='Seiki Ubukata')`;
  const py = spawnSync('python3', ['-I', '-c', build, dir, out], { stdio: 'inherit' });
  if (py.status !== 0) { console.log('Pillow failed: no PDF written'); process.exit(1); }
  console.log(`${files.length} pages (${files[0].hash} to ${files.at(-1).hash}) -> ${out}`);
})();
