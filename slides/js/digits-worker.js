/**
 * Batch SOM and SOM-OLP on Digits (1797 points in 64 dimensions, a 16 x 16 lattice), off the main
 * thread: about six seconds of work, started when the deck opens, so the scene has it in time.
 * Message in: { X (standardized rows), side, lam, gamma, lamHard }. Messages out: { kind: 'som' | 'olp' | 'olpHard', result }:
 * olpHard is SOM-OLP again with a small λ (lamHard), its data points bound to the nodes.
 */
import * as A from './algo.js';

// The handler is set at once; a message that came while UbuKit was still loading would be lost.
const ubukit = import('../vendor/ubukit/src/index.js').catch(() => import('https://cdn.jsdelivr.net/npm/ubukit@0.2.0/src/index.js'));

/** A Result as plain data (typed arrays survive the message). */
const plain = r => ({
  centers: { rows: r.centers.rows, cols: r.centers.cols, data: Float64Array.from(r.centers.data) },
  embedding: { rows: r.embedding.rows, cols: r.embedding.cols, data: Float64Array.from(r.embedding.data) },
  history: Array.from(r.history), nIter: r.nIter, stopReason: r.stopReason,
});

self.onmessage = async ({ data: { X, side, lam, gamma, lamHard } }) => {
  const ub = await ubukit;
  postMessage({ kind: 'som', result: plain(ub.batchSom(X, [side, side], { epochs: 60, sigma: 4, sigmaEnd: 0.5 })) });
  // The talk's stopping rule (as the public implementation): relative change of J at most 1e-4.
  const olp = l => {
    const gen = ub.steps.somOlp(X, A.lattice(side), { lam: l, gamma, maxIter: 1000, tol: 0 });
    for (;;) {
      const { value, done } = gen.next(), r = done ? value : value.result(), h = r.history, n = h.length;
      if (done || (n >= 3 && Math.abs(h[n - 1] - h[n - 2]) / Math.max(1, Math.abs(h[n - 2])) <= 1e-4)) return plain(r);
    }
  };
  postMessage({ kind: 'olp', result: olp(lam) });
  if (lamHard) postMessage({ kind: 'olpHard', result: olp(lamHard) });
};
