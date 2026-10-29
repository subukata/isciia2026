/**
 * The stage: one canvas behind every scene, 1600 x 900 logical units, scaled to the screen.
 *
 * It holds items (points, prototypes, lattice nodes, milestones) by id. set() moves them to new
 * targets with one tween, so a point keeps its identity from scene to scene: the same 300 points
 * are k-means labels, then degrees of membership, then rough regions. Items left out fade away.
 * A view maps data coordinates onto the stage and tweens with the items (both affine, same
 * easing), so overlays drawn through map() stay on the points while they move.
 */
export const W = 1600, H = 900;

export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;

const colorCache = new Map();
/** '#rrggbb' or 'rgb(r, g, b)' as [r, g, b]. */
export function rgb(c) {
  if (Array.isArray(c)) return c;
  if (colorCache.has(c)) return colorCache.get(c);
  const v = c.startsWith('#') ? [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16)) : c.match(/[\d.]+/g).slice(0, 3).map(Number);
  colorCache.set(c, v);
  return v;
}
export const css = ([r, g, b], a = 1) => (a >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a.toFixed(3)})`);
export const mixRGB = (a, b, t) => { const A = rgb(a), B = rgb(b); return [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]; };

/** An equal-aspect map of data bounds [x0, x1, y0, y1] into a stage rectangle { x, y, w, h }. */
export function fit([x0, x1, y0, y1], rect) {
  const k = Math.min(rect.w / (x1 - x0), rect.h / (y1 - y0));
  const ox = rect.x + (rect.w - k * (x1 - x0)) / 2 - k * x0, oy = rect.y + (rect.h - k * (y1 - y0)) / 2 + k * y1;
  return affine({ k, ox, oy });
}
const affine = a => ({ ...a, map: p => [a.ox + a.k * p[0], a.oy - a.k * p[1]], unmap: (X, Y) => [(X - a.ox) / a.k, (a.oy - Y) / a.k] });

const NUM = ['x', 'y', 'r', 'alpha', 'lw', 'fa', 'sa'];

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // 1600 units across; the height follows the screen's shape (900 on the 16:9 stage, more on narrow screens).
    this.W = W; this.H = H;
    this.items = new Map();
    this.order = [];
    this.edges = [];
    this.under = null;
    this.over = null;
    this.loops = new Set();
    this.handlers = {};
    this.cut = false;     // set while a new scene is shown: items do not travel, and the view jumps
    this.ghosts = 0;
    this.keys = new Map(); this.prevKeys = new Set(); this.stepAt = 0; this.sceneAt = 0; this.sceneAt = 0;
    this.font = { display: 'Archivo', body: 'Source Sans 3' };
    const v = { k: 1, ox: 0, oy: 0 };
    this.v = { cur: { ...v }, from: { ...v }, to: { ...v }, t0: 0, dur: 0 };
    this.scale = 1;
    this.scheduled = false;
    new ResizeObserver(() => this.resize()).observe(canvas);
    const at = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * this.W / r.width, (e.clientY - r.top) * this.H / r.height]; };
    // A down handler returns true when it takes the gesture (a drag), so that a swipe does not also turn the slide.
    for (const [ev, name] of [['pointerdown', 'down'], ['pointermove', 'move'], ['pointerup', 'up'], ['pointerleave', 'leave']]) {
      canvas.addEventListener(ev, e => {
        const h = this.handlers[name];
        if (name === 'down') this.claimed = false;
        if (!h) return;
        const [x, y] = at(e);
        if (name === 'down') canvas.setPointerCapture?.(e.pointerId);
        const took = h(x, y, e);
        if (name === 'down') this.claimed = took === true;
        this.wake();
      });
    }
  }

  resize() {
    const r = this.canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (r.width < 2) return;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.scale = r.width / this.W * dpr;
    this.draw();
  }

  // ------------------------------------------------------------ items

  /**
   * Move items to the given specs: { id, x, y, r, fill, stroke, lw, shape, alpha, z, text, from }.
   * New items appear from `from` (a partial spec) or grow in place. Items not listed fade out
   * unless keep is set. stagger(spec, index) gives each item a delay in ms.
   * Items travel to their new place only where the eye should follow the same thing: within a scene.
   * At a cut to a new scene, and with fresh (a figure giving way to another method's result), nothing
   * travels: an item fades out where it was, and the new one comes in where it goes.
   */
  set(specs, { dur = 700, stagger = null, keep = false, fresh = false } = {}) {
    const now = performance.now(), seen = new Set(), reach = fresh || this.cut ? -1 : Infinity;
    specs.forEach((spec, k) => {
      seen.add(spec.id);
      const to = this.norm(spec);
      let it = this.items.get(spec.id);
      if (it && !it.dying && Math.hypot(to.x - it.cur.x, to.y - it.cur.y) > reach) { this.retire(it, now, dur); it = null; }
      if (!it || it.dying) {
        const start = spec.from ? { ...to, ...this.norm({ ...spec, ...spec.from }, true) } : { ...to, alpha: 0, r: to.r * 0.3 };
        if (it?.dying) Object.assign(start, { x: it.cur.x, y: it.cur.y });
        it = { id: spec.id, cur: start };
        this.items.set(spec.id, it);
      }
      it.prevShape = it.shape ?? spec.shape ?? 'circle';
      it.shape = spec.shape ?? 'circle';
      it.z = spec.z ?? 0;
      it.text = spec.text ?? null;
      it.textStyle = spec.textStyle ?? null;
      it.hit = spec.hit ?? false;
      it.proto = spec.proto ?? false;
      it.data = spec.data ?? it.data;
      this.tween(it, to, now, dur, stagger ? stagger(spec, k) : 0);
      it.dying = false;
    });
    if (!keep) for (const it of this.items.values()) {
      if (seen.has(it.id) || it.dying) continue;
      it.dying = true;
      this.tween(it, { ...it.cur, alpha: 0 }, now, Math.min(dur, 450) || 0, 0);
    }
    this.order = [...this.items.values()].sort((a, b) => a.z - b.z);
    this.wake();
  }

  /** Change some properties of the listed items, tweened. */
  patch(changes, { dur = 300 } = {}) {
    const now = performance.now();
    for (const [id, props] of changes) {
      const it = this.items.get(id);
      if (!it || it.dying) continue;
      if (props.shape) { it.prevShape = it.shape; it.shape = props.shape; }
      if ('text' in props) it.text = props.text;
      if (props.textStyle) it.textStyle = props.textStyle;
      const base = it.to ?? it.cur;
      this.tween(it, { ...base, ...this.norm({ ...this.spec(base), ...props }, true) }, now, dur, 0);
    }
    this.wake();
  }

  /** Numeric targets of a spec; partial specs keep what they leave out undefined. */
  norm(s, partial = false) {
    const o = {};
    const put = (k, v) => { if (v !== undefined || !partial) o[k] = v; };
    put('x', s.x); put('y', s.y);
    put('r', s.r ?? (partial ? undefined : 5));
    put('alpha', s.alpha ?? (partial ? undefined : 1));
    put('lw', s.lw ?? (partial ? undefined : 1.5));
    if (s.fill !== undefined || !partial) { o.fill = s.fill ? rgb(s.fill) : [0, 0, 0]; o.fa = s.fill ? 1 : 0; }
    if (s.stroke !== undefined || !partial) { o.stroke = s.stroke ? rgb(s.stroke) : [0, 0, 0]; o.sa = s.stroke ? 1 : 0; }
    for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
    return o;
  }
  spec(n) { return { x: n.x, y: n.y, r: n.r, alpha: n.alpha, lw: n.lw, fill: n.fa ? n.fill : null, stroke: n.sa ? n.stroke : null }; }

  tween(it, to, now, dur, delay) {
    if (dur <= 0 && delay <= 0) { it.cur = { ...it.cur, ...to }; it.to = null; if (it.dying && !(it.cur.alpha > 0)) this.remove(it); return; }
    it.from = { ...it.cur };
    it.to = { ...it.cur, ...to };
    it.t0 = now; it.dur = Math.max(1, dur); it.delay = delay;
  }
  remove(it) { this.items.delete(it.id); this.order = this.order.filter(o => o !== it); }
  /** Let an item fade out where it is, under another id, so that its own id can start afresh. */
  retire(it, now, dur) {
    this.items.delete(it.id);
    const ghost = { ...it, id: `${it.id}†${++this.ghosts}`, dying: true, hit: false };
    this.items.set(ghost.id, ghost);
    this.tween(ghost, { ...ghost.cur, alpha: 0 }, now, Math.min(dur, 450) || 0, 0);
  }

  pos(id) { const it = this.items.get(id); return it ? [it.cur.x, it.cur.y] : null; }
  /** Put an item at (x, y) at once, for motion driven frame by frame; a tween of its other properties goes on. */
  place(id, x, y) {
    const it = this.items.get(id);
    if (!it || it.dying) return;
    it.cur.x = x; it.cur.y = y;
    if (it.to) { it.from.x = it.to.x = x; it.from.y = it.to.y = y; }
  }
  has(id) { const it = this.items.get(id); return !!it && !it.dying; }

  /** The nearest pickable item to (x, y) within `within` units, or null. */
  pick(x, y, { within = 16, test = null } = {}) {
    let best = null, bd = within * within;
    for (const it of this.items.values()) {
      if (!it.hit || it.dying || it.cur.alpha < 0.2 || (test && !test(it))) continue;
      const d = (it.cur.x - x) ** 2 + (it.cur.y - y) ** 2;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  // ------------------------------------------------------------ the view

  /** Tween the view so that data bounds fill rect. Returns the target map. */
  view(bounds, rect, dur = 0) {
    if (this.cut) dur = 0;   // a new scene: its overlays start where its items will be
    const f = fit(bounds, rect), now = performance.now(), v = this.v;
    v.from = { ...v.cur };
    v.to = { k: f.k, ox: f.ox, oy: f.oy };
    v.t0 = now; v.dur = dur;
    if (dur <= 0) v.cur = { ...v.to };
    this.wake();
    return f;
  }
  get map() { return affine(this.v.cur); }
  get target() { return affine(this.v.to); }

  // ------------------------------------------------------------ the loop

  /** Call fn(now) every frame until the returned function is called (or the scene changes). */
  every(fn) { this.loops.add(fn); this.wake(); return () => this.loops.delete(fn); }

  /** Forget the scene's overlays, handlers and loops; items stay, for the next scene to move. */
  reset(newScene = false) {
    this.edges = []; this.under = null; this.over = null; this.handlers = {}; this.loops.clear();
    this.canvas.style.cursor = '';
    // Births of overlays (common.js born): what the step before drew stays; in a new scene, everything is new.
    this.prevKeys = newScene ? new Set() : new Set(this.keys.keys());
    this.keys = new Map();
    this.stepAt = performance.now();
    if (newScene) this.sceneAt = this.stepAt;
    if (newScene) this.sceneAt = this.stepAt;
    this.wake();
  }
  cursor(c) { this.canvas.style.cursor = c; }

  wake() {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(now => this.frame(now));
  }

  frame(now) {
    this.scheduled = false;
    let busy = this.loops.size > 0;
    for (const fn of [...this.loops]) fn(now);
    const v = this.v;
    if (v.dur > 0) {
      // A frame's timestamp can precede the tween's start: clamp, or the map would run backwards.
      const p = Math.max(0, Math.min(1, (now - v.t0) / v.dur)), e = ease(p);
      for (const k of ['k', 'ox', 'oy']) v.cur[k] = lerp(v.from[k], v.to[k], e);
      if (p < 1) busy = true; else v.dur = 0;
    }
    for (const it of [...this.items.values()]) {
      if (!it.to) continue;
      const p = (now - it.t0 - it.delay) / it.dur;
      if (p <= 0) { busy = true; continue; }
      if (p >= 1) {
        it.cur = it.to; it.to = null; it.prevShape = it.shape;
        if (it.dying) this.remove(it);
        continue;
      }
      busy = true;
      const e = ease(p), c = it.cur, a = it.from, b = it.to;
      for (const k of NUM) c[k] = lerp(a[k], b[k], e);
      c.fill = [0, 1, 2].map(j => lerp(a.fill[j], b.fill[j], e));
      c.stroke = [0, 1, 2].map(j => lerp(a.stroke[j], b.stroke[j], e));
      c.p = e;
    }
    this.draw();
    if (busy) this.wake();
  }

  // ------------------------------------------------------------ drawing

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // For the audit (deck.mjs): the labels of this frame (common.js records them) and the sheet they must stay on.
    Object.assign(globalThis, { __deckStage: this, __deckCtx: ctx, __deckScale: this.scale, __deckClip: this.clip, __deckInk: [] });
    // Everything stays on the plot sheet: points flying in or zoomed past its edge are cut there.
    ctx.save();
    if (this.clip) { ctx.beginPath(); ctx.rect(this.clip.x, this.clip.y, this.clip.w, this.clip.h); ctx.clip(); }
    // A new scene's drawings (regions, lattices, labels) come in where they are, with its points.
    const fade = this.sceneAt ? Math.min(1, (performance.now() - this.sceneAt) / 500) : 1;
    if (fade < 1) this.wake();
    ctx.save(); ctx.globalAlpha = fade; this.under?.(ctx, this); ctx.restore();
    for (const e of this.edges) {
      const a = this.items.get(e.a), b = this.items.get(e.b);
      if (!a || !b) continue;
      const al = Math.min(a.cur.alpha, b.cur.alpha) * (e.alpha ?? 1);
      if (al <= 0.01) continue;
      ctx.strokeStyle = css(rgb(e.color ?? '#13202E'), al);
      ctx.lineWidth = e.lw ?? 1.4;
      ctx.setLineDash(e.dash ?? []);
      ctx.beginPath(); ctx.moveTo(a.cur.x, a.cur.y); ctx.lineTo(b.cur.x, b.cur.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const it of this.order) this.drawItem(ctx, it);
    ctx.save(); ctx.globalAlpha = fade; this.over?.(ctx, this); ctx.restore();
    ctx.restore();
  }

  drawItem(ctx, it) {
    const c = it.cur;
    if (!(c.alpha > 0.005) || !(c.r > 0)) return;
    const shape = it.to && (c.p ?? 0) < 0.5 ? it.prevShape : it.shape;
    const { x, y, r } = c;
    ctx.beginPath();
    switch (shape) {
      case 'square': { const s = r * 0.9; ctx.rect(x - s, y - s, 2 * s, 2 * s); break; }
      case 'diamond': { const s = r * 1.4; ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); break; }
      case 'triangle': { const s = r * 1.25; ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.92, y + s * 0.62); ctx.lineTo(x - s * 0.92, y + s * 0.62); ctx.closePath(); break; }
      case 'star': {
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
        ctx.closePath(); break;
      }
      case 'cross': {
        ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
        ctx.strokeStyle = css(c.stroke, c.alpha * c.sa); ctx.lineWidth = c.lw; ctx.stroke();
        return;
      }
      default: ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    if (c.fa > 0.01) { ctx.fillStyle = css(c.fill, c.alpha * c.fa); ctx.fill(); }
    if (c.sa > 0.01 && c.lw > 0) { ctx.strokeStyle = css(c.stroke, c.alpha * c.sa); ctx.lineWidth = c.lw; ctx.stroke(); }
    if (it.text) {
      const s = it.textStyle ?? {};
      // No text under 28 stage units: the projection rule of the deck.
      ctx.font = `${s.weight ?? 600} ${Math.max(28, s.size ?? 30)}px "${s.family ?? this.font.body}", system-ui, sans-serif`;
      ctx.textAlign = s.align ?? 'center'; ctx.textBaseline = s.base ?? 'bottom';
      ctx.fillStyle = css(rgb(s.color ?? '#13202E'), c.alpha);
      ctx.fillText(it.text, x + (s.dx ?? 0), y + (s.dy ?? -r - 6));
    }
  }
}
