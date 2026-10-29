/**
 * Shared data, runs, geometry and drawing helpers of the scenes.
 *
 * Points come from the talk's saved runs (data.js). Parts 1 and 2 start every method from the
 * same two prototypes, both in the left cluster (k-means++ with seed 7), so each run has a way to
 * go; from there every method reaches the result of the saved runs (checked in Node).
 *
 * Projection rule: no text on the stage under 28 units (1600 units across); text() enforces it.
 */
import * as A from './algo.js';
import { fit, rgb, css, mixRGB } from './stage.js';

export let ub;
try { ub = await import('../vendor/ubukit/src/index.js'); }
catch (err) { ub = await import('https://cdn.jsdelivr.net/npm/ubukit@0.2.0/src/index.js'); }
export { A, fit, rgb, css, mixRGB };

export const D = window.DECK_DATA;
if (!D) throw new Error('data.js did not load, so there are no points to draw');

export const memo = fn => { const cache = new Map(); return (...a) => { const k = JSON.stringify(a); if (!cache.has(k)) cache.set(k, fn(...a)); return cache.get(k); }; };
export const run = gen => { let r; while (!(r = gen.next()).done) {} return r.value; };

// ---------------------------------------------------------------- geometry (stage units)

/** Where the figure may draw: below the title, above the caption (see index.html). */
export const CLIP = { x: 40, y: 150, w: 1520, h: 606 };
/**
 * The figure's rectangle, leaving room for the equation band (top left; 'tall' for equations with
 * their terms annotated underneath) and the meter (top right).
 */
