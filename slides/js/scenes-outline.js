/**
 * The overview of the talk, and the same cards again before each part with that part lit, so the
 * room always knows which part comes next. The talk has four parts: the introduction and three
 * parts. Each card: the part, what it does, and its methods (green: ours), typed as
 * rule-based updates or the minimization of one objective.
 */
import { FONT, text, plate, labelSize, labelWidth } from './common.js';

const CARDS = [
  { head: ['Introduction', 'Clustering:', 'k-means and FCM'], q: ['Crisp clusters,', 'then degrees'], methods: [['k-means', 'obj'], ['FCM', 'obj']] },
  { head: ['Part 1', 'Rough Clustering', '(Distances)'], q: ['Uncertain regions', 'found by distances'], methods: [['RCM', 'rule'], ['ExRCM', 'rule', 1]] },
  { head: ['Part 2', 'Rough Clustering', '(Neighborhoods)'], q: ['Uncertainty by', 'neighborhoods;', 'graphs from overlaps'], methods: [['RMCM2', 'obj', 1]] },
  { head: ['Part 3', 'Topographic', 'Mapping'], q: ['Prototypes kept', 'in order on a map'], methods: [['SOM', 'rule'], ['Batch SOM', 'rule'], ['SOM-OLP', 'obj', 1]] },
];

// The outline slides are dark (index.html: data-theme="dark"), so that the room sees a break between parts.
const K = {
  card: '#172433', line: '#3A4A5C', title: '#F3F6FA', ink: '#E3E9F0', muted: '#A7B2BF', hl: '#A9C1EC', ours: '#4FD1A5',
  obj: ['#163A55', '#5BA8DD'], rule: ['#2A3644', '#6E7D8E'],
};
const PLATE = { bg: K.card, border: K.line, color: K.ink };
// Look 2026: glass cards on the navy-to-green gradient of the frame (index.html), and the talk site's light accents.
const K0 = { ...K }, K26 = { card: 'rgba(255, 255, 255, 0.07)', line: 'rgba(255, 255, 255, 0.22)', hl: '#9DC1EA', ours: '#63D3A6' };
export function outlineLook(look) {
  Object.assign(K, K0, look === '2026' ? K26 : {});
  Object.assign(PLATE, { bg: K.card, border: K.line, color: K.ink });
}

function chip(g, s, x, y, { type, ours, typed }) {
  g.save();
  const z = labelSize(30);
  g.font = `700 ${z}px ${FONT.body}`;
  const w = g.measureText(s).width + 26, h = Math.round(z * 1.4), [fill, edge] = typed ? K[type] : [K.card, K.line];
  g.fillStyle = fill; g.strokeStyle = edge; g.lineWidth = 2;
  g.beginPath(); g.roundRect(x, y, w, h, 23); g.fill(); g.stroke();
  g.fillStyle = ours ? K.ours : K.ink; g.textBaseline = 'middle'; g.fillText(s, x + 13, y + h / 2 + 1);
  g.restore();
  return w;
}

export default function outlines(ctx) {
  const S = ctx.stage, M = ctx.meter;

  /**
   * The four parts as cards in a row. focus: the part about to start (0 to 3), the rest faded; null
   * for the overview; supplement: a row under the cards for the material after the last slide, and
   * the part it belongs to (focus). No key: the cards say it all (green names are ours).
   */
  function draw(ctx, { focus = null, supplement = null } = {}) {
    M.hide();
    const F = ctx.field(), card = 372, gap = 28, extra = supplement ? 76 : 0, typed = false;
    const y0 = F.y + Math.max(0, (F.h - card - extra) / 2), cols = ctx.panels({ x: F.x, y: y0, w: F.w, h: card }, 4, { gap }), below = y0 + card + 30;
    const faded = k => focus !== null && k !== focus;
    S.over = g => {
      cols.forEach((r, k) => {
        const c = CARDS[k];
        g.save();
        g.globalAlpha *= faded(k) ? 0.4 : 1;
        g.fillStyle = K.card; g.strokeStyle = focus === k ? K.title : K.line; g.lineWidth = focus === k ? 5 : 2;
        g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, 14); g.fill(); g.stroke();
        // The part's label, its name on two lines, then its question.
        text(g, c.head[0], r.x + 20, r.y + 40, { size: 28, weight: 700, color: K.muted, halo: false });
        c.head.slice(1).forEach((s, j) => text(g, s, r.x + 20, r.y + 78 + j * 34, { size: 30, weight: 760, family: FONT.display, color: K.title, halo: false }));
        c.q.forEach((s, j) => text(g, s, r.x + 20, r.y + 160 + j * 34, { size: 28, weight: 700, color: K.hl, halo: false }));
        // Method chips, wrapped to the card; green names are ours.
        let x = r.x + 20, y = r.y + 262;
        for (const [name, type, ours] of c.methods) {
          const cw = labelWidth(g, name, 30) + 26;
          if (x + cw > r.x + r.w - 14) { x = r.x + 20; y += 56; }
          x += chip(g, name, x, y, { type, ours, typed }) + 10;
        }
        g.restore();
      });
      if (supplement) {
        const sy = below, { w } = plate(g, 'Supplement', F.x, sy, { ...PLATE, color: K.hl, border: K.hl });
        // Each supplement: its methods as a chip, and the part it belongs to.
        let x = F.x + w + 20;
        for (const [name, note] of supplement) {
          const cw = chip(g, name, x, sy - 1, { type: 'obj', typed: false });
          text(g, note, x + cw + 12, sy + 33, { size: 30, weight: 700, color: K.hl, halo: false });
          x += cw + 12 + labelWidth(g, note, 30) + 30;
        }
      }
    };
  }

  // The overview, on one slide: the four parts and our answers (methods).
  const outline = {
    id: 'outline', steps: 1,
    narrowAspect: () => 0.82,
    show(ctx, step, { dur }) { S.set([], { dur }); draw(ctx); },
  };
  const part = [1, 2, 3].map(k => ({
    id: 'toc' + k, steps: 1,
    narrowAspect: () => 0.82,
    show(ctx, step, { dur }) { S.set([], { dur }); draw(ctx, { focus: k }); },
  }));
  // Between the last slide and the supplement: the talk ends here, and what follows is for questions (Parts 2 and 3).
  const supplement = {
    id: 'supp', steps: 1,
    show(ctx, step, { dur }) { S.set([], { dur }); draw(ctx, { supplement: [['RSCM · RMCM · Recommendation', ''], ["Manifolds · SOM-OLP · Heskes's SOM", '']] }); },
  };
  return { outline, part, supplement };
}
