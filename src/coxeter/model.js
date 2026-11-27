export const symbols = ["s", "t", "u"];

function model(id, title, family, exponents, description, { depth = 4, max = 7, coupling } = {}) {
  const rank = exponents.length;
  const gram = exponents.map((row, i) => row.map((m, j) => {
    if (i === j) return 1;
    if (coupling) return -coupling[0] / coupling[1];
    if (m === Infinity) return -1;
    if (m === 2) return 0;
    if (m === 3) return -0.5;
    return -Math.cos(Math.PI / m);
  }));
  return { id, title, family, rank, exponents, gram, coupling, description, depth, max };
}

function dihedral(id, title, order) {
  return model(id, title, "Finite dihedral", [[1, order], [order, 1]],
    "The complete gallery contains " + 2 * order + " chambers and fills the dual plane.",
    { depth: order, max: order });
}

function infinite(id, title, coupling, description) {
  const c = coupling[0] / coupling[1];
  // Hyperbolic rays converge exponentially in the fan. Stop short of rounding them together.
  const max = c === 1 ? 24 : Math.min(16, Math.floor(13 / Math.acosh(c)));
  return model(id, title, c === 1 ? "Affine" : "Indefinite",
    [[1, Infinity], [Infinity, 1]], description,
    { coupling, depth: c === 1 ? 6 : 4, max });
}

function triangle(id, title, family, [st, tu, us], description) {
  return model(id, title, family, [[1, st, us], [st, 1, tu], [us, tu, 1]], description,
    { depth: 4, max: family === "Affine" ? 9 : 7 });
}

function spherical(id, title, [st, tu, us], order, max) {
  return model(id, title, "Spherical", [[1, st, us], [st, 1, tu], [us, tu, 1]],
    "The Tits cone is the entire dual space. " + order + " chambers tile the sphere of rays.",
    { depth: max, max });
}

export const affineDihedralProduct = model(
  "a1-i2-infinity", "A₁ × I₂(∞) · (∞, 2, 2)", "Affine",
  [[1, Infinity, 2], [Infinity, 1, 2], [2, 2, 1]],
  "Unit-width half-strips tile the Euclidean slice. The isolated reflection u swaps the upper and lower halves.",
  {depth: 4, max: 12}
);

