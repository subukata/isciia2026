/**
 * Part 3 (7.5 min), relations among prototypes, all on one surface (800 points, a 10 x 10 lattice):
 * why maps (data near a low-dimensional manifold, seen as a flat map); a lattice learns the surface (one online update, then batch SOM) and becomes a map;
 * Heskes's energy-based winner; SOM-OLP's latent positions; one point moved across a map; the three
 * block updates of SOM-OLP with J after each; Iris; and Digits (64 dimensions, computed in a worker).
 */
import {
  A, ub, D, C, FONT, memo, XS, ZCOLOR, Y10, FLAT10, mapState, settled, batchSaddleGen, batchSaddle, olpSaddle, packAtNodes,
  project, latticeMap, drawGrid, nodeDiscs, text, labelWidth, symbol, plate, newExample, ring, line, arrow, cross, fit, mixRGB, css,
  heightLegend, slider, f2, CLUSTER, SHAPE, withMotive, withIdea, swing, live, cycle, bounds, born, remap,
} from './common.js';
import { BLOCK_COLORS } from './meter.js';

const rowsOf = m => Array.from({ length: m.rows }, (_, r) => Array.from(m.data.subarray(r * m.cols, (r + 1) * m.cols)));
const view3 = { az: -58 * Math.PI / 180, el: 24 * Math.PI / 180 };
const SPACING10 = 2 / 9;

