/**
 * The objective meter, a fixed slot at the top right of the figure: the method, its objective J
 * per iteration on axes that stay fixed during a run, and a verdict. The verdict reports what was
 * observed in this run ("No increase observed"); a theoretical guarantee is said in the caption.
 * Methods whose updates are rules show a short description of the updates instead of a curve.
 */
const BLOCK = { u: '#0072B2', v: '#009E73', b: '#D55E00', start: '#4F5B6A' };
const INK = '#13202E', MUTED = '#4F5B6A', LINE = '#C3CCD7';

export class Meter {
  constructor(root) {
    this.root = root;
    root.innerHTML = '<div class="m-name"></div><div class="m-chart"><canvas aria-hidden="true"></canvas></div><div class="m-verdict"></div>';
    this.name = root.querySelector('.m-name');
    this.verdict = root.querySelector('.m-verdict');
    this.canvas = root.querySelector('canvas');
    this.data = null;
    new ResizeObserver(() => this.draw()).observe(this.canvas.parentElement);
  }

  /**
   * values: J per iteration (or per block update); from: first index shown; tags: the block of
   * each value; rule: text shown in place of a curve; yRange / xMax: fixed axes for a run that is
   * still being animated; xLabel: the horizontal axis.
   */
  show({ name, values = [], from = 0, tags = null, rule = null, verdict = null, yRange = null, xMax = null, xLabel = 'iteration' }) {
    const ys = Array.from(values).slice(from);
    this.data = { ys, tags: tags ? tags.slice(from) : null, rule, yRange, xMax: xMax === null ? null : xMax - from, xLabel };
    this.root.hidden = false;
    document.documentElement.classList.add('meter-on');
    // $…$ marks math in the name: its letters in italic, as in the equations.
    this.name.innerHTML = String(name).split('$').map((part, k) => {
      const safe = part.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return k % 2 ? safe.replace(/[A-Za-zα-ω]+/gu, w => `<i>${w}</i>`) : safe;
    }).join('');
    if (rule) {
      this.verdict.textContent = '';
      this.verdict.className = 'm-verdict rule';
    } else {
      let rise = 0;
      for (let t = 1; t < ys.length; t++) if (ys[t] > ys[t - 1] + 1e-9 * Math.max(1, Math.abs(ys[t - 1]))) rise++;
      this.verdict.textContent = verdict ?? (ys.length < 2 ? '' : rise === 0 ? 'No increase observed' : `Increased ${rise}×`);
      this.verdict.className = `m-verdict ${rise === 0 ? 'down' : 'up'}`;
    }
    this.draw();
  }
  hide() { this.root.hidden = true; this.data = null; document.documentElement.classList.remove('meter-on'); }

  draw() {
    const c = this.canvas, r = c.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (r.width < 2 || r.height < 2) return;
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    const d = this.data;
    if (!d) return;
    // Text at 28 stage units: one rem is 20 units.
    const unit = parseFloat(getComputedStyle(document.documentElement).fontSize) / 20, fs = 28 * unit, w = r.width, h = r.height;
    ctx.font = `600 ${fs}px "Source Sans 3", "Source Sans 3 Local", "Segoe UI", sans-serif`;
    if (d.rule) {
      // No curve for rules: their line, large, in the middle of the slot.
      ctx.font = `700 ${36 * unit}px "Source Sans 3", "Source Sans 3 Local", "Segoe UI", sans-serif`;
      ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(d.rule, 0, h / 2);
      return;
    }
    const L = fs * 0.9, B = fs * 1.15, plotW = w - L - 4, plotH = h - B - 4;
    // Axes and their names.
    ctx.strokeStyle = LINE; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(L, 2); ctx.lineTo(L, 2 + plotH); ctx.lineTo(L + plotW, 2 + plotH); ctx.stroke();
    ctx.fillStyle = MUTED; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = `italic 600 ${fs}px "Source Sans 3", "Source Sans 3 Local", "Segoe UI", sans-serif`;
    ctx.fillText('J', 0, 2 + plotH * 0.35);
    ctx.font = `600 ${fs}px "Source Sans 3", "Source Sans 3 Local", "Segoe UI", sans-serif`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${d.xLabel} →`, w - 2, h);
    const ys = d.ys;
    if (!ys.length) return;
    let [lo, hi] = d.yRange ?? [Math.min(...ys), Math.max(...ys)];
    if (hi - lo < 1e-12) { lo -= 1; hi += 1; }
    const n = Math.max(d.xMax ?? ys.length, ys.length);
    const X = i => L + 6 + (n <= 1 ? plotW / 2 : (plotW - 12) * i / (n - 1));
    const Y = v => 6 + (plotH - 12) * (hi - v) / (hi - lo);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4 * unit * 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (d.tags) ys.forEach((v, i) => { if (i) { ctx.lineTo(X(i), Y(ys[i - 1])); ctx.lineTo(X(i), Y(v)); } else ctx.moveTo(X(i), Y(v)); });
    else ys.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
    ctx.stroke();
    const dots = ys.length <= 60;
    ys.forEach((v, i) => {
      if (!dots && i !== ys.length - 1) return;
      ctx.fillStyle = d.tags ? BLOCK[d.tags[i]] ?? INK : INK;
      ctx.beginPath(); ctx.arc(X(i), Y(v), (i === ys.length - 1 ? 5 : 3.4) * unit * 2, 0, Math.PI * 2); ctx.fill();
    });
  }
}
export const BLOCK_COLORS = BLOCK;
