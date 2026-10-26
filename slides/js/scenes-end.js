/**
 * Summary (2 min), the last slide: the three parts side by side, each with its figure and, under it, what we did in a
 * sentence; then the next direction and the thanks (index.html).
 */
import { cycle, fillSiteQR } from './common.js';
import { C, FONT, XA, XS, ZCOLOR, BOUNDS_A, leftOf, exrcmA, rmcm2A, olpSaddle, RADIUS, diverging, hard, boundaryStyle, latticeMap, drawGrid, fit, text, labelWidth, muLeft } from './common.js';


export default function closing(ctx) {
  const S = ctx.stage, M = ctx.meter;

  // What each part did, in a sentence under its figure (wrapped to the column).
  const PARTS3 = [
    { title: 'Part 1 · ExRCM', says: 'Unified the RCM thresholds; one exponent shapes the clusters flexibly.' },
    { title: 'Part 2 · RMCM2', says: 'Handles uncertainty through neighborhoods, inside one objective.' },
    { title: 'Part 3 · SOM-OLP', says: 'Each point gets its own latent position on the map, under one objective.' },
  ];
  const SAY = 36, LINE = 50;
  /** The words of s in lines no wider than w at the sentences' size. */
  const wrap = (g, s, w) => s.split(' ').reduce((ls, word) => {
    const last = ls.at(-1);
    if (last && labelWidth(g, `${last} ${word}`, SAY, 700) <= w) ls[ls.length - 1] = `${last} ${word}`; else ls.push(word);
    return ls;
  }, []);
  const principle = {
    id: 'principle', steps: 1,
    narrowAspect: () => 2,
    show(ctx, step, { dur }) {
      M.hide();
      // The talk site's QR code at the top right (index.html: .site-qr), as on the title.
      fillSiteQR(ctx, 'principle');
      // Each column: its title, the result (small), and what the part did under it (large); the titles under the QR code.
      const F = ctx.field(), fr = ctx.el('frame').getBoundingClientRect(), qr = ctx.el('copy').querySelector('[data-id="principle"] .site-qr');
      const qrBottom = qr ? (qr.getBoundingClientRect().bottom - fr.top) * 1600 / fr.width : 0;
      const panels = ctx.panels(F, 3, { gap: 40, top: Math.max(70, qrBottom + 70 - F.y) }).map(c => ({ ...c, h: c.h - 4 * LINE - 30 }));
      const ex = exrcmA(1.2, 0.5, 2), l1 = leftOf(ex.B), r2 = rmcm2A(RADIUS), olp = olpSaddle(0.3, 3);
      const m1 = fit(BOUNDS_A, panels[0]), m2 = fit(BOUNDS_A, panels[1]), lm = latticeMap(panels[2], 0.04);
      const items = [];
      XA.forEach((p, i) => { const [x, y] = m1.map(p); items.push({ id: 'p' + i, x, y, ...(ex.region[i] < 0 ? { ...boundaryStyle, r: 5.5 } : { ...hard(ex.region[i] !== l1), r: 4 }) }); });
      XA.forEach((p, i) => { const [x, y] = m2.map(p); items.push({ id: 'q' + i, x, y, r: 4, fill: diverging(muLeft(r2, i)) }); });
      XS.forEach((p, i) => { const [x, y] = lm.at(olp.emb[i]); items.push({ id: 's' + i, x, y, r: 2.6, fill: ZCOLOR[i] }); });
      S.set(items, { dur: Math.max(dur, 900) });
      S.over = g => {
        // The three parts take turns in focus, gently: the title of the one in focus in the accent color (no frame).
        const lit = cycle([0, 1, 2], 3.2);
        panels.forEach((rect, k) => {
          const lines = wrap(g, PARTS3[k].says, rect.w - 8);
          text(g, PARTS3[k].title, rect.x + rect.w / 2, rect.y - 24, { size: 36, weight: 760, color: k === lit ? C.hl : C.title, halo: false, family: FONT.display, align: 'center' });
          lines.forEach((s, j) => text(g, s, rect.x + rect.w / 2, rect.y + rect.h + 46 + j * LINE, { size: SAY, weight: 700, color: C.ink, halo: false, align: 'center' }));
        });
        drawGrid(g, lm, 10, C.faint, 1);
      };
    },
  };
  return [principle];
}
