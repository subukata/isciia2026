/**
 * Introduction (5 min): the title with the talk's three parts; about me; why clustering matters;
 * and the k-means objective, with its two updates. The overview of the talk is in scenes-outline.js.
 */
import {
  A, ub, D, C, FONT, memo, XA, BOUNDS_A, RADIUS, leftOf, hoodOf, fcmA, exrcmA, rmcm2A, olpSaddle, CLUSTER, SHAPE, hard, boundaryStyle,
  XS, ZCOLOR, latticeMap, drawGrid, project,
  bounds, pointItems, protoItems, diverging, text, labelWidth, plate, ring, line, arrow, paintField, mixRGB, fit, muLeft, withMotive, cycle, born, remap,
  fillSiteQR,
} from './common.js';

const BLOBS = D.blobs.X;
const BOUNDS_B = bounds(BLOBS, 0.05);
/** k-means on the blobs from the best of five k-means++ starts by the objective (the saved run took the best of ten). */
const blobsInit = memo(() => {
  let best = null;
  for (let seed = 1; seed <= 5; seed++) {
    const init = A.kmeansPlusPlus(BLOBS, 3, seed * 101 + 3), r = ub.kmeans(BLOBS, 3, { init });
    if (!best || r.history.at(-1) < best.J) best = { init, J: r.history.at(-1) };
  }
  return best.init;
});
const blobsFinal = memo(() => A.fromUbukit(ub.kmeans(BLOBS, 3, { init: blobsInit() })));
const blobItems = (m, style) => pointItems(BLOBS, m, style, 'g');

