/**
 * The deck. Scenes advance in build steps; the stage and its points persist across all of them.
 * Keys, hash (#scene or #scene.step), the rail, an overview, a pacing timer, and a
 * presenter window kept in sync over a BroadcastChannel (#presenter).
 */
import { Stage } from './stage.js';
import { Meter } from './meter.js';
import { ub, CLIP, fieldRect, panels, motion, bindStage, applyLook } from './common.js';
import intro from './scenes-intro.js';
import outlines, { outlineLook } from './scenes-outline.js';
import part1 from './scenes-part1.js';
import part2 from './scenes-part2.js';
import part3 from './scenes-part3.js';
import closing from './scenes-end.js';

const $ = id => document.getElementById(id);
const root = document.documentElement;
const PRESENTER = location.hash === '#presenter';
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('isciia2026-stage') : null;

// Minutes per part (26 in all), for the pacing timer: the introduction reads k-means term by term.
const PARTS = [
  { name: 'Introduction', minutes: 5 },
  { name: 'Part 1 · Rough Clustering (Distances)', minutes: 5.5 },
  { name: 'Part 2 · Rough Clustering (Neighborhoods)', minutes: 6 },
  { name: 'Part 3 · Topographic Mapping', minutes: 7.5 },
  { name: 'Summary', minutes: 2 },
  { name: 'Supplement', minutes: 0 },
];

// ---------------------------------------------------------------- the scenes

const sections = [...document.querySelectorAll('#copy > .scene')];
let split = false;   // this step's layout: the words left and the figure right (data-split), or the wide one
let eqRowBottom = 0; // in the split layout, where an equation's own row ends (stage units)
let eqRowSide = null; // a row marked data-beside: where its equations end on the right and where the row begins (stage units)
let leadShift = 0;   // how much lower than designed the key sentence under the title ends (stage units)
let leadBottom = 0;  // where it ends (stage units; 0 without one)
let footTop = 0;     // where the words at the bottom (a benefit box, with the caption over it) begin (stage units; 0 without)
let colWidth = 560;  // and how wide the column of words is
const timers = new Set();
// The layout is always the fixed 16:9 stage, scaled to fit the screen (portrait screens too, with
// space above and below). The narrow layout (html.narrow) is kept in the styles but no longer used.
const narrow = false;
root.classList.toggle('narrow', narrow);

const stage = new Stage($('field'));
bindStage(stage);
const meter = new Meter($('meter'));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ctx = {
  stage, meter, ub,
  /**
   * The figure's rectangle: with an equation band above it, and with the meter beside it. The stage
   * is cut to it, so points zoomed past its edge never cross the equations or the meter.
   */
  field(opts = {}) {
    if (split && !narrow) {
      // Right of the column of words (as wide as its equation needs), under the title or the equation's row; or, for a
      // row marked data-beside, right of its equations from the top of the row (the words stay under the equations).
      const y0 = eqRowSide ? eqRowSide.y : root.classList.contains('eq-row') ? eqRowBottom + 24 : 140;
      const x0 = eqRowSide ? eqRowSide.x : 60 + colWidth + 40;
      const r = { x: x0, y: y0, w: 1540 - x0, h: 852 - y0 };
      stage.clip = { x: r.x - 20, y: r.y - 12, w: r.w + 40, h: r.h + 16 };
      return r;
    }
    const r = fieldRect(narrow, opts, stage.H);
    // Under the key sentence: lower by as much as it grew, and in any case under it (a figure without an equation band).
    if (leadBottom && !narrow) { const y = Math.max(r.y + leadShift, leadBottom + 20); r.h -= y - r.y; r.y = y; }
    // Over the words at the bottom.
    if (footTop && !narrow) r.h = Math.min(r.h, footTop - 14 - r.y);
    stage.clip = narrow ? null : { x: r.x - 14, y: r.y - 10, w: r.w + 28, h: r.h + 16 };
    return r;
  },
  narrow: () => narrow,
  /** n panels: side by side on the 16:9 stage, stacked on narrow screens. */
  panels: (F, n, opts) => panels(narrow, F, n, opts),
  el: id => $(id),
  after(ms, fn) { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; },
  /**
   * Animate a step generator: show(state, done) after each iteration, `delay` ms apart. Stops when
   * the scene or step changes. adapt turns a Result into a state; stop ends a run early.
   */
  play(gen, show, { delay = 380, adapt = s => s, stop = null, then = null } = {}) {
    const tick = () => {
      let { value, done } = gen.next();
      const s = adapt(done ? value : value.result());
      if (!done && stop?.(s)) { done = true; s.converged = true; }
      show(s, done);
      // A replay is running until a little after its next tick (the audit does not count its moving prototypes).
      globalThis.__deckPlayUntil = done ? 0 : performance.now() + (reduced() ? 0 : delay) + 200;
      if (!done) ctx.after(reduced() ? 0 : delay, tick); else then?.(s);
    };
    tick();
  },
  /** Light the named terms of the scene's equations, as a hover would. */
  highlight(names) {
    const s = scenes[cur.si];
    for (const g of s.el.querySelectorAll('g.term')) {
      const on = names.includes(g.dataset.term);
      if (g.classList.contains('hot') !== on) { g.classList.toggle('hot', on); s.term?.(ctx, g.dataset.term, on); }
    }
    stage.wake();
  },
  rerender: () => show(cur.si, cur.step, { instant: true }),
  go: id => { const k = scenes.findIndex(s => s.id === id); if (k >= 0) show(k, 0); },
  reduced,
};