export const presets = [
  model("a1", "A₁ · one mirror", "Finite line", [[1]],
    "The origin is the mirror. The two chambers cover the dual line.", {depth: 1, max: 1}),
  dihedral("orthogonal", "A₁ × A₁ · m = 2", 2),
  dihedral("a2", "A₂ · m = 3", 3),
  dihedral("b2", "B₂ · m = 4", 4),
  dihedral("i25", "I₂(5) · m = 5", 5),
  dihedral("g2", "G₂ · m = 6", 6),
  dihedral("i27", "I₂(7) · m = 7", 7),
  dihedral("i28", "I₂(8) · m = 8", 8),
  spherical("a1-cubed", "A₁ × A₁ × A₁ · (2, 2, 2)", [2, 2, 2], 8, 3),
  spherical("a1-i25", "A₁ × I₂(5) · (5, 2, 2)", [5, 2, 2], 20, 6),
  spherical("a3", "A₃ · (2, 3, 3)", [2, 3, 3], 24, 6),
  spherical("b3", "B₃ · (2, 3, 4)", [2, 3, 4], 48, 9),
  spherical("h3", "H₃ · (2, 3, 5)", [2, 3, 5], 120, 15),
  infinite("affine", "Ã₁ · affine line", [1, 1],
    "The Tits cone is the open half-plane xₛ + xₜ > 0 together with the origin."),
  infinite("near-affine", "I₂(∞) · c = 21/20", [21, 20],
    "A small change in the Gram matrix opens a gap between the two limit rays."),
  infinite("indefinite", "I₂(∞) · c = 27/20", [27, 20],
    "The Tits cone is an open wedge together with the origin. The limit rays are excluded."),
  infinite("narrow", "I₂(∞) · c = 2", [2, 1],
    "A larger off-diagonal magnitude narrows the wedge in these dual coordinates."),
  triangle("affine2", "Ã₂ · (3, 3, 3)", "Affine", [3, 3, 3],
    "Equilateral triangles tile the entire Euclidean slice."),
  triangle("affine-c2", "C̃₂ · (2, 4, 4)", "Affine", [2, 4, 4],
    "A right isosceles fundamental triangle tiles the Euclidean slice."),
  triangle("affine-g2", "G̃₂ · (2, 3, 6)", "Affine", [2, 3, 6],
    "A 30°–60°–90° fundamental triangle tiles the Euclidean slice."),
  affineDihedralProduct,
  triangle("hurwitz", "Triangle · (2, 3, 7)", "Hyperbolic", [2, 3, 7],
    "A compact triangle with a small angle defect. The projective slice is the open Klein disk."),
  triangle("compact-245", "Triangle · (2, 4, 5)", "Hyperbolic", [2, 4, 5],
    "A compact right triangle. Its chambers accumulate at the excluded circle."),
  triangle("compact-334", "Triangle · (3, 3, 4)", "Hyperbolic", [3, 3, 4],
    "A compact triangle with two equal angles."),
  triangle("compact-444", "Triangle · (4, 4, 4)", "Hyperbolic", [4, 4, 4],
    "A compact symmetric triangle. Its three hyperbolic angles are π/4."),
  triangle("one-cusp", "Triangle · (2, 3, ∞)", "Hyperbolic", [2, 3, Infinity],
    "One corner is ideal. Its orbit lies on the boundary circle."),
  triangle("two-cusps", "Triangle · (3, ∞, ∞)", "Hyperbolic", [3, Infinity, Infinity],
    "Two ideal corners and one interior corner."),
  triangle("ideal", "Triangle · (∞, ∞, ∞)", "Hyperbolic", [Infinity, Infinity, Infinity],
    "An ideal triangle with all three corners on the circle. Ideal vertices of reflected chambers belong to the slice.")
];

export function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function couplingLabel([numerator, denominator]) {
  return denominator === 1 ? String(numerator) : numerator + "/" + denominator;
}

export const maxDihedralOrder = 24;
const moreDihedralModels = Array.from({length: maxDihedralOrder - 8}, (_, index) => {
  const order = index + 9;
  return dihedral("i2-" + order, "I₂(" + order + ")", order);
});
const infinitePresets = presets.filter(example => example.coupling);
export const infiniteDihedralModels = Array.from({length: 21}, (_, index) => {
  const numerator = 20 + index;
  const preset = infinitePresets.find(example => example.coupling[0] / example.coupling[1] === numerator / 20);
  if (preset) return preset;
  const divisor = gcd(numerator, 20);
  const coupling = [numerator / divisor, 20 / divisor];
  return infinite("i2-infinity-" + coupling.join("-"), "I₂(∞) · c = " + couplingLabel(coupling), coupling,
    "The Tits cone is an open wedge together with the origin. The limit rays are excluded.");
});
export const maxTriangleOrder = 24;
function compactRightTriangles(q, first) {
  return Array.from({length: maxTriangleOrder - first + 1}, (_, index) => {
    const m = first + index;
    return triangle("triangle-2" + q + "-" + m, "Triangle · (2, " + q + ", " + m + ")", "Hyperbolic", [2, q, m],
      "A compact right triangle. Its smallest angle is π/" + m + ".");
  });
}
const moreTriangleModels = [
  ...compactRightTriangles(3, 8),
  ...compactRightTriangles(4, 6),
  triangle("triangle-24-infinity", "Triangle · (2, 4, ∞)", "Hyperbolic", [2, 4, Infinity],
    "A hyperbolic right triangle with a π/4 angle and one ideal vertex.")
];
function rightTriangleSeries(q) {
  return [...presets, ...moreTriangleModels]
    .filter(example => example.rank === 3 && example.exponents[0][1] === 2 && example.exponents[1][2] === q)
    .sort((a, b) => a.exponents[0][2] - b.exponents[0][2]);
}
export const triangleSeries = rightTriangleSeries(3);
export const triangleSeriesWithFour = rightTriangleSeries(4);
const cuspPresets = presets.filter(example => example.rank === 3 &&
  example.exponents[0][2] === Infinity && example.exponents[1][2] === Infinity);