export default function intro(ctx) {
  const S = ctx.stage, M = ctx.meter;

  // ------------------------------------------------------------ title: the three parts of the talk, always in motion
  // Each column: the part, its name (in lines that fit the column), and its method (ours in green).
  const PART_LABELS = [
    ['Introduction', ['Clustering'], 'k-means and FCM', ''],
    ['Part 1', ['Rough Clustering', '(Distances)'], '', 'ExRCM (ours)'],
    ['Part 2', ['Rough Clustering', '(Neighborhoods)'], '', 'RMCM2 (ours)'],
    ['Part 3', ['Topographic Mapping'], '', 'SOM-OLP (ours)'],
  ];
  // ExRCM with ζ = 2: certain regions tinted, the boundary gray; boundary points are diamonds.
  const EX = [1.2, 0.5, 2], tint = CLUSTER.map(c => mixRGB('#FFFFFF', c, 0.2).map(Math.round)), gray = [214, 219, 226];
  const wave = (t, period, phase = 0) => 0.5 - 0.5 * Math.cos(2 * Math.PI * (t / period + phase));
  /** The phase at which lo + span * wave starts from v, so the motion begins where the still picture is. */
  const phase = (v, lo, span) => Math.acos(1 - 2 * (v - lo) / span) / (2 * Math.PI);
  const title = {
    id: 'title', steps: 1,
    narrowAspect: () => 2,
    show(ctx, step, { dur, from }) {
      M.hide();
      const narrow = ctx.narrow(), first = from === null;
      // The talk site's QR code at the top right (index.html: .site-qr).
      fillSiteQR(ctx, 'title');
      // Under the title block on the 16:9 stage; on narrow screens the title is above the stage.
      const F = narrow ? ctx.field() : { x: 60, y: 356, w: 1480, h: 488 };
      if (!narrow) S.clip = { x: 40, y: 336, w: 1520, h: 528 };
      // The four parts in a row; Part 3 takes more width: SOM-OLP shows its data space and its latent space side by side.
      const rects = narrow ? ctx.panels(F, 4, { gap: 44, top: 150 }) : [300, 300, 300, 448].map((w, k, ws) => ({ x: F.x + ws.slice(0, k).reduce((a, v) => a + v + 44, 0), y: F.y + 150, w, h: F.h - 150 }));
      const [dataRect, latentRect] = [0, 1].map(k => ({ x: rects[3].x + k * (rects[3].w / 2 + 8), y: rects[3].y + 34, w: rects[3].w / 2 - 8, h: rects[3].h - 34 }));
      const ex = exrcmA(...EX), l1 = leftOf(ex.B), r2 = rmcm2A(RADIUS), soft = olpSaddle(0.3, 3), hood = hoodOf(RADIUS), l2 = leftOf(r2.B);
      const m0 = fit(BOUNDS_A, rects[0]), m1 = fit(BOUNDS_A, rects[1]), m2 = fit(BOUNDS_A, rects[2]), lm = latticeMap(latentRect, 0.04), fcm = fcmA(2);
      // SOM-OLP's data space: the surface and the prototypes of its lattice, turning slowly.
      const view = { az: -58 * Math.PI / 180, el: 24 * Math.PI / 180 };
      const k3 = Math.min(dataRect.w, dataRect.h) * 0.46, c3 = [dataRect.x + dataRect.w / 2, dataRect.y + dataRect.h / 2 + dataRect.h * 0.04];
      const P3 = p => { const q = project(view, p); return [c3[0] + k3 * q[0], c3[1] - k3 * q[1], q[2]]; };
      let nodesB = soft.B;
      const dataItems = (e) => [
        ...XS.map((p, i) => { const [x, y, z] = P3(p); return { id: 'u' + i, x, y, r: 2.3, fill: ZCOLOR[i], alpha: 0.75, z: -z, from: e?.() }; }),
        ...nodesB.map((b, j) => { const [x, y, z] = P3(b); return { id: 'v' + j, x, y, r: 2.6, fill: C.ink, z: -z + 0.05, from: e?.() }; }),
      ];
      // Part 2: the neighborhood of a point whose membership is most shared.
      const focus = XA.map((_, i) => i).filter(i => hood[i].length >= 6).sort((a, b) => Math.abs(r2.mu[a * 2 + l2] - 0.5) - Math.abs(r2.mu[b * 2 + l2] - 0.5))[0];
      const rand = A.mulberry32(3), enter = r => (first ? { x: r.x + rand() * r.w, y: r.y + rand() * r.h, alpha: 0 } : undefined);
      // What moves: the slack β of ExRCM (the boundary), the radius r (the neighborhoods), and λ of SOM-OLP (hard or soft).
      let beta = EX[1], radius = RADIUS;
      const regionOf = b => XA.map(p => { const cand = A.candidates(ex.B.map(c => Math.hypot(p[0] - c[0], p[1] - c[1])), EX[0], b, EX[2]); return cand[0] && cand[1] ? -1 : cand[l1] ? l1 : 1 - l1; });
      // The introduction: FCM's degrees in cluster 1, from vermilion to blue.
      const fcmItems = e => pointItems(XA, m0, i => ({ fill: diverging(muLeft(fcm, i)), r: 4.6, from: e?.() }), 'f');
      const exItems = (region, e) => pointItems(XA, m1, i => ({ ...(region[i] < 0 ? { ...boundaryStyle, r: 6 } : { ...hard(region[i] !== l1), r: 4.6 }), from: e?.() }), 'p');
      const muItems = (mu, e) => pointItems(XA, m2, i => ({ fill: diverging(mu[i * 2 + l2]), r: 4.6, from: e?.() }), 'q');
      const mapItems = (s, e) => XS.map((p, i) => { const [x, y] = lm.at(s.emb[i]); return { id: 's' + i, x, y, r: 3.2, fill: ZCOLOR[i], from: e?.() }; });
      let region = regionOf(beta), rq = Math.round(radius * 100) / 100;
      S.set([
        ...fcmItems(() => enter(rects[0])),
        ...exItems(region, () => enter(rects[1])),
        ...muItems(A.roughMembership(hoodOf(rq), r2.labels, 2), () => enter(rects[2])),
        ...mapItems(soft, () => enter(latentRect)),
        ...dataItems(() => enter(dataRect)),
      ], { dur: first ? 1600 : dur, stagger: first ? (sp, k) => (k % 300) * 2.2 : null });
      for (let j = 0; j < 100; j++) {
        if (j % 10 < 9) S.edges.push({ a: 'v' + j, b: 'v' + (j + 1), color: C.ink, lw: 1 });
        if (j + 10 < 100) S.edges.push({ a: 'v' + j, b: 'v' + (j + 10), color: C.ink, lw: 1 });
      }
      S.under = g => {
        // Over ExRCM's data only (the panel is taller than the data).
        const [p0, p1] = [m1.map([BOUNDS_A[0], BOUNDS_A[3]]), m1.map([BOUNDS_A[1], BOUNDS_A[2]])];
        paintField(g, { x: p0[0], y: p0[1], w: p1[0] - p0[0], h: p1[1] - p0[1] }, 4, (sx, sy) => {
          const p = m1.unmap(sx, sy), cand = A.candidates(ex.B.map(b => Math.hypot(p[0] - b[0], p[1] - b[1])), EX[0], beta, EX[2]);
          return cand[0] && cand[1] ? gray : tint[cand[l1] ? 0 : 1];
        }, { grow: born('title:regions', { delay: 500, dur: 900 }) });
        drawGrid(g, lm, 10, C.faint, 1);
      };
      S.over = g => {
        rects.forEach((r, k) => {
          const [head, name, what, ours] = PART_LABELS[k];
          text(g, head, r.x, r.y - 126, { size: 28, weight: 700, color: C.muted, halo: false });
          name.forEach((s, j) => text(g, s, r.x, r.y - 88 + j * 36, { size: 30, weight: 760, family: FONT.display, color: C.title, halo: false }));
          text(g, what, r.x, r.y - 12, { size: 28, weight: 700, color: C.muted, halo: false });
          if (ours) text(g, ours, r.x + (what ? labelWidth(g, what, 28) : 0), r.y - 12, { size: 28, weight: 700, color: C.ours, halo: false });
        });
        text(g, 'data space', dataRect.x + dataRect.w / 2, dataRect.y - 6, { size: 28, weight: 600, color: C.muted, align: 'center', halo: false });
        text(g, 'latent space', latentRect.x + latentRect.w / 2, latentRect.y - 6, { size: 28, weight: 600, color: C.muted, align: 'center', halo: false });
        ring(g, ...m2.map(XA[focus]), radius * m2.k, { lw: 2.6, dash: [8, 6], grow: born('title:hood', { delay: 1100, dur: 600 }) });
      };
      if (ctx.reduced()) return;
      // Once the points have arrived: β and r swing slowly, and the map turns hard, then soft again.
      ctx.after(first ? 2600 : dur + 100, () => {
        const t0 = performance.now();
        S.every(now => {
          const t = (now - t0) / 1000;
          beta = 0.12 + 0.95 * wave(t, 7, phase(EX[1], 0.12, 0.95));
          radius = 0.16 + 0.42 * wave(t, 9, phase(RADIUS, 0.16, 0.42));
          const next = regionOf(beta);
          if (next.some((v, i) => v !== region[i])) { region = next; S.set(exItems(region), { dur: 260, keep: true }); }
          const q = Math.round(radius * 100) / 100;
          if (q !== rq) { rq = q; S.set(muItems(A.roughMembership(hoodOf(q), r2.labels, 2)), { dur: 260, keep: true }); }
        });
        // The data space turns slowly; hard and soft take turns in both spaces (the prototypes move a little too).
        let last = performance.now(), fromB = nodesB, toB = nodesB, tB = 0;
        S.every(now => {
          view.az += (now - last) * 0.00012; last = now;
          const u = Math.min(1, (now - tB) / 2400), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
          nodesB = toB.map((b, j) => b.map((v, f) => fromB[j][f] + (v - fromB[j][f]) * e));
          S.set(dataItems(), { dur: 0, keep: true });
        });
        let isSoft = true;
        const flip = () => {
          isSoft = !isSoft;
          const st = isSoft ? soft : olpSaddle(0.01, 3);
          S.set(mapItems(st), { dur: 2400, keep: true });
          fromB = nodesB; toB = st.B; tB = performance.now();
          ctx.after(4600, flip);
        };
        ctx.after(1200, flip);
      });
    },
  };

  // ------------------------------------------------------------ about me: the profile, service and awards (index.html), and the talk site
  let siteQR = null, siteQRFor = null;
  /** The QR code of the talk site (index.html: data-site of the About section); a marked place until it is set. */
  function siteCode(g, x, y, size, url) {
    g.save();
    g.fillStyle = '#FFFFFF'; g.fillRect(x - 12, y - 12, size + 24, size + 24);
    if (url && window.qrcode) {
      if (siteQRFor !== url) { siteQR = window.qrcode(0, 'M'); siteQR.addData(url); siteQR.make(); siteQRFor = url; }
      const n = siteQR.getModuleCount(), cell = size / n;
      g.fillStyle = C.ink;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (siteQR.isDark(r, c)) g.fillRect(x + c * cell, y + r * cell, cell + 0.4, cell + 0.4);
    } else {
      g.setLineDash([12, 9]); g.strokeStyle = C.gray; g.lineWidth = 3; g.strokeRect(x, y, size, size);
      text(g, 'QR code', x + size / 2, y + size / 2 - 8, { size: 30, weight: 700, color: C.muted, align: 'center', halo: false });
      text(g, '(site to come)', x + size / 2, y + size / 2 + 32, { size: 28, weight: 600, color: C.muted, align: 'center', halo: false });
    }
    g.restore();
  }
  const about = {
    id: 'about', steps: 1,
    narrowAspect: () => 0.45,
    show(ctx, step, { dur }) {
      M.hide();
      S.set([], { dur });
      // The profile, service and awards are the page's own text (index.html); the talk site's code is drawn to their right.
      const narrow = ctx.narrow(), F = narrow ? ctx.field() : { x: 600, y: 168, w: 940, h: 580 };
      const qx = F.x + F.w - 270, size = 250;
      const url = ctx.el('copy').querySelector('[data-id="about"]')?.dataset.site?.trim() ?? '';
      S.over = g => {
        // The talk site, to photograph.
        text(g, 'Take a photo!', qx + size / 2, F.y + 40, { size: 38, weight: 780, family: FONT.display, color: C.hl, align: 'center', halo: false });
        siteCode(g, qx, F.y + 74, size, url);
        // What the code opens (its address is long, and the code is enough).
        text(g, 'The talk site:', qx + size / 2, F.y + 74 + size + 52, { size: 28, weight: 700, color: C.ink, align: 'center', halo: false });
        text(g, 'slides, papers, code', qx + size / 2, F.y + 74 + size + 90, { size: 28, weight: 600, color: C.muted, align: 'center', halo: false });
      };
      // The code and its words open the site: a mouse on the press, a finger on the lift (when browsers allow a new tab).
      const onSite = (x, y) => url && x >= qx - 30 && x <= qx + size + 30 && y >= F.y && y <= F.y + 74 + size + 104;
      const open = () => window.open(url, '_blank', 'noopener');
      let tap = false;
      S.handlers.move = (x, y) => S.cursor(onSite(x, y) ? 'pointer' : '');
      S.handlers.down = (x, y, e) => {
        if (!onSite(x, y)) return false;
        if (e.pointerType === 'mouse') open(); else tap = true;
        return true;
      };
      S.handlers.up = (x, y) => { if (tap && onSite(x, y)) open(); tap = false; };
    },
  };

  // ------------------------------------------------------------ why clustering: data ▶ groups ▶ prototypes, on one screen
  const why = {
    id: 'why', steps: 3,
    narrowAspect: () => 2,
    show(ctx, step, { dur, forward }) {
      M.hide();
      const F = ctx.field(), fin = blobsFinal();
      const rects = ctx.panels({ x: F.x, y: F.y + 56, w: F.w, h: F.h - 56 }, 3, { gap: 80 }), ms = rects.map(r => fit(BOUNDS_B, r));
      // Each panel's points appear in their own panel (the arrow tells that they are the same points); the panels
      // before stay still, for the room to compare.
      const items = [...pointItems(BLOBS, ms[0], () => ({ fill: C.gray, shape: 'circle', r: 5 }), 'g')];
      if (step >= 1) items.push(...pointItems(BLOBS, ms[1], i => ({ fill: CLUSTER[fin.labels[i]], shape: SHAPE[fin.labels[i]], r: 5 }), 'h'));
      if (step >= 2) items.push(...pointItems(BLOBS, ms[2], i => ({ fill: CLUSTER[fin.labels[i]], shape: SHAPE[fin.labels[i]], r: 4.5, alpha: 0.3 }), 'k'), ...protoItems(fin.B, ms[2], { r: 28 }));
      S.set(items, { dur: Math.max(dur, 1000), stagger: forward ? (sp, k) => (k % 300) * 1.6 : null });
      S.over = g => {
        ['Data points, no labels', 'Clustering: 3 groups', 'Data points → 3 prototypes'].forEach((label, k) => { if (k <= step) plate(g, label, rects[k].x, rects[k].y - 56); });
        if (step >= 2) fin.B.forEach(b => ring(g, ...ms[2].map(b), 34, { color: C.hl, lw: 3, grow: born('why:protos', { delay: 500 }) }));
        if (!ctx.narrow()) for (let k = 0; k < step; k++) arrow(g, [rects[k].x + rects[k].w + 14, rects[k].y + rects[k].h / 2], [rects[k + 1].x - 14, rects[k].y + rects[k].h / 2], { color: C.gray, lw: 5, head: 22, grow: born('why:arrow' + k, { dur: 500 }) });
      };
    },
  };

  // ------------------------------------------------------------ k-means: one objective, two updates
  /** Points that take turns in focus: in each cluster, a few far from their prototype (so their lines show). */
  const focusPoints = memo(() => {
    const fin = blobsFinal(), d = i => A.sqd(BLOBS[i], fin.B[fin.labels[i]]);
    return [0, 1, 2].flatMap(c => BLOBS.map((_, i) => i).filter(i => fin.labels[i] === c).sort((a, b) => d(b) - d(a)).slice(3, 5))
      .sort((a, b) => (a % 3) - (b % 3));
  });
  let kmTerm = new Set();
  const kmeans = {
    id: 'kmeans', steps: 2, usesTerms: true,
    show(ctx, step, { dur, forward }) {
      // J (step 0), then its two updates (step 1); the equation sits top left and the figure takes the right side.
      const F = ctx.field({ eq: 'tall', meter: true });
      const m = S.view(BOUNDS_B, F, dur), fin = blobsFinal(), init = blobsInit();
      const J = fin.history.at(-1);
      const painted = s => blobItems(m, i => ({ fill: CLUSTER[s.labels[i]], shape: SHAPE[s.labels[i]] }));
      const cells = B => (g, st) => {
        const mm = st.map, tint = CLUSTER.map(c => mixRGB('#FFFFFF', c, 0.16).map(Math.round));
        paintField(g, F, 5, (sx, sy) => {
          const p = mm.unmap(sx, sy);
          let best = 0, bd = Infinity;
          B.forEach((b, c) => { const d = (p[0] - b[0]) ** 2 + (p[1] - b[1]) ** 2; if (d < bd) { bd = d; best = c; } });
          return tint[best];
        }, { grow: born('km:cells', { dur: 700 }) });
      };
      if (step === 0) {
        // J read at once: every point's line to its prototype, one line lit in turn as a squared distance, and the value of J.
        S.set([...painted(fin), ...protoItems(fin.B, m, { r: 22 })], { dur });
        M.hide();
        ctx.highlight([]);
        S.over = (g, st) => {
          const sample = cycle(focusPoints(), 2.6), mm = st.map, P = mm.map(BLOBS[sample]);
          const grow = born('km:lines', { dur: 800 });
          BLOBS.forEach((p, i) => line(g, mm.map(p), mm.map(fin.B[fin.labels[i]]), { color: CLUSTER[fin.labels[i]], lw: 1.4, alpha: 0.4, grow }));
          // The label beside the line's middle, on the side that faces the middle of the figure, so that it stays inside it.
          const Q = mm.map(fin.B[fin.labels[sample]]), mid = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2];
          const right = mid[0] < F.x + F.w / 2, below = mid[1] < F.y + F.h / 2;
          line(g, P, Q, { color: C.hl, lw: 5, grow: born('km:d' + sample, { dur: 500 }) });
          text(g, 'squared distance', mid[0] + (right ? 20 : -20), mid[1] + (below ? 40 : -20), { size: 30, weight: 700, color: C.hl, align: right ? 'left' : 'right' });
          // The figure's label and the value of J, in the free space under the equation.
          plate(g, 'k-means on 300 data points, $C = 3$', F.x + 4, F.y + 2);
          plate(g, `$J$ = ${J.toFixed(1)}`, F.x + 4, F.y + 60, { size: 44, color: C.hl });
        };
        return;
      }
      const axes = { yRange: [Math.min(...fin.history), Math.max(...fin.history)], xMax: fin.history.length };
      const draw = (s, d) => { S.set([...painted(s), ...protoItems(s.B, m, { r: 22 })], { dur: d }); M.show({ name: 'k-means', values: s.history, ...axes }); };
      // Back, opened directly, or with motion reduced (as for the PDF): the converged state at once.
      if (!forward || ctx.reduced()) { draw(fin, dur); S.under = cells(fin.B); return; }
      // From a k-means++ start: the first cycle slowly (assign, then move), then the rest.
      const gen = ub.steps.kmeans(BLOBS, 3, { init }), first = A.fromUbukit(gen.next().value.result());
      S.set([...painted(first), ...protoItems(init, m, { r: 22 })], { dur: 700 });
      M.show({ name: 'k-means', values: first.history, ...axes });
      let phase = 'assign';
      ctx.highlight(['ua']);
      S.over = (g, st) => {
        const mm = st.map;
        if (phase === 'assign') { const grow = born('km:assign', { dur: 700 }); BLOBS.forEach((p, i) => line(g, mm.map(p), mm.map(init[first.labels[i]]), { color: CLUSTER[first.labels[i]], lw: 1.4, alpha: 0.45, grow })); }
        if (phase === 'move') { const grow = born('km:move', { dur: 900 }); init.forEach((b, c) => arrow(g, mm.map(b), mm.map(first.B[c]), { lw: 4, head: 20, grow })); }
        if (phase !== 'repeat') plate(g, phase === 'assign' ? 'fix b: assign to the nearest' : 'fix u: move to the mean', F.x + 4, F.y + 2, { color: C.hl, size: 32 });
      };
      ctx.after(2200, () => {
        phase = 'move';
        ctx.highlight(['bm']);
        S.set([...painted(first), ...protoItems(first.B, m, { r: 22 })], { dur: 1000 });
        ctx.after(2200, () => {
          phase = 'repeat';
          ctx.highlight([]);
          // Once it has converged, it runs again from another k-means++ start, and again.
          let seed = 1;
          const again = () => {
            const start = A.kmeansPlusPlus(BLOBS, 3, 17 * ++seed);
            S.set([...painted(A.fromUbukit(ub.kmeans(BLOBS, 3, { init: start, maxIter: 1 }))), ...protoItems(start, m, { r: 22 })], { dur: 700 });
            ctx.after(900, () => ctx.play(ub.steps.kmeans(BLOBS, 3, { init: start }), (s, done) => { draw(s, 420); if (done) { S.under = cells(s.B); ctx.after(2600, again); } }, { delay: 650, adapt: A.fromUbukit }));
          };
          ctx.play(gen, (s, done) => { draw(s, 420); if (done) { S.under = cells(s.B); S.wake(); ctx.after(2600, again); } }, { delay: 650, adapt: A.fromUbukit });
        });
      });
    },
    term(ctx, name, on) { if (on) kmTerm.add(name); else kmTerm.delete(name); },
    leave() { kmTerm.clear(); },
  };

  // Before J: good prototypes sit close to the points they stand for, so we want to measure that.
  const kmeansMotive = (ctx, { dur }) => {
    M.hide();
    const F = ctx.field({ eq: true }), fin = blobsFinal();
    const m = S.view(BOUNDS_B, { x: F.x, y: F.y + 56, w: F.w, h: F.h - 56 }, dur);
    S.set([...blobItems(m, i => ({ fill: CLUSTER[fin.labels[i]], shape: SHAPE[fin.labels[i]] })), ...protoItems(fin.B, m, { r: 22 })], { dur });
    S.over = (g, st) => {
      const grow = born('km:lines', { delay: 300, dur: 900 });
      BLOBS.forEach((p, i) => line(g, st.map.map(p), st.map.map(fin.B[fin.labels[i]]), { color: CLUSTER[fin.labels[i]], lw: 1.2, alpha: 0.35, grow }));
      plate(g, 'Each data point joined to its prototype', F.x + 4, F.y + 2);
    };
  };

  return [title, about, remap(why, [2]), withMotive(kmeans, kmeansMotive)];
}