// After the title and the speaker, the overview of the talk; its cards come back, the part lit, before each part. Scenes marked
// supplement (kept for questions) follow the last slide, after a divider that says so.
const [title, about, why, kmeans] = intro(ctx), toc = outlines(ctx);
// FCM (the first scene of scenes-part1.js) closes the introduction; Part 1 starts with rough c-means.
const [fcm, ...rough] = part1(ctx);
const talk = [title, about, toc.outline, why, kmeans, fcm, toc.part[0], ...rough, toc.part[1], ...part2(ctx), toc.part[2], ...part3(ctx), ...closing(ctx)];
const scenes = [...talk.filter(s => !s.supplement), toc.supplement, ...talk.filter(s => s.supplement)];
for (const s of scenes) {
  s.el = sections.find(el => el.dataset.id === s.id);
  if (!s.el) throw new Error(`no copy for scene ${s.id}`);
  s.part = Number(s.el.dataset.part);
  s.title = s.el.dataset.title ?? s.el.querySelector('h2')?.textContent ?? s.id;
  s.steps = s.steps ?? 1;
  s.lit = s.el.dataset.lit ? s.el.dataset.lit.split('|').map(x => x.split(',').map(Number)) : null;
  const sp = s.el.dataset.split;
  s.split = !sp ? () => false : sp === 'all' ? () => true : (list => step => list.includes(step))(sp.split(',').map(Number));
}
const cur = { si: -1, step: 0 };