export const twoCuspSeries = [...Array.from({length: maxTriangleOrder - 1}, (_, index) => {
  const m = index + 2;
  return cuspPresets.find(example => example.exponents[0][1] === m) ??
    triangle("triangle-two-cusps-" + m, "Triangle · (" + m + ", ∞, ∞)", "Hyperbolic", [m, Infinity, Infinity],
      "Two ideal vertices and one interior vertex with angle π/" + m + ".");
}), cuspPresets.find(example => example.exponents[0][1] === Infinity)];
const productPresets = presets.filter(example =>
  example.rank === 3 && example.exponents[0][2] === 2 && example.exponents[1][2] === 2);
const finiteProducts = Array.from({length: maxDihedralOrder - 1}, (_, index) => {
  const m = index + 2;
  return productPresets.find(example => example.exponents[0][1] === m) ??
    spherical("a1-i2-" + m, "A₁ × I₂(" + m + ") · (" + m + ", 2, 2)", [m, 2, 2], 4 * m, m + 1);
});
export const dihedralProductModels = [...finiteProducts, affineDihedralProduct];
export const examples = [...presets, ...moreDihedralModels,
  ...infiniteDihedralModels.filter(example => !infinitePresets.includes(example)), ...moreTriangleModels,
  ...twoCuspSeries.filter(example => !cuspPresets.includes(example)),
  ...dihedralProductModels.filter(example => !productPresets.includes(example))];
export const dihedralModels = examples.filter(example => example.family === "Finite dihedral");
export const exampleById = new Map(examples.map(example => [example.id, example]));
export const wallNames = example => symbols.slice(0, example.rank);

export function affineProductStrip({rays}) {
  // Each finite endpoint lies on the wall opposite the other finite ray.
  const [[t], [s], vertical] = rays;
  return {left: Math.min(s, t), right: Math.max(s, t), above: vertical[2] > 0, sOnLeft: s < t};
}

export function reflect(point, wall, example) {
  const i = symbols.indexOf(wall);
  return point.map((x, j) => x - 2 * example.gram[i][j] * point[i]);
}

export function dihedralMetric(example) {
  const offDiagonal = example.gram[0][1];
  const diagonalScale = Math.sqrt(1 + offDiagonal);
  const antiDiagonalScale = Math.sqrt(1 - offDiagonal);
  // In the sum and difference directions, the dual metric has eigenvalues 1/(1 ± B_st).
  const rescale = ([x, y], diagonal, antiDiagonal) => {
    const sum = (x + y) * diagonal;
    const difference = (x - y) * antiDiagonal;
    return [(sum + difference) / 2, (sum - difference) / 2];
  };
  return {
    forward: point => rescale(point, 1 / diagonalScale, 1 / antiDiagonalScale),
    inverse: point => rescale(point, diagonalScale, antiDiagonalScale)
  };
}

const galleryCache = new WeakMap();

export function* braidMoves(word, example) {
  for (let index = 0; index < word.length - 1; index++) {
    const a = word[index], b = word[index + 1];
    if (a === b) continue;
    const length = example.exponents[symbols.indexOf(a)][symbols.indexOf(b)];
    if (index + length > word.length) continue;
    let replacement = "";
    for (let j = 0; j < length; j++) {
      if (word[index + j] !== (j % 2 === 0 ? a : b)) break;
      replacement += j % 2 === 0 ? b : a;
    }
    if (replacement.length === length) {
      yield {word: word.slice(0, index) + replacement + word.slice(index + length), index, length};
    }
  }
}

