/**
 * Part 1 (5.5 min), uncertain membership judged by distance: from k-means to degrees (FCM, its
 * objective read term by term, then its updates), to deferred decisions (rough c-means, its rule
 * read term by term), the family of thresholds (GRCM, ExRCM: generalized rules), and the shapes
 * that ExRCM's exponent gives one cluster.
 */
import {
  A, ub, C, FONT, XA, START, BOUNDS_A, RADIUS, leftOf, hoodOf, kmeansA, fcmA, lrcmA, rscmA, CLUSTER, R,
  pointItems, protoItems, hard, boundaryStyle, diverging, text, symbol, plate, newExample, ring, line, arrow, paintField, mixRGB, fit,
  membershipLegend, slider, onClick, f2, muLeft, withMotive, withIdea, swing, live, born, remap,
} from './common.js';

export default function part1(ctx) {
  const S = ctx.stage, M = ctx.meter;
  const regionStyle = (s, left) => i => (s.region[i] < 0 ? boundaryStyle : hard(s.region[i] !== left));

  // ------------------------------------------------------------ from 0 or 1 to degrees
  let fzM = null, hotU = false;
  const fuzzy = {
    id: 'fuzzy', steps: 4, usesTerms: true,
    setup(ctx) { fzM = slider('fz-m', () => ctx.rerender()); onClick('fz-run', () => fuzzy.replay?.()); },
    show(ctx, step, { dur, forward, from }) {
      // The points over a bottom row kept for the membership scale and m, so that neither covers a point.
      const F = ctx.field({ eq: 'tall', meter: true }), m = S.view(BOUNDS_A, { ...F, h: F.h - 100 }, dur);
      if (step === 0) {
        const s = kmeansA(), left = leftOf(s.B), [b1, b2] = s.B;
        S.set([...pointItems(XA, m, i => hard(s.labels[i] !== left)), ...protoItems(s.B, m)], { dur });
        M.hide();
        S.over = (g, st) => {
          const mm = st.map, P = [mm.map(b1), mm.map(b2)], mid = [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2];
          const dx = P[1][0] - P[0][0], dy = P[1][1] - P[0][1], n = Math.hypot(dx, dy);
          const cut = born('fz:bisector', { delay: 250, dur: 800 }), near = born('fz:near', { delay: 800, dur: 400 });
          for (const sg of [1, -1]) line(g, mid, [mid[0] - sg * dy / n * 500, mid[1] + sg * dx / n * 500], { color: C.muted, lw: 2.4, dash: [10, 8], grow: cut });
          XA.forEach(p => { if (Math.abs(Math.sqrt(A.sqd(p, b1)) - Math.sqrt(A.sqd(p, b2))) <= 0.35) ring(g, ...mm.map(p), 14, { lw: 2.4, grow: near }); });
          // Parts 1 and 2 use these points; the plate says so once, as the data change from the introduction.
          if (from !== 'fuzzy') newExample(g, '300 data points in two overlapping groups', F);
          else plate(g, 'k-means on 300 data points, $C = 2$', F.x + 4, F.y + 2);
          // What the rings mark, under the ringed band (the boundary), not in the caption.
          const rg = XA.filter(p => Math.abs(Math.sqrt(A.sqd(p, b1)) - Math.sqrt(A.sqd(p, b2))) <= 0.35).map(p => mm.map(p));
          const lx = Math.min(Math.max(rg.reduce((a, q) => a + q[0], 0) / rg.length, F.x + 230), F.x + F.w - 230);
          const ly = Math.min(F.y + F.h - 48, Math.max(...rg.map(q => q[1])) + 44);
          text(g, 'ringed: near the boundary,', lx, ly, { size: 30, weight: 700, color: C.ink, align: 'center' });
          text(g, 'yet in one cluster only', lx, ly + 36, { size: 30, weight: 700, color: C.ink, align: 'center' });
        };
        return;
      }
      const fin = fcmA(fzM()), axes = { yRange: [Math.min(...fin.history), Math.max(...fin.history)], xMax: fin.history.length };
      let state = fin, mu = null, mNow = fzM();
      const draw = (s, d, fixed = true) => {
        state = s; mu = null; mNow = fzM();
        S.set([...pointItems(XA, m, i => ({ fill: diverging(muLeft(s, i)), shape: 'circle' })), ...protoItems(s.B, m)], { dur: d });
        if (step >= 2) M.show({ name: `FCM, $m = ${fzM().toFixed(2)}$`, values: s.history, ...(fixed ? axes : {}) }); else M.hide();
      };
      // Then m swings slowly and only the degrees follow: the prototypes stay where FCM put them (for the slider's m), so that
      // the swing shows what m does to the degrees and nothing else. m - 1 swings on a log scale, so that crisp (m near 1.1)
      // and very soft (m near 6) take as long.
      const degrees = (B, q) => XA.flatMap(p => { const d = B.map(b => Math.max(1e-12, A.sqd(p, b))); return d.map(dc => 1 / d.reduce((acc, dk) => acc + (dc / dk) ** (1 / (q - 1)), 0)); });
      const swingM = () => live(ctx, 0, () => {
        const B = state.B, l = leftOf(B), next = swing(-1, 0.7, 11, Math.log10(fzM() - 1));
        return () => {
          const q = Math.round((1 + 10 ** (Math.round(next() * 20) / 20)) * 100) / 100;
          if (q !== mNow) { mNow = q; mu = degrees(B, q); S.set(pointItems(XA, m, i => ({ fill: diverging(mu[i * 2 + l]), shape: 'circle' })), { dur: 280, keep: true }); }
        };
      });
      fuzzy.replay = () => ctx.play(ub.steps.fcm(XA, 2, { m: fzM(), init: START }), s => draw(s, 300), { delay: 340, adapt: A.fromUbukit, then: swingM });
      if (step === 2 && forward) fuzzy.replay(); else { draw(fin, dur); ctx.after(dur + 300, swingM); }
      ctx.highlight(step === 1 ? ['u'] : []);
      S.over = g => {
        // The membership scale, at the figure's lower right.
        const lx = F.x + F.w - 400, ly = F.y + F.h - 50, lw = 380;
        g.save(); g.globalAlpha *= born('fz:legend', { delay: 300 }); membershipLegend(g, lx, ly, lw); g.restore();
        // u lit in the equation: the scale that shows it is framed.
        if (hotU) { g.save(); g.strokeStyle = C.hl; g.lineWidth = 3; g.strokeRect(lx - 12, ly - 46, lw + 24, 100); g.restore(); }
        // The m of the degrees shown (the prototypes are those of the run in the meter).
        text(g, `$m = ${mNow.toFixed(2)}$`, F.x + 4, F.y + F.h - 6, { size: 34, weight: 760, color: C.hl });
      };
    },
    term(ctx, name, on) { if (name === 'u') hotU = on; },
    leave() { hotU = false; },
  };

  // ------------------------------------------------------------ rough c-means
  let rgBeta = null, hotRough = new Set();
  const rough = {
    id: 'rough', steps: 4, usesTerms: true,
    // Its first step asks its question on fuzzy c-means' own figure: the points stay, and only what is ringed is new.
    continues: 'fuzzy',
    setup(ctx) { rgBeta = slider('rg-beta', () => ctx.rerender()); onClick('rg-run', () => rough.replay?.()); },
    show(ctx, step, { dur }) {
      const F = ctx.field({ eq: 'tall', meter: true });
      let s = lrcmA(rgBeta());
      const boundary = XA.map((_, i) => i).filter(i => s.region[i] < 0);
      const mid = [(s.B[0][0] + s.B[1][0]) / 2, (s.B[0][1] + s.B[1][1]) / 2];
      // The point in focus: its distances to the two prototypes differ markedly (by 0.40 to 0.55), so that the small slack
      // leaves it in one cluster and the large one puts it in both; the one nearest the middle among those.
      const gapOf = i => { const d = s.B.map(b => Math.sqrt(A.sqd(XA[i], b))); return Math.abs(d[0] - d[1]); };
      const clear = XA.map((_, i) => i).filter(i => gapOf(i) >= 0.4 && gapOf(i) <= 0.55);
      const probe = [...(clear.length ? clear : boundary)].sort((a, b) => A.sqd(XA[a], mid) - A.sqd(XA[b], mid))[0] ?? 0;
      const zoom = step === 1 || step === 2, c = XA[probe];
      const m = S.view(zoom ? [c[0] - 1.5, c[0] + 1.5, c[1] - 1.0, c[1] + 1.0] : BOUNDS_A, F, dur);
      const draw = (st, d) => {
        s = st;
        const left = leftOf(st.B);
        S.set([...pointItems(XA, m, i => ({ ...regionStyle(st, left)(i), r: zoom ? 9 : R }), 'r'), ...protoItems(st.B, m, { prefix: 'rb', r: zoom ? 24 : 18 })], { dur: d });
      };
      draw(s, dur);
      M.hide();   // RCM's updates are rules: no meter (the caption says so)
      let bb = rgBeta();
      if (zoom) {
        // Up close, the prototypes stay where RCM put them and only β changes. It rests where the point in focus belongs to both
        // clusters, then where it belongs to one (2.5 s each, 1 s between), so that the two cases can be told apart.
        const B = s.B, L = leftOf(B), p0 = XA[probe], dd = B.map(b => Math.sqrt(A.sqd(p0, b))), gap = Math.abs(dd[0] - dd[1]);
        const lo = Math.max(0.03, 0.4 * gap), hi = gap + 0.25;
        const restyle = beta => { const reg = A.roughRegions(XA, B, 1, beta, 1).region; S.set(pointItems(XA, m, i => ({ ...(reg[i] < 0 ? boundaryStyle : hard(reg[i] !== L)), r: 9 }), 'r'), { dur: 200, keep: true }); };
        bb = hi;
        live(ctx, dur + 300, () => {
          const t0 = performance.now(), ease = x => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
          let shown = null;
          return now => {
            const u = ((now - t0) / 7000) % 1;
            bb = u < 0.36 ? hi : u < 0.5 ? hi - (hi - lo) * ease((u - 0.36) / 0.14) : u < 0.86 ? lo : lo + (hi - lo) * ease((u - 0.86) / 0.14);
            const q = Math.round(bb * 100) / 100;
            if (q !== shown) { shown = q; restyle(q); }
          };
        });
      }
      // Away from the close-up, β stays at the slider's value, and with it RCM's prototypes: a size that changed while the
      // prototypes moved would mix two effects.
      rough.replay = () => ctx.play(A.roughCMeans(XA, START, { beta: rgBeta() }), st => draw(st, 300), { delay: 340 });
      ctx.highlight(step === 1 ? ['dmin'] : step === 2 ? ['beta'] : []);
      S.over = (g, st) => {
        const mm = st.map, left = leftOf(s.B);
        if (step === 0) {
          // Direct labels once: the two lower approximations and the boundary between them.
          const cl = mm.map([s.B[left][0] - 0.9, s.B[left][1] + 1.35]), cr = mm.map([s.B[1 - left][0] + 0.4, s.B[1 - left][1] + 1.35]);
          text(g, 'lower 1 (certain)', cl[0], cl[1], { size: 30, weight: 700, color: C.blue, align: 'center' });
          text(g, 'lower 2 (certain)', cr[0], cr[1], { size: 30, weight: 700, color: C.verm, align: 'center' });
          const b = mm.map([mid[0], BOUNDS_A[2] + 0.25]);
          text(g, 'boundary (deferred)', b[0], b[1], { size: 30, weight: 700, color: C.ink, align: 'center' });
          return;
        }
        if (step === 3) {
          // The update: every point pulls the prototypes of its candidates, a boundary point half each (ũ = 1/2).
          const reach = born('rg:shares', { dur: 800 }), on = born('rg:protos', { delay: 500 });
          XA.forEach((p, i) => { if (s.region[i] < 0) s.B.forEach((b, c) => { if (s.mu[i * 2 + c] > 0) line(g, mm.map(p), mm.map(b), { color: C.hl, lw: 2, alpha: 0.55, dash: [6, 5], grow: reach }); }); });
          s.B.forEach(b => ring(g, ...mm.map(b), 30, { color: C.hl, lw: 3.4, grow: on }));
          plate(g, 'Dashed: ½ to each of its clusters', F.x + 4, F.y + 2, { color: C.hl });
          return;
        }
        plate(g, 'One boundary data point, up close', F.x + 4, F.y + 2);
        // The prototypes where they are drawn now (they glide between RCM's results), and β as it swings: no jumps.
        const p = XA[probe], P = mm.map(p), Bs = s.B.map((b, c) => S.pos('rb' + c) ?? mm.map(b));
        const d = Bs.map(Q => Math.hypot(Q[0] - P[0], Q[1] - P[1]) / mm.k), dmin = Math.min(...d), near = d.indexOf(dmin);
        const cand = A.candidates(d, 1, bb, 1);
        ring(g, ...P, dmin * mm.k, { color: step === 1 ? C.hl : C.gray, lw: step === 1 ? 4 : 2.6, grow: born('rg:dmin', { dur: 600 }) });
        const Bn = Bs[near];
        line(g, P, Bn, { color: step === 1 ? C.hl : C.gray, lw: 3, grow: born('rg:dline', { dur: 500 }) });
        symbol(g, 'd', 'i', (P[0] + Bn[0]) / 2, (P[1] + Bn[1]) / 2 - 22, { sup: 'min', color: step === 1 ? C.hl : C.ink, align: 'center' });
        if (step === 2) {
          ring(g, ...P, (dmin + bb) * mm.k, { color: C.hl, lw: 3.4, dash: [12, 9], grow: born('rg:slack', { delay: 200, dur: 600 }) });
          const base = Math.atan2(Bn[1] - P[1], Bn[0] - P[0]), probeR = (dmin + 0.5) * mm.k;
          const room = a => { const x = P[0] + Math.cos(a) * probeR, y = P[1] + Math.sin(a) * probeR; return Math.min(x - F.x, F.x + F.w - x, y - F.y, F.y + F.h - y); };
          const ang = [2.2, -2.2, 1.6, -1.6, 2.8, -2.8].map(o => base + o).reduce((a, b) => (room(b) > room(a) ? b : a));
          const a0 = [P[0] + Math.cos(ang) * dmin * mm.k, P[1] + Math.sin(ang) * dmin * mm.k], a1 = [P[0] + Math.cos(ang) * (dmin + bb) * mm.k, P[1] + Math.sin(ang) * (dmin + bb) * mm.k];
          if (bb > 0.03) { arrow(g, a0, a1, { color: C.hl, lw: 3.4, head: 18, grow: born('rg:beta', { delay: 500, dur: 400 }) }); text(g, 'β', (a0[0] + a1[0]) / 2 + 20, (a0[1] + a1[1]) / 2, { size: 40, weight: 700, color: C.hl, base: 'middle', italic: true }); }
          // Under each prototype, toward the middle of the figure, so that the label stays inside it.
          Bs.forEach((Q, k) => { const right = Q[0] > F.x + F.w / 2; text(g, cand[k] ? 'relatively close' : 'too far', right ? Q[0] + 24 : Q[0] - 24, Q[1] + 56, { size: 30, weight: 700, align: right ? 'right' : 'left' }); });
          // What it means for the point, in so many words.
          const both = cand.filter(Boolean).length > 1;
          plate(g, both ? '$i$ belongs to both clusters' : `$i$ belongs to cluster ${near === left ? 1 : 2} only`, F.x + F.w - 4, F.y + F.h - 62, { align: 'right', size: 34, color: both ? C.ink : near === left ? C.blue : C.verm });
        }
        ring(g, ...P, 14, { color: C.hl, lw: 3.6, grow: born('rg:point', { dur: 300 }) });
      };
    },
    term(ctx, name, on) { if (on) hotRough.add(name); else hotRough.delete(name); },
    leave() { hotRough.clear(); },
  };

  // ------------------------------------------------------------ one family of thresholds: LRCM ▶ PRCM ▶ GRCM ▶ ExRCM on one screen
  const LINGRAS = [1, 0.5, 1], PETERS = [1.4, 0, 1], GRCM_TO = [1.25, 0.3], EX_TO = [1, 0.9, 2];
  const WORLD = [-2.4, 2.4, -1.6, 1.6];
  const P = [[-1.0, 0.55], [1.0, 0.65], [0.05, -0.85]];
  let fa = null, fb = null, fz = null, grcm = [...GRCM_TO], ex = [...EX_TO];
  const tint = CLUSTER.map(c => mixRGB('#FFFFFF', c, 0.42).map(Math.round)), bd2 = [196, 203, 212], bd3 = [168, 177, 189];
  function region(g, rect, m, [a, b, z], grow = 1) {
    const bz = b ** z, d = [0, 0, 0];
    paintField(g, rect, 3, (sx, sy) => {
      const p = m.unmap(sx, sy);
      let dmin = Infinity, best = 0;
      for (let c = 0; c < 3; c++) { d[c] = Math.hypot(p[0] - P[c][0], p[1] - P[c][1]); if (d[c] < dmin) { dmin = d[c]; best = c; } }
      const bound = ((a * dmin) ** z + bz) * (1 + 1e-12);
      let count = 0;
      for (let c = 0; c < 3; c++) if (d[c] ** z <= bound) count++;
      return count === 1 ? tint[best] : count === 2 ? bd2 : bd3;
    }, { grow });
  }
  // The four rules, each with its own panel; GRCM and ExRCM are ours.
  let lr = [...LINGRAS], pr = [...PETERS];
  const RULES = [
    { name: 'LRCM (Lingras)', params: () => lr, label: () => `$β = ${f2(lr[1])}$` },
    { name: 'PRCM (Peters)', params: () => pr, label: () => `$α = ${f2(pr[0])}$` },
    { name: 'GRCM (ours)', params: () => [grcm[0], grcm[1], 1], label: () => `$α = ${f2(grcm[0])}$ · $β = ${f2(grcm[1])}$` },
    { name: 'ExRCM (ours)', params: () => ex, label: () => `$p = ${ex[2].toFixed(1)}$ · $α = ${ex[0].toFixed(1)}$ · $β = ${ex[1].toFixed(1)}$` },
  ];
  const family = {
    id: 'family', steps: 4,
    narrowAspect: () => 2.6,
    setup(ctx) {
      // The sliders set GRCM's α and β, and ExRCM's α, β and ζ.
      const change = () => { grcm = [fa(), fb()]; ex = [fa(), fb(), fz()]; S.wake(); };
      fa = slider('fm-alpha', change); fb = slider('fm-beta', change); fz = slider('fm-zeta', change);
    },
    show(ctx, step, { dur, forward }) {
      M.hide();
      // Two classic rules (steps 0 and 1, pictures then formulas), then GRCM (2), then ExRCM (3): each new rule
      // takes the next panel, and the earlier ones stay for comparison.
      // The panels start 64 below the field: their plates then clear ExRCM's two-line inequality above them.
      const F = ctx.field({ eq: true }), n = step <= 1 ? 2 : step + 1;
      const rects = ctx.panels({ x: F.x, y: F.y + 64, w: F.w, h: F.h - 64 - 44 }, 4, { gap: 48, top: 0 });
      const ms = rects.map(r => fit(WORLD, r));
      // Each rule's inequality (index.html: .rule-eq) sits over its own panel; 20 stage units are 1rem.
      for (const el of ctx.el('copy').querySelectorAll('.rule-eq')) { const r = rects[Number(el.dataset.k)]; el.style.left = `${r.x / 20}rem`; el.style.width = `${r.w / 20}rem`; }
      const stars = k => P.map((p, c) => { const [x, y] = ms[k].map(p); return { id: `f${k}_${c}`, x, y, r: 15, shape: 'star', fill: CLUSTER[c], stroke: '#FFFFFF', lw: 2, z: 5, hit: true, data: [k, c] }; });
      const place = d => S.set(Array.from({ length: n }, (_, k) => stars(k)).flat(), { dur: d });
      place(dur);
      // The new rule grows out of the one before it.
      if (step === 2) grcm = forward ? [LINGRAS[0], LINGRAS[1]] : [...GRCM_TO];
      if (step === 3) { ex = forward ? [GRCM_TO[0], GRCM_TO[1], 1] : [...EX_TO]; grcm = [...GRCM_TO]; }
      if (step >= 2 && forward) {
        const fromG = [...grcm], fromE = [...ex], t0 = performance.now(), T = ctx.reduced() ? 1 : 1400;
        const stop = S.every(now => {
          const u = Math.min(1, (now - t0) / T), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
          if (step === 2) grcm = fromG.map((v, j) => v + (GRCM_TO[j] - v) * e);
          else ex = fromE.map((v, j) => v + (EX_TO[j] - v) * e);
          if (u >= 1) stop();
          const cur = step === 2 ? [...grcm, 1] : ex;
          fa.set(cur[0]); fb.set(cur[1]); fz.set(cur[2]);
        });
      }
      // Once each rule is in place, its parameter swings slowly (each at its own pace): the boundaries breathe.
      lr = [...LINGRAS]; pr = [...PETERS];
      live(ctx, step >= 2 && forward ? 1700 : dur + 300, () => {
        const lb = swing(0.25, 0.8, 10, LINGRAS[1]), pa = swing(1.2, 1.7, 11, PETERS[0]);
        const ga = swing(1.1, 1.5, 12, GRCM_TO[0]), gb = swing(0.15, 0.5, 9, GRCM_TO[1]), ez = swing(1.2, 3, 10, EX_TO[2]);
        return () => {
          lr = [1, lb(), 1]; pr = [pa(), 0, 1];
          if (step >= 2) grcm = [ga(), gb()];
          if (step >= 3) ex = [EX_TO[0], EX_TO[1], ez()];
        };
      });
      S.under = g => { for (let k = 0; k < n; k++) region(g, rects[k], ms[k], RULES[k].params(), born('fam:panel' + k, { dur: 700 })); };
      S.over = g => {
        rects.forEach((r, k) => {
          if (k < n) {
            plate(g, RULES[k].name, r.x, r.y - 50, { color: k >= 2 ? C.ours : C.title });
            text(g, RULES[k].label(), r.x + 4, r.y + r.h + 34, { size: 28, weight: 700, color: C.muted, halo: false });
          } else {
            // Panels still to come: a dashed place.
            g.save(); g.setLineDash([10, 8]); g.strokeStyle = C.line; g.lineWidth = 2; g.strokeRect(r.x, r.y, r.w, r.h); g.restore();
            text(g, '?', r.x + r.w / 2, r.y + r.h / 2 + 18, { size: 52, weight: 780, color: C.line, align: 'center', halo: false });
          }
          if (k < 3 && !ctx.narrow()) arrow(g, [r.x + r.w + 8, r.y + r.h / 2], [r.x + r.w + 40, r.y + r.h / 2], { color: k + 1 < n ? C.gray : C.line, lw: 3.4, head: 14, grow: born('fam:arrow' + k, { delay: 200 }) });
        });
        // No key: the caption says what the colors mean, and the notes say a star can be dragged.
      };
      // The same three prototypes in every panel: drag one, and all rules redraw.
      let held = null;
      S.handlers.down = (x, y) => { const it = S.pick(x, y, { within: 26 }); held = it ? it.data : null; return held !== null; };
      S.handlers.move = (x, y) => {
        if (held === null) { S.cursor(S.pick(x, y, { within: 26 }) ? 'grab' : ''); return; }
        const p = ms[held[0]].unmap(x, y);
        P[held[1]] = [Math.max(WORLD[0], Math.min(WORLD[1], p[0])), Math.max(WORLD[2], Math.min(WORLD[3], p[1]))];
        place(0);
      };
      S.handlers.up = () => { held = null; };
    },
  };

  // ------------------------------------------------------------ what ζ does to one cluster: five prototypes on a pentagon around a sixth
  // ExRCM with α = 1, one panel per ζ: bulging (ζ = 1, Lingras), straight (2), bent inward (4), a star (16).
  const ZETAS = [1, 2, 4, 16], SHAPES = ['bulging', 'straight', 'bent inward', 'a star'];
  // Tight around the six prototypes (the pentagon spans y from -0.81 to 1), so the panels can be as large as possible.
  const SH_WORLD = [-1.1, 1.1, -0.98, 1.14], SH_BETA = 0.6;
  const Q = [[0, 0], ...Array.from({ length: 5 }, (_, k) => { const t = Math.PI / 2 + 2 * Math.PI * k / 5; return [Math.cos(t), Math.sin(t)]; })];
  // The center cluster only: its lower approximation dark, the rest of its upper approximation light, and outside it white.
  const shTint = [mixRGB('#FFFFFF', C.verm, 0.75), mixRGB('#FFFFFF', C.verm, 0.14), [255, 255, 255]].map(c => c.map(Math.round));
  let shZ = [...ZETAS], shB = SH_BETA;
  function centerRegion(g, rect, m, z, b, grow = 1) {
    const bz = b ** z, d = [0, 0, 0, 0, 0, 0];
    paintField(g, rect, 3, (sx, sy) => {
      const p = m.unmap(sx, sy);
      let dmin = Infinity;
      for (let c = 0; c < 6; c++) { d[c] = Math.hypot(p[0] - Q[c][0], p[1] - Q[c][1]); if (d[c] < dmin) dmin = d[c]; }
      const bound = (dmin ** z + bz) * (1 + 1e-12);
      let count = 0;
      for (let c = 0; c < 6; c++) if (d[c] ** z <= bound) count++;
      return d[0] ** z > bound ? shTint[2] : count === 1 ? shTint[0] : shTint[1];
    }, { grow });
  }
  const shapes = {
    id: 'shapes', steps: 5,
    show(ctx, step, { dur, forward }) {
      M.hide();
      // One panel per exponent p, added step by step (the last step keeps all four, for the benefit); the earlier ones stay.
      // Under the key sentence, over the caption and the benefit box.
      const F = ctx.field(), n = Math.min(step, 3) + 1;
      const rects = ctx.panels({ x: F.x, y: F.y + 50, w: F.w, h: F.h - 50 - 10 }, 4, { gap: 48, top: 0 });
      const ms = rects.map(r => fit(SH_WORLD, r));
      const stars = k => Q.map((p, c) => { const [x, y] = ms[k].map(p); return { id: `s${k}_${c}`, x, y, r: 13, shape: 'star', fill: c === 0 ? C.verm : C.blue, stroke: '#FFFFFF', lw: 2, z: 5, hit: true, data: [k, c] }; });
      const place = d => S.set(Array.from({ length: n }, (_, k) => stars(k)).flat(), { dur: d });
      place(dur);
      shZ = [...ZETAS]; shB = SH_BETA;
      // The new panel's region grows out of the one before it: ζ rises from the previous panel's value.
      if (step >= 1 && step <= 3 && forward) {
        const z0 = Math.log(ZETAS[step - 1]), z1 = Math.log(ZETAS[step]), t0 = performance.now(), T = ctx.reduced() ? 1 : 1400;
        shZ[step] = ZETAS[step - 1];
        const stop = S.every(now => {
          const u = Math.min(1, (now - t0) / T), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
          shZ[step] = Math.exp(z0 + (z1 - z0) * e);
          if (u >= 1) stop();
        });
      }
      // Once in place, the shared β swings slowly: every region grows and shrinks, and keeps its shape.
      live(ctx, step >= 1 && step <= 3 && forward ? 1700 : dur + 300, () => {
        // From 0.53 to 0.76 every panel keeps its shape (p = 16 stays a star), while the uncertain area grows and shrinks.
        const sb = swing(0.53, 0.76, 9, SH_BETA);
        return () => { shB = sb(); };
      });
      S.under = g => { for (let k = 0; k < n; k++) centerRegion(g, rects[k], ms[k], shZ[k], shB, born('sh:panel' + k, { dur: 700 })); };
      S.over = g => {
        rects.forEach((r, k) => {
          if (k < n) {
            plate(g, `$p = ${ZETAS[k]}$: ${SHAPES[k]}`, r.x, r.y - 50, { color: k >= 1 ? C.ours : C.title });
          } else {
            // Panels still to come: a dashed place.
            g.save(); g.setLineDash([10, 8]); g.strokeStyle = C.line; g.lineWidth = 2; g.strokeRect(r.x, r.y, r.w, r.h); g.restore();
            text(g, '?', r.x + r.w / 2, r.y + r.h / 2 + 18, { size: 52, weight: 780, color: C.line, align: 'center', halo: false });
          }
          if (k < 3) arrow(g, [r.x + r.w + 8, r.y + r.h / 2], [r.x + r.w + 40, r.y + r.h / 2], { color: k + 1 < n ? C.gray : C.line, lw: 3.4, head: 14, grow: born('sh:arrow' + k, { delay: 200 }) });
        });
        // No key: the caption names the two oranges (the center's lower and upper approximations).
      };
      // The same six prototypes in every panel: drag one, and all panels redraw.
      let held = null;
      S.handlers.down = (x, y) => { const it = S.pick(x, y, { within: 26 }); held = it ? it.data : null; return held !== null; };
      S.handlers.move = (x, y) => {
        if (held === null) { S.cursor(S.pick(x, y, { within: 26 }) ? 'grab' : ''); return; }
        const p = ms[held[0]].unmap(x, y);
        Q[held[1]] = [Math.max(SH_WORLD[0], Math.min(SH_WORLD[1], p[0])), Math.max(SH_WORLD[2], Math.min(SH_WORLD[3], p[1]))];
        place(0);
      };
      S.handlers.up = () => { held = null; };
    },
  };

  // FCM and RCM side by side: degrees on the left; on the right, points between clusters in both.
  const roughIdea = (ctx, { dur }) => {
    M.hide();
    // Under the key sentence, over the caption and the benefit box.
    const F = ctx.field(), [a, b] = ctx.panels(F, 2, { gap: 90, top: 56 });
    const ma = fit(BOUNDS_A, a), mb = fit(BOUNDS_A, b), Bf = fcmA(2).B, Br = lrcmA(0.35).B, lf = leftOf(Bf), lr = leftOf(Br);
    // The prototypes stay where they are; only the rule's parameter changes: FCM's m on the left, RCM's β on the right.
    const dist = (p, B) => B.map(c => Math.hypot(p[0] - c[0], p[1] - c[1]));
    const degree = (i, m) => { const d = dist(XA[i], Bf); if (d[lf] === 0) return 1; return 1 / d.reduce((acc, dk) => acc + (d[lf] / Math.max(dk, 1e-12)) ** (2 / (m - 1)), 0); };
    const regionOf = (i, beta) => { const d = dist(XA[i], Br), cand = A.candidates(d, 1, beta, 1); return cand[0] && cand[1] ? -1 : cand[lr] ? lr : 1 - lr; };
    const fcmItems = m => pointItems(XA, ma, i => ({ fill: diverging(degree(i, m)), shape: 'circle', r: 5.5 }), 'p');
    const rcmItems = beta => pointItems(XA, mb, i => { const g = regionOf(i, beta); return g < 0 ? { ...boundaryStyle, r: 6.5 } : { ...hard(g !== lr), r: 5.5 }; }, 'r');
    let m = 2, beta = 0.35;
    S.set([...fcmItems(m), ...protoItems(Bf, ma, { r: 16 }), ...rcmItems(beta), ...protoItems(Br, mb, { prefix: 'rb', r: 16 })], { dur: Math.max(dur, 900) });
    live(ctx, Math.max(dur, 900) + 300, () => {
      const nm = swing(-1, 0.7, 10, 0), nb = swing(0.1, 0.8, 8, 0.35);
      return () => {
        const qm = Math.round((1 + 10 ** nm()) * 100) / 100, qb = Math.round(nb() * 50) / 50;
        if (qm !== m) { m = qm; S.set(fcmItems(m), { dur: 200, keep: true }); }
        if (qb !== beta) { beta = qb; S.set(rcmItems(beta), { dur: 200, keep: true }); }
      };
    });
    S.over = g => {
      plate(g, 'FCM: a degree for every cluster', a.x, a.y - 56);
      plate(g, 'RCM: between clusters, in both', b.x, b.y - 56);
      // The parameter values, under each panel.
      text(g, `$m = ${m.toFixed(2)}$`, a.x + 4, a.y + a.h - 6, { size: 34, weight: 760, color: C.hl });
      text(g, `$β = ${beta.toFixed(2)}$`, b.x + 4, b.y + b.h - 6, { size: 34, weight: 760, color: C.hl });
      if (!ctx.narrow()) text(g, 'vs', (a.x + a.w + b.x) / 2, a.y + a.h / 2 + 14, { size: 40, weight: 780, align: 'center', color: C.muted, halo: false });
    };
  };

  // Before the rule: fuzzy degrees near 0.5 hide that we cannot decide, so we want to say so.
  const roughMotive = (ctx, { dur }) => {
    const F = ctx.field({ eq: true, meter: true }), m = S.view(BOUNDS_A, F, dur), s = fcmA(2);
    S.set([...pointItems(XA, m, i => ({ fill: diverging(muLeft(s, i)), shape: 'circle' })), ...protoItems(s.B, m)], { dur });
    M.hide();
    const unsure = XA.map((_, i) => Math.abs(muLeft(s, i) - 0.5) < 0.15), n = unsure.filter(Boolean).length;
    S.over = (g, st) => {
      const grow = born('rm:unsure', { delay: 400, dur: 500 });
      XA.forEach((p, i) => { if (unsure[i]) ring(g, ...st.map.map(p), 13, { color: C.hl, lw: 2.6, grow }); });
      plate(g, 'FCM, $m = 2$', F.x + 4, F.y + 2);
      // What the rings mark, just under the ringed points (the boundary), not in the caption.
      const Rg = XA.map((p, i) => (unsure[i] ? st.map.map(p) : null)).filter(Boolean);
      const cx = Rg.reduce((a, q) => a + q[0], 0) / Rg.length, bottom = Math.max(...Rg.map(q => q[1]));
      const lx = Math.min(Math.max(cx, F.x + 220), F.x + F.w - 220), ly = Math.min(F.y + F.h - 48, bottom + 44);
      text(g, `ringed: ${n} data points`, lx, ly, { size: 30, weight: 700, color: C.hl, align: 'center' });
      text(g, 'with $u$ between 0.35 and 0.65', lx, ly + 36, { size: 30, weight: 700, color: C.hl, align: 'center' });
    };
  };

  return [remap(withIdea(fuzzy, 1), [0, 1, 2, 4]), remap(withIdea(withMotive(rough, roughMotive), 1, roughIdea), [0, 1, 4, 5]), remap(family, [3]), remap(shapes, [4])];
}