function show(si, step, { instant = false } = {}) {
  si = Math.max(0, Math.min(scenes.length - 1, si));
  const s = scenes[si];
  step = Math.max(0, Math.min(s.steps - 1, step));
  const prev = { ...cur }, prevScene = scenes[prev.si];
  const sameScene = prev.si === si;
  for (const t of timers) clearTimeout(t);
  timers.clear();
  for (const g of document.querySelectorAll('g.term.hot')) { g.classList.remove('hot'); prevScene?.term?.(ctx, g.dataset.term, false); }
  if (!sameScene) prevScene?.leave?.(ctx);
  stage.reset(!sameScene);
  stage.clip = narrow ? null : CLIP;
  cur.si = si; cur.step = step;
  // The words: the scene, and the elements of this step.
  for (const el of sections) el.classList.toggle('active', el === s.el);
  for (const el of s.el.querySelectorAll('[data-steps]')) el.classList.toggle('shown', el.dataset.steps.split(',').map(Number).includes(step));
  // The four parts (the introduction and three parts): the current one lit.
  const lit = s.lit ? s.lit[Math.min(step, s.lit.length - 1)] : s.part >= 0 && s.part <= 3 ? [s.part] : [];
  for (const chip of document.querySelectorAll('.part-chip')) chip.classList.toggle('lit', lit.includes(Number(chip.dataset.k)));
  $('parts').hidden = s.id === 'title' && step === 0;
  // The slide number, bottom right (none on the title): the scene's number, as in the hash and "number + Enter".
  $('pageno').textContent = s.id === 'title' ? '' : String(si + 1);
  split = s.split(step);
  root.classList.toggle('split', split);
  // Outline slides (data-theme="dark") are dark: a break between parts.
  root.classList.toggle('dark', s.el.dataset.theme === 'dark');
  // Narrow screens: the stage takes the shape the step's figure needs, so it can use the full width.
  const aspect = narrow ? (s.narrowAspect?.(step) ?? 0.75) : 0.5625;
  stage.H = 1600 * aspect;
  $('screen').style.aspectRatio = narrow ? String(1 / aspect) : '';
  placeEquation(s);
  spaceEquations(s);
  placeFoot(s);
  const forward =!instant && ((sameScene && step === prev.step + 1) || (si === prev.si + 1 && step === 0));
  const dur = instant ? (sameScene ? 260 : 0) : sameScene ? 800 : prev.si < 0 ? 1400 : 1000;
  // The presenter window shows words and time only; the stage runs in the audience's window.
  if (!PRESENTER) {
    try {
      if (!s.ready) { s.setup?.(ctx); s.ready = true; }
      motion.still = reduced();
      if (motion.still) stage.sceneAt = 0;
      if (motion.still) stage.sceneAt = 0;
      // A new scene is a cut: nothing travels from the scene before (stage.set), unless the new scene says that it
      // continues that scene's figure (continues: its id).
      stage.cut = !sameScene && s.continues !== prevScene?.id;
      s.show(ctx, step, { forward, dur, from: prevScene?.id ?? null, fromStep: prev.step });
      stage.cut = false;
      // The stage keeps drawing, so that what breathes (focus rings, swinging parameters) keeps moving.
      if (!motion.still) stage.every(() => {});
    } catch (err) {
      stage.cut = false;
      console.error(err);
      s.el.querySelector('.err')?.remove();
      s.el.insertAdjacentHTML('beforeend', `<p class="err">This figure stopped: ${err.message}</p>`);
    }
  }
  updateRail();
  fitWords(s);
  try { history.replaceState(null, '', step ? `#${si + 1}.${step + 1}` : `#${si + 1}`); } catch (e) {}
  if (!sameScene && si > 0 && clock.start === null) clock.start = Date.now();
  if (document.activeElement && document.activeElement !== document.body && !document.activeElement.closest('.sheet')) document.activeElement.blur();
  updatePresenter();
  broadcast();
}
/**
 * The words grow as large as the room under them allows: no wasted space under small text. Split layout: the words of
 * the column (boxes, key sentence, caption), up to 30% larger, clear of the meter (or of the rail). Wide layout: the
 * caption at the bottom (unless a benefit box stacks there), clear of the rail and the reference, and no larger than the
 * key sentence (2rem), which stays the larger. Runs after the scene has shown (and the meter with it).
 */
function fitWords(s) {
  const words = [...s.el.children].filter(e => e.matches('.motive, .idea, .lead, .cap, .benefit, p.next'));
  for (const e of words) e.style.removeProperty('font-size');
  if (narrow) return;
  const on = (e, pos) => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.position === pos; };
  const fr = $('frame').getBoundingClientRect(), meter = $('meter'), gap = 14 * fr.width / 1600;
  let shown, floor, steps = [1.3, 1.24, 1.18, 1.12, 1.06];
  if (split) {
    shown = words.filter(e => on(e, 'static'));
    floor = (root.classList.contains('meter-on') && !meter.hidden ? meter : $('rail')).getBoundingClientRect().top - gap;
  } else {
    if (words.some(e => e.matches('.benefit, p.next') && on(e, 'absolute'))) return;
    shown = words.filter(e => e.matches('.cap') && on(e, 'absolute'));
    const ref = s.el.querySelector('.ref');
    floor = Math.min($('rail').getBoundingClientRect().top, ref ? ref.getBoundingClientRect().top : Infinity) - gap;
    steps = [1.11, 1.08, 1.05];
  }
  if (!shown.length) return;
  const base = shown.map(e => parseFloat(getComputedStyle(e).fontSize));
  // In rem, not px: the slide scales with the window, and so must the grown words (a px size stays when the window changes).
  const rootPx = parseFloat(getComputedStyle(root).fontSize);
  for (const f of steps) {
    shown.forEach((e, i) => { e.style.fontSize = `${(base[i] * f / rootPx).toFixed(3)}rem`; });
    if (Math.max(...shown.map(e => e.getBoundingClientRect().bottom)) <= floor) return;
  }
  for (const e of shown) e.style.removeProperty('font-size');
}
/**
 * Split layout: the equation of this step goes into the column of words when it fits there and leaves
 * room for the meter; otherwise it takes a row of its own under the title (eq-row), and the column of
 * words and the figure start under that row.
 */
