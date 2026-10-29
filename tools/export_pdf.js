/**
 * The deck as a PDF: one 16:9 page per step (each step's final state, with motion reduced), at 3200 x 1800 pixels,
 * lossless. The text is in the images (it cannot be searched).
 *
 * Serve the repository first, from its root:  python3 -m http.server 8765
 * Then:  node tools/export_pdf.js OUT.pdf [--base http://localhost:8765/slides/]
 * Needs Playwright (as tools/check_deck.js) and Python 3 with pypdf: Chromium rounds the page to 675.12 pt, and pypdf
 * trims the white sliver that leaves under each image, so the pages are exactly 1200 x 675 pt.
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
  const html = path.join(dir, 'book.html');
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><title>Uncertainty, Topology, and Graphs in Prototype-Based Learning</title>
<style>@page { size: 1200pt 675pt; margin: 0; } html, body { margin: 0; } img { display: block; width: 1200pt; height: 675pt; break-after: page; }</style>
${files.map(f => `<img src="${path.basename(f.file)}">`).join('\n')}`);
  const raw = path.join(dir, 'raw.pdf');
  const book = await browser.newPage();
  await book.goto('file://' + html, { waitUntil: 'load' });
  await book.pdf({ path: raw, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  const trim = `
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
r, w = PdfReader(sys.argv[1]), PdfWriter()
for p in r.pages:
    x0, y0, x1, y1 = [float(v) for v in p.mediabox]
    p.mediabox = p.cropbox = RectangleObject([x0, y1 - 675, x1, y1])
    w.add_page(p)
w.add_metadata({'/Title': 'Uncertainty, Topology, and Graphs in Prototype-Based Learning', '/Author': 'Seiki Ubukata'})
w.write(sys.argv[2])`;
  const py = spawnSync('python3', ['-c', trim, raw, out], { stdio: 'inherit' });
  if (py.status !== 0) { fs.copyFileSync(raw, out); console.log('pypdf failed: the PDF keeps a thin white line under each page'); }
  console.log(`${files.length} pages (${files[0].hash} to ${files.at(-1).hash}) -> ${out}`);
})();
