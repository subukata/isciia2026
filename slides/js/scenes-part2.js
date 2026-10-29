/**
 * Part 2 (6 min), relations among data points: rough set theory, where uncertainty comes from
 * neighborhoods; where distance and neighborhoods disagree; rough membership read term by term;
 * from rules (RSCM, RMCM) to one objective (RMCM2), with its two updates; and the use in
 * recommendation (a toy example with ratings).
 */
import {
  A, ub, C, FONT, XA, START, BOUNDS_A, RADIUS, leftOf, hoodOf, kmeansA, lrcmA, rscmA, rmcmA, rmcm2A, run, memo, R, fit,
  pointItems, protoItems, hard, boundaryStyle, diverging, text, labelWidth, labelSize, plate, fractionPlate, ring, line, arrow, membershipLegend, slider, onClick, f2, withMotive, withIdea, swing, live, born,
  CLUSTER, mixRGB, css, cycle, newExample, remap, symbol,
} from './common.js';

export default function part2(ctx) {
  const S = ctx.stage, M = ctx.meter;
  const muStyle = (mu, left) => i => ({ fill: diverging(mu[i * 2 + left]), shape: 'circle' });
  const regionStyle = (s, left) => i => (s.region[i] < 0 ? boundaryStyle : hard(s.region[i] !== left));
  /** A point whose neighborhood is the most mixed, with at least `min` neighbors. */
  const mixedPoint = (mu, left, hood, min = 5) => {
    let best = -1, bd = 2;
    XA.forEach((_, i) => { const d = Math.abs(mu[i * 2 + left] - 0.5); if (hood[i].length >= min && d < bd) { bd = d; best = i; } });
    return best;
  };
  const hoverPoint = onPick => (x, y) => { const it = S.pick(x, y, { within: 16, test: it => it.id[0] === 'p' }); onPick(it ? it.data : -1); };

  // ------------------------------------------------------------ rough sets: uncertainty induced by neighborhoods
  const roughset = {
    id: 'roughset', steps: 3,
    show(ctx, step, { dur }) {
      M.hide();
      // The sets X_c: the two clusters of k-means. Each point is judged by its neighborhood only.
      const F = ctx.field({ eq: 'tall' }), km = kmeansA(), left = leftOf(km.B);
      // Everything below follows the radius rq, which swings slowly: neighborhoods grow and shrink, and with them what is certain.
      const at = r => {
        const hood = hoodOf(r), share = hood.map(list => list.filter(j => km.labels[j] === left).length / list.length);
        const lower = share.map(v => v === 0 || v === 1), nLower = lower.filter(Boolean).length;
        return { hood, share, lower, nLower, nBoundary: XA.length - nLower };
      };
      let rq = RADIUS, cur = at(rq);
      // The point in focus: mixed at the starting radius, with at least 5 neighbors, and still holding several neighbors (4 or
      // more, itself included) just inside the nearest point of the other cluster (the most balanced such point): so a smaller
      // radius makes its neighborhood pure while it holds several data points, not only the point itself.
      const otherDist = i => Math.min(...XA.map((p, j) => (km.labels[j] !== km.labels[i] ? Math.hypot(p[0] - XA[i][0], p[1] - XA[i][1]) : Infinity)));
      const pureCount = i => { const r = 0.95 * otherDist(i); return XA.filter(p => Math.hypot(p[0] - XA[i][0], p[1] - XA[i][1]) <= r).length; };
      const mixed = XA.map((_, i) => i).filter(i => cur.share[i] > 0 && cur.share[i] < 1 && cur.hood[i].length >= 5);
      const several = mixed.filter(i => pureCount(i) >= 4);
      const focus = several.length ? several.sort((a, b) => Math.abs(cur.share[a] - 0.5) - Math.abs(cur.share[b] - 0.5))[0] : mixed.sort((a, b) => pureCount(b) - pureCount(a))[0];
      const c = XA[focus], zoom = step === 0;
      // The radius swings down to just inside the nearest point of the other cluster: there the neighborhood in focus is pure
      // (certain), and still holds several data points.
      const lo = 0.95 * otherDist(focus);
      const m = S.view(zoom ? [c[0] - 1.1, c[0] + 1.1, c[1] - 0.62, c[1] + 0.62] : BOUNDS_A, F, dur);
      const items = () => pointItems(XA, m, i => {
        if (zoom) return { ...hard(km.labels[i] !== left), r: 10 };
        if (step === 1) return { ...hard(km.labels[i] !== left), alpha: cur.lower[i] ? 1 : 0.2 };
        return cur.lower[i] ? { ...hard(km.labels[i] !== left), alpha: 0.35 } : boundaryStyle;
      });
      S.set(items(), { dur });
      // The circles follow the radius smoothly (rr, every frame); the sets of all points are recomputed at each 0.01 of it (rq).
      let rr = RADIUS;
      live(ctx, dur + 300, () => {
        const next = swing(lo, 0.45, 10, RADIUS);
        return () => { rr = next(); const q = Math.round(rr * 100) / 100; if (q !== rq) { rq = q; cur = at(q); if (!zoom) S.set(items(), { dur: 240, keep: true }); } };
      });
      S.over = (g, st) => {
        const mm = st.map, { hood, lower, nLower, nBoundary } = cur;
        if (zoom) {
          // The neighborhood in focus at the smooth radius: the circle and the points marked inside it always agree.
          const inside = XA.map((_, j) => j).filter(j => Math.hypot(XA[j][0] - c[0], XA[j][1] - c[1]) <= rr);
          const P = mm.map(c), n = inside.length, a = inside.filter(j => km.labels[j] === left).length;
          plate(g, 'One data point, up close', F.x + 4, F.y + 2);
          const members = born('rs:members', { delay: 700, dur: 400 });
          ring(g, ...P, rr * mm.k, { color: C.hl, lw: 4, dash: [12, 9], grow: born('rs:hood', { delay: 200, dur: 700 }) });
          for (const j of inside) ring(g, ...mm.map(XA[j]), 20, { color: C.hl, lw: 3, grow: members });
          // On one plate under the circle (the point sits in the middle of the figure; one plate still fits at the largest radius
          // of the swing, two did not). The caption says what it means: possibly in either.
          const pure = a === n || a === 0;
          plate(g, pure ? `$𝒩ᵢ$: all in cluster ${a === n ? 1 : 2}` : `$𝒩ᵢ$: ${a} in cluster 1, ${n - a} in cluster 2`, P[0], P[1] + rr * mm.k + 20, { color: C.hl, align: 'center' });
          // The verdict at the top right, as the radius swings: certain (in the cluster's color) or uncertain.
          plate(g, pure ? 'certain' : 'uncertain', F.x + F.w - 4, F.y + 2, { size: 40, align: 'right', color: pure ? (a === n ? C.blue : C.verm) : C.ink });
          return;
        }
        if (step === 1) {
          plate(g, `Lower approximations: ${nLower} certain data points`, F.x + 4, F.y + 2);
          // One certain point of each cluster, with its neighborhood inside the cluster.
          for (const side of [left, 1 - left]) {
            const i = XA.map((_, k) => k).filter(k => lower[k] && km.labels[k] === side && hood[k].length >= 4).sort((p, q) => A.sqd(XA[p], km.B[side]) - A.sqd(XA[q], km.B[side]))[0];
            if (i !== undefined) ring(g, ...mm.map(XA[i]), rr * mm.k, { color: C.hl, lw: 3, dash: [10, 8], grow: born('rs:certain', { delay: 300, dur: 600 }) });
          }
          return;
        }
        plate(g, `Boundary: ${nBoundary} data points with mixed neighborhoods`, F.x + 4, F.y + 2);
      };
    },
  };

  // ------------------------------------------------------------ distance and neighborhoods disagree
  const disagree = {
    id: 'disagree', steps: 2,
    narrowAspect: step => (step === 0 ? 0.75 : 1.4),
    show(ctx, step, { dur }) {
      const s = lrcmA(0.35), r = rscmA(RADIUS), left = leftOf(s.B), lr = leftOf(r.B), hood = hoodOf(RADIUS);
      const boundary = XA.map((_, i) => s.region[i] < 0), mis = XA.map((_, i) => boundary[i] && r.region[i] >= 0);
      const nb = boundary.filter(Boolean).length, nr = r.region.filter(v => v < 0).length;
      // The misjudged point with the most neighbors, up close.
      const focus = XA.map((_, i) => i).filter(i => mis[i]).sort((a, b) => hood[b].length - hood[a].length)[0];
      const c = XA[focus];
      if (step === 1) {
        // The two judgments side by side: by distance (rough c-means) and by neighborhoods (RSCM).
        M.hide();
        const F = ctx.field(), [a, b] = ctx.panels(F, 2, { gap: 90, top: 56 }), ma = fit(BOUNDS_A, a), mb = fit(BOUNDS_A, b);
        S.set([
          ...pointItems(XA, ma, i => ({ ...regionStyle(s, left)(i), r: boundary[i] ? 7 : 5, alpha: boundary[i] ? 1 : 0.35 })),
          ...protoItems(s.B, ma, { r: 15 }),
          ...pointItems(XA, mb, i => ({ ...regionStyle(r, lr)(i), r: r.region[i] < 0 ? 7 : 5, alpha: r.region[i] < 0 || mis[i] ? 1 : 0.35 }), 'q'),
          ...protoItems(r.B, mb, { prefix: 'qb', r: 15 }),
        ], { dur: Math.max(dur, 900) });
        S.over = g => {
          plate(g, `By distance (RCM): ${nb} undecided`, a.x, a.y - 56);
          plate(g, `By neighborhoods (RSCM): ${nr} undecided`, b.x, b.y - 56);
          const grow = born('dg:mis', { delay: 900, dur: 400 });
          XA.forEach((p, i) => { if (mis[i]) { ring(g, ...ma.map(p), 14, { color: C.hl, lw: 3.2, grow }); ring(g, ...mb.map(p), 14, { color: C.hl, lw: 3.2, grow }); } });
          if (!ctx.narrow()) text(g, 'vs', (a.x + a.w + b.x) / 2, a.y + a.h / 2 + 14, { size: 40, weight: 780, align: 'center', color: C.muted, halo: false });
        };
        return;
      }
      const F = ctx.field({ eq: true, meter: true });
      const m = S.view([c[0] - 0.95, c[0] + 0.95, c[1] - 0.62, c[1] + 0.62], F, dur);
      S.set([...pointItems(XA, m, i => ({ ...regionStyle(s, left)(i), r: 11 })), ...protoItems(s.B, m)], { dur });
      M.show({ name: 'RCM, β = 0.35', rule: 'Rule-based updates' });
      S.over = (g, st) => {
        const mm = st.map, P = mm.map(c), n = hood[focus].length;
        plate(g, 'One boundary data point and its neighborhood, up close', F.x + 4, F.y + 2);
        const members = born('dg:members', { delay: 700, dur: 400 });
        ring(g, ...P, RADIUS * mm.k, { lw: 3.4, dash: [12, 9], grow: born('dg:hood', { delay: 200, dur: 700 }) });
        for (const j of hood[focus]) if (j !== focus) ring(g, ...mm.map(XA[j]), 20, { color: C.hl, lw: 3.4, grow: members });
        ring(g, ...P, 22, { lw: 3.6, grow: born('dg:point', { dur: 300 }) });
        text(g, 'boundary by distance', P[0] + 34, P[1] - RADIUS * mm.k - 18, { size: 32, weight: 700 });
        // Centered under the circle, kept inside the figure.
        const cx = Math.max(F.x + 450, Math.min(F.x + F.w - 450, P[0]));
        text(g, `its ${n} neighbors (itself included): all in cluster ${r.labels[focus] === left ? 1 : 2}`, cx, P[1] + RADIUS * mm.k + 52, { size: 32, weight: 700, color: C.hl, align: 'center' });
      };
    },
  };

  // ------------------------------------------------------------ rough membership, read term by term
  let grR = null, grHover = -1, grTerm = new Set();
  const granule = {
    id: 'granule', steps: 4, usesTerms: true,
    setup(ctx) { grR = slider('gr-radius', () => ctx.rerender()); },
    show(ctx, step, { dur }) {
      M.hide();
      const zoom = step < 3, F = ctx.field({ eq: zoom ? 'tall' : true }), km = kmeansA(), left = leftOf(km.B);
      // The radius swings slowly (from the slider's value): the neighborhood, its counts and the degrees follow.
      let r = grR(), hood = hoodOf(r), mu = A.roughMembership(hood, km.labels, 2);
      // The point in focus: in cluster 1, mixed at the starting radius (at least 4 neighbors), and with at least 3 points of
      // cluster 1 (itself included) nearer than 3/4 of its distance to cluster 2 (the most balanced such point): a smaller radius
      // then brings μ₁ up to 1 with several neighbors, not with the point alone.
      const dist = (i, j) => Math.hypot(XA[j][0] - XA[i][0], XA[j][1] - XA[i][1]);
      const toTwo = i => Math.min(...XA.map((_, j) => (km.labels[j] !== left ? dist(i, j) : Infinity)));
      const ones = XA.map((_, i) => i).filter(i => km.labels[i] === left && mu[i * 2 + left] > 0 && mu[i * 2 + left] < 1 && hood[i].length >= 4);
      const far = ones.filter(i => XA.filter((_, j) => km.labels[j] === left && dist(i, j) <= 0.75 * toTwo(i)).length >= 3);
      const probe = far.length ? far.sort((a, b) => Math.abs(mu[a * 2 + left] - 0.5) - Math.abs(mu[b * 2 + left] - 0.5))[0] : mixedPoint(mu, left, hood, 4);
      const c = XA[probe], lo = Math.min(0.2, 0.75 * toTwo(probe));
      const m = S.view(zoom ? [c[0] - 1.1, c[0] + 1.1, c[1] - 0.62, c[1] + 0.62] : BOUNDS_A, F, dur);
      // Step 3: two panels side by side, μ = 1 on the left and 0 < μ₁ < 1 on the right; each case's equation over its panel.
      const [pa, pb] = ctx.panels({ x: F.x, y: F.y + 64, w: F.w, h: F.h - 64 - 10 }, 2, { gap: 90, top: 0 }), ma = fit(BOUNDS_A, pa), mb = fit(BOUNDS_A, pb);
      if (!zoom) for (const el of ctx.el('copy').querySelector('[data-id="granule"]').querySelectorAll('.rule-eq')) { const rr0 = [pa, pb][Number(el.dataset.k)]; el.style.left = `${rr0.x / 20}rem`; el.style.width = `${rr0.w / 20}rem`; }
      // Up close: the clusters' colors. Side by side: the certain points (μ = 1 for their cluster) lit on the left, the boundary
      // (0 < μ₁ < 1, colored by μ₁) lit on the right.
      const sure = i => mu[i * 2 + left] === 0 || mu[i * 2 + left] === 1;
      const items = () => (zoom
        ? [...pointItems(XA, m, i => ({ ...hard(km.labels[i] !== left), r: 10 })), ...protoItems(km.B, m, { fill: C.gray })]
        : [...pointItems(XA, ma, i => (sure(i) ? hard(km.labels[i] !== left) : { ...boundaryStyle, alpha: 0.25 }), 'pa'),
          ...pointItems(XA, mb, i => (sure(i) ? { ...hard(km.labels[i] !== left), alpha: 0.2 } : { fill: diverging(mu[i * 2 + left]), shape: 'diamond', r: 7.5 }), 'pb'),
          ...protoItems(km.B, ma, { prefix: 'ba', fill: C.gray }), ...protoItems(km.B, mb, { prefix: 'bb', fill: C.gray })]);
      S.set(items(), { dur });
      ctx.highlight(step === 0 ? ['N'] : step === 1 ? ['X'] : []);
      let mixed = XA.filter((_, i) => mu[i * 2 + left] > 0 && mu[i * 2 + left] < 1).length;
      // The circle follows the radius smoothly (rr, every frame); the degrees of all points are recomputed at each 0.01 of it (r).
      let rr = r;
      live(ctx, dur + 300, () => {
        const next = swing(lo, 0.45, 10, r);
        return () => {
          rr = next();
          const q = Math.round(rr * 100) / 100;
          if (q === r) return;
          r = q; hood = hoodOf(q); mu = A.roughMembership(hood, km.labels, 2);
          mixed = XA.filter((_, i) => mu[i * 2 + left] > 0 && mu[i * 2 + left] < 1).length;
          if (!zoom) S.set(items(), { dur: 240, keep: true });
        };
      });
      S.over = (g, st) => {
        const mm = st.map, i = grHover >= 0 ? grHover : zoom ? probe : -1;
        if (zoom) plate(g, 'One data point, up close', F.x + 4, F.y + 2);
        else {
          plate(g, `Certain: ${XA.length - mixed} data points`, pa.x, pa.y - 6);
          plate(g, `Boundary: ${mixed} data points`, pb.x, pb.y - 6);
          g.save(); g.globalAlpha *= born('gr:legend', { delay: 300 }); membershipLegend(g, pb.x + pb.w - 380, pb.y + pb.h - 40, 380, 'rough membership $μ₁$'); g.restore();
          return;
        }
        if (i < 0) return;
        // The neighborhood at the smooth radius: the circle and the points counted inside it always agree.
        const inside = XA.map((_, j) => j).filter(j => Math.hypot(XA[j][0] - XA[i][0], XA[j][1] - XA[i][1]) <= rr);
        const P = mm.map(XA[i]), a = inside.filter(j => km.labels[j] === left).length, n = inside.length;
        ring(g, ...P, rr * mm.k, { color: step === 0 ? C.hl : C.ink, lw: step === 0 ? 4 : 3, dash: [12, 9], grow: born('gr:hood' + i, { delay: 150, dur: 600 }) });
        ring(g, ...P, zoom ? 22 : 14, { lw: 3.4, grow: born('gr:point' + i, { dur: 300 }) });
        if (step === 0) text(g, `$𝒩ᵢ$: ${n} data points`, P[0] + rr * mm.k + 16, P[1] - 10, { size: 34, weight: 700, color: C.hl });
        if (step === 1) for (const j of inside) {
          const Q = mm.map(XA[j]), one = km.labels[j] === left;
          ring(g, ...Q, 20, { color: C.hl, lw: 3, grow: born('gr:members' + i, { delay: 300 }) });
          text(g, one ? '1' : '2', Q[0], Q[1] - 26, { size: 30, weight: 760, color: one ? C.blue : C.verm, align: 'center' });
        }
        // The degree as a large fraction at the figure's top right, clear of the circle at every radius of the swing: the
        // neighbors in cluster 1 (in its color) over all the neighbors.
        if (step === 2) fractionPlate(g, '$μ₁$ =', a, n, F.x + F.w - 4, F.y + 2, { tail: a === n ? '= 1' : '', numColor: C.blue });
        if (step === 2) text(g, a === n ? `all ${n} of its neighbors are in cluster 1` : `${a} of its ${n} neighbors are in cluster 1`, P[0], P[1] + rr * mm.k + 60, { size: 34, weight: 760, align: 'center' });
      };
      S.handlers.move = hoverPoint(k => { if (k !== grHover) { grHover = k; S.wake(); } });
      S.handlers.leave = () => { grHover = -1; S.wake(); };
    },
    term(ctx, name, on) { if (on) grTerm.add(name); else grTerm.delete(name); },
    leave() { grHover = -1; grTerm.clear(); },
  };

  // ------------------------------------------------------------ from rules to one objective
  let obR = null, obTerm = new Set(), lcHover = -1;
  const objective = {
    id: 'objective', steps: 3, usesTerms: true,
    narrowAspect: step => (step === 0 ? 1.3 : 0.75),
    setup(ctx) { obR = slider('ob-radius', () => ctx.rerender()); onClick('ob-run', () => objective.replay?.()); },
    show(ctx, step, { dur, forward, from, fromStep }) {
      // The supplement (rscm) shows step 0 without this scene's setup, so possibly before its slider exists: the data's radius.
      const F = ctx.field({ eq: 'tall', meter: true }), r = obR ? obR() : RADIUS, hood = hoodOf(r);
      // Between the two rule-based methods (step 0) and RMCM2 (the rest), one result gives way to another: no point travels.
      const fresh = from === 'objective' && (step === 0) !== (fromStep === 0);
      if (step === 0) {
        // The two rule-based uses side by side: regions (RSCM) and weights (RMCM).
        const rects = ctx.panels(F, 2, { gap: 30, top: 50 });
        const ms = rects.map(rc => fit(BOUNDS_A, rc)), a = rscmA(r), b = rmcmA(r), la = leftOf(a.B), lb = leftOf(b.B);
        S.view(BOUNDS_A, rects[1], dur);
        S.set([
          ...XA.map((p, i) => { const [x, y] = ms[0].map(p); return { id: 'q' + i, x, y, r: 5.5, ...regionStyle(a, la)(i), ...(a.region[i] < 0 ? { r: 5 } : {}) }; }),
          ...pointItems(XA, ms[1], i => ({ ...muStyle(b.mu, lb)(i), r: 5.5 })),
          ...protoItems(a.B, ms[0], { prefix: 'qb', r: 15 }), ...protoItems(b.B, ms[1], { r: 15 }),
        ], { dur, fresh });
        M.hide();
        S.over = g => { plate(g, 'RSCM: lower and upper regions', rects[0].x, rects[0].y - 50); plate(g, 'RMCM: membership as weights', rects[1].x, rects[1].y - 50); };
        return;
      }
      // The label update (step 2) closer: between the two prototypes, both in view, with point j (the most mixed) among them.
      const fin = rmcm2A(r), probe = mixedPoint(fin.mu, leftOf(fin.B), hood), [p1, p2] = fin.B;
      const cx = (p1[0] + p2[0]) / 2, cy = (p1[1] + p2[1]) / 2, hw = Math.abs(p1[0] - p2[0]) / 2 + 0.6;
      const m = S.view(step === 2 ? [cx - hw, cx + hw, cy - 0.75, cy + 0.75] : BOUNDS_A, F, dur);
      let state = fin;
      // No meter of J: the curve says little (J barely changes after the first iterations); the caption says J never increases.
      M.hide();
      const draw = (s, d, fresh = false) => {
        state = s;
        S.set([...pointItems(XA, m, muStyle(s.mu, leftOf(s.B))), ...protoItems(s.B, m)], { dur: d, fresh });
      };
      // The radius stays at the slider's value, and with it the prototypes: a size that changed while the prototypes moved
      // would mix two effects. The update step shows the run once.
      objective.replay = () => ctx.play(A.rmcm2(XA, START, hood), s => draw(s, 450), { delay: 750 });
      if (step === 2 && forward) objective.replay(); else draw(fin, dur, fresh);
      ctx.highlight(step === 1 ? ['mu'] : step === 2 ? ['P'] : []);
      if (step === 1) {
        // The errors of J, each weighted by μ: a line from every point to each prototype, as strong as its μ. A point between
        // the clusters sends its error to both; the others, to one. The radius δ swings slowly (the labels and the prototypes
        // stay): μ, and with it the lines and the colors, follow; the larger δ, the more points are shared.
        // One point shows where its μ comes from: its neighborhood, dashed at the smooth radius rr, its errors drawn strong,
        // each as wide as the share of its neighbors in that cluster, and the counts under the circle. The point: pure with at
        // least 3 neighbors at the swing's smallest δ, mixed at its largest (the most balanced at the slider's δ), so that the
        // swing takes it from one cluster to both.
        const lo = Math.max(0.15, r - 0.12), hi = r + 0.15, l0 = leftOf(state.B), hoodLo = hoodOf(lo);
        const muLo = A.roughMembership(hoodLo, state.labels, 2), muHi = A.roughMembership(hoodOf(hi), state.labels, 2);
        const turns = XA.map((_, i) => i).filter(i => hoodLo[i].length >= 3 && muLo[i * 2] % 1 === 0 && muHi[i * 2] % 1 !== 0)
          .sort((a, b) => Math.abs(fin.mu[a * 2 + l0] - 0.5) - Math.abs(fin.mu[b * 2 + l0] - 0.5));
        const focus = turns.length ? turns[0] : probe;
        let dl = r, rr = r, mu = state.mu;
        live(ctx, dur + 300, () => {
          const next = swing(lo, hi, 10, r);
          return () => {
            rr = next();
            const q = Math.round(rr * 100) / 100;
            if (q === dl) return;
            dl = q; mu = A.roughMembership(hoodOf(q), state.labels, 2);
            S.set(pointItems(XA, m, muStyle(mu, leftOf(state.B))), { dur: 240, keep: true });
          };
        });
        // The focus point's neighbors at the smooth radius: the circle, the strong lines and the counts always agree.
        const near = () => XA.map((_, j) => j).filter(j => Math.hypot(XA[j][0] - XA[focus][0], XA[j][1] - XA[focus][1]) <= rr);
        S.under = (g, st) => {
          const mm = st.map, l = leftOf(state.B), grow = born('ob:errors', { delay: 300, dur: 700 });
          state.B.forEach((b, c) => {
            const Bc = mm.map(b);
            XA.forEach((p, i) => { const v = mu[i * 2 + c]; if (v > 0) line(g, mm.map(p), Bc, { color: c === l ? C.blue : C.verm, lw: 1.6, alpha: 0.45 * v, grow }); });
          });
        };
        S.over = (g, st) => {
          plate(g, `Errors in $J$, weighted by $μ$ ($δ$ = ${dl.toFixed(2)})`, F.x + 4, F.y + 2);
          const mm = st.map, l = leftOf(state.B), P = mm.map(XA[focus]), inside = near(), n = inside.length, R0 = rr * mm.k;
          const a = inside.filter(j => state.labels[j] === l).length, show = born('ob:nb', { delay: 800, dur: 600 });
          // Its errors over the points, each stopping short of its prototype's star.
          const reach = born('ob:nblines', { delay: 1000, dur: 600 });
          state.B.forEach((b, c) => {
            const v = (c === l ? a : n - a) / n, Bc = mm.map(b), d = Math.hypot(Bc[0] - P[0], Bc[1] - P[1]);
            const end = [Bc[0] - (Bc[0] - P[0]) * 18 / d, Bc[1] - (Bc[1] - P[1]) * 18 / d];
            if (v > 0) line(g, P, end, { color: c === l ? C.blue : C.verm, lw: 2.5 + 5 * v, grow: reach });
          });
          ring(g, ...P, R0, { color: C.hl, lw: 3, dash: [12, 9], grow: show });
          ring(g, ...P, 14, { lw: 3.4, grow: born('ob:nbpoint', { delay: 800, dur: 300 }) });
          // Under the circle (over it when the figure ends first), kept inside the figure.
          const s = a === n || a === 0 ? `$𝒩ᵢ$: all ${n} in cluster ${a ? 1 : 2}` : `$𝒩ᵢ$: ${a} in cluster 1, ${n - a} in cluster 2`;
          const w = labelWidth(g, s, 32) + 28, h = labelSize(32) * 1.5, x = Math.max(F.x + w / 2, Math.min(F.x + F.w - w / 2, P[0]));
          const y = P[1] + R0 + 16 + h <= F.y + F.h ? P[1] + R0 + 16 : P[1] - R0 - 16 - h;
          g.save(); g.globalAlpha *= show; plate(g, s, x, y, { size: 32, align: 'center' }); g.restore();
        };
        return;
      }
      // The update of the labels, for one point j: the points whose neighborhoods contain j (those within the radius of j,
      // inside the dashed circle), their errors to the prototype with the smaller q, and both costs. Points j take turns
      // (the most mixed first, then shared points along the boundary, in view); the one under the pointer instead. During a
      // run, the costs follow the prototypes.
      const shared = XA.map((_, i) => i).filter(i => fin.mu[i * 2] > 0 && fin.mu[i * 2] < 1 && Math.abs(XA[i][1] - cy) < 0.55).sort((a, b) => XA[a][1] - XA[b][1]);
      const turns = [probe, ...[0.15, 0.5, 0.85].map(u => shared[Math.round(u * (shared.length - 1))]).filter(i => i !== undefined && i !== probe)];
      let Q = null, Qof = null;
      S.over = (g, st) => {
        if (Qof !== state) { Q = A.labelCosts(XA, state.B, hood); Qof = state; }
        const mm = st.map, l = leftOf(state.B), j = lcHover >= 0 ? lcHover : cycle(turns, 3.5), P = mm.map(XA[j]);
        const q1 = Q[j * 2 + l], q2 = Q[j * 2 + 1 - l], c = q1 <= q2 ? l : 1 - l, B = mm.map(state.B[c]), col = c === l ? C.blue : C.verm;
        const reach = born('ob:lines' + j, { delay: 300, dur: 600 });
        ring(g, ...P, r * mm.k, { lw: 2.6, dash: [10, 8], grow: born('ob:hood' + j, { dur: 500 }) });
        for (const i of hood[j]) {
          line(g, mm.map(XA[i]), B, { color: col, lw: 2.4, alpha: 0.75, grow: reach });
          if (obTerm.has('P')) text(g, `1/${hood[i].length}`, mm.map(XA[i])[0], mm.map(XA[i])[1] - 18, { size: 28, weight: 700, color: C.hl, align: 'center' });
        }
        ring(g, ...P, 16, { lw: 3.6, grow: born('ob:point' + j, { dur: 300 }) });
        text(g, '$j$', P[0] + 18, P[1] + 8, { size: 36, weight: 700 });
        plate(g, 'Dashed: the data points with $j$ in their neighborhoods', F.x + 4, F.y + 2);
        // Both costs and the label on one plate, at the bottom left (clear of the prototypes and the lines).
        plate(g, `$q₁ⱼ$ = ${f2(q1)} ${q1 <= q2 ? '<' : '>'} $q₂ⱼ$ = ${f2(q2)}: $j$ to cluster ${c === l ? 1 : 2}`, F.x + 4, F.y + F.h - 58, { size: 32, color: col });
      };
      S.handlers.move = hoverPoint(k => { if (k !== lcHover) { lcHover = k; S.wake(); } });
      S.handlers.leave = () => { lcHover = -1; S.wake(); };
    },
    term(ctx, name, on) { if (on) obTerm.add(name); else obTerm.delete(name); },
    leave() { obTerm.clear(); lcHover = -1; },
  };

  // ------------------------------------------------------------ recommendation: a toy example with ratings
  // 7 users rate 6 contents (0: not rated). Rough c-means (Lingras's rule, slack 1 to 2) on these rows gives exactly the
  // two overlapping clusters below: x1-x3 in cluster 1, x5-x7 in cluster 2, x4 in both.
  const RATINGS = [
    [5, 4, 0, 2, 0, 0],
    [4, 0, 5, 0, 2, 0],
    [0, 4, 5, 0, 0, 2],
    [5, 0, 0, 0, 4, 0],
    [1, 0, 0, 4, 5, 0],
    [0, 2, 0, 4, 0, 5],
    [0, 0, 2, 0, 5, 5],
  ];
  const CF_CLUSTERS = [[0, 1, 2, 3], [3, 4, 5, 6]], ITEMS = ['A', 'B', 'C', 'D', 'E', 'F'];
  // A cluster's prototype: each content's mean rating over its users (not rated counts as 0), its popularity there.
  const CF_PROTO = CF_CLUSTERS.map(us => ITEMS.map((_, j) => us.reduce((a, i) => a + RATINGS[i][j], 0) / us.length));
  /** From each cluster the user belongs to: the content most popular there that the user has not rated. */
  const cfPicks = i => CF_CLUSTERS.flatMap((us, c) => {
    if (!us.includes(i)) return [];
    let best = -1;
    RATINGS[i].forEach((r, j) => { if (!r && (best < 0 || CF_PROTO[c][j] > CF_PROTO[c][best])) best = j; });
    return [{ c, j: best }];
  });
  const cfex = {
    id: 'cfex', steps: 3,
    show(ctx, step, { dur }) {
      M.hide();
      S.set([], { dur });
      const F = ctx.field();
      // Two tables side by side: the ratings as they come (left), and after clustering (right): the same rows with the
      // cluster bars (x4 under both) and the two prototypes under them. Room left of the right table for the bars.
      // Rows as tall as the last step allows (its benefit box under the caption), the same in every step: the tables stay put.
      const cw = 80, rh = 35, labW = 70, gap = 10, TW = labW + 6 * cw, barW = 210;
      const xL = F.x + 10, xR = xL + TW + 70 + barW, y0 = F.y + 50;
      const colX = (x0, j) => x0 + labW + j * cw, rowY = i => y0 + rh * (1 + i), protoY = c => y0 + rh * 8 + gap + c * rh;
      const cell = (g, x, y, fill, edge) => { g.fillStyle = fill; g.strokeStyle = edge; g.lineWidth = 1.5; g.beginPath(); g.roundRect(x + 3, y + 3, cw - 6, rh - 6, 6); g.fill(); g.stroke(); };
      const rgb = c => `rgb(${c.map(Math.round)})`;
      // In step 2, one user in focus at a time on the right table (the others fade there): one of cluster 1, one of
      // cluster 2, then x4, which belongs to both. The left table stays the raw data.
      const ratings = (g, x0, focus) => {
        ITEMS.forEach((s, j) => text(g, s, colX(x0, j) + cw / 2, y0 + rh - 10, { size: 28, weight: 760, align: 'center', color: C.title, halo: false }));
        RATINGS.forEach((row, i) => {
          g.save(); g.globalAlpha *= focus >= 0 && i !== focus ? 0.3 : 1;
          symbol(g, 'x', String(i + 1), x0 + labW - 14, rowY(i) + rh / 2 + 6, { size: 32, color: C.title, align: 'right' });
          row.forEach((r, j) => {
            cell(g, colX(x0, j), rowY(i), r ? rgb(mixRGB('#FFFFFF', '#5E6B7D', 0.12 + 0.14 * (r - 1))) : '#FFFFFF', r ? 'rgba(0,0,0,0)' : C.line);
            text(g, r ? String(r) : '–', colX(x0, j) + cw / 2, rowY(i) + rh / 2 + 9, { size: 28, weight: 700, align: 'center', color: r >= 4 ? '#FFFFFF' : r ? C.ink : C.muted, halo: false });
          });
          g.restore();
        });
        if (focus >= 0) { g.save(); g.strokeStyle = C.hl; g.lineWidth = 3; g.beginPath(); g.roundRect(x0 + 4, rowY(focus) + 1, labW + 6 * cw - 6, rh - 2, 8); g.stroke(); g.restore(); }
      };
      S.over = g => {
        const focus = step === 2 ? cycle([1, 5, 3], 4) : -1, picks = focus >= 0 ? cfPicks(focus) : [];
        const inFocus = c => focus < 0 || CF_CLUSTERS[c].includes(focus);
        newExample(g, 'ratings: 7 users × 6 items', F);
        ratings(g, xL, -1);
        if (step === 0) {
          // After clustering: still to come.
          const x = xR - barW + 40, w = TW + barW - 40, h = protoY(1) + rh - y0;
          g.save(); g.setLineDash([10, 8]); g.strokeStyle = C.line; g.lineWidth = 2; g.strokeRect(x, y0, w, h); g.restore();
          text(g, '?', x + w / 2, y0 + h / 2 + 18, { size: 52, weight: 780, color: C.line, align: 'center', halo: false });
          return;
        }
        plate(g, 'After clustering, $C = 2$', xR - barW + 40, F.y + 2);
        ratings(g, xR, focus);
        // Cluster bars beside the users (x4 under both), and the two prototypes under the ratings.
        const bars = born('cfx:bars', { dur: 600 }), protos = born('cfx:protos', { delay: 350, dur: 600 });
        CF_CLUSTERS.forEach((us, c) => {
          g.save(); g.globalAlpha *= (inFocus(c) ? 1 : 0.3) * bars;
          const top = rowY(us[0]) + 5, bottom = rowY(us.at(-1)) + rh - 5, bx = xR - 50 + c * 22;
          g.fillStyle = CLUSTER[c]; g.beginPath(); g.roundRect(bx, top, 14, bottom - top, 7); g.fill();
          text(g, `cluster ${c + 1}`, xR - 64, (top + bottom) / 2 + 10, { size: 28, weight: 760, align: 'right', color: CLUSTER[c], halo: false });
          g.restore();
          g.save(); g.globalAlpha *= (inFocus(c) ? 1 : 0.3) * protos;
          symbol(g, 'b', String(c + 1), xR + labW - 14, protoY(c) + rh / 2 + 6, { size: 32, color: CLUSTER[c], align: 'right' });
          CF_PROTO[c].forEach((v, j) => {
            cell(g, colX(xR, j), protoY(c), rgb(mixRGB('#FFFFFF', CLUSTER[c], 0.08 + 0.13 * v)), 'rgba(0,0,0,0)');
            text(g, v.toFixed(1), colX(xR, j) + cw / 2, protoY(c) + rh / 2 + 9, { size: 28, weight: 700, align: 'center', color: C.ink, halo: false });
          });
          g.restore();
        });
        if (focus < 0) return;
        // From each of the user's clusters, its most popular item the user has not rated: up the column of the right table
        // (right of the numbers, so that it crosses no value), and ringed in the user's row.
        picks.forEach(({ c, j }, k) => {
          const grow = born(`cfx:pick${focus}:${c}`, { delay: 150 * k, dur: 600 });
          ring(g, colX(xR, j) + cw / 2, protoY(c) + rh / 2, 24, { color: CLUSTER[c], lw: 3.4, grow });
          arrow(g, [colX(xR, j) + cw - 14, protoY(c) + 6], [colX(xR, j) + cw - 14, rowY(focus) + rh - 4], { color: CLUSTER[c], lw: 4, head: 14, grow });
          ring(g, colX(xR, j) + cw / 2, rowY(focus) + rh / 2, 24, { color: CLUSTER[c], lw: 3.4, grow });
        });
      };
    },
  };

  // ------------------------------------------------------------ a glimpse of graphs: overlapping clusters glue into a graph
  // A concept on a new example: 240 points on a ring (seeded), ExRCM with p = 1 and α = 1 (Lingras's rule) and 8 prototypes
  // started evenly on it,
  // run to convergence at the slack β = 0.15. Only neighboring clusters overlap (3 to 13 shared points each, for β from
  // 0.11 to 0.24), so the graph among the prototypes is a loop, like the ring.
  const ringData = memo(() => {
    let a = 7;
    const rand = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
    const X = Array.from({ length: 240 }, () => { const t = 2 * Math.PI * rand(), r = 1 + 0.07 * gauss(); return [r * Math.cos(t), r * Math.sin(t)]; });
    const B0 = Array.from({ length: 8 }, (_, c) => { const t = 2 * Math.PI * (c + 0.5) / 8; return [Math.cos(t), Math.sin(t)]; });
    return { X, B: run(A.roughCMeans(X, B0, { beta: 0.15 })).B };
  });
  /** For the slack β: each point's clusters (its upper approximations), and each overlapping pair with its shared points. */
  const ringRegions = memo(beta => {
    const { X, B } = ringData(), K = B.length, { upper } = A.roughRegions(X, B, 1, beta, 1), pairs = new Map();
    const of = X.map((_, i) => { const cs = []; for (let c = 0; c < K; c++) if (upper[i * K + c]) cs.push(c); return cs; });
    of.forEach((cs, i) => { for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) { const k = `${cs[a]}-${cs[b]}`; if (!pairs.has(k)) pairs.set(k, []); pairs.get(k).push(i); } });
    return { of, pairs };
  });
  /** The convex hull of points (monotone chain), for a cluster drawn as a piece. */
  const hull = P => {
    const p = [...P].sort((u, v) => u[0] - v[0] || u[1] - v[1]), cross2 = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
    const lo = [], hi = [];
    for (const q of p) { while (lo.length > 1 && cross2(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
    for (const q of p.reverse()) { while (hi.length > 1 && cross2(hi.at(-2), hi.at(-1), q) <= 0) hi.pop(); hi.push(q); }
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  };
  const RING_WORLD = [-1.24, 1.24, -1.24, 1.24];
  const graph = {
    id: 'graph', steps: 1,
    show(ctx, step, { dur }) {
      M.hide();
      const F = ctx.field(), { X, B } = ringData(), K = B.length;
      // Three panels side by side: the clusters, the pieces glued at their overlaps, and the graph.
      const rects = ctx.panels({ x: F.x, y: F.y + 110, w: F.w, h: F.h - 116 }, 3, { gap: 70, top: 0 }), ms = rects.map(r => fit(RING_WORLD, r));
      let bq = 0.15, cur = ringRegions(bq);
      // Neighboring clusters alternate blue and vermilion; a point in two clusters is a white diamond.
      const style = (k, alpha) => i => (cur.of[i].length > 1 ? { ...boundaryStyle, r: 6, alpha: k === 0 ? 1 : 0.9 } : { ...hard(cur.of[i][0] % 2 === 1), r: 5, alpha });
      const items = () => [
        ...pointItems(X, ms[0], style(0, 1), 'g0'), ...protoItems(B, ms[0], { prefix: 'gb0', r: 15 }),
        ...pointItems(X, ms[1], style(1, 0.35), 'g1'), ...protoItems(B, ms[1], { prefix: 'gb1', r: 15 }),
        ...pointItems(X, ms[2], i => ({ fill: C.mid, shape: 'circle', r: 4, alpha: 0.25 }), 'g2'), ...protoItems(B, ms[2], { prefix: 'gb2', r: 19 }),
      ];
      S.set(items(), { dur });
      // The slack swings slowly: the overlaps grow and shrink, and the graph keeps its loop.
      live(ctx, dur + 300, () => {
        const sb = swing(0.12, 0.21, 10, 0.15);
        return () => { const q = Math.round(sb() * 100) / 100; if (q !== bq) { bq = q; cur = ringRegions(q); S.set(items(), { dur: 240, keep: true }); } };
      });
      S.under = g => {
        // Middle: each cluster (its upper approximation) as a piece; neighboring pieces overlap where they share points.
        const grow = born('gr:pieces', { delay: 300, dur: 800 });
        g.save(); g.globalAlpha *= grow;
        for (let c = 0; c < K; c++) {
          const pts = X.filter((_, i) => cur.of[i].includes(c)).map(p => ms[1].map(p));
          if (pts.length < 3) continue;
          const h = hull(pts), col = CLUSTER[c % 2];
          g.beginPath(); h.forEach((q, j) => (j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
          g.fillStyle = css(mixRGB('#FFFFFF', col, 0.3), 0.55); g.fill();
          g.strokeStyle = col; g.lineWidth = 2.4; g.stroke();
        }
        g.restore();
        // Right: one edge for each pair of clusters that overlap, as thick as the points they share.
        for (const [k, shared] of cur.pairs) {
          const [a, b] = k.split('-').map(Number);
          line(g, ms[2].map(B[a]), ms[2].map(B[b]), { color: C.hl, lw: 3 + 0.9 * Math.min(shared.length, 12), grow: born('gr:edge' + k, { delay: 500, dur: 700 }) });
        }
      };
      S.over = g => {
        newExample(g, '240 data points on a ring, ExRCM with 8 prototypes', F);
        const titles = ['Overlapping clusters (ExRCM)', 'Shared data points glue the pieces', 'A graph among prototypes'];
        rects.forEach((r, k) => {
          plate(g, titles[k], r.x + r.w / 2, r.y - 52, { align: 'center', color: k === 2 ? C.hl : C.title });
          if (k < 2 && !ctx.narrow()) arrow(g, [r.x + r.w + 12, r.y + r.h / 2], [r.x + r.w + 58, r.y + r.h / 2], { color: C.gray, lw: 3.4, head: 14, grow: born('gr:arrow' + k, { delay: 200 }) });
        });
        const c2 = ms[2].map([0, 0]);
        text(g, 'a loop', c2[0], c2[1] + 12, { size: 34, weight: 760, color: C.hl, align: 'center', halo: false });
      };
    },
  };

  /** A label beside a circle, on the side that keeps it inside the figure F. */
  const sideLabel = (g, F, label, P, r, side, { verdict, verdictColor, ...opts } = {}) => {
    const w = Math.max(labelWidth(g, label, 30), verdict ? labelWidth(g, verdict, 30) : 0) + 28;
    const fitsRight = P[0] + r + 10 + w <= F.x + F.w, fitsLeft = P[0] - r - 10 - w >= F.x;
    // The label, and under it the verdict if there is one.
    const put = (x, y, align) => {
      plate(g, label, x, y, { ...opts, align });
      if (verdict) plate(g, verdict, x, y + 55, { ...opts, color: verdictColor ?? opts.color, align });
    };
    // Neither side has room: under the circle, kept inside the figure.
    if (!fitsLeft && !fitsRight) { put(Math.min(Math.max(P[0], F.x + w / 2), F.x + F.w - w / 2), P[1] + r + 12, 'center'); return; }
    // Above or below the circle, centered on it and kept inside the figure.
    if (side === 'above' || side === 'below') {
      const h = verdict ? 105 : 50, x = Math.min(Math.max(P[0], F.x + w / 2), F.x + F.w - w / 2);
      put(x, side === 'above' ? P[1] - r - 10 - h : P[1] + r + 10, 'center');
      return;
    }
    if (side === 'left' && !fitsRight) side = 'right';
    if (side === 'right' && !fitsLeft) side = 'left';
    put(side === 'right' ? P[0] - r - 10 : P[0] + r + 10, P[1] - (verdict ? 52 : 25), side);
  };
  /** Each point's share of cluster 1 (the left one of k-means) among its neighbors. */
  const kmShare = () => {
    const km = kmeansA(), left = leftOf(km.B), hood = hoodOf(RADIUS);
    return { km, left, hood, share: hood.map(list => list.filter(j => km.labels[j] === left).length / list.length) };
  };

  // Before rough sets: neighbors tell us about a point; some neighborhoods are pure, some mixed.
  const roughsetMotive = (ctx, { dur }) => {
    M.hide();
    const F = ctx.field({ eq: true }), { km, left, hood, share } = kmShare(), m = S.view(BOUNDS_A, F, dur);
    S.set(pointItems(XA, m, i => hard(km.labels[i] !== left)), { dur });
    const ids = XA.map((_, i) => i).filter(i => hood[i].length >= 5);
    const nearest = (list, c) => [...list].sort((a, b) => A.sqd(XA[a], km.B[c]) - A.sqd(XA[b], km.B[c]))[0];
    const shown = [
      [nearest(ids.filter(i => share[i] === 1), left), 'all in cluster 1', 'certain', C.blue, 'right'],
      [nearest(ids.filter(i => share[i] === 0), 1 - left), 'all in cluster 2', 'certain', C.verm, 'above'],
      [mixedPoint(A.roughMembership(hood, km.labels, 2), left, hood), 'mixed', 'uncertain', C.ink, 'below'],
    ];
    S.over = (g, st) => {
      const mm = st.map;
      for (const [i, label, verdict, color, side] of shown) {
        const P = mm.map(XA[i]), r = RADIUS * mm.k;
        ring(g, ...P, r, { color: C.hl, lw: 3.4, dash: [10, 8], grow: born('rsm:hoods', { delay: 300, dur: 700 }) });
        sideLabel(g, F, label, P, r, side, { color: C.hl, verdict, verdictColor: color });
      }
      plate(g, 'Neighborhoods of three data points', F.x + 4, F.y + 2);
    };
  };

  // Before the definition: two boundary points with very different neighborhoods.
  const granuleMotive = (ctx, { dur }) => {
    M.hide();
    const F = ctx.field({ eq: true }), { km, left, hood, share } = kmShare(), m = S.view(BOUNDS_A, F, dur);
    const lower = share.map(v => v === 0 || v === 1);
    S.set(pointItems(XA, m, i => (lower[i] ? { ...hard(km.labels[i] !== left), alpha: 0.3 } : boundaryStyle)), { dur });
    const bd = XA.map((_, i) => i).filter(i => !lower[i] && hood[i].length >= 4).sort((a, b) => share[b] - share[a]);
    const most = bd[0], least = bd.at(-1);
    S.over = (g, st) => {
      const mm = st.map;
      for (const [i, side] of [[most, 'right'], [least, 'left']]) {
        const P = mm.map(XA[i]), r = RADIUS * mm.k, n = hood[i].length, a = Math.round(share[i] * n);
        ring(g, ...P, r, { color: C.hl, lw: 3.4, dash: [10, 8], grow: born('grm:hoods', { delay: 300, dur: 700 }) });
        sideLabel(g, F, `${a} of ${n} in cluster 1`, P, r, side, { color: C.hl });
      }
      plate(g, 'Both in the boundary', F.x + 4, F.y + 2);
    };
  };

  // The comparison of RCM and rough sets (disagree) is not in the talk.
  return [remap(withIdea(withMotive(roughset, roughsetMotive), 1), [0, 2]), remap(withIdea(withMotive(granule, granuleMotive), 1), [4, 5]),
    remap(objective, [1, 2]), cfex, graph,
    // RSCM and RMCM (the first step of the objective scene) are kept for questions, after the last slide.
    { ...remap(objective, [0]), id: 'rscm', setup: undefined, supplement: true }];
}