/**
 * The key sentence under the title (.lead, when it stands on its own above the equation) is large and may take two
 * lines: what comes under it moves down by as much as it ends lower than a one-line sentence of the original size
 * (169 units): the equations (--lead-shift), the boxes (--lead-end) and the figure (leadShift, in ctx.field).
 */
function placeLead(s) {
  const lead = [...s.el.children].find(e => { const cs = getComputedStyle(e); return e.matches('.lead') && cs.display !== 'none' && cs.position === 'absolute'; });
  if (!lead) return;
  const fr = $('frame').getBoundingClientRect(), bottom = (lead.getBoundingClientRect().bottom - fr.top) * 1600 / fr.width;
  leadShift = Math.max(0, Math.ceil(bottom - 169));
  leadBottom = bottom;
  s.el.style.setProperty('--lead-shift', `${leadShift / 20}rem`);
  s.el.style.setProperty('--lead-end', `${bottom / 20}rem`);
}
/**
 * The benefit box (.benefit) sits at the bottom of the slide, above the rail, or above the next line (p.next) when the slide
 * has one (--benefit-bottom); the caption moves up over the box (--cap-top), and the figure ends above them all (footTop,
 * in ctx.field). In the split layout they stay in the column of words.
 */
function placeFoot(s) {
  footTop = 0;
  for (const v of ['--cap-top', '--benefit-bottom']) s.el.style.removeProperty(v);
  const on = sel => [...s.el.children].find(e => { const cs = getComputedStyle(e); return e.matches(sel) && cs.display !== 'none' && cs.position === 'absolute'; });
  const box = on('.benefit');
  if (!box) return;
  const fr = $('frame').getBoundingClientRect(), unit = 1600 / fr.width, cap = on('.cap'), next = on('p.next');
  if (next) s.el.style.setProperty('--benefit-bottom', `${(900 - (next.getBoundingClientRect().top - fr.top) * unit + 10) / 20}rem`);
  footTop = (box.getBoundingClientRect().top - fr.top) * unit;
  if (cap) { footTop -= cap.getBoundingClientRect().height * unit + 12; s.el.style.setProperty('--cap-top', `${footTop / 20}rem`); }
}
/**
 * Equations side by side in a band (wide, or in their own row): as far apart as the band's room allows, up to 8rem, and
 * never closer than the band's own gap, so that each reads as its own. A column of words wraps its equations instead.
 */
