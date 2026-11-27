import { affineDihedralProduct, gcd, maxDihedralOrder, slice, wallNames } from "./model.js";

const tex = String.raw;
const radicals = new Map([
  [2, "0"],
  [3, tex`-\frac{1}{2}`],
  [4, tex`-\frac{\sqrt{2}}{2}`],
  [5, tex`-\frac{1+\sqrt{5}}{4}`],
  [6, tex`-\frac{\sqrt{3}}{2}`]
]);

function rational(numerator, denominator) {
  const divisor = gcd(Math.abs(numerator), denominator);
  const n = numerator / divisor, d = denominator / divisor;
  if (d === 1) return String(n);
  return (n < 0 ? "-" : "") + tex`\frac{${Math.abs(n)}}{${d}}`;
}

export function gramEntry(example, i, j) {
  if (i === j) return "1";
  if (example.coupling) {
    const [numerator, denominator] = example.coupling;
    return rational(-numerator, denominator);
  }
  const m = example.exponents[i][j];
  if (m === Infinity) return "-1";
  return radicals.get(m) ?? tex`-\cos\!\left(\frac{\pi}{${m}}\right)`;
}

function piFraction(n, d) {
  if (n === 0) return "0";
  const g = gcd(n, d);
  const numerator = (n / g === 1 ? "" : n / g) + tex`\pi`;
  return d === g ? numerator : tex`\frac{${numerator}}{${d / g}}`;
}

function rankTwoEigenvalues(example) {
  if (example.coupling) {
    const [n, d] = example.coupling;
    return tex`\lambda_+=${rational(d + n, d)},\quad \lambda_-=${rational(d - n, d)}`;
  }
  const m = example.exponents[0][1];
  if (m === 2) return tex`\lambda_+=\lambda_-=1`;
  return tex`\lambda_{\pm}=1\pm\cos\!\left(\frac{\pi}{${m}}\right)`;
}

export function exampleFormulae(example) {
  const walls = wallNames(example);
  const order = m => m === Infinity ? tex`\infty` : String(m);
  const relations = walls.flatMap((a, i) => walls.slice(i + 1).map((b, k) =>
    tex`m_{${a}${b}}=${order(example.exponents[i][i + k + 1])}`)).join(tex`,\quad `);
  const rows = walls.map((_, i) => walls.map((_, j) => gramEntry(example, i, j)).join(" & "));
  const matrix = tex`B=\begin{pmatrix}${rows.join(tex`\\`)}\end{pmatrix}`;
  if (example.rank === 1) return { relations: "s^2=1", matrix };
  if (example.rank === 2) return { relations, matrix,
    eigenvalues: rankTwoEigenvalues(example),
    angle: example.family === "Finite dihedral" ? piFraction(1, example.exponents[0][1]) : null };
  if (example === affineDihedralProduct) return { relations, matrix };

  const orders = [[1, 2], [2, 0], [0, 1]].map(([i, j]) => example.exponents[i][j]);
  const angles = tex`\left(${orders.map(m => m === Infinity ? "0" : piFraction(1, m)).join(", ")}\right)`;
  const finite = orders.filter(Number.isFinite);
  const d = finite.reduce((a, b) => a * b / gcd(a, b), 1);
  const sum = finite.reduce((total, m) => total + d / m, 0);
  const angleSum = piFraction(sum, d);
  const area = example.family === "Affine" ? null : piFraction(Math.abs(d - sum), d);
  const covector = example.family === "Spherical" ? null :
    tex`\mathbf{h}\approx\left(${slice(example).height.map(x => Number(x.toFixed(4))).join(", ")}\right)`;
  return { relations, matrix, angles, angleSum, area, covector };
}

export const inspectorMath = {
  affineProductSlice: "x_s+x_t=1",
  affineProductAxes: "(x_s,x_u)",
  affineProductPositiveHeight: "x_s+x_t>0",
  affineProductLine: "x_s=x_t=0",
  sphere: tex`B^{-1}`,
  slice: tex`\mathbf{h}\cdot x=1`,
  axes: tex`(x_s,x_t)`,
  limit: tex`(-a,1),\ (1,-a),\quad a=c-\sqrt{c^2-1}`
};

export const mathNotes = {
  dihedral: tex`I_2(m)`,
  dihedralOrders: tex`m=2,\ldots,${maxDihedralOrder}`,
  infiniteDihedral: tex`m=\infty`,
  dihedralCoupling: tex`B_{st}=-c,\quad c\ge 1`,
  couplingEigenvalues: tex`1+c,\quad 1-c`,
  triangleOrders: tex`(p,q,r)=(m_{st},m_{tu},m_{us})`,
  reciprocalSum: tex`\frac{1}{p}+\frac{1}{q}+\frac{1}{r}`,
  reciprocalInfinity: tex`1/\infty=0`,
  triangleCurvature: tex`\alpha+\beta+\gamma-\pi=KA`,
  triangleSeries: tex`(2,3,m)`,
  triangleSeriesWithFour: tex`(2,4,m)`,
  twoCuspSeries: tex`(m,\infty,\infty)`,
  twoCuspArea: tex`\pi\left(1-\frac{1}{m}\right)`,
  product: tex`A_1\times I_2(m)`,
  affineProductReflections: tex`s:x_s\mapsto -x_s,\quad t:x_s\mapsto 2-x_s`,
  affineProductTranslations: tex`st:x_s\mapsto x_s-2,\quad ts:x_s\mapsto x_s+2`,
  affineProductFlip: tex`u:x_u\mapsto -x_u`,
  coordinate: tex`x_i=\lambda(\alpha_i)`,
  chamber: tex`C=\{x:x_i\ge 0\}`,
  cone: tex`\bigcup_{w\in W}wC`,
  crossing: tex`wC\longmapsto ws_iC`,
  reflection: tex`x_j\longmapsto x_j-2B_{ij}x_i`,
  kleinMetric: tex`g_p(u,v)=\frac{u\cdot v}{1-\|p\|^2}
    +\frac{(p\cdot u)(p\cdot v)}{(1-\|p\|^2)^2}`,
  growthTotal: tex`\sum_{k=0}^{d} a_k`,
  growthH3: tex`\prod_{e\in\{1,5,9\}}(1+t+\cdots+t^e)`,
  growthAffine: tex`a_n=3n\quad(n\ge 1)`,
  growthProduct: tex`a_1=3,\quad a_n=4\quad(n\ge 2)`,
  growthIdeal: tex`a_n=3\cdot 2^{n-1}\quad(n\ge 1)`,
  growthAffineSeries: tex`\sum_{n\ge 0}a_n t^n=\frac{1+t+t^2}{(1-t)^2}`
};