export function fieldRect(narrow, { eq = false, meter = false } = {}, H = 900) {
  if (narrow) return { x: 40, y: 40, w: 1520, h: H - 80 };
  const x0 = 60, x1 = meter ? 1140 : 1540, y0 = eq === 'tall' ? 390 : eq ? 292 : 168, y1 = 748;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
export const MIN_TEXT = 28;
/** Canvas labels are drawn this much larger than the sizes the scenes name (text as large as the figures allow). */
export const LABEL_SCALE = 1.1;
/** The pixel size of a label of the named size. */
export const labelSize = size => Math.max(MIN_TEXT, Math.round(size * LABEL_SCALE));
/**
 * A step in plain words before a scene's first equation: step `at` shows the figure of the step
 * after it (the scene's own step `at`) without lighting any term, under the idea box of index.html;
 * render, if given, draws it instead. The scene's later steps move one step on.
 */
export function withIdea(scene, at, render = null) {
  const inner = scene.show, innerAspect = scene.narrowAspect;
  return {
    ...scene,
    steps: (scene.steps ?? 1) + 1,
    narrowAspect: step => innerAspect?.(step <= at ? step : step - 1) ?? 0.75,
    show(ctx, step, opts) {
      if (step < at) return inner.call(scene, ctx, step, opts);
      if (step === at) return render ? render(ctx, opts) : inner.call(scene, { ...ctx, highlight: () => {} }, at, opts);
      return inner.call(scene, ctx, step - 1, { ...opts, fromStep: opts.fromStep > at ? opts.fromStep - 1 : opts.fromStep });
    },
  };
}
/**
 * A scene that opens with its motivation, before any equation: step 0 is motive(ctx, opts), and the
 * scene's own steps follow from step 1. aspect: the stage's shape for step 0 on narrow screens.
 */
/**
 * The scene with fewer steps: its step k draws the scene's step map[k], so a merged step shows the last of the steps it
 * merges (index.html numbers the words the same way). Moving on to a step that was not next to the one before draws
 * its final state, without the animation that led there.
 */
export function remap(scene, map) {
  const inner = scene.show, innerAspect = scene.narrowAspect;
  return {
    ...scene,
    steps: map.length,
    narrowAspect: step => innerAspect?.(map[step]) ?? 0.75,
    show(ctx, step, opts) {
      const old = map[step], forward = opts.forward && old === (step > 0 ? map[step - 1] : -1) + 1;
      const fromStep = opts.from === scene.id && map[opts.fromStep] !== undefined ? map[opts.fromStep] : opts.fromStep;
      return inner.call(scene, ctx, old, { ...opts, forward, fromStep });
    },
  };
}

export function withMotive(scene, motive, { aspect = null } = {}) {
  const inner = scene.show, innerAspect = scene.narrowAspect;
  return {
    ...scene,
    steps: (scene.steps ?? 1) + 1,
    narrowAspect: step => (step === 0 ? aspect ?? innerAspect?.(0) ?? 0.75 : innerAspect?.(step - 1) ?? 0.75),
    show(ctx, step, opts) {
      if (step === 0) return motive(ctx, opts);
      return inner.call(scene, ctx, step - 1, { ...opts, fromStep: opts.fromStep - 1 });
    },
  };
}
/**
 * n panels in a rectangle: side by side on the 16:9 stage, stacked on narrow screens (whose stage
 * grows taller), so that each panel can use the full width. top leaves room for a panel's label.
 */
export function panels(narrow, F, n, { gap = 40, top = 0 } = {}) {
  return Array.from({ length: n }, (_, k) => {
    if (narrow) { const h = (F.h - (n - 1) * gap) / n; return { x: F.x, y: F.y + k * (h + gap) + top, w: F.w, h: h - top }; }
    const w = (F.w - (n - 1) * gap) / n;
    return { x: F.x + k * (w + gap), y: F.y + top, w, h: F.h - top };
  });
}

// ---------------------------------------------------------------- colors and type (light, as the talk's deck)

export const C = {
  paper: '#F7F8FA', ink: '#13202E', title: '#0E2741', muted: '#4F5B6A', line: '#C3CCD7', faint: '#E1E6EC',
  blue: '#0072B2', verm: '#D55E00', green: '#009E73', ours: '#00775A', hl: '#1F3B73', mid: '#98A1AD', gray: '#76818F',
};
/** The deck's looks (main.js sets one): on the canvas only these colors change. */
const LOOKS = { classic: { paper: '#F7F8FA', title: '#0E2741', ours: '#00775A' }, 2026: { paper: '#F7F6F2', title: '#0B2545', ours: '#0A5C45' } };
export function applyLook(look) { Object.assign(C, LOOKS[look] ?? LOOKS.classic); }
export const modernLook = () => document.documentElement.dataset.look === '2026';
export const FONT = {
  display: '"Archivo", "Archivo Local", "Segoe UI", sans-serif',
  body: '"Source Sans 3", "Source Sans 3 Local", "Segoe UI", sans-serif',
};

/** Vermilion (0) through gray (0.5) to blue (1): membership in cluster 1. */
export function diverging(t) {
  return css(t < 0.5 ? mixRGB(C.verm, C.mid, t / 0.5) : mixRGB(C.mid, C.blue, (t - 0.5) / 0.5));
}
const VIRIDIS = ['#440154', '#3B528B', '#21918C', '#5EC962', '#FDE725'];
export function viridis(t) {
  t = Math.min(1, Math.max(0, t)) * 4;
  const k = Math.min(3, Math.floor(t));
  return css(mixRGB(VIRIDIS[k], VIRIDIS[k + 1], t - k));
}
export const CLUSTER = [C.blue, C.verm, C.green];
export const SHAPE = ['circle', 'square', 'triangle'];
export const R = 7;

// ---------------------------------------------------------------- the overlap data (Parts 1 and 2)

export const XA = D.overlap.X, RADIUS = D.overlap.radius;
export const START = A.kmeansPlusPlus(XA, 2, 7);
export const BOUNDS_A = bounds(XA, 0.04);
export const leftOf = B => (B[0][0] <= B[1][0] ? 0 : 1);
export const hoodOf = memo(r => A.neighborhoods(XA, Math.round(r * 1e4) / 1e4));
export const kmeansA = memo(() => A.fromUbukit(ub.kmeans(XA, 2, { init: START })));
export const fcmA = memo(m => A.fromUbukit(ub.fcm(XA, 2, { m, init: START })));
export const lrcmA = memo(beta => run(A.roughCMeans(XA, START, { beta })));
export const exrcmA = memo((alpha, beta, zeta) => run(A.roughCMeans(XA, START, { alpha, beta, zeta })));
export const rscmA = memo(r => run(A.rscm(XA, START, hoodOf(r))));
export const rmcmA = memo(r => A.fromUbukit(ub.rmcm(XA, 2, { delta: r, init: START })));
export const rmcm2A = memo(r => run(A.rmcm2(XA, START, hoodOf(r))));

export function bounds(points, pad = 0.05) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const px = (x1 - x0) * pad, py = (y1 - y0) * pad;
  return [x0 - px, x1 + px, y0 - py, y1 + py];
}
/** Points as items through map m; style(i) gives { fill, shape, r, ... }. */
export function pointItems(X, m, style, prefix = 'p') {
  return X.map((p, i) => { const [x, y] = m.map(p); return { id: prefix + i, x, y, r: R, hit: true, data: i, ...style(i) }; });
}
/** Cluster 1 (left) a blue circle, cluster 2 a vermilion square, as in the deck. */
export const hard = second => (second ? { fill: C.verm, shape: 'square' } : { fill: C.blue, shape: 'circle' });
export const boundaryStyle = { fill: '#FFFFFF', stroke: C.ink, lw: 2, shape: 'diamond', r: 6.5 };
export function protoItems(B, m, { prefix = 'b', r = 18, fill = C.ink } = {}) {
  return B.map((b, c) => { const [x, y] = m.map(b); return { id: prefix + c, x, y, r, shape: 'star', fill, stroke: '#FFFFFF', lw: 2, z: 5, proto: true }; });
}
/** The one-step-in-cluster-1 index of the overlap data: membership of the left cluster. */
export const muLeft = (s, i) => s.mu[i * 2 + leftOf(s.B)];