function spaceEquations(s) {
  const rem = $('frame').getBoundingClientRect().width / 80;
  for (const band of s.el.querySelectorAll('.eqband')) {
    band.style.removeProperty('column-gap');
    const cs = getComputedStyle(band), eqs = [...band.children].filter(e => e.matches('mjx-container'));
    if (cs.display === 'none' || cs.position === 'static' || eqs.length < 2) continue;
    const own = parseFloat(cs.columnGap) / rem, free = band.clientWidth - eqs.reduce((a, e) => a + e.getBoundingClientRect().width, 0);
    band.style.columnGap = `${Math.max(own, Math.min(8, free / eqs.length / rem))}rem`;
  }
}
function placeEquation(s) {
  root.classList.remove('eq-row', 'eq-beside');
  for (const v of ['--col-top', '--col-w', '--lead-shift', '--lead-end']) s.el.style.removeProperty(v);
  colWidth = 560;
  eqRowSide = null;
  leadShift = 0;
  leadBottom = 0;
  if (!split || narrow) { placeLead(s); return; }
  const bands = [...s.el.querySelectorAll('.eqband')].filter(b => getComputedStyle(b).display !== 'none');
  if (!bands.length) {
    // No equation: the column of words may still ask for more room (data-wide on one of them, in stage units).
    const wide = [...s.el.children].find(e => e.hasAttribute('data-wide') && getComputedStyle(e).display !== 'none');
    if (wide) { colWidth = Number(wide.dataset.wide); s.el.style.setProperty('--col-w', `${colWidth / 20}rem`); }
    return;
  }
  const fr = $('frame').getBoundingClientRect(), unit = 1600 / fr.width, y = e => (e.getBoundingClientRect().bottom - fr.top) * unit;
  // The column widens to its widest equation (up to 790), and the figure takes the rest.
  const widest = Math.max(...bands.flatMap(b => [...b.querySelectorAll('mjx-container')].map(m => m.getBoundingClientRect().width * unit)));
  // A band marked data-beside always takes its own row (the key sentence above it across the slide, the figure beside it).
  if (widest <= 790 && !bands.some(b => b.hasAttribute('data-beside'))) {
    colWidth = Math.max(560, Math.ceil(widest) + 10);
    s.el.style.setProperty('--col-w', `${colWidth / 20}rem`);
    const words = [...s.el.children].filter(e => e.matches('.lead, .motive, .idea, .eqband, .cap, .benefit, p.next') && getComputedStyle(e).display !== 'none');
    if (Math.max(...words.map(y)) <= 660) return;   // clear of the meter under the words
    s.el.style.removeProperty('--col-w');
    colWidth = 560;
  }
  root.classList.add('eq-row');
  placeLead(s);
  eqRowBottom = Math.max(...bands.map(y));
  s.el.style.setProperty('--col-top', `${(eqRowBottom + 24) / 20}rem`);
  // Words under the row that need more room (data-wide on them: the column's width, in stage units); the figure takes the rest.
  const wide = [...s.el.children].find(e => e.hasAttribute('data-wide') && getComputedStyle(e).display !== 'none');
  if (wide) {
    colWidth = Number(wide.dataset.wide);
    s.el.style.setProperty('--col-w', `${colWidth / 20}rem`);
  }
  // A tall but narrow equation (data-beside on its band): the figure takes the room right of it, from the top of the row,
  // instead of the short strip under it. The band is only as wide as its equations, so it stays clear of the figure.
  // Equations on two lines (a wide one, then narrower ones): the figure goes beside the last line, from its top.
  if (bands.some(b => b.hasAttribute('data-beside'))) {
    root.classList.add('eq-beside');
    const eqs = bands.flatMap(b => [...b.querySelectorAll('mjx-container')]).map(m => m.getBoundingClientRect());
    const lastTop = Math.max(...eqs.map(q => q.top)), last = eqs.filter(q => q.top >= lastTop - 2);
    const top = last.length === eqs.length ? Math.min(...bands.map(b => b.getBoundingClientRect().top)) : lastTop;
    const right = Math.max(...last.map(q => (q.right - fr.left) * unit));
    eqRowSide = { x: Math.ceil(right) + 40, y: (top - fr.top) * unit };
    // The words under the equation are as wide as it: the figure is beside the equation, not beside them.
    colWidth = Math.max(560, Math.ceil(right) - 60);
    s.el.style.setProperty('--col-w', `${colWidth / 20}rem`);
  }
}
const next = () => {
  if (cur.step < scenes[cur.si].steps - 1) show(cur.si, cur.step + 1);
  else if (cur.si < scenes.length - 1) show(cur.si + 1, 0);
};
const prev = () => (cur.step > 0 ? show(cur.si, cur.step - 1) : cur.si > 0 && show(cur.si - 1, scenes[cur.si - 1].steps - 1));

// ---------------------------------------------------------------- the rail (no text: the room reads the chips)

// The talk only: the supplement (a part of 0 minutes) has no ticks, so on its slides the rail stays full. deck.mjs reads the
// number of scenes from __deckScenes, not from the ticks.
globalThis.__deckScenes = scenes.length;
function buildRail() {
  const rail = $('rail');
  rail.innerHTML = PARTS.map((p, k) => {
    if (!p.minutes) return '';
    const items = scenes.map((s, i) => [s, i]).filter(([s]) => s.part === k);
    return `<div class="rail-part" style="flex: ${items.length}">${items.map(([s, i]) =>
      `<button type="button" class="tick" data-i="${i}" title="${i + 1}. ${s.title.replace(/"/g, '&quot;')}" aria-label="Go to ${i + 1}: ${s.title.replace(/"/g, '&quot;')}"><i></i></button>`).join('')}</div>`;
  }).join('');
  rail.addEventListener('click', e => { const b = e.target.closest('.tick'); if (b) { show(Number(b.dataset.i), 0); b.blur(); } });
}
function updateRail() {
  for (const b of document.querySelectorAll('#rail .tick')) {
    const i = Number(b.dataset.i), s = scenes[i];
    b.classList.toggle('done', i < cur.si);
    b.style.setProperty('--fill', i === cur.si ? `${((cur.step + 1) / s.steps) * 100}%` : i < cur.si ? '100%' : '0%');
    b.toggleAttribute('aria-current', i === cur.si);
  }
}

// ---------------------------------------------------------------- the clock and the presenter

