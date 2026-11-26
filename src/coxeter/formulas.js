import { slice, wallNames } from "./model.js";

const tex = String.raw;
const radicals = new Map([
  [2, "0"],
  [3, tex`-\frac{1}{2}`],
  [4, tex`-\frac{\sqrt{2}}{2}`],
  [5, tex`-\frac{1+\sqrt{5}}{4}`],
  [6, tex`-\frac{\sqrt{3}}{2}`]
]);

export function gramEntry(example, i, j) {
  if (i === j) return "1";
  if (example.coupling) {
    const [numerator, denominator] = example.coupling;
    return denominator === 1 ? "-" + numerator : tex`-\frac{${numerator}}{${denominator}}`;
  }
  const m = example.exponents[i][j];
  if (m === Infinity) return "-1";
  return radicals.get(m) ?? tex`-\cos\!\left(\frac{\pi}{${m}}\right)`;
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function piFraction(n, d) {
  if (n === 0) return "0";
  const g = gcd(n, d);
  const numerator = (n / g === 1 ? "" : n / g) + tex`\pi`;
  return d === g ? numerator : tex`\frac{${numerator}}{${d / g}}`;
}

export function exampleFormulae(example) {
  const walls = wallNames(example);
  const order = m => m === Infinity ? tex`\infty` : String(m);
  const relations = walls.flatMap((a, i) => walls.slice(i + 1).map((b, k) =>
    tex`m_{${a}${b}}=${order(example.exponents[i][i + k + 1])}`)).join(tex`,\quad `);
  const rows = walls.map((_, i) => walls.map((_, j) => gramEntry(example, i, j)).join(" & "));
  const matrix = tex`B=\begin{pmatrix}${rows.join(tex`\\`)}\end{pmatrix}`;
  if (example.rank === 2) return { relations, matrix,
    angle: example.family === "Finite dihedral" ? piFraction(1, example.exponents[0][1]) : null };

  const orders = [[1, 2], [2, 0], [0, 1]].map(([i, j]) => example.exponents[i][j]);
  const angles = tex`\left(${orders.map(m => m === Infinity ? "0" : piFraction(1, m)).join(", ")}\right)`;
  const finite = orders.filter(Number.isFinite);
  const d = finite.reduce((a, b) => a * b / gcd(a, b), 1);
  const sum = finite.reduce((total, m) => total + d / m, 0);
  const area = example.family === "Affine" ? null : piFraction(Math.abs(d - sum), d);
  const covector = example.family === "Spherical" ? null :
    tex`\mathbf{h}\approx\left(${slice(example).height.map(x => Number(x.toFixed(4))).join(", ")}\right)`;
  return { relations, matrix, angles, area, covector };
}

export const mathNotes = {
  coordinate: tex`x_i=\lambda(\alpha_i)`,
  chamber: tex`C=\{x:x_i\ge 0\}`,
  cone: tex`\bigcup_{w\in W}wC`,
  crossing: tex`wC\longmapsto ws_iC`,
  reflection: tex`x_j\longmapsto x_j-2B_{ij}x_i`,
  sphere: tex`B^{-1}`,
  slice: tex`\mathbf{h}\cdot x=1`,
  kleinMetric: tex`g_p(u,v)=\frac{u\cdot v}{1-\|p\|^2}
    +\frac{(p\cdot u)(p\cdot v)}{(1-\|p\|^2)^2}`,
  axes: tex`(x_s,x_t)`,
  limit: tex`(-a,1),\ (1,-a),\quad a=c-\sqrt{c^2-1}`
};