export default function part3(ctx) {
  const S = ctx.stage, M = ctx.meter;

  /** The saddle and a lattice B (or none) projected into rect; returns item specs. */
  function saddleItems(rect, B, { r = 5, alpha = 0.9, view = view3 } = {}) {
    const k = Math.min(rect.w, rect.h) * 0.42, cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2 + rect.h * 0.04;
    const P = p => { const q = project(view, p); return [cx + k * q[0], cy - k * q[1], q[2]]; };
    const items = XS.map((p, i) => { const [x, y, z] = P(p); return { id: 's' + i, x, y, r, fill: ZCOLOR[i], alpha, z: -z, hit: true, data: i }; });
    if (B) B.forEach((b, j) => { const [x, y, z] = P(b); items.push({ id: 'n' + j, x, y, r: 4.5, fill: C.ink, z: -z + 0.05 }); });
    return { items, P };
  }
  const latticeEdges = (side, prefix = 'n', color = C.ink, lw = 1.8) => {
    const out = [];
    for (let j = 0; j < side * side; j++) {
      if (j % side < side - 1) out.push({ a: prefix + j, b: prefix + (j + 1), color, lw });
      if (j + side < side * side) out.push({ a: prefix + j, b: prefix + (j + side), color, lw });
    }
    return out;
  };
  function dragRotate(onTurn) {
    let drag = null;
    // A touch swipes the slides instead (the view turns by itself anyway).
    S.handlers.down = (x, y, e) => { if (e.pointerType === 'touch') return false; drag = [x, y, view3.az, view3.el]; S.cursor('grabbing'); return true; };
    S.handlers.move = (x, y) => {
      if (!drag) { S.cursor('grab'); return; }
      view3.az = drag[2] + (x - drag[0]) * 0.008;
      view3.el = Math.max(-1.2, Math.min(1.4, drag[3] + (y - drag[1]) * 0.008));
      onTurn();
    };
    S.handlers.up = () => { drag = null; S.cursor('grab'); };
    return () => drag !== null;
  }

  // ------------------------------------------------------------ topographic maps and the SOM
  // One online update: the input high on the surface, the lattice still flat.
  const online = memo(() => {
    let input = 0, bd = Infinity;
    XS.forEach((p, i) => { const d = A.sqd(p, [0.82, 0.12, 0.66]); if (d < bd) { bd = d; input = i; } });
    const x = XS[input], B0 = FLAT10;
    let w = 0;
    B0.forEach((b, c) => { if (A.sqd(x, b) < A.sqd(x, B0[w])) w = c; });
    const alpha = 0.7, sigma = 1.6, h = c => Math.exp(-(((Y10[c][0] - Y10[w][0]) ** 2 + (Y10[c][1] - Y10[w][1]) ** 2) / SPACING10 ** 2) / (2 * sigma * sigma));
    const B1 = B0.map((b, c) => b.map((v, f) => v + alpha * h(c) * (x[f] - v)));
    return { input, w, B0, B1, h };
  });
  /** Turn the 3-D view slowly once the points have arrived; place(0) redraws it. Returns whether it turns yet. */
  function spin(ctx, delay, place, dragging) {
    let last = performance.now(), spinning = false;
    ctx.after(delay, () => {
      spinning = true; last = performance.now();
      S.every(now => { if (!dragging() && !ctx.reduced()) view3.az += (now - last) * 0.0001; last = now; place(0); });
    });
    return () => spinning;
  }
  // ------------------------------------------------------------ why maps: the manifold hypothesis, and visualization
  const maps = {
    id: 'maps', steps: 1,
    narrowAspect: () => 1.5,
    show(ctx, step, { dur }) {
      M.hide();
      // Side by side from the start: the surface in 3D (left; it turns, and a drag turns it) and the map that lays it flat
      // (right). The colors (the height) tie each point to its place on the map; no point travels between the panels.
      const F = ctx.field({ eq: true }), [left, right] = ctx.panels(F, 2, { gap: 120, top: 56 }), enter = Math.max(dur, 1000);
      const s = batchSaddle(), lm = latticeMap(right), off = packAtNodes('saddle-som', s.emb, SPACING10);
      const flat = XS.map((p, i) => { const [x, y] = lm.at([s.emb[i][0] + off[i][0], s.emb[i][1] + off[i][1]]); return { id: 'm' + i, x, y, r: 3.6, fill: ZCOLOR[i] }; });
      const place = d => S.set([...saddleItems(left, null, { r: 3.6 }).items, ...flat], { dur: d });
      place(enter);
      S.under = g => { g.save(); g.globalAlpha *= born('maps:grid', { delay: 300, dur: 700 }); drawGrid(g, lm, 10, C.line); g.restore(); };
      S.over = g => {
        plate(g, 'New example · 800 data points in 3D', left.x, left.y - 56, { color: C.hl, border: '#BFCDE3' });
        plate(g, 'A 2D topographic map: the surface laid flat', right.x, right.y - 56);
        if (!ctx.narrow()) arrow(g, [left.x + left.w + 24, left.y + left.h / 2], [right.x - 24, right.y + right.h / 2], { lw: 5, head: 24, color: C.gray, grow: born('maps:arrow', { delay: 200 }) });
      };
      spin(ctx, enter + 50, place, dragRotate(() => place(0)));
    },
  };

  // ------------------------------------------------------------ the SOM: prototypes with an order
  const som = {
    id: 'som', steps: 2,
    show(ctx, step, { dur, forward, from }) {
      // No meter: the SOM's updates are rules, and the caption says so.
      M.hide();
      // Both spaces side by side: the prototypes in the data space (left; the view turns, and a drag turns it) and their
      // lattice, the latent space (right), where "near the winner" is measured and where each point lands on the map.
      const F = ctx.field({ eq: 'tall' }), enter = Math.max(dur, 1000), top = 56, side = F.h - top;
      // The pair centered in the figure, close together: the data space as wide as its plate needs, the lattice square.
      const dw = Math.max(1.6 * side, 680), x0 = F.x + (F.w - dw - 100 - side) / 2;
      const data = { x: x0, y: F.y + top, w: dw, h: side }, lat = { x: x0 + dw + 100, y: F.y + top, w: side, h: side };
      const lm = latticeMap(lat, 0.06), o = online();
      let B = step === 0 ? o.B1 : batchSaddle().B;
      if (step === 1 && forward) B = o.B0;
      // Step 1: each point at its winner node on the lattice (spread around it, so that all can be seen), as batch SOM runs.
      let emb = step === 1 && !forward ? batchSaddle().emb : null, off = null, offOf = null;
      const onMap = () => {
        if (!emb) return [];
        if (offOf !== emb) { off = packAtNodes('som-map', emb, SPACING10); offOf = emb; }
        return emb.map((v, i) => { const [x, y] = lm.at([v[0] + off[i][0], v[1] + off[i][1]]); return { id: 'm' + i, x, y, r: 3.4, fill: ZCOLOR[i] }; });
      };
      const place = d => S.set([...saddleItems(data, B).items, ...onMap()], { dur: d });
      S.set([...saddleItems(data, step === 0 && forward ? o.B0 : B).items, ...onMap()], { dur: from === 'som' ? dur : enter });
      S.edges = latticeEdges(10);
      const nodes = g => {
        drawGrid(g, lm, 10, C.line);
        g.fillStyle = C.ink;
        for (const y of Y10) { const [x, yy] = lm.at(y); g.beginPath(); g.arc(x, yy, 4.5, 0, Math.PI * 2); g.fill(); }
      };
      const dragging = dragRotate(() => place(0));
      if (step === 0) {
        // Online learning, one input after another: each input pulls its winner and the winner's lattice
        // neighbors toward it. The first SLOW inputs go one at a time, with arrows; then a fast-forward of FAST
        // inputs, the rate and the neighborhood shrinking, fits the lattice to the surface. It holds the fit a
        // while, then starts flat again. On the lattice, h(c, w) shades the nodes around the winner.
        const rand = A.mulberry32(11), SLOW = 5, FAST = 3000, PER = 40, s0 = 2.4 - 1.5 * SLOW / 30;
        let next = null, input = o.input, w = o.w, t = 0, sigma = 2.4, alpha = 0.55;
        B = FLAT10.map(b => b.slice());
        const h = c => Math.exp(-(((Y10[c][0] - Y10[w][0]) ** 2 + (Y10[c][1] - Y10[w][1]) ** 2) / SPACING10 ** 2) / (2 * sigma * sigma));
        const pull = () => {
          input = Math.floor(rand() * XS.length);
          const x = XS[input];
          w = 0; B.forEach((b, c) => { if (A.sqd(x, b) < A.sqd(x, B[w])) w = c; });
          return B.map((b, c) => b.map((v, f) => v + alpha * h(c) * (x[f] - v)));
        };
        const choose = () => {
          if (t >= SLOW) { fast(); return; }
          t++; sigma = 2.4 - 1.5 * t / 30;
          next = pull();
          ctx.after(1000, move);
        };
        const move = () => { B = next; next = null; place(650); ctx.after(750, choose); };
        const fast = () => {
          for (let k = 0; k < PER && t < SLOW + FAST; k++) {
            t++;
            const u = (t - SLOW) / FAST;
            sigma = s0 * (0.5 / s0) ** u; alpha = 0.5 * (0.02 / 0.5) ** u;
            B = pull();
          }
          place(60);
          if (t < SLOW + FAST) ctx.after(50, fast);
          else ctx.after(6000, () => { t = 0; sigma = 2.4; alpha = 0.55; B = FLAT10.map(b => b.slice()); place(900); ctx.after(1200, choose); });
        };
        if (!ctx.reduced()) ctx.after(forward ? 900 : 400, choose);
        S.under = g => {
          nodes(g);
          if (t > SLOW) return;
          const r = lm.k * SPACING10 * 0.46;
          g.save(); g.fillStyle = C.hl;
          Y10.forEach((y, c) => { const a = h(c); if (a < 0.04) return; const [x, yy] = lm.at(y); g.globalAlpha = 0.8 * a; g.beginPath(); g.arc(x, yy, r, 0, Math.PI * 2); g.fill(); });
          g.restore();
        };
        S.over = g => {
          plate(g, t === 0 ? 'Data space: one input at a time' : t <= SLOW ? `Data space: one input at a time (${t} of ${SLOW})` : t < SLOW + FAST ? `Data space: fast-forward (${t} inputs)` : `Data space: fitted (${t} inputs)`, data.x, data.y - 52);
          plate(g, t <= SLOW ? 'Latent space: $h(c, w)$' : 'Latent space: the lattice', lat.x + lat.w, lat.y - 52, { align: 'right' });
          if (t > SLOW) return;
          const { P } = saddleItems(data, null), X = P(XS[input]);
          if (next) { const pull = born('som:pull' + t, { delay: 250, dur: 500 }); B.forEach((b, c) => { if (h(c) > 0.12) arrow(g, P(b).slice(0, 2), P(next[c]).slice(0, 2), { color: C.hl, lw: 2.6, head: 13, alpha: 0.9, grow: pull }); }); }
          ring(g, X[0], X[1], 16, { color: C.verm, lw: 4.5, grow: born('som:x' + t, { dur: 300 }) });
          text(g, 'input $x$', X[0] + 22, X[1] - 18, { size: 32, weight: 700, color: C.verm });
          const W = P(B[w]), L = lm.at(Y10[w]);
          ring(g, W[0], W[1], 13, { lw: 3.4, grow: born('som:w' + t, { delay: 150, dur: 300 }) });
          text(g, 'winner $w$', W[0] - 18, W[1] + 44, { size: 32, weight: 700, align: 'right' });
          ring(g, L[0], L[1], 13, { lw: 3.4, grow: born('som:wl' + t, { delay: 150, dur: 300 }) });
        };
        return;
      }
      S.under = nodes;
      S.over = g => {
        plate(g, 'Data space: the lattice unfolds', data.x, data.y - 52);
        plate(g, 'Latent space: on the winners', lat.x + lat.w, lat.y - 52, { align: 'right' });
      };
      const spinning = spin(ctx, enter + 50, place, dragging);
      if (step === 1 && forward) ctx.play(batchSaddleGen(), st => { B = st.B; emb = st.emb; if (!spinning()) place(90); }, { delay: 95, adapt: mapState(10) });
    },
  };

  // ------------------------------------------------------------ Heskes's energy-based winner, on the same surface and lattice
  const H_OF = memo(sigma => {
    const n = Y10.length, h = new Float64Array(n * n);
    for (let c = 0; c < n; c++) for (let k = 0; k < n; k++) h[c * n + k] = Math.exp(-(((Y10[c][0] - Y10[k][0]) ** 2 + (Y10[c][1] - Y10[k][1]) ** 2) / SPACING10 ** 2) / (2 * sigma * sigma));
    return h;
  });
  /** For a point x on the batch SOM lattice: the nearest node, each candidate's term of E, and the energy-based winner. */
  function heskesOf(x, sigma) {
    const B = batchSaddle().B, h = H_OF(sigma), n = B.length, d = B.map(b => A.sqd(x, b));
    const term = B.map((_, c) => { let t = 0; for (let k = 0; k < n; k++) t += h[c * n + k] * d[k]; return t; });
    return { term, near: d.indexOf(Math.min(...d)), win: term.indexOf(Math.min(...term)) };
  }
  const heskesAll = memo(sigma => XS.map(x => { const r = heskesOf(x, sigma); return [r.near, r.win]; }));
  const latticeGap = (a, b) => Math.hypot(Y10[a][0] - Y10[b][0], Y10[a][1] - Y10[b][1]) / SPACING10;
  // The example: at σ = 1, the point whose winner lies farthest on the lattice from its nearest node.
  const heskesExample = memo(() => {
    let best = 0, gap = -1;
    heskesAll(1).forEach(([a, b], i) => { const g = latticeGap(a, b); if (g > gap) { gap = g; best = i; } });
    return best;
  });
  let hkSigma = null, hkPoint = null;
  const heskes = {
    id: 'heskes', steps: 2,
    narrowAspect: () => 1.4,
    setup(ctx) { hkSigma = slider('hk-sigma', () => ctx.rerender()); },
    show(ctx, step, { dur }) {
      M.hide();
      const F = ctx.field({ eq: 'tall' }), [left, right] = ctx.panels(F, 2, { gap: 60, top: 50 });
      // σ swings slowly between 0.5 and 1.5 (from the slider's value); the winners and the count in the caption follow.
      let sigma = hkSigma();
      const tell = () => { ctx.el('hk-count').textContent = String(heskesAll(sigma).filter(([a, b]) => a !== b).length); ctx.el('hk-sig').textContent = sigma.toFixed(1).replace(/\.0$/, ''); };
      tell();
      live(ctx, Math.max(dur, 900) + 400, () => {
        const next = swing(0.5, 1.5, 12, sigma);
        return () => { const q = Math.round(next() * 10) / 10; if (q !== sigma) { sigma = q; tell(); } };
      });
      if (hkPoint === null) hkPoint = heskesExample();
      const B = batchSaddle().B, sad = saddleItems(left, B, { r: 3.2, alpha: 0.45 });
      S.set(sad.items, { dur: Math.max(dur, 900) });
      S.edges = latticeEdges(10, 'n', C.gray, 1.4);
      const side = Math.min(right.w, right.h), lm = latticeMap({ x: right.x, y: right.y, w: side, h: side }, 0.06), kx = right.x + side + 30;
      S.over = g => {
        const x = XS[hkPoint], r = heskesOf(x, sigma), hh = H_OF(sigma), n = 100;
        plate(g, '800 data points, batch SOM lattice', left.x, left.y - 50);
        plate(g, 'Lattice: 10 × 10 nodes', right.x, right.y - 50);
        // Data space: the point x, its nearest node and its energy-based winner.
        const X = sad.P(x), N = sad.P(B[r.near]), Wn = sad.P(B[r.win]);
        const reach = born('hk:lines' + hkPoint, { delay: 200, dur: 600 }), at = born('hk:nodes' + hkPoint, { delay: 500 });
        if (step === 1) { const fan = born('hk:fan' + hkPoint, { delay: 300, dur: 600 }); for (let k = 0; k < n; k++) { const w = hh[r.win * n + k]; if (k !== r.win && w >= 0.1) line(g, X, sad.P(B[k]), { color: C.hl, lw: 1 + 3 * w, alpha: 0.25 + 0.6 * w, grow: fan }); } }
        line(g, X, N, { color: C.gray, lw: 3, dash: [8, 6], grow: reach });
        line(g, X, Wn, { color: C.blue, lw: 3.4, grow: reach });
        ring(g, N[0], N[1], 11, { color: C.gray, lw: 4, grow: at });
        ring(g, Wn[0], Wn[1], 11, { color: C.blue, lw: 4, grow: at });
        cross(g, X[0], X[1], 10);
        text(g, 'x', X[0] + 14, X[1] - 14, { size: 38, weight: 700, color: C.verm, italic: true });
        // The lattice, shaded by h(c, w) (step 1: by how small each candidate's term is).
        const t0 = Math.min(...r.term), t1 = Math.max(...r.term);
        const shade = c => (step === 0 ? hh[r.win * n + c] : 1 - (r.term[c] - t0) / (t1 - t0 || 1));
        const rad = lm.k * SPACING10 * 0.36;
        drawGrid(g, lm, 10, C.line, 1.4);
        const discs = born('hk:discs', { dur: 600 });
        for (let c = 0; c < n; c++) ring(g, ...lm.at(Y10[c]), rad, { color: C.line, lw: 1.4, fill: css(mixRGB('#FFFFFF', C.hl, 0.8 * shade(c))), grow: discs });
        if (r.near !== r.win) arrow(g, lm.at(Y10[r.near]), lm.at(Y10[r.win]), { color: C.ink, lw: 3, head: 16, grow: born('hk:arrow' + hkPoint, { delay: 700, dur: 500 }) });
        ring(g, ...lm.at(Y10[r.near]), rad + 5, { color: C.gray, lw: 5, grow: at });
        ring(g, ...lm.at(Y10[r.win]), rad + 5, { color: C.blue, lw: 5, grow: at });
        // The key, beside the lattice.
        const key = (y, color, label) => { ring(g, kx + 14, y - 10, 13, { color, lw: 5 }); text(g, label, kx + 40, y, { size: 30, weight: 700, halo: false }); };
        key(right.y + 40, C.gray, 'nearest node');
        key(right.y + 90, C.blue, 'energy winner');
        g.fillStyle = css(mixRGB('#FFFFFF', C.hl, 0.8)); g.beginPath(); g.arc(kx + 14, right.y + 130, 13, 0, Math.PI * 2); g.fill();
        text(g, step === 0 ? '$h(c, w)$: near $w$' : 'small term', kx + 40, right.y + 140, { size: 30, weight: 700, halo: false, color: C.hl });
        if (step === 1) {
          text(g, '$nC$² = 8,000,000', kx, right.y + 214, { size: 36, weight: 760, color: C.hl, halo: false });
          text(g, 'terms per iteration', kx, right.y + 254, { size: 28, weight: 600, halo: false });
          text(g, '(800 data points, 100 nodes)', kx, right.y + 290, { size: 28, weight: 600, color: C.muted, halo: false });
        }
      };
      // Any point of the surface can be the example.
      const pickPoint = (x, y) => S.pick(x, y, { within: 14, test: it => it.id[0] === 's' });
      S.handlers.down = (x, y) => { const it = pickPoint(x, y); if (it) { hkPoint = it.data; S.wake(); } return !!it; };
      S.handlers.move = (x, y) => S.cursor(pickPoint(x, y) ? 'pointer' : '');
    },
  };

  // ------------------------------------------------------------ the data space beside the latent space
  /**
   * The data space in rect: the surface's points (faint) and the lattice of prototypes B ([x, y, z]
   * per node, side × side), seen from view3; rings on the points in `marked`. Returns the projection.
   */
  function dataSpace(g, rect, B, { side = 10, marked = [] } = {}) {
    const k = Math.min(rect.w, rect.h) * 0.44, cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2 + rect.h * 0.04;
    const P = p => { const q = project(view3, p); return [cx + k * q[0], cy - k * q[1]]; };
    g.save();
    const a0 = g.globalAlpha;
    g.globalAlpha = a0 * 0.4;
    XS.forEach((p, i) => { const [x, y] = P(p); g.fillStyle = ZCOLOR[i]; g.fillRect(x - 2, y - 2, 4, 4); });
    g.globalAlpha = a0;
    latticeLines(g, B.map(P), side);
    g.restore();
    for (const i of marked) ring(g, ...P(XS[i]), 10, { color: C.hl, lw: 3 });
    return P;
  }
  /** Lattice lines and nodes through already projected points (side × side, row by row). */
  function latticeLines(g, Q, side) {
    g.strokeStyle = C.ink; g.lineWidth = 1.3; g.beginPath();
    for (let j = 0; j < side * side; j++) {
      if (j % side < side - 1) { g.moveTo(...Q[j]); g.lineTo(...Q[j + 1]); }
      if (j + side < side * side) { g.moveTo(...Q[j]); g.lineTo(...Q[j + side]); }
    }
    g.stroke(); g.fillStyle = C.ink;
    Q.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill(); });
  }
  /** The first two principal axes of X (power iteration on the covariance), for data in more than 3 dimensions. */
  const principal = memo(key => {
    const X = key === 'iris' ? XI : DIGITS.X, n = X.length, d = X[0].length, mean = new Array(d).fill(0);
    X.forEach(x => x.forEach((v, f) => (mean[f] += v / n)));
    const Cv = Array.from({ length: d }, () => new Float64Array(d));
    X.forEach(x => { for (let f = 0; f < d; f++) { const a = x[f] - mean[f]; if (a) for (let h = 0; h < d; h++) Cv[f][h] += a * (x[h] - mean[h]) / n; } });
    const axes = [];
    for (let a = 0; a < 2; a++) {
      let v = Array.from({ length: d }, (_, i) => Math.sin(i + 1 + a));
      for (let t = 0; t < 200; t++) {
        let w = Cv.map(row => row.reduce((acc, r, h) => acc + r * v[h], 0));
        for (const u of axes) { const dot = w.reduce((acc, x, h) => acc + x * u[h], 0); w = w.map((x, h) => x - dot * u[h]); }
        const norm = Math.hypot(...w) || 1; v = w.map(x => x / norm);
      }
      axes.push(v);
    }
    return p => axes.map(u => p.reduce((acc, x, f) => acc + (x - mean[f]) * u[f], 0));
  });
  /** Data in many dimensions, on its two principal axes, with a lattice of prototypes B (side × side). */
  function principalSpace(g, rect, key, X, color, B, side) {
    const proj = principal(key), pts = X.map(proj), m = fit(bounds(pts, 0.06), rect);
    g.save(); const a0 = g.globalAlpha; g.globalAlpha = a0 * 0.4; latticeLines(g, B.map(b => m.map(proj(b))), side);
    g.globalAlpha = a0 * 0.9; pts.forEach((q, i) => { const [x, y] = m.map(q); g.fillStyle = color(i); g.beginPath(); g.arc(x, y, 3.6, 0, Math.PI * 2); g.fill(); }); g.restore();
  }

  // ------------------------------------------------------------ Batch SOM and SOM-OLP side by side
  /**
   * Batch SOM on the left; at step 1 SOM-OLP fills the right panel, its points coming out of the left
   * one, so the two can be compared on one screen. legend: width kept at the left for a key.
   * item(i): the style of point i. Returns the panels' maps and a function that draws their labels.
   */
  function sideBySide(ctx, step, { dur, forward }, { F, legend = 0, side, spacing, somEmb, olpEmb, packKey, item, prefix = ['s', 't'], data = null }) {
    // With `data` (a function drawing the data space into a rectangle), the data space takes the first of three columns.
    const cols = ctx.panels({ x: F.x + legend, y: F.y + 56, w: F.w - legend, h: F.h - 56 }, data ? 3 : 2, { gap: data ? 60 : 90 });
    const [a, b] = data ? cols.slice(1) : cols, dataRect = data ? cols[0] : null;
    const la = latticeMap(a, 0.05), lb = latticeMap(b, 0.05), off = packAtNodes(packKey, somEmb, spacing);
    const used = [...new Set(somEmb.map(v => v.join(',')))].map(k => k.split(',').map(Number));
    const atA = i => la.at([somEmb[i][0] + off[i][0], somEmb[i][1] + off[i][1]]);
    const items = somEmb.map((_, i) => { const [x, y] = atA(i); return { ...item(i), id: prefix[0] + i, x, y, hit: true, data: i }; });
    // SOM-OLP's points appear on its own map: a different result, not Batch SOM's points moving.
    if (step >= 1) items.push(...olpEmb.map((v, i) => { const [x, y] = lb.at(v); return { ...item(i), id: prefix[1] + i, x, y, hit: true, data: i }; }));
    S.set(items, { dur: Math.max(dur, 1300), stagger: step >= 1 && forward ? (sp, k) => (k % somEmb.length) * (1400 / somEmb.length) : null });
    const grid = side > 10 ? C.faint : C.line;
    S.under = g => { drawGrid(g, la, side, grid); nodeDiscs(g, la, used, spacing); if (step >= 1) { g.save(); g.globalAlpha *= born('sbs:olp', { dur: 700 }); drawGrid(g, lb, side, grid); g.restore(); } if (data) data(g, dataRect); };
    const labels = g => {
      if (data) plate(g, 'Data space (PCA)', dataRect.x, dataRect.y - 56);
      plate(g, data ? 'Batch SOM' : 'Batch SOM: on the winner nodes', a.x, a.y - 56);
      if (step >= 1) plate(g, data ? 'SOM-OLP' : 'SOM-OLP: between the nodes', b.x, b.y - 56, { color: C.ours });
      else {
        g.save(); g.setLineDash([10, 8]); g.strokeStyle = C.line; g.lineWidth = 2; g.strokeRect(b.x, b.y, b.w, b.h); g.restore();
        text(g, '?', b.x + b.w / 2, b.y + b.h / 2 + 18, { size: 52, weight: 780, color: C.line, align: 'center', halo: false });
      }
      if (!ctx.narrow()) arrow(g, [a.x + a.w + 16, a.y + a.h / 2], [b.x - 16, a.y + a.h / 2], { color: step >= 1 ? C.gray : C.line, lw: 5, head: 22, grow: born('sbs:arrow', { delay: 200 }) });
    };
    return { a, b, la, lb, labels };
  }

  // ------------------------------------------------------------ latent positions
  let ltHover = -1;
  const mini = { az: -0.9, el: 0.45 };
  function inset(g, rect, i, B = null) {
    g.save();
    g.fillStyle = 'rgba(255, 255, 255, 0.95)'; g.strokeStyle = C.line; g.lineWidth = 1.5;
    g.fillRect(rect.x, rect.y, rect.w, rect.h); g.strokeRect(rect.x, rect.y, rect.w, rect.h);
    const k = Math.min(rect.w, rect.h) * 0.33, cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2 + 16;
    const P = p => { const q = project(mini, p); return [cx + k * q[0], cy - k * q[1]]; };
    const a0 = g.globalAlpha;
    XS.forEach((p, j) => { const [x, y] = P(p); g.globalAlpha = a0 * 0.55; g.fillStyle = ZCOLOR[j]; g.fillRect(x - 1.5, y - 1.5, 3, 3); });
    g.globalAlpha = a0;
    if (B) {
      g.strokeStyle = C.ink; g.lineWidth = 1.2; g.beginPath();
      for (let j = 0; j < 100; j++) { if (j % 10 < 9) { g.moveTo(...P(B[j])); g.lineTo(...P(B[j + 1])); } if (j + 10 < 100) { g.moveTo(...P(B[j])); g.lineTo(...P(B[j + 10])); } }
      g.stroke();
    }
    if (i >= 0) ring(g, ...P(XS[i]), 10, { color: C.hl, lw: 3.4 });
    text(g, B ? 'data fit' : 'on the surface', rect.x + 12, rect.y + 36, { size: 28, weight: 700, color: C.muted, halo: false });
    g.restore();
  }
  /**
   * The SOM-OLP panel keeps moving: its points go to a hard map (small λ: on the nodes) and back to
   * the soft one, slowly. states: [the soft result, () => the hard one]; lb: the panel's lattice map.
   */
  function hardSoft(ctx, lb, [soft, hard], prefix, item, delay) {
    if (ctx.reduced()) return;
    let isSoft = true;
    const flip = () => {
      isSoft = !isSoft;
      const st = isSoft ? soft : hard();
      S.set(st.emb.map((v, i) => { const [x, y] = lb.at(v); return { ...item(i), id: prefix + i, x, y, hit: true, data: i }; }), { dur: 2400, keep: true });
      ctx.after(5200, flip);
    };
    ctx.after(delay, flip);
  }
  /** Hovering a point rings it in both panels. */
  function hoverBoth(prefixes, get, set) {
    S.handlers.move = (x, y) => { const it = S.pick(x, y, { within: 12 }); const i = it ? it.data : -1; if (i !== get()) { set(i); S.wake(); } };
    S.handlers.leave = () => { set(-1); S.wake(); };
    return g => { const i = get(); if (i < 0) return; for (const p of prefixes) { const q = S.pos(p + i); if (q) ring(g, ...q, 13, { color: C.hl, lw: 3.4 }); } };
  }
  const latent = {
    id: 'latent', steps: 2,
    show(ctx, step, { dur, forward }) {
      M.hide();
      // Each method in both spaces: its lattice of prototypes in the data space, and the points on its map.
      const F = ctx.field({ eq: step === 0 }), som = batchSaddle(), olp = olpSaddle(0.3, 3);
      const [A2, B2] = ctx.panels(F, 2, { gap: 90, top: 56 });
      const half = (r, k) => ({ x: r.x + k * (r.w / 2 + 8), y: r.y + 46, w: r.w / 2 - 8, h: r.h - 46 });
      const [aData, aLat, bData, bLat] = [half(A2, 0), half(A2, 1), half(B2, 0), half(B2, 1)];
      const la = latticeMap(aLat, 0.05), lb = latticeMap(bLat, 0.05), off = packAtNodes('saddle-som', som.emb, SPACING10);
      const used = [...new Set(som.emb.map(v => v.join(',')))].map(k => k.split(',').map(Number));
      const atA = i => la.at([som.emb[i][0] + off[i][0], som.emb[i][1] + off[i][1]]);
      const items = XS.map((_, i) => { const [x, y] = atA(i); return { id: 's' + i, x, y, r: 3.4, fill: ZCOLOR[i], hit: true, data: i }; });
      // SOM-OLP's points appear on its own map (a different result, not Batch SOM's points moving over).
      const olpItems = st => st.emb.map((v, i) => { const [x, y] = lb.at(v); return { id: 't' + i, x, y, r: 3.4, fill: ZCOLOR[i], hit: true, data: i }; });
      if (step >= 1) items.push(...olpItems(olp));
      S.set(items, { dur: Math.max(dur, 1300), stagger: step >= 1 && forward ? (sp, k) => (k % 800) * 1.6 : null });
      // SOM-OLP goes hard (λ small: on the nodes) and soft again; its prototypes in the data space follow.
      let olpB = olp.B, fromB = olpB, toB = olpB, tB = 0;
      const marked = () => (ltHover >= 0 ? [ltHover] : []);
      S.under = g => {
        drawGrid(g, la, 10, C.line); nodeDiscs(g, la, used, SPACING10); dataSpace(g, aData, som.B, { marked: marked() });
        if (step >= 1) { g.save(); g.globalAlpha *= born('lt:olp', { dur: 700 }); drawGrid(g, lb, 10, C.line); dataSpace(g, bData, olpB, { marked: marked() }); g.restore(); }
      };
      S.over = g => {
        // The contrast in the panel titles (Batch SOM's points are drawn spread around their node, so that all can be seen).
        plate(g, 'Batch SOM: on the nodes (spread to be seen)', A2.x, A2.y - 56);
        if (step >= 1) plate(g, 'SOM-OLP (ours): between the nodes', B2.x, B2.y - 56, { color: C.ours });
        else { g.save(); g.setLineDash([10, 8]); g.strokeStyle = C.line; g.lineWidth = 2; g.strokeRect(B2.x, B2.y, B2.w, B2.h); g.restore(); text(g, '?', B2.x + B2.w / 2, B2.y + B2.h / 2 + 18, { size: 52, weight: 780, color: C.line, align: 'center', halo: false }); }
        for (const [r, label] of [[aData, 'data space'], [aLat, 'latent space'], ...(step >= 1 ? [[bData, 'data space'], [bLat, 'latent space']] : [])]) text(g, label, r.x + r.w / 2, r.y - 14, { size: 28, weight: 600, color: C.muted, align: 'center', halo: false });
        if (!ctx.narrow()) arrow(g, [A2.x + A2.w + 16, A2.y + A2.h / 2], [B2.x - 16, A2.y + A2.h / 2], { color: step >= 1 ? C.gray : C.line, lw: 5, head: 22, grow: born('lt:arrow', { delay: 200 }) });
        if (ltHover >= 0) for (const pre of ['s', 't']) { const q = S.pos(pre + ltHover); if (q) ring(g, ...q, 12, { color: C.hl, lw: 3.2 }); }
      };
      live(ctx, Math.max(dur, 1300) + 200, () => {
        let last = performance.now();
        return now => {
          view3.az += (now - last) * 0.0001; last = now;
          const u = Math.min(1, (now - tB) / 2400), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
          olpB = toB.map((b, j) => b.map((v, f) => fromB[j][f] + (v - fromB[j][f]) * e));
        };
      });
      if (step >= 1 && !ctx.reduced()) {
        let isSoft = true;
        const flip = () => {
          isSoft = !isSoft;
          const st = isSoft ? olp : olpSaddle(0.01, 3);
          S.set(olpItems(st), { dur: 2400, keep: true });
          fromB = olpB; toB = st.B; tB = performance.now();
          ctx.after(5200, flip);
        };
        ctx.after(forward ? 3200 : 1600, flip);
      }
      S.handlers.move = (x, y) => { const it = S.pick(x, y, { within: 12 }); const i = it ? it.data : -1; if (i !== ltHover) { ltHover = i; S.wake(); } };
      S.handlers.leave = () => { ltHover = -1; S.wake(); };
    },
    leave() { ltHover = -1; },
  };

  // ------------------------------------------------------------ one point across a map
  const PSIDE = 5, YP = A.lattice(PSIDE), BP = YP.map(([r, c]) => [c * 0.95 + 0.16 * r * r - 0.08, r * 0.85 - 0.2 * c * c + 0.1]);
  let px = [0.18, 0.28], prLam = null, prGamma = null;
  const probe = {
    id: 'probe', steps: 1,
    narrowAspect: () => 1.6,
    setup(ctx) { prLam = slider('pr-lam', () => S.wake()); prGamma = slider('pr-gamma', () => S.wake()); },
    show(ctx, step, { dur, forward }) {
      M.hide();
      const F = ctx.field(), [dataRect, latRect] = ctx.panels(F, 2, { gap: F.w * 0.08, top: 60 });
      const m = fit([-1.35, 1.35, -1.25, 1.2], dataRect), lm = latticeMap(latRect, 0.12);
      S.set(BP.map((b, c) => { const [x, y] = m.map(b); return { id: 'o' + c, x, y, r: 11, fill: '#FFFFFF', stroke: C.blue, lw: 2.4, z: 2 }; }), { dur });
      S.edges = latticeEdges(PSIDE, 'o', C.gray, 2.2);
      const solve = memo((x0, x1, lam, gamma) => ub.apply.somOlp([[x0, x1]], BP, YP, { lam, gamma, maxIter: 2000, tol: 1e-10 }));
      const at = p => solve(p[0], p[1], prLam(), prGamma());
      const winnerOf = p => BP.reduce((a, b, c) => (A.sqd(p, b) < A.sqd(p, BP[a]) ? c : a), 0);
      let trailV = [], trailW = [];
      const record = () => { const r = at(px); trailV.push([r.embedding.data[0], r.embedding.data[1]]); const w = winnerOf(px); if (trailW.at(-1) !== w) trailW.push(w); };
      if (forward || dur > 0) {
        // The scripted path across the map.
        // Back and forth along the path, for ever (positions on a fine grid, so the solutions are reused).
        const path = t => [-1.0 + 2.0 * t, -0.78 + 1.5 * t + 0.28 * Math.sin(2 * Math.PI * t)], next = swing(0, 1, 11, 0);
        px = path(0); trailV = []; trailW = [];
        S.every(() => { px = path(Math.round(next() * 400) / 400); record(); if (trailV.length > 700) trailV.shift(); if (trailW.length > 24) trailW.shift(); });
      }
      S.over = g => {
        const r = at(px), u = r.membership.data, v = [r.embedding.data[0], r.embedding.data[1]], top = Math.max(...u), win = winnerOf(px);
        plate(g, 'Data space: a 5 × 5 lattice', dataRect.x, dataRect.y - 60);
        plate(g, 'Lattice', latRect.x, latRect.y - 60);
        BP.forEach((b, c) => { if (u[c] > 0.01) ring(g, ...m.map(b), 11, { color: C.blue, lw: 2.4, fill: css(mixRGB('#FFFFFF', C.blue, Math.min(1, u[c] / top))) }); });
        const X = m.map(px);
        cross(g, ...X, 12);
        text(g, 'x', X[0] + 18, X[1] - 16, { size: 40, weight: 700, color: C.verm, italic: true });
        drawGrid(g, lm, PSIDE, C.line, 1.6);
        // Trails: the winner jumps between nodes; v moves continuously.
        if (trailW.length > 1) { g.save(); g.setLineDash([10, 8]); g.strokeStyle = C.gray; g.lineWidth = 3; g.beginPath(); trailW.forEach((w, k) => (k ? g.lineTo(...lm.at(YP[w])) : g.moveTo(...lm.at(YP[w])))); g.stroke(); g.restore(); }
        if (trailV.length > 1) { g.save(); g.strokeStyle = C.blue; g.lineWidth = 4; g.beginPath(); trailV.forEach((p, k) => (k ? g.lineTo(...lm.at(p)) : g.moveTo(...lm.at(p)))); g.stroke(); g.restore(); }
        const V = lm.at(v);
        YP.forEach((y, c) => { if (u[c] > 0.02) line(g, V, lm.at(y), { color: C.blue, lw: 1.5 + 14 * u[c], alpha: 0.75 }); });
        YP.forEach(y => ring(g, ...lm.at(y), 11, { color: C.gray, lw: 2, fill: '#FFFFFF' }));
        trailW.forEach(w => ring(g, ...lm.at(YP[w]), 11, { color: C.gray, lw: 2, fill: '#D9DEE5' }));
        // The winner's label beside it, on the side away from v (v lies between the winner and its neighbors): above the
        // row's line, or below it when v is above; kept inside the figure on every row and column (the path starts in a corner).
        const Wp = lm.at(YP[win]);
        const lw = labelWidth(g, 'SOM winner', 30);
        let toRight = Math.abs(V[0] - Wp[0]) > 2 ? V[0] < Wp[0] : Wp[0] < latRect.x + latRect.w / 2;
        if (toRight && Wp[0] + 30 + lw > F.x + F.w) toRight = false;
        if (!toRight && Wp[0] - 30 - lw < latRect.x) toRight = true;
        const below = V[1] < Wp[1] - 2 && Wp[1] + 50 < F.y + F.h;
        ring(g, ...Wp, 20, { lw: 3.4 });
        // On v's side (when the other side has no room), past v and its letter.
        let lx = Wp[0] + (toRight ? 30 : -30);
        if (toRight && V[0] > Wp[0] + 2) lx = Math.max(lx, V[0] + 48);
        if (!toRight && V[0] < Wp[0] - 2) lx = Math.min(lx, V[0] - 48);
        text(g, 'SOM winner', lx, Wp[1] + (below ? 40 : -14), { size: 30, weight: 700, align: toRight ? 'left' : 'right' });
        ring(g, ...V, 12, { color: '#FFFFFF', lw: 3, fill: C.blue });
        text(g, 'v', V[0] + 16, V[1] - 16, { size: 40, weight: 700, color: C.blue, italic: true });
      };
      let held = false;
      S.handlers.down = (x, y) => {
        const X = m.map(px);
        held = (X[0] - x) ** 2 + (X[1] - y) ** 2 < 36 ** 2;
        if (!held) { const p = m.unmap(x, y); if (p[0] > -1.35 && p[0] < 1.35 && p[1] > -1.25 && p[1] < 1.2) { px = p; held = true; } }
        if (held) { trailV = []; trailW = []; }
        return held;
      };
      S.handlers.move = (x, y) => {
        const X = m.map(px);
        S.cursor(held || (X[0] - x) ** 2 + (X[1] - y) ** 2 < 36 ** 2 ? 'grab' : '');
        if (held) { px = m.unmap(x, y).map((t, k) => Math.max([-1.35, -1.25][k], Math.min([1.35, 1.2][k], t))); record(); }
      };
      S.handlers.up = () => { held = false; };
    },
  };

  // ------------------------------------------------------------ three closed-form updates
  let bcLam = null, bcGamma = null, bcTerm = new Set();
  const blockRun = memo((lam, gamma) => {
    const r1 = ub.steps.somOlp(XS, Y10, { lam, gamma, init: FLAT10, maxIter: 300, tol: 0 }).next().value.result();
    const states = [];
    let U = null, B = null, prevJ = null;
    for (const st of A.olpBlocks(XS, Y10, { lam, gamma, U0: r1.membership.data, B0: rowsOf(r1.centers), maxIter: 200 })) {
      states.push({ block: st.block, iteration: st.iteration, J: st.J, V: st.V, B: Array.from({ length: 100 }, (_, c) => Array.from(st.B.subarray(c * 3, c * 3 + 3))) });
      U = st.U; B = st.B;
      if (st.block === 'b') {
        if (prevJ !== null && Math.abs(st.J - prevJ) / Math.max(1, Math.abs(prevJ)) <= 1e-4) break;
        prevJ = st.J;
      }
    }
    return { states, U, B: Array.from({ length: 100 }, (_, c) => Array.from(B.subarray(c * 3, c * 3 + 3))) };
  });
  const bcd = {
    id: 'bcd', steps: 3, usesTerms: true,
    narrowAspect: () => 1,
    setup(ctx) { bcLam = slider('bc-lam', () => ctx.rerender()); bcGamma = slider('bc-gamma', () => ctx.rerender()); },
    show(ctx, step, { dur, forward }) {
      // The data space (prototypes b on the surface) beside the latent space (positions v): each update moves its own block.
      const F = ctx.field({ eq: 'tall', meter: true }), run = blockRun(bcLam(), bcGamma());
      const [dRect, lRect] = ctx.panels({ x: F.x, y: F.y + 92, w: F.w, h: F.h - 92 }, 2, { gap: 40 }), lm = latticeMap(lRect);
      const last = run.states.length - 1;
      // No meter of J: the curve says little (J barely changes after the first block updates); the caption says J never increases.
      M.hide();
      const items = st => XS.map((p, i) => { const [x, y] = lm.at([st.V[2 * i], st.V[2 * i + 1]]); return { id: 's' + i, x, y, r: 4.5, fill: ZCOLOR[i], hit: true, data: i }; });
      const showUpTo = (k, d) => {
        const st = run.states[Math.min(k, last)];
        S.set(items(st), { dur: d });
        if (step >= 1) ctx.highlight(st.block === 'start' ? [] : ['b' + st.block]);
        bcd.k = k;
      };
      const sample = [55, 300, 512, 701];
      S.under = g => {
        drawGrid(g, lm, 10, C.line);
        const st = run.states[bcd.k ?? 0] ?? run.states[0];
        dataSpace(g, dRect, st.B, { marked: bcTerm.has('fit') ? sample : [] });
      };
      live(ctx, 600, () => { let last = performance.now(); return now => { view3.az += (now - last) * 0.0001; last = now; }; });
      S.over = g => {
        text(g, 'data space', dRect.x + dRect.w / 2, dRect.y - 8, { size: 28, weight: 600, color: C.muted, align: 'center', halo: false });
        text(g, 'latent space', lRect.x + lRect.w / 2, lRect.y - 8, { size: 28, weight: 600, color: C.muted, align: 'center', halo: false });
        if (step === 1 || step === 2) {
          const k = bcd.k ?? 0, b = run.states[k]?.block;
          if (b && b !== 'start') plate(g, `updating ${b}`, F.x + 4, F.y + 2, { color: BLOCK_COLORS[b], size: 34 });
        }
        if (!bcTerm.size) return;
        const U = run.U, K = 100;
        for (const i of sample) {
          const p = S.pos('s' + i);
          if (!p) continue;
          if (bcTerm.has('lat')) for (let c = 0; c < K; c++) { const u = U[i * K + c]; if (u > 0.03) line(g, p, lm.at(Y10[c]), { color: C.hl, lw: 1 + 8 * u, alpha: 0.85 }); }
          if (bcTerm.has('ent')) { let h = 0; for (let c = 0; c < K; c++) { const u = U[i * K + c]; if (u > 0) h -= u * Math.log(u); } ring(g, ...p, 8 + 18 * h, { color: C.hl, lw: 3 }); }
          if (bcTerm.has('fit')) ring(g, ...p, 14, { color: C.hl, lw: 3.4 });
        }
        if (bcTerm.has('ent')) plate(g, 'entropy: softness of u', F.x + 4, F.y + 2, { color: C.hl });
        if (bcTerm.has('lat')) plate(g, 'lattice distance of v to the nodes', F.x + 4, F.y + 2, { color: C.hl });
        if (bcTerm.has('fit')) plate(g, 'data fit: data points near their prototypes (data space)', F.x + 4, F.y + 2, { color: C.hl });
      };
      if (step === 0) {
        showUpTo(0, dur);
        // Light the three terms in turn, then rest a moment, and again.
        const turn = k => { ctx.highlight(k < 3 ? [['fit', 'lat', 'ent'][k]] : []); ctx.after(k < 3 ? 2300 : 1600, () => turn((k + 1) % 4)); };
        ctx.after(900, () => turn(0));
      } else if (step === 1) {
        // The replays run only when stepping forward with motion; otherwise (as for the PDF) the last state at once.
        if (forward && !ctx.reduced()) {
          showUpTo(0, 0);
          // The first block updates one by one; then, after a pause, from the start again.
          const until = Math.min(last, 9), tick = () => { if (bcd.k >= until) { ctx.after(2600, () => { showUpTo(0, 400); ctx.after(900, tick); }); return; } showUpTo(bcd.k + 1, 500); ctx.after(800, tick); };
          ctx.after(500, tick);
        } else showUpTo(Math.min(9, last), 0);
      } else if (forward && !ctx.reduced()) {
        let k = Math.min(bcd.k ?? 0, last);
        // All the updates to the end; then, after a pause, from the start again.
        const tick = () => { k = Math.min(last, k + 3); showUpTo(k, 140); ctx.after(k < last ? 160 : 3200, k < last ? tick : () => { k = 0; showUpTo(0, 400); ctx.after(900, tick); }); };
        tick();
      } else showUpTo(last, dur);
    },
    term(ctx, name, on) { if (on) bcTerm.add(name); else bcTerm.delete(name); },
    leave() { bcTerm.clear(); },
  };

  // ------------------------------------------------------------ Iris
  const XI = D.iris.X, species = D.iris.y, Y16 = A.lattice(16), SP16 = 2 / 15;
  const irisSom = memo(() => mapState(16)(ub.batchSom(XI, [16, 16], { epochs: 60, sigma: 4, sigmaEnd: 0.5 })));
  const irisOlp = memo((lam = 1.32) => {
    const gen = ub.steps.somOlp(XI, Y16, { lam, gamma: 51.94, maxIter: 1000, tol: 0 }), stop = settled(), adapt = mapState(0);
    for (;;) { const { value, done } = gen.next(); const s = adapt(done ? value : value.result()); if (done || stop(s)) return s; }
  });
  const NAMES = ['setosa', 'versicolor', 'virginica'];
  const iris = {
    id: 'iris', steps: 2,
    narrowAspect: () => 1.9,
    show(ctx, step, opts) {
      M.hide();
      const F = ctx.field();
      const view = sideBySide(ctx, step, opts, {
        F, legend: 230, side: 16, spacing: SP16, somEmb: irisSom().emb, olpEmb: step >= 1 ? irisOlp().emb : [], packKey: 'iris-som', prefix: ['i', 'j'],
        data: (g, r) => principalSpace(g, r, 'iris', XI, i => CLUSTER[species[i]], (step >= 1 ? irisOlp() : irisSom()).B, 16),
        item: i => ({ r: 7, fill: CLUSTER[species[i]], shape: SHAPE[species[i]], stroke: '#FFFFFF', lw: 1.2 }),
      });
      if (step >= 1) hardSoft(ctx, view.lb, [irisOlp(), () => irisOlp(0.02)], 'j', i => ({ r: 7, fill: CLUSTER[species[i]], shape: SHAPE[species[i]], stroke: '#FFFFFF', lw: 1.2 }), opts.forward ? 3000 : 1600);
      S.over = g => {
        view.labels(g);
        NAMES.forEach((name, k) => {
          const y = F.y + 90 + k * 56;
          g.fillStyle = CLUSTER[k]; g.beginPath();
          if (k === 0) g.arc(F.x + 18, y - 10, 11, 0, Math.PI * 2); else if (k === 1) g.rect(F.x + 8, y - 20, 20, 20); else { g.moveTo(F.x + 18, y - 24); g.lineTo(F.x + 30, y); g.lineTo(F.x + 6, y); g.closePath(); }
          g.fill();
          text(g, name, F.x + 42, y, { size: 30, weight: 700, halo: false });
        });
      };
    },
  };

  // ------------------------------------------------------------ Digits: 64 dimensions, computed in the background
  // Standardized as in the public SOM-OLP example (population standard deviation; a constant pixel keeps scale 1).
  const DIGITS = (() => {
    const raw = D.digits.X, y = D.digits.y, n = raw.length, d = raw[0].length, mean = new Array(d).fill(0), sd = new Array(d).fill(0);
    raw.forEach(x => x.forEach((v, f) => (mean[f] += v / n)));
    raw.forEach(x => x.forEach((v, f) => (sd[f] += (v - mean[f]) ** 2 / n)));
    const X = raw.map(x => x.map((v, f) => (v - mean[f]) / (Math.sqrt(sd[f]) || 1)));
    // The mean image of each digit, for the key.
    const means = Array.from({ length: 10 }, (_, k) => {
      const ids = y.map((c, i) => (c === k ? i : -1)).filter(i => i >= 0);
      return Array.from({ length: d }, (_, f) => ids.reduce((a, i) => a + raw[i][f], 0) / ids.length);
    });
    return { raw, y, X, means };
  })();
  const DIGITS_PARAMS = { side: 16, lam: 2.79, gamma: 5.53 };   // tuned for Digits in the public SOM-OLP example
  const TAB10 = ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F', '#BCBD22', '#17BECF'];
  const digitsRuns = { som: null, olp: null, failed: false, onReady: null };
  const digitsReady = () => digitsRuns.onReady?.();
  /** On the main thread, only if the worker could not run. */
  function digitsHere() {
    digitsRuns.som = mapState(16)(ub.batchSom(DIGITS.X, [16, 16], { epochs: 60, sigma: 4, sigmaEnd: 0.5 }));
    const gen = ub.steps.somOlp(DIGITS.X, A.lattice(16), { lam: DIGITS_PARAMS.lam, gamma: DIGITS_PARAMS.gamma, maxIter: 1000, tol: 0 }), stop = settled(), adapt = mapState(0);
    for (;;) { const { value, done } = gen.next(); const s = adapt(done ? value : value.result()); if (done || stop(s)) { digitsRuns.olp = s; break; } }
    digitsReady();
  }
  // Start when the deck opens (not in the presenter's window, which draws no figures).
  if (location.hash !== '#presenter') {
    try {
      const worker = new Worker(new URL('./digits-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        digitsRuns[data.kind] = mapState(data.kind === 'som' ? 16 : 0)(data.result);
        if (data.kind === 'olp') worker.terminate();
        digitsReady();
      };
      worker.onerror = e => { e.preventDefault?.(); worker.terminate(); digitsRuns.failed = true; digitsReady(); };
      worker.postMessage({ X: DIGITS.X, ...DIGITS_PARAMS });
    } catch (err) { digitsRuns.failed = true; }
  }
  /** An 8 x 8 image (values 0 to 16) as gray squares. */
  function digitImage(g, img, x, y, cell) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const v = Math.round(255 - img[r * 8 + c] * 255 / 16);
      g.fillStyle = `rgb(${v}, ${v}, ${v})`; g.fillRect(x + c * cell, y + r * cell, cell + 0.3, cell + 0.3);
    }
    g.strokeStyle = C.line; g.lineWidth = 1; g.strokeRect(x, y, 8 * cell, 8 * cell);
  }
  let dgShown = false, dgHover = -1, dgPrefix = 'd';
  const digits = {
    id: 'digits', steps: 2,
    narrowAspect: () => 1.9,
    show(ctx, step, opts) {
      dgShown = true;
      M.hide();
      const F = ctx.field();
      // The key: each digit's mean image and its color.
      // Ten rows that fit the figure's height (it is lower under the opening sentence).
      const kStep = Math.min(57, (F.h - 52) / 9), kScale = Math.min(5.5, (kStep - 8) / 8);
      const key = g => DIGITS.means.forEach((img, k) => {
        const y = F.y + 8 + k * kStep;
        digitImage(g, img, F.x + 6, y, kScale);
        text(g, String(k), F.x + 70, y + kScale * 7, { size: 34, weight: 780, color: TAB10[k], halo: false });
        if (digits.focus === k) ring(g, F.x + 28, y + kScale * 4, 34, { color: C.hl, lw: 3, grow: born('dgk:focus' + k, { dur: 300 }) });
      });
      digits.focus = -1;
      digitsRuns.onReady = () => { if (dgShown) ctx.rerender(); };
      if (!digitsRuns.som || (step >= 1 && !digitsRuns.olp)) {
        S.set([], { dur: opts.dur });
        S.over = g => { key(g); plate(g, 'Computing on this computer…', F.x + 300, F.y + F.h / 2 - 24); };
        if (digitsRuns.failed && !digitsRuns.som) ctx.after(80, digitsHere);
        return;
      }
      const view = sideBySide(ctx, step, opts, {
        F, legend: 250, side: 16, spacing: SP16, somEmb: digitsRuns.som.emb, olpEmb: step >= 1 ? digitsRuns.olp.emb : [], packKey: 'digits-som', prefix: ['d', 'e'],
        data: (g, r) => principalSpace(g, r, 'digits', DIGITS.X, i => TAB10[DIGITS.y[i]], (step >= 1 ? digitsRuns.olp : digitsRuns.som).B, 16),
        item: i => ({ r: 3.6, fill: TAB10[DIGITS.y[i]] }),
      });
      // One digit after another comes forward in both maps (and in the key).
      let focus = -1;
      live(ctx, opts.forward ? 2600 : 1200, () => () => {
        const k = cycle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 2.4);
        if (k === focus) return;
        focus = k;
        const grow = (prefix, n) => Array.from({ length: n }, (_, i) => [prefix + i, { r: DIGITS.y[i] === k ? 5.6 : 3.6, alpha: DIGITS.y[i] === k ? 1 : 0.45 }]);
        S.patch([...grow('d', DIGITS.raw.length), ...(step >= 1 ? grow('e', DIGITS.raw.length) : [])], { dur: 400 });
        digits.focus = k;
      });
      S.over = g => {
        key(g); view.labels(g);
        if (dgHover < 0) return;
        // The image under the pointer, beside its point.
        const p = S.pos(dgPrefix + dgHover);
        if (!p) return;
        ring(g, ...p, 10, { color: C.ink, lw: 3 });
        const x = Math.min(p[0] + 18, F.x + F.w - 100), y = Math.max(p[1] - 110, F.y);
        g.fillStyle = '#FFFFFF'; g.fillRect(x - 6, y - 6, 100, 100);
        digitImage(g, DIGITS.raw[dgHover], x, y, 11);
      };
      S.handlers.move = (x, y) => { const it = S.pick(x, y, { within: 10 }); const i = it ? it.data : -1; if (it) dgPrefix = it.id[0]; if (i !== dgHover) { dgHover = i; S.wake(); } };
      S.handlers.leave = () => { dgHover = -1; S.wake(); };
    },
    leave() { dgShown = false; dgHover = -1; digitsRuns.onReady = null; },
  };

  // Before the energy: SOM's updates are rules, with no function they are sure to decrease.
  const heskesMotive = (ctx, { dur }) => {
    const F = ctx.field({ eq: true, meter: true }), B = batchSaddle().B, enter = Math.max(dur, 900);
    const place = d => S.set(saddleItems(F, B).items, { dur: d });
    place(enter);
    S.edges = latticeEdges(10);
    M.hide();
    S.over = g => plate(g, 'Batch SOM: rules, with no function sure to decrease', F.x + 4, F.y + 2);
    spin(ctx, enter + 50, place, dragRotate(() => place(0)));
  };

  // Before the objective: the variable SOM-OLP adds to the SOM (each point's latent position v), with the two it shares.
  const bcdMotive = (ctx, { dur }) => {
    M.hide();
    // On a narrow figure (narrow screens, or the split layout) the key goes under the lattice.
    // b lives in the data space, v in the latent space: both, side by side, and the key under them.
    const F = ctx.field({ eq: true }), narrow = true, olp = olpSaddle(0.3, 3);
    const [dRect, lRect] = ctx.panels({ x: F.x, y: F.y + 92, w: F.w, h: F.h - 92 - 200 }, 2, { gap: 40 }), lm = latticeMap(lRect);
    S.set(XS.map((p, i) => { const [x, y] = lm.at(olp.emb[i]); return { id: 's' + i, x, y, r: 4, fill: ZCOLOR[i] }; }), { dur });
    S.under = g => { drawGrid(g, lm, 10, C.line); dataSpace(g, dRect, olp.B); };
    live(ctx, dur + 300, () => { let last = performance.now(); return now => { view3.az += (now - last) * 0.0001; last = now; }; });
    S.over = g => {
      plate(g, 'SOM-OLP: a new variable $v$', F.x + 4, F.y + 2, { color: C.ours });
      text(g, 'data space: $b$', dRect.x + dRect.w / 2, dRect.y - 8, { size: 28, weight: 600, color: C.muted, align: 'center', halo: false });
      text(g, 'latent space: $v$', lRect.x + lRect.w / 2, lRect.y - 8, { size: 28, weight: 600, color: C.muted, align: 'center', halo: false });
      const kx = narrow ? F.x + 10 : F.x + F.w - 430, ky = narrow ? F.y + F.h - 150 : F.y + 140;
      // The new variable first, in our color; the two the SOM has too, muted.
      [['v', 'each data point\'s position on the lattice (new)', C.ours], ['u', 'memberships: soft winners', C.muted], ['b', 'prototypes, as in the SOM', C.muted]].forEach(([sym, words, color], k) => {
        text(g, sym, kx, ky + k * 60, { size: 38, weight: 700, italic: true, color, halo: false });
        text(g, words, kx + 40, ky + k * 60, { size: 30, weight: 700, color: k ? C.muted : C.ink, halo: false });
      });
    };
  };

  // Heskes's SOM is a supplement (after the last slide), kept for questions.
  return [maps, som, remap(latent, [1]), { ...probe, supplement: true }, remap(withIdea(withMotive(bcd, bcdMotive, { aspect: 1.15 }), 1), [0, 2, 4]),
    // Iris and Digits in one step each: Batch SOM and SOM-OLP side by side at once.
    remap(iris, [1]), remap(digits, [1]),
    { ...withIdea(withMotive(heskes, heskesMotive, { aspect: 0.9 }), 1), supplement: true }];
}