const clock = { start: null, paused: null };
const elapsed = () => (clock.start === null ? 0 : ((clock.paused ?? Date.now()) - clock.start) / 1000);
function planned(si) {
  const s = scenes[si];
  let before = 0;
  for (let k = 0; k < s.part; k++) before += PARTS[k].minutes;
  const inPart = scenes.filter(x => x.part === s.part), k = inPart.indexOf(s);
  return 60 * (before + PARTS[s.part].minutes * k / inPart.length);
}
const mmss = t => `${t < 0 ? '−' : ''}${Math.floor(Math.abs(t) / 60)}:${String(Math.floor(Math.abs(t) % 60)).padStart(2, '0')}`;
function capText(s, step) {
  for (const el of s.el.querySelectorAll('.cap[data-steps]')) if (el.dataset.steps.split(',').map(Number).includes(step)) return el.textContent.trim();
  return '';
}
function updatePresenter() {
  const box = PRESENTER ? $('presenter-window') : $('presenter');
  if (!box || (box.hidden && !PRESENTER)) return;
  const s = scenes[cur.si], t = elapsed(), diff = t - planned(cur.si);
  box.querySelector('.p-time').textContent = clock.start === null ? '0:00' : mmss(t);
  const pace = box.querySelector('.p-pace');
  pace.textContent = clock.start === null ? 'starts when you leave the title' : Math.abs(diff) < 20 ? 'on time' : diff > 0 ? `${mmss(diff)} behind` : `${mmss(-diff)} ahead`;
  pace.className = `p-pace ${clock.start === null || Math.abs(diff) < 20 ? '' : diff > 0 ? 'late' : 'early'}`;
  let end = 0;
  for (let k = 0; k <= s.part; k++) end += PARTS[k].minutes;
  box.querySelector('.p-plan').textContent = `${PARTS[s.part].name} ends at ${mmss(end * 60)} · talk ${mmss(PARTS.reduce((a, p) => a + p.minutes, 0) * 60)}`;
  box.querySelector('.p-now').textContent = `${cur.si + 1}. ${s.title} — step ${cur.step + 1} of ${s.steps}`;
  const n = cur.step < s.steps - 1 ? `step ${cur.step + 2}: ${capText(s, cur.step + 1)}` : scenes[cur.si + 1] ? `${cur.si + 2}. ${scenes[cur.si + 1].title}` : 'end';
  box.querySelector('.p-next').textContent = `Next: ${n}`;
}
setInterval(() => { if (!$('presenter').hidden || PRESENTER) updatePresenter(); }, 1000);
function togglePresenter() {
  $('presenter').hidden = !$('presenter').hidden;
  $('b-timer').setAttribute('aria-pressed', String(!$('presenter').hidden));
  updatePresenter();
}
function openPresenterWindow() {
  const w = window.open(location.href.split('#')[0] + '#presenter', 'isciia-presenter', 'width=1100,height=720');
  if (!w) togglePresenter();
}
function broadcast() {
  if (!PRESENTER) channel?.postMessage({ type: 'state', si: cur.si, step: cur.step, start: clock.start, paused: clock.paused });
}
const restartClock = () => { clock.start = Date.now(); clock.paused = null; updatePresenter(); broadcast(); };
channel?.addEventListener('message', ({ data }) => {
  if (PRESENTER && data.type === 'state') {
    clock.start = data.start; clock.paused = data.paused;
    if (data.si !== cur.si || data.step !== cur.step) show(data.si, data.step, { instant: true });
  } else if (!PRESENTER && data.type === 'cmd') {
    if (data.cmd === 'next') next(); else if (data.cmd === 'prev') prev(); else if (data.cmd === 'reset') restartClock();
  } else if (!PRESENTER && data.type === 'hello') broadcast();
});

// ---------------------------------------------------------------- overview, help, controls

function buildOverview() {
  $('overview-list').innerHTML = PARTS.map((p, k) => `<li class="ov-part"><h3>${p.name}</h3><ol>${scenes.map((s, i) => [s, i]).filter(([s]) => s.part === k)
    .map(([s, i]) => `<li><a href="#${i + 1}" data-i="${i}"><span class="ov-n">${String(i + 1).padStart(2, '0')}</span>${s.title}</a></li>`).join('')}</ol></li>`).join('');
  $('overview-list').addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault(); toggle('overview', false); show(Number(a.dataset.i), 0);
  });
}
function toggle(id, on) {
  const el = $(id);
  el.hidden = on === undefined ? !el.hidden : !on;
  if (!el.hidden) el.querySelector('a, button')?.focus();
}
function toggleControls() {
  root.classList.toggle('controls');
  $('b-controls').setAttribute('aria-pressed', String(root.classList.contains('controls')));
}