// ---------------------------------------------------------------- the saddle (Part 3)

export const XS = D.saddle.X;
export const ZCOLOR = (() => { const z = XS.map(p => p[2]), lo = Math.min(...z), hi = Math.max(...z); return z.map(v => viridis((v - lo) / (hi - lo))); })();
export const Y10 = A.lattice(10);
export const FLAT10 = A.flatStart(10, 1.155);
const rowsOf = m => Array.from({ length: m.rows }, (_, r) => Array.from(m.data.subarray(r * m.cols, (r + 1) * m.cols)));
/** A map's Result as { B, emb (positions in [-1, 1]^2: [row, col]), history, nIter }. */
export const mapState = side => r => ({
  B: rowsOf(r.centers),
  emb: Array.from({ length: r.embedding.rows }, (_, i) => {
    const a = r.embedding.data[2 * i], b = r.embedding.data[2 * i + 1];
    return side ? [-1 + 2 * a / (side - 1), -1 + 2 * b / (side - 1)] : [a, b];
  }),
  history: Array.from(r.history), nIter: r.nIter, converged: r.stopReason === 'tol',
});
/** The talk's stopping rule for SOM-OLP (as the public implementation): relative change of J at most 1e-4. */
export const settled = (tol = 1e-4) => s => {
  const h = s.history, n = h.length;
  return n >= 3 && Math.abs(h[n - 1] - h[n - 2]) / Math.max(1, Math.abs(h[n - 2])) <= tol;
};
export const batchSaddleGen = () => ub.steps.batchSom(XS, [10, 10], { epochs: 60, sigma: 3, sigmaEnd: 0.5, init: FLAT10 });
export const olpSaddleGen = (lam, gamma) => ub.steps.somOlp(XS, Y10, { lam, gamma, init: FLAT10, maxIter: 300, tol: 0 });
export const batchSaddle = memo(() => mapState(10)(run(batchSaddleGen())));
export const olpSaddle = memo((lam, gamma) => {
  const gen = olpSaddleGen(lam, gamma), stop = settled(), adapt = mapState(0);
  for (;;) { const { value, done } = gen.next(); const s = adapt(done ? value : value.result()); if (done || stop(s)) return s; }
});

