/**
 * The computations of the talk that UbuKit does not provide, as in experiments/methods:
 * rough c-means with region weights (LRCM, PRCM, GRCM, ExRCM), RSCM and RMCM2, checked
 * against the saved Python results; and SOM-OLP split into its three block updates, so that the
 * objective can be shown after each one.
 *
 * Points X and prototypes B are arrays of rows. The clustering methods are generators in UbuKit's
 * protocol: they yield { iteration, result } after each iteration, result() giving the state there,
 * and return the final state { B, labels, mu, region, history, nIter, converged }.
 */

export const sqd = (a, b) => {
  let s = 0;
  for (let f = 0; f < a.length; f++) s += (a[f] - b[f]) ** 2;
  return s;
};

/** Squared distances to the prototypes, n x K. */
export function distances(X, B) {
  const K = B.length, D = new Float64Array(X.length * K);
  X.forEach((x, i) => B.forEach((b, c) => (D[i * K + c] = sqd(x, b))));
  return D;
}

/** N_i = { j : ||x_i - x_j|| <= r }, self included, ascending (the kernel P_ij = 1/|N_i| on N_i). */
export function neighborhoods(X, r) {
  const n = X.length, r2 = (r + 1e-12) ** 2, hood = X.map((_, i) => [i]);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (sqd(X[i], X[j]) <= r2) { hood[i].push(j); hood[j].push(i); }
  }
  for (const list of hood) list.sort((a, b) => a - b);
  return hood;
}

/** Row-wise argmin of an n x K cost that keeps the previous label when it is among the minimizers. */
function stableArgmin(cost, K, previous) {
  const n = cost.length / K, labels = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let best = 0;
    for (let c = 1; c < K; c++) if (cost[i * K + c] < cost[i * K + best]) best = c;
    if (previous && Math.abs(cost[i * K + previous[i]] - cost[i * K + best]) <= 1e-12) best = previous[i];
    labels[i] = best;
  }
  return labels;
}

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function mean(X, idx) {
  const out = new Array(X[0].length).fill(0);
  for (const i of idx) X[i].forEach((v, f) => (out[f] += v / idx.length));
  return out;
}

/** mu_ci = (1/|N_i|) sum_{j in N_i} u_cj for hard labels u: counted, then divided, so 0 and 1 are exact. */
export function roughMembership(hood, labels, K) {
  const mu = new Float64Array(hood.length * K);
  hood.forEach((list, i) => {
    list.forEach(j => (mu[i * K + labels[j]] += 1));
    for (let c = 0; c < K; c++) mu[i * K + c] /= list.length;
  });
  return mu;
}

/**
 * Candidate clusters of one point (ExRCM): c is a candidate when d_c^zeta <= (alpha d_min)^zeta + beta^zeta,
 * d the distances (not squared). zeta = 1 is GRCM; then alpha = 1 is LRCM and beta = 0 is PRCM.
 */
export function candidates(d, alpha, beta, zeta) {
  const dmin = Math.min(...d), bound = (alpha * dmin) ** zeta + beta ** zeta;
  return d.map(v => v ** zeta <= bound * (1 + 1e-12));
}

/** Upper approximations (n x K, 0/1) and regions of rough c-means for the prototypes B. */
export function roughRegions(X, B, alpha, beta, zeta) {
  const K = B.length, upper = new Uint8Array(X.length * K), region = new Int8Array(X.length);
  X.forEach((x, i) => {
    const cand = candidates(B.map(b => Math.sqrt(sqd(x, b))), alpha, beta, zeta);
    cand.forEach((ok, c) => (upper[i * K + c] = ok ? 1 : 0));
    const count = cand.filter(Boolean).length;
    region[i] = count === 1 ? cand.indexOf(true) : -1;
  });
  return { upper, region };
}

function roughState(B, upper, region, nIter, converged) {
  const K = B.length, n = region.length, mu = new Float64Array(n * K), labels = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let count = 0;
    for (let c = 0; c < K; c++) count += upper[i * K + c];
    for (let c = 0; c < K; c++) mu[i * K + c] = upper[i * K + c] / count;
    labels[i] = region[i] >= 0 ? region[i] : upper.subarray(i * K, (i + 1) * K).indexOf(1);
  }
  return { B: B.map(b => b.slice()), labels, mu, region: Int8Array.from(region), history: [], nIter, converged };
}

/**
 * Rough c-means (LRCM by default; GRCM and ExRCM thresholds through alpha, beta, zeta). Upper
 * membership ū_ci = 1 when c is a candidate; lower membership u̲_ci = 1 when c is the only one.
 * Prototype: the mean weighted by the normalized upper membership ũ_ci = ū_ci / Σ_k ū_ki. No objective.
 */