// ---------------------------------------------------------------- input

let typed = '';
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target, inRange = t.tagName === 'INPUT' && t.type === 'range', onButton = t.tagName === 'BUTTON' || t.tagName === 'A';
  const k = e.key;
  const send = cmd => (PRESENTER ? channel?.postMessage({ type: 'cmd', cmd }) : cmd === 'next' ? next() : prev());
  if (/^[0-9]$/.test(k)) { typed = (typed + k).slice(-2); return; }
  if (k === 'Enter' && typed) { show(Number(typed) - 1, 0); typed = ''; e.preventDefault(); return; }
  typed = '';
  if (k === 'PageDown' || (k === 'ArrowRight' && !inRange) || (k === 'ArrowDown' && !inRange) || (k === ' ' && !onButton)) {
    e.preventDefault();
    if (e.shiftKey && !PRESENTER) show(cur.si + 1, 0); else send('next');
  } else if (k === 'PageUp' || (k === 'ArrowLeft' && !inRange) || (k === 'ArrowUp' && !inRange)) {
    e.preventDefault();
    if (e.shiftKey && !PRESENTER) show(cur.si - 1, 0); else send('prev');
  } else if (k === 'Home') show(0, 0);
  else if (k === 'End') show(scenes.length - 1, 0);
  else if (k === 'l' || k === 'L') { setLook(document.documentElement.dataset.look === '2026' ? 'classic' : '2026'); ctx.rerender(); }
  else if (k === 'o' || k === 'O' || k === 'g' || k === 'G') toggle('overview');
  else if (k === 'p' || k === 'P') togglePresenter();
  else if (k === 'w' || k === 'W') openPresenterWindow();
  else if (k === 'c' || k === 'C') toggleControls();
  else if (k === 'r' || k === 'R') { if (PRESENTER) channel?.postMessage({ type: 'cmd', cmd: 'reset' }); else restartClock(); }
  else if (k === 'f' || k === 'F') fullscreen();
  else if (k === '?') toggle('help');
  else if (k === 'Escape') { $('overview').hidden = true; $('help').hidden = true; }
});
function fullscreen() {
  try { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); else root.requestFullscreen?.().catch(() => {}); } catch (e) {}
}
const clickBlur = (id, fn) => $(id)?.addEventListener('click', e => { fn(); e.currentTarget.blur(); });
clickBlur('b-prev', prev);
clickBlur('b-next', next);
clickBlur('b-overview', () => toggle('overview'));
clickBlur('b-timer', togglePresenter);
clickBlur('b-controls', toggleControls);
clickBlur('b-full', fullscreen);
clickBlur('b-help', () => toggle('help'));
clickBlur('b-window', openPresenterWindow);
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => toggle(b.dataset.close, false));
for (const id of ['p-prev', 'p-next']) clickBlur(id, () => (PRESENTER ? channel?.postMessage({ type: 'cmd', cmd: id === 'p-next' ? 'next' : 'prev' }) : id === 'p-next' ? next() : prev()));
for (const id of ['p-reset', 'p-reset2']) clickBlur(id, () => (PRESENTER ? channel?.postMessage({ type: 'cmd', cmd: 'reset' }) : restartClock()));

// The operator buttons show while the mouse moves, and leave the room's view otherwise.
let idle = 0;
const wake = () => {
  $('tools').classList.remove('idle');
  clearTimeout(idle);
  idle = setTimeout(() => { if (!$('tools').matches(':hover, :focus-within')) $('tools').classList.add('idle'); }, 2500);
};
document.addEventListener('pointermove', wake, { passive: true });
wake();