export function buildGallery(example) {
  if (galleryCache.has(example)) return galleryCache.get(example);
  const walls = wallNames(example);
  const normalForms = new Map([["", ""]]);

  function normalForm(word) {
    if (normalForms.has(word)) return normalForms.get(word);
    // Tits' word moves reduce a nonminimal word by braids followed by an ss deletion.
    const queue = [word], seen = new Set(queue);
    let best = word;
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      if (current < best) best = current;
      const adjacentRepeat = current.search(/([stu])\1/);
      if (adjacentRepeat >= 0) {
        best = normalForm(current.slice(0, adjacentRepeat) + current.slice(adjacentRepeat + 2));
        break;
      }
      for (const {word: next} of braidMoves(current, example)) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    for (const variant of seen) normalForms.set(variant, best);
    return best;
  }

  const origin = { word: "", rays: walls.map((_, i) => walls.map((_, j) => Number(i === j))), neighbors: {} };
  const list = [origin];
  const byWord = new Map([["", origin]]);
  for (const chamber of list) {
    for (const [i, wall] of walls.entries()) {
      const word = normalForm(chamber.word + wall);
      if (word.length > example.max) continue;
      if (!byWord.has(word)) {
        // Right multiplication fixes every ray except the one opposite the crossed wall.
        const rays = chamber.rays.map((ray, j) => j !== i ? ray :
          ray.map((component, k) => chamber.rays.reduce((sum, column, l) =>
            sum + (l === i ? -component : -2 * example.gram[i][l] * column[k]), 0)));
        const next = { word, rays, neighbors: {} };
        byWord.set(word, next);
        list.push(next);
      }
      chamber.neighbors[wall] = word;
    }
  }
  const countsByLength = Array(example.max + 1).fill(0);
  for (const {word} of list) countsByLength[word.length]++;
  const gallery = { list, byWord, countsByLength };
  galleryCache.set(example, gallery);
  return gallery;
}

const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

function eigenbasis(matrix) {
  const a = matrix.map(row => [...row]);
  const v = matrix.map((row, i) => row.map((_, j) => Number(i === j)));
  for (let step = 0; step < 40; step++) {
    const [p, q] = [[0, 1], [0, 2], [1, 2]].reduce((best, pair) =>
      Math.abs(a[pair[0]][pair[1]]) > Math.abs(a[best[0]][best[1]]) ? pair : best);
    const cross = a[p][q];
    if (Math.abs(cross) < 1e-14) break;
    const angle = Math.atan2(2 * cross, a[q][q] - a[p][p]) / 2;
    const c = Math.cos(angle), s = Math.sin(angle), x = a[p][p], y = a[q][q];
    a[p][p] = c*c*x - 2*s*c*cross + s*s*y;
    a[q][q] = s*s*x + 2*s*c*cross + c*c*y;
    a[p][q] = a[q][p] = 0;
    for (let i = 0; i < 3; i++) {
      if (i !== p && i !== q) {
        const u = a[i][p], w = a[i][q];
        a[i][p] = a[p][i] = c*u - s*w;
        a[i][q] = a[q][i] = s*u + c*w;
      }
      const u = v[i][p], w = v[i][q];
      v[i][p] = c*u - s*w;
      v[i][q] = s*u + c*w;
    }
  }
  return a.map((row, i) => ({ value: row[i], vector: v.map(column => column[i]) }))
    .sort((left, right) => left.value - right.value);
}