/**
 * Offsets that spread the points sharing a winner node around its center (a small sunflower), so
 * that all are visible and still read as one node's points. emb holds lattice positions in
 * [-1, 1]^2; spacing is the lattice step there.
 */
export const packAtNodes = memo((key, emb, spacing) => {
  const groups = new Map(), out = emb.map(() => [0, 0]);
  emb.forEach((v, i) => { const k = v.map(t => t.toFixed(4)).join(','); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  for (const ids of groups.values()) {
    ids.forEach((i, k) => {
      const r = spacing * 0.3 * Math.sqrt((k + 0.5) / ids.length), a = k * 2.39996;
      out[i] = [r * Math.sin(a), r * Math.cos(a)];
    });
  }
  return out;
});

/** 3-D view: azimuth az, elevation el; returns [screen x, screen y (up), depth]. */
export function project(view, p) {
  const ca = Math.cos(view.az), sa = Math.sin(view.az), ce = Math.cos(view.el), se = Math.sin(view.el);
  const x = p[0] * ca - p[1] * sa, y = p[0] * sa + p[1] * ca;
  return [x, p[2] * ce + y * se, y * ce - p[2] * se];
}
/** Lattice coordinates [row, col] in [-1, 1]^2 onto a stage rectangle: col to the right, row up. */
export function latticeMap(rect, pad = 0.08) {
  const m = fit([-1 - pad, 1 + pad, -1 - pad, 1 + pad], rect);
  return { ...m, at: ([r, c]) => m.map([c, r]) };
}
export function drawGrid(ctx, lm, side, color = C.line, lw = 1.2) {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
  for (let a = 0; a < side; a++) {
    const t = -1 + 2 * a / (side - 1);
    ctx.moveTo(...lm.at([t, -1])); ctx.lineTo(...lm.at([t, 1]));
    ctx.moveTo(...lm.at([-1, t])); ctx.lineTo(...lm.at([1, t]));
  }
  ctx.stroke();
}
/** Discs at lattice nodes, to show where the points of each winner node belong. */
export function nodeDiscs(ctx, lm, nodes, spacing, { fill = '#E9EEF4', stroke = '#B9C3CF' } = {}) {
  const r = lm.k * spacing * 0.42;
  ctx.save(); ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 1.4;
  for (const y of nodes) { const [x, yy] = lm.at(y); ctx.beginPath(); ctx.arc(x, yy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- overlay drawing (stage units)

/**
 * The runs of a label. Between $ and $ is math: its letters (Latin, lowercase Greek and the subscript letters) are italic, as
 * in the equations; digits, operators and brackets stay upright. A label without $ is one run.
 */
export function mathRuns(s, italic = false) {
  const runs = [];
  String(s).split('$').forEach((part, k) => {
    for (const ch of part) {
      const it = k % 2 === 1 ? /[A-Za-zα-ωᵢⱼₖₙ]/u.test(ch) : italic;
      if (runs.length && runs.at(-1).it === it) runs.at(-1).t += ch; else runs.push({ t: ch, it });
    }
  });
  return runs;
}
const runFont = (it, weight, size, family) => `${it ? 'italic ' : ''}${weight} ${size}px ${family}`;
function runsWidth(ctx, runs, weight, size, family) {
  let w = 0;
  for (const r of runs) { ctx.font = runFont(r.it, weight, size, family); w += ctx.measureText(r.t).width; }
  return w;
}
/** Draws the runs from x (left aligned): all halos first, so that no halo covers the run before it. */
function drawRuns(ctx, runs, x, y, weight, size, family, halo) {
  ctx.textAlign = 'left';
  for (const pass of halo ? ['halo', 'fill'] : ['fill']) {
    let xx = x;
    for (const r of runs) {
      ctx.font = runFont(r.it, weight, size, family);
      if (pass === 'halo') ctx.strokeText(r.t, xx, y); else ctx.fillText(r.t, xx, y);
      xx += ctx.measureText(r.t).width;
    }
  }
}
/** The width of a label in the plate's font (for placing it before it is drawn). */
export const labelWidth = (ctx, s, size = 30, weight = 700) => runsWidth(ctx, mathRuns(s), weight, labelSize(size), FONT.body);

export function text(ctx, s, x, y, { size = 30, weight = 600, color = C.ink, align = 'left', base = 'alphabetic', family = FONT.body, halo = true, alpha = 1, italic = false } = {}) {
  ctx.save();
  ctx.globalAlpha *= alpha * labelBorn(ctx, s);
  const z = labelSize(size), runs = mathRuns(s, italic), w = runsWidth(ctx, runs, weight, z, family);
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textBaseline = base; ctx.lineWidth = 7; ctx.strokeStyle = '#FFFFFF'; ctx.lineJoin = 'round'; ctx.fillStyle = color;
  drawRuns(ctx, runs, x0, y, weight, z, family, halo);
  const y0 = base === 'middle' ? y - z / 2 : base === 'top' || base === 'hanging' ? y : base === 'bottom' ? y - z : y - z * 0.75;
  inked(ctx, s, x0, y0, x0 + w, y0 + z);
  ctx.restore();
}
/** Records a label's box, in stage units, for the audit (deck.mjs), when it is drawn on the stage. */
function inked(ctx, s, x0, y0, x1, y1) {
  if (ctx !== globalThis.__deckCtx) return;
  const T = ctx.getTransform(), k = globalThis.__deckScale || 1, xs = [], ys = [];
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { xs.push((T.a * x + T.c * y + T.e) / k); ys.push((T.b * x + T.d * y + T.f) / k); }
  globalThis.__deckInk.push({ s, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
}
/** A symbol with a subscript or superscript, italic, as in the equations; the scripts stay at 28 or more. */
export function symbol(ctx, base, sub, x, y, { size = 38, color = C.ink, sup = '', align = 'left' } = {}) {
  const small = Math.max(MIN_TEXT, size * 0.72), zb = labelSize(size);
  ctx.save();
  ctx.font = `italic 700 ${zb}px ${FONT.body}`;
  const wb = ctx.measureText(base).width;
  ctx.font = `italic 700 ${labelSize(small)}px ${FONT.body}`;
  const ws = Math.max(sub ? ctx.measureText(sub).width : 0, sup ? ctx.measureText(sup).width : 0);
  const x0 = align === 'center' ? x - (wb + ws) / 2 : align === 'right' ? x - wb - ws : x;
  text(ctx, base, x0, y, { size, color, weight: 700, italic: true });
  if (sub) text(ctx, sub, x0 + wb + 2, y + zb * 0.3, { size: small, color, weight: 700, italic: true });
  if (sup) text(ctx, sup, x0 + wb + 2, y - zb * 0.42, { size: small, color, weight: 700, italic: true });
  ctx.restore();
}
// ---------------------------------------------------------------- motion that never stops (gently)

/** motion.still: no ongoing motion (the viewer asked for reduced motion; main.js sets it). */
export const motion = { still: false };
const clock = () => performance.now() / 1000;
/** 0 → 1 → 0, smoothly, once per period (seconds); phase in [0, 1). Still: 0.5. */
export const breathe = (period, phase = 0) => (motion.still ? 0.5 : 0.5 - 0.5 * Math.cos(2 * Math.PI * (clock() / period + phase)));
/** A value swinging between lo and hi, once per period. */
export const sweep = (lo, hi, period, phase = 0) => lo + (hi - lo) * breathe(period, phase);
/** The item of list in focus now; each holds for `hold` seconds. Still: the first. */
export const cycle = (list, hold) => (motion.still ? list[0] : list[Math.floor(clock() / hold) % list.length]);
/** The phase at which lo + (hi - lo) * breathe starts from v, so that motion begins where the still picture is. */
export const phaseAt = (v, lo, hi) => Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (v - lo) / (hi - lo)))) / (2 * Math.PI);

/**
 * A value that swings between lo and hi from now on, starting at `from` (where the still picture
 * is), once per period: call the returned function each frame. Still: always `from`.
 */
export function swing(lo, hi, period, from = lo) {
  const t0 = clock(), ph = phaseAt(from, lo, hi);
  // Each call marks a swing as running now (the audit checks that the prototypes stay while one runs).
  return () => { if (motion.still) return from; globalThis.__deckSwing = performance.now(); return lo + (hi - lo) * (0.5 - 0.5 * Math.cos(2 * Math.PI * ((clock() - t0) / period + ph))); };
}
/**
 * From `delay` ms on (after the step's own animation), unless motion is still: setup() runs once
 * (make the swings there, so that they start where the picture is) and returns what runs every frame.
 */
export function live(ctx, delay, setup) { if (!motion.still) ctx.after(delay, () => ctx.stage.every(setup())); }

// ---------------------------------------------------------------- births: how an overlay comes into being

let STAGE = null;
/** main.js binds the stage, whose steps births are counted from. */
export const bindStage = s => { STAGE = s; };
/**
 * How far an overlay named `key` has come into being (0 to 1, eased). It is 1 if the step before drew it
 * (the same thing stays as it is); otherwise it grows from when it is first drawn, after `delay` ms from
 * the step's start. Things first drawn later than `window` ms into the step (values that change, as a
 * count) are there at once. Each kind of overlay grows its own way: a ring from its center, a line from
 * its start, a region or a label in place (see ring, line, arrow, paintField, text and plate).
 */
export function born(key, { delay = 0, dur = 450, window = Infinity } = {}) {
  const s = STAGE;
  if (!s || motion.still) return 1;
  if (s.prevKeys.has(key)) { s.keys.set(key, -Infinity); return 1; }
  const now = performance.now();
  let t0 = s.keys.get(key);
  if (t0 === undefined) { t0 = now - s.stepAt > window ? -Infinity : Math.max(now, s.stepAt + delay); s.keys.set(key, t0); }
  const u = Math.min(1, Math.max(0, (now - t0) / dur));
  return 1 - (1 - u) ** 3;
}
/** Labels come in after the things they name, in place; a label the step before had stays. */
const labelBorn = (ctx, s) => (STAGE && ctx === STAGE.ctx ? born('label:' + s, { delay: 180, dur: 380, window: 600 }) : 1);

/** A ring; focus rings (the highlight color) breathe a little, unless steady. grow (0 to 1): it opens from its center. */
export function ring(ctx, x, y, r, { color = C.ink, lw = 2.4, dash = null, alpha = 1, fill = null, steady = false, grow = 1 } = {}) {
  if (grow <= 0) return;
  if (color === C.hl && !steady && !motion.still) { const b = breathe(1.6); r *= 1 + 0.1 * b; lw *= 1 + 0.35 * b; }
  r *= grow;
  ctx.save(); ctx.globalAlpha *= alpha * Math.min(1, 2 * grow);
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.setLineDash(dash ?? []); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
  ctx.restore();
}
/** A line; grow (0 to 1): it is drawn from a toward b. */
export function line(ctx, a, b, { color = C.ink, lw = 2, dash = null, alpha = 1, grow = 1 } = {}) {
  if (grow <= 0) return;
  if (grow < 1) b = [a[0] + (b[0] - a[0]) * grow, a[1] + (b[1] - a[1]) * grow];
  ctx.save(); ctx.globalAlpha *= alpha; ctx.setLineDash(dash ?? []);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
  ctx.restore();
}
/** An arrow; grow (0 to 1): it reaches out from a toward b. */
export function arrow(ctx, a, b, { color = C.ink, lw = 2.6, head = 14, alpha = 1, grow = 1 } = {}) {
  if (grow <= 0) return;
  if (grow < 1) b = [a[0] + (b[0] - a[0]) * grow, a[1] + (b[1] - a[1]) * grow];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(b[0] - head * 0.7 * Math.cos(ang), b[1] - head * 0.7 * Math.sin(ang)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(...b);
  ctx.lineTo(b[0] - head * Math.cos(ang - 0.42), b[1] - head * Math.sin(ang - 0.42));
  ctx.lineTo(b[0] - head * Math.cos(ang + 0.42), b[1] - head * Math.sin(ang + 0.42));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
export function cross(ctx, x, y, r, color = C.verm, lw = 5) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath();
  ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); ctx.restore();
}
/** A label on a white plate, for "New example" and panel titles. */
export function plate(ctx, s, x, y, { size = 30, color = C.title, bg = '#FFFFFF', border = C.line, align = 'left' } = {}) {
  ctx.save();
  ctx.globalAlpha *= labelBorn(ctx, s);
  const z = labelSize(size), runs = mathRuns(s);
  const w = runsWidth(ctx, runs, 700, z, FONT.body) + 28, h = z * 1.5, x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  card(ctx, x0, y, w, h, bg, border);
  ctx.fillStyle = color; ctx.textBaseline = 'middle';
  drawRuns(ctx, runs, x0 + 14, y + h / 2 + 1, 700, z, FONT.body, false);
  inked(ctx, s, x0, y, x0 + w, y + h);
  ctx.restore();
  return { w, h };
}
/** The plate's card. Look 2026: rounder, with a soft shadow under it. */
function card(ctx, x0, y, w, h, bg = '#FFFFFF', border = C.line) {
  ctx.fillStyle = bg; ctx.strokeStyle = border; ctx.lineWidth = 1.5;
  const modern = modernLook();
  if (modern) { ctx.shadowColor = 'rgba(11, 37, 69, 0.14)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; }
  ctx.beginPath(); ctx.roundRect(x0, y, w, h, modern ? 12 : 8); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.stroke();
}
/**
 * A plate with a stacked fraction, right-aligned at x: `head` = num over den, then `tail` (e.g. '= 1'). Large, for a count
 * read as a degree; the numerator may take its own color.
 */
export function fractionPlate(ctx, head, num, den, x, y, { size = 64, tail = '', color = C.title, numColor = color } = {}) {
  const z = labelSize(size), wd = s => labelWidth(ctx, s, size, 760), pad = 22, gap = 16;
  const wf = Math.max(wd(String(num)), wd(String(den))) + 24;
  const w = pad + wd(head) + gap + wf + (tail ? gap + wd(tail) : 0) + pad, h = 2 * z + 2 * gap + 16, x0 = x - w, mid = y + h / 2;
  ctx.save();
  card(ctx, x0, y, w, h);
  const opt = { size, weight: 760, color, halo: false };
  let xx = x0 + pad;
  text(ctx, head, xx, mid + z * 0.35, opt); xx += wd(head) + gap;
  text(ctx, String(num), xx + wf / 2, mid - gap, { ...opt, color: numColor, align: 'center' });
  text(ctx, String(den), xx + wf / 2, mid + gap + z * 0.72, { ...opt, align: 'center' });
  ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(xx, mid); ctx.lineTo(xx + wf, mid); ctx.stroke();
  if (tail) text(ctx, tail, xx + wf + gap, mid + z * 0.35, opt);
  ctx.restore();
  return { w, h };
}
/** Fills a QR box (index.html: .site-qr .qr) with the talk site's address (data-site of the About section), once, and
 *  points its link (the code and its words) to the site. */
export function fillSiteQR(ctx, id) {
  const box = ctx.el('copy').querySelector(`[data-id="${id}"] .site-qr .qr`), site = ctx.el('copy').querySelector('[data-id="about"]')?.dataset.site?.trim();
  if (box && site) box.closest('a.site-qr')?.setAttribute('href', site);
  if (box && site && window.qrcode && !box.firstChild) { const q = window.qrcode(0, 'M'); q.addData(site); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
}
export const newExample = (ctx, s, F) => plate(ctx, `New example · ${s}`, F.x + 4, F.y + 2, { color: C.hl, border: '#BFCDE3' });

/** The membership scale, 0 (vermilion) to 1 (blue), with its labels. */
/** The membership scale, 0 (vermilion) to 1 (blue): the caption above, the end values below. */
export function membershipLegend(ctx, x, y, w, caption = 'membership in cluster 1', size = 28) {
  const bar = Math.round(size * 0.6), k2 = size / 28;
  text(ctx, caption, x + w / 2, y - 12 * k2, { size, align: 'center', halo: false, color: C.muted });
  for (let k = 0; k < w; k += 2) { ctx.fillStyle = diverging(k / w); ctx.fillRect(x + k, y, 2.5, bar); }
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, bar);
  text(ctx, '0', x, y + bar + 30 * k2, { size, align: 'left', halo: false });
  text(ctx, '0.5', x + w / 2, y + bar + 30 * k2, { size, align: 'center', halo: false });
  text(ctx, '1', x + w, y + bar + 30 * k2, { size, align: 'right', halo: false });
}
export function heightLegend(ctx, x, y, w) {
  for (let k = 0; k < w; k += 2) { ctx.fillStyle = viridis(k / w); ctx.fillRect(x + k, y, 2.5, 16); }
  text(ctx, 'low', x, y + 48, { size: 28, halo: false });
  text(ctx, 'high', x + w, y + 48, { size: 28, align: 'right', halo: false });
  text(ctx, 'color = height', x + w / 2, y + 48, { size: 28, align: 'center', halo: false, color: C.muted });
}

/**
 * Paint a stage rectangle cell by cell: colorAt(sx, sy) gives [r, g, b] for a stage point.
 * res is the cell size in stage units.
 */
const scratch = document.createElement('canvas');
/** Regions colored cell by cell; grow (0 to 1): they deepen in place. */
export function paintField(ctx, rect, res, colorAt, { grow = 1 } = {}) {
  if (grow <= 0) return;
  const w = Math.max(1, Math.ceil(rect.w / res)), h = Math.max(1, Math.ceil(rect.h / res));
  scratch.width = w; scratch.height = h;
  const sctx = scratch.getContext('2d'), img = sctx.createImageData(w, h), px = img.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = colorAt(rect.x + (i + 0.5) * res, rect.y + (j + 0.5) * res), o = 4 * (j * w + i);
    px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = c[3] ?? 255;
  }
  sctx.putImageData(img, 0, 0);
  ctx.save(); ctx.globalAlpha *= grow; ctx.imageSmoothingEnabled = true; ctx.drawImage(scratch, rect.x, rect.y, w * res, h * res); ctx.restore();
}

// ---------------------------------------------------------------- controls (hidden while presenting)

/** Range input wired to its <output>; it gives the arrow keys back to the deck once released. */
export function slider(id, onInput) {
  const input = document.getElementById(id), out = document.querySelector(`output[for="${id}"]`);
  const digits = input.step.includes('.') ? input.step.split('.')[1].length : 0;
  const showValue = () => { if (out) out.value = Number(input.value).toFixed(digits); };
  showValue();
  input.addEventListener('input', () => { showValue(); onInput?.(Number(input.value)); });
  input.addEventListener('change', () => input.blur());
  return Object.assign(() => Number(input.value), { set(v) { input.value = v; showValue(); } });
}
export function onClick(id, fn) { const b = document.getElementById(id); b.addEventListener('click', () => { fn(); b.blur(); }); }
export const f2 = v => v.toFixed(2);