export function* roughCMeans(X, B0, { alpha = 1, beta = 0.35, zeta = 1, maxIter = 100 } = {}) {
  let B = B0.map(b => b.slice()), upper = null;
  const K = B.length, d = X[0].length;
  for (let t = 1; t <= maxIter; t++) {
    const next = roughRegions(X, B, alpha, beta, zeta);
    if (upper && same(next.upper, upper)) return roughState(B, next.upper, next.region, t - 1, true);
    upper = next.upper;
    // Each prototype: the mean weighted by the normalized upper membership, ũ_ci = ū_ci / Σ_k ū_ki.
    const sums = B.map(() => new Array(d).fill(0)), mass = new Array(K).fill(0);
    X.forEach((x, i) => {
      let count = 0;
      for (let c = 0; c < K; c++) count += upper[i * K + c];
      for (let c = 0; c < K; c++) if (upper[i * K + c]) { const w = 1 / count; mass[c] += w; x.forEach((v, f) => (sums[c][f] += w * v)); }
    });
    B = B.map((b, c) => (mass[c] > 0 ? sums[c].map(v => v / mass[c]) : b));
    const after = roughRegions(X, B, alpha, beta, zeta), snap = roughState(B, after.upper, after.region, t, false);
    yield { iteration: t, result: () => snap };
  }
  const last = roughRegions(X, B, alpha, beta, zeta);
  return roughState(B, last.upper, last.region, maxIter, false);
}

/** Lower {mu = 1} and upper {mu > 0} approximations as regions. */
function granularRegions(mu, K) {
  const n = mu.length / K, region = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    region[i] = -1;
    for (let c = 0; c < K; c++) if (mu[i * K + c] >= 1 - 1e-12) region[i] = c;
  }
  return region;
}

/**
 * Rough set c-means (RSCM): nearest-prototype labels, rough membership over the neighborhoods,
 * lower {mu = 1}, upper {mu > 0}; prototype w[0] * lower + w[1] * upper + w[2] * boundary centroids
 * when the lower approximation and the boundary are nonempty, else the upper centroid. No objective.
 */
export function* rscm(X, B0, hood, { w = [0.7, 0, 0.3], maxIter = 100 } = {}) {
  const K = B0.length;
  let B = B0.map(b => b.slice()), labels = null, mu = null;
  const state = (t, converged) => ({ B: B.map(b => b.slice()), labels: Int32Array.from(labels), mu: Float64Array.from(mu),
    region: granularRegions(mu, K), history: [], nIter: t, converged });
  for (let t = 1; t <= maxIter; t++) {
    const next = stableArgmin(distances(X, B), K, labels);
    if (labels && same(next, labels)) return state(t - 1, true);
    labels = next;
    mu = roughMembership(hood, labels, K);
    B = B.map((b, c) => {
      const lower = [], upper = [], boundary = [];
      X.forEach((_, i) => {
        const m = mu[i * K + c];
        if (m > 1e-12) upper.push(i);
        if (m >= 1 - 1e-12) lower.push(i);
        else if (m > 1e-12) boundary.push(i);
      });
      if (lower.length && boundary.length) {
        const a = mean(X, lower), u = mean(X, upper), z = mean(X, boundary);
        return a.map((v, f) => w[0] * v + w[1] * u[f] + w[2] * z[f]);
      }
      return upper.length ? mean(X, upper) : b;
    });
    const snap = state(t, false);
    yield { iteration: t, result: () => snap };
  }
  return state(maxIter, false);
}

/** b_c = sum_i mu_ci x_i / sum_i mu_ci; a prototype without weight stays. */
function weightedCenters(X, mu, B) {
  const K = B.length;
  return B.map((b, c) => {
    let s = 0;
    const acc = new Array(b.length).fill(0);
    X.forEach((x, i) => {
      const m = mu[i * K + c];
      if (m > 0) { s += m; x.forEach((v, f) => (acc[f] += m * v)); }
    });
    return s > 0 ? acc.map(v => v / s) : b.slice();
  });
}

/** J = sum_c sum_i mu_ci ||x_i - b_c||^2. */
export function roughObjective(X, B, mu) {
  const K = B.length, D = distances(X, B);
  let J = 0;
  for (let k = 0; k < D.length; k++) J += mu[k] * D[k];
  return J;
}

/** q_cj = sum_i P_ij ||x_i - b_c||^2: the errors around j that its label c takes on (n x K). */
export function labelCosts(X, B, hood) {
  const K = B.length, D = distances(X, B), Q = new Float64Array(X.length * K);
  hood.forEach((list, i) => list.forEach(j => {
    for (let c = 0; c < K; c++) Q[j * K + c] += D[i * K + c] / list.length;
  }));
  return Q;
}

/**
 * RMCM2: label j by argmin_c q_cj, then b_c = sum_i mu_ci x_i / sum_i mu_ci; both minimize
 * J = sum_c sum_i mu_ci ||x_i - b_c||^2, recorded after each update.
 */
export function* rmcm2(X, B0, hood, { maxIter = 100 } = {}) {
  const K = B0.length, history = [];
  let B = B0.map(b => b.slice()), labels = null, mu = null;
  const state = (t, converged) => ({ B: B.map(b => b.slice()), labels: Int32Array.from(labels), mu: Float64Array.from(mu),
    region: null, history: history.slice(), nIter: t, converged });
  for (let t = 1; t <= maxIter; t++) {
    const next = stableArgmin(labelCosts(X, B, hood), K, labels);
    if (labels && same(next, labels)) return state(t - 1, true);
    labels = next;
    mu = roughMembership(hood, labels, K);
    B = weightedCenters(X, mu, B);
    history.push(roughObjective(X, B, mu));
    const snap = state(t, false);
    yield { iteration: t, result: () => snap };
  }
  return state(maxIter, false);
}