export function slice(example) {
  const eigen = eigenbasis(example.gram);
  let [height, horizontal, vertical] = eigen.map(item => item.vector);
  if (height.reduce((a, b) => a + b, 0) < 0) height = height.map(value => -value);
  if (example.gram[0][1] === example.gram[0][2] && example.gram[0][1] === example.gram[1][2]) {
    height = [1, 1, 1].map(value => value / Math.sqrt(3));
    horizontal = [0, 1, -1].map(value => value / Math.sqrt(2));
    vertical = [-2, 1, 1].map(value => value / Math.sqrt(6));
  }
  const scale = example.family === "Hyperbolic" ? Math.sqrt(-eigen[0].value) : 1;
  const scaleX = scale / Math.sqrt(eigen[1].value);
  const scaleY = scale / Math.sqrt(eigen[2].value);
  return {
    height,
    project(point) {
      const z = dot(height, point);
      return [scaleX * dot(horizontal, point) / z, scaleY * dot(vertical, point) / z];
    }
  };
}

export function sphere(example) {
  const axes = eigenbasis(example.gram);
  return ray => {
    const point = axes.map(({vector, value}) => dot(vector, ray) / Math.sqrt(value));
    const length = Math.hypot(...point);
    return point.map(component => component / length);
  };
}

export function vertexAngles(example) {
  return [[1, 2], [2, 0], [0, 1]].map(([i, j]) => Math.PI / example.exponents[i][j]);
}

export function idealVertexIndices(example) {
  if (example.family !== "Hyperbolic") return [];
  return vertexAngles(example).flatMap((angle, index) => angle === 0 ? [index] : []);
}

export function idealVertexGallery(example) {
  const [vertex] = idealVertexIndices(example);
  if (vertex === undefined) return null;
  const walls = wallNames(example).filter((_, index) => index !== vertex);
  return {vertex, word: walls.join("").repeat(3)};
}

export function limitRays(example) {
  if (example.rank !== 2) return null;
  const c = -example.gram[0][1];
  if (c < 1) return null;
  const a = 1 / (c + Math.sqrt(c * c - 1));
  return [[-a, 1], [1, -a]];
}

function probeInterval(u, onWall) {
  const nearest = Math.round(u);
  const interval = onWall ? nearest - Number(nearest > 0) : Math.floor(u);
  return {kind: "inside", distance: Math.abs(interval), onWall};
}

export function probeRankTwo(example, point) {
  const tolerance = 1e-12;
  const norm = Math.hypot(...point);
  if (norm <= tolerance) return {kind: "origin"};
  const [x, y] = point.map(value => value / norm);
  const limits = limitRays(example);
  if (limits) {
    const a = -limits[0][0];
    const f = x + a * y, g = y + a * x;
    const inward = Math.min(f, g);
    if (inward < -tolerance) return {kind: "outside"};
    if (inward <= tolerance) return {kind: "limit"};
    if (a === 1) {
      // On x + y = 1, the two reflections take u to −u and 2 − u.
      const u = point[0] / (point[0] + point[1]);
      const onWall = Math.abs(u - Math.round(u)) <= Math.max(tolerance, 8 * Number.EPSILON * Math.abs(u));
      return probeInterval(u, onWall);
    }

    // The reflections invert f/g and multiply it by a² or 1/a².
    // The logarithmic coordinate makes each chamber an interval of length one.
    const step = -Math.log(a);
    const u = ((Math.log(f) - Math.log(g)) / step + 1) / 2;
    const wall = 2 * Math.round(u) - 1;
    const factor = Math.exp(-Math.abs(wall) * step);
    // Compare the original linear forms to avoid magnifying error near a limit ray.
    const residual = wall > 0 ? g - factor * f : f - factor * g;
    return probeInterval(u, Math.abs(residual) <= 32 * Number.EPSILON);
  }

  let folded = [x, y];
  for (let distance = 0; distance <= 80; distance++) {
    const negative = folded.findIndex(value => value < -tolerance);
    if (negative === -1) {
      return {kind: "inside", distance, onWall: folded.some(value => Math.abs(value) <= tolerance)};
    }
    const next = reflect(folded, symbols[negative], example);
    const scale = Math.hypot(...next);
    folded = next.map(value => value / scale);
  }
  return {kind: "inside", distance: null};
}