// Swipe on touch screens, anywhere on the slide, but not on controls and not when the stage took the touch (a drag).
// Touch events, since the browser may cancel pointer events for its own gestures.
let touch = null;
document.addEventListener('touchstart', e => {
  touch = e.touches.length === 1 && !e.target.closest('input, button, a, select, textarea, .sheet, #tools') ? [e.touches[0].clientX, e.touches[0].clientY] : null;
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!touch) return;
  const t = e.changedTouches[0], dx = t.clientX - touch[0], dy = t.clientY - touch[1];
  touch = null;
  if (!stage.claimed && Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) (dx < 0 ? next : prev)();
}, { passive: true });
window.addEventListener('hashchange', () => { const [a, b] = parseHash(); if (a !== cur.si || b !== cur.step) show(a, b); });
function parseHash() {
  const m = location.hash.match(/^#(\d+)(?:\.(\d+))?$/);
  return m ? [Number(m[1]) - 1, m[2] ? Number(m[2]) - 1 : 0] : [0, 0];
}

// ---------------------------------------------------------------- equations linked to the stage

/**
 * Terms written \class{t-name}{...} in the TeX can be lit by a step (ctx.highlight) or by the
 * pointer; the scene's term(name, on) draws what the term stands for. A transparent rectangle
 * over each term catches the pointer, since glyph outlines alone are hard to hit.
 */
function hookTerms() {
  for (const g of document.querySelectorAll('mjx-container svg g[class*="t-"]')) {
    const name = [...g.classList].find(c => c.startsWith('t-'))?.slice(2);
    if (!name || g.dataset.term) continue;
    g.dataset.term = name;
    const b = g.getBBox(), rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    for (const [k, v] of [['x', b.x - 40], ['y', b.y - 40], ['width', b.width + 80], ['height', b.height + 80], ['fill', 'none'], ['pointer-events', 'all']]) rect.setAttribute(k, v);
    g.prepend(rect);
    g.classList.add('term');
    const on = flag => {
      const s = scenes[cur.si];
      if (!s.el.contains(g)) return;
      g.classList.toggle('hot', flag);
      s.term?.(ctx, name, flag);
      stage.wake();
    };
    g.addEventListener('pointerenter', () => on(true));
    g.addEventListener('pointerleave', () => on(false));
  }
}

// ---------------------------------------------------------------- start

buildRail();
buildOverview();
if (PRESENTER) {
  root.classList.add('presenter-mode');
  $('presenter-window').hidden = false;
  channel?.postMessage({ type: 'hello' });
}
const [s0, t0] = parseHash();
// The look (index.html, "Look 2026"): DEFAULT_LOOK, or ?look=classic in the address; L switches. 'classic' goes back.
const DEFAULT_LOOK = '2026';
function setLook(look) { document.documentElement.dataset.look = look; applyLook(look); outlineLook(look); }
setLook(new URLSearchParams(location.search).get('look') ?? DEFAULT_LOOK);
// The talk site's QR code, small at the top right of the slides (index.html: #corner-qr); the address is data-site of About me.
{
  const box = $('corner-qr'), site = document.querySelector('[data-id="about"]')?.dataset.site?.trim();
  if (box && site && window.qrcode) { const q = window.qrcode(0, 'M'); q.addData(site); q.make(); box.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); box.href = site; }
}
show(PRESENTER ? 0 : s0, PRESENTER ? 0 : t0, { instant: PRESENTER });
// Once the equations exist, a scene that lights terms in its steps is shown again so the light lands.
// A split step places its figure under its equation, so it is drawn again once the equation has its size.
/** No line starts with a comma, colon or closing bracket: the one after inline math stays on the math's line. */
function gluePunctuation() {
  for (const m of document.querySelectorAll('#copy mjx-container:not([display="true"])')) {
    const t = m.nextSibling, k = t?.nodeType === 3 ? (t.textContent.match(/^[,.:;)?!’]+/u)?.[0].length ?? 0) : 0;
    if (!k || m.parentElement.classList.contains('nobr')) continue;
    t.splitText(k);
    const wrap = document.createElement('span');
    wrap.className = 'nobr';
    m.replaceWith(wrap);
    wrap.append(m, t);
  }
}
const termsReady = () => { gluePunctuation(); hookTerms(); if (!PRESENTER) ctx.rerender(); };
// The layout is measured (the key sentence, the words at the bottom, the grown words, the gaps between equations): measure
// again when the window changes size (full screen, a resized viewer) or the fonts arrive.
let relayout = 0;
const measureAgain = () => { clearTimeout(relayout); relayout = setTimeout(() => { if (!PRESENTER && cur.si >= 0) ctx.rerender(); }, 150); };
window.addEventListener('resize', measureAgain);
document.fonts?.ready?.then(measureAgain);
window.MathJax?.startup?.promise?.then(termsReady).catch(err => console.error(err));
document.addEventListener('mathjax-ready', termsReady);