/** A UbuKit Result in the state shape above. */
export function fromUbukit(r) {
  const K = r.centers.rows, d = r.centers.cols;
  const B = Array.from({ length: K }, (_, c) => Array.from(r.centers.data.subarray(c * d, (c + 1) * d)));
  return { B, labels: Int32Array.from(r.labels), mu: r.membership ? Float64Array.from(r.membership.data) : null, region: null,
    history: Array.from(r.history), nIter: r.nIter, converged: r.stopReason === 'tol' };
}

/** k-means++ seeding with a seeded generator (mulberry32), for starts shared by several methods. */
export function kmeansPlusPlus(X, k, seed) {
  const rand = mulberry32(seed), idx = [Math.floor(rand() * X.length)];
  while (idx.length < k) {
    const d2 = X.map(p => Math.min(...idx.map(j => sqd(p, X[j]))));
    let u = rand() * d2.reduce((a, b) => a + b, 0), i = 0;
    while (i < X.length - 1 && u > d2[i]) { u -= d2[i]; i++; }
    idx.push(i);
  }
  return idx.map(j => X[j].slice());
}

export function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- SOM-OLP, block by block

/**
 * SOM-OLP as block coordinate descent on
 *   J = sum_ic u_ci (||x_i - b_c||^2 + gamma ||v_i - r_c||^2) + lam sum_ic u_ci ln u_ci,
 * starting from memberships U0 and prototypes B0 (UbuKit's first iteration). Each step minimizes J
 * over one block with the others fixed, in closed form:
 *   u: u_ci = softmax_c(-q_ci / lam);  v: v_i = sum_c u_ci r_c;  b: b_c = sum_i u_ci x_i / sum_i u_ci.
 * Yields { block: 'start' | 'u' | 'v' | 'b', iteration, J, U, V, B } (typed arrays, row-major).
 */
export function* olpBlocks(X, Y, { lam, gamma, U0, B0, maxIter = 300 }) {
  const n = X.length, K = Y.length, d = X[0].length;
  const x = Float64Array.from(X.flat()), y = Float64Array.from(Y.flat());
  let U = Float64Array.from(U0), B = Float64Array.from(B0.flat()), V = new Float64Array(n * 2);
  const latent = () => {
    V = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) for (let c = 0; c < K; c++) { const u = U[i * K + c]; V[2 * i] += u * y[2 * c]; V[2 * i + 1] += u * y[2 * c + 1]; }
  };
  const cost = (i, c) => {
    let s = 0;
    for (let f = 0; f < d; f++) s += (x[i * d + f] - B[c * d + f]) ** 2;
    return s + gamma * ((V[2 * i] - y[2 * c]) ** 2 + (V[2 * i + 1] - y[2 * c + 1]) ** 2);
  };
  const objective = () => {
    let J = 0;
    for (let i = 0; i < n; i++) for (let c = 0; c < K; c++) {
      const u = U[i * K + c];
      if (u > 0) J += u * cost(i, c) + lam * u * Math.log(u);
    }
    return J;
  };
  const state = (block, iteration) => ({ block, iteration, J: objective(), U: Float64Array.from(U), V: Float64Array.from(V), B: Float64Array.from(B) });
  latent();
  yield state('start', 0);
  const q = new Float64Array(K);
  for (let t = 1; t <= maxIter; t++) {
    for (let i = 0; i < n; i++) {
      let low = Infinity;
      for (let c = 0; c < K; c++) { q[c] = cost(i, c); low = Math.min(low, q[c]); }
      let sum = 0;
      for (let c = 0; c < K; c++) sum += U[i * K + c] = Math.exp(-(q[c] - low) / lam);
      for (let c = 0; c < K; c++) U[i * K + c] /= sum;
    }
    yield state('u', t);
    latent();
    yield state('v', t);
    const next = new Float64Array(K * d);
    for (let c = 0; c < K; c++) {
      let s = 0;
      for (let i = 0; i < n; i++) { const u = U[i * K + c]; s += u; for (let f = 0; f < d; f++) next[c * d + f] += u * x[i * d + f]; }
      for (let f = 0; f < d; f++) next[c * d + f] = s > 0 ? next[c * d + f] / s : B[c * d + f];
    }
    B = next;
    yield state('b', t);
  }
}

/** Unit coordinates of a side x side lattice in [-1, 1]^2, row-major: [row, col]. */
export const lattice = side => Array.from({ length: side * side }, (_, j) => [-1 + 2 * Math.floor(j / side) / (side - 1), -1 + 2 * (j % side) / (side - 1)]);

/** A flat start for the saddle maps: the lattice on the plane z = 0, spread like the data's two principal axes. */
export const flatStart = (side, spread) => lattice(side).map(([r, c]) => [c * spread, r * spread, 0]);
