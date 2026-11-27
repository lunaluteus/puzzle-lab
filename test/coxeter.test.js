import assert from "node:assert/strict";
import test from "node:test";
import { coxeterMath } from "../scripts/coxeter-mathjax.js";
import {
  affineDihedralProduct, affineProductStrip, braidMoves, buildGallery, dihedralMetric, dihedralModels,
  dihedralProductModels, exampleById, examples, idealVertexGallery, idealVertexIndices, limitRays, oppositeSphericalChamber, presets,
  probeRankTwo, reflect, slice, sphere, triangleSeries, triangleSeriesWithFour, twoCuspSeries, vertexAngles, wallNames
} from "../src/coxeter/model.js";
import { clipHemisphere, decodeSphereCamera, encodeSphereCamera, rotateSphereCamera, sphereCamera } from "../src/coxeter/spherical.js";
import { drawPlot, poincareCircle, toKlein, toPoincare } from "../src/coxeter/plot.js";
import { exampleFormulae, gramEntry, inspectorMath, mathNotes } from "../src/coxeter/formulas.js";

function close(a, b) {
  return Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
}

function act(point, word, model) {
  return Array.from(word).reverse().reduce((vector, wall) => reflect(vector, wall, model), point);
}

function sliceAngle(p, a, b, hyperbolic) {
  const dot = (x, y) => x.reduce((sum, value, i) => sum + value * y[i], 0);
  const complement = 1 - dot(p, p);
  // The common denominator in the Klein metric cancels in the angle quotient.
  const inner = hyperbolic
    ? (x, y) => complement * dot(x, y) + dot(x, p) * dot(y, p)
    : dot;
  const u = a.map((x, i) => x - p[i]), v = b.map((x, i) => x - p[i]);
  const cosine = inner(u, v) / Math.sqrt(inner(u, u) * inner(v, v));
  return Math.acos(Math.max(-1, Math.min(1, cosine)));
}

for (const model of examples) {
  test(model.id + " respects the Coxeter relations and gallery walls", () => {
    const {list, byWord} = buildGallery(model);
    const walls = wallNames(model);
    const axes = list[0].rays;
    for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const m = model.exponents[i][j];
        if (!Number.isFinite(m)) continue;
        for (const axis of axes) {
          const result = act(axis, (walls[i] + walls[j]).repeat(m), model);
          assert.ok(result.every((x, k) => close(x, axis[k])));
        }
      }
    }
    const signatures = new Set();
    for (const chamber of list) {
      assert.equal(chamber.word.length <= model.max, true);
      if (chamber.word) {
        const prefix = byWord.get(chamber.word.slice(0, -1));
        assert.equal(prefix?.neighbors[chamber.word.at(-1)], chamber.word);
      }
      for (const {word: alternate} of braidMoves(chamber.word, model)) {
        assert.notEqual(alternate, chamber.word);
        let step = "";
        for (const [index, wall] of Array.from(alternate).entries()) {
          step = byWord.get(step).neighbors[wall];
          assert.equal(step?.length, index + 1);
        }
        assert.equal(step, chamber.word);
      }
      const directions = chamber.rays.map(ray =>
        ray.map(x => Math.round(x / Math.hypot(...ray) * 1e13)).join(","));
      const signature = directions.sort().join(";");
      assert.ok(!signatures.has(signature), "a chamber was drawn twice " + chamber.word);
      signatures.add(signature);
      chamber.rays.forEach((ray, i) => assert.ok(
        ray.every((x, j) => close(x, act(axes[i], chamber.word, model)[j]))));
      for (const [i, wall] of walls.entries()) {
        const next = chamber.neighbors[wall];
        if (next === undefined) {
          assert.equal(chamber.word.length, model.max);
        } else {
          const neighbor = byWord.get(next);
          assert.equal(neighbor.neighbors[wall], chamber.word);
          assert.equal(Math.abs(next.length - chamber.word.length), 1);
          chamber.rays.forEach((ray, j) => {
            if (j !== i) assert.ok(ray.every((x, k) => close(x, neighbor.rays[j][k])));
          });
        }
      }
    }
    if (model.rank === 1) {
      assert.deepEqual(list.map(({rays}) => rays), [[[1]], [[-1]]]);
      assert.deepEqual(buildGallery(model).countsByLength, [1, 1]);
    }
    if (model.family === "Finite dihedral") assert.equal(list.length, 2 * model.exponents[0][1]);
    if (model.rank === 2 && limitRays(model)) assert.equal(list.length, 1 + 2 * model.max);
  });

  if (model.family === "Spherical") {
    test(model.id + " tiles the dual unit sphere", () => {
      const {list} = buildGallery(model);
      const angles = vertexAngles(model);
      const project = sphere(model);
      const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
      const area = angles.reduce((a, b) => a + b, 0) - Math.PI;
      assert.ok(close(list.length * area, 4 * Math.PI));
      for (const chamber of list) {
        const vertices = chamber.rays.map(project);
        const opposite = oppositeSphericalChamber(model, chamber);
        const oppositeVertices = opposite.rays.map(project);
        assert.equal(chamber.word.length + opposite.word.length, model.max);
        assert.equal(oppositeSphericalChamber(model, opposite), chamber);
        assert.ok(vertices.every(vertex => oppositeVertices.some(other =>
          vertex.every((coordinate, i) => close(coordinate, -other[i])))));
        for (const [i, a] of vertices.entries()) {
          assert.ok(close(Math.hypot(...a), 1));
          const tangent = b => b.map((x, k) => x - a[k] * dot(a, b));
          const b = tangent(vertices[(i + 1) % 3]), c = tangent(vertices[(i + 2) % 3]);
          const angle = Math.acos(dot(b, c) / (Math.hypot(...b) * Math.hypot(...c)));
          assert.ok(close(angle, angles[i]));
        }
      }
    });
  } else if (model.rank === 3 && model !== affineDihedralProduct) {
    test(model.id + " projects to its expected Euclidean or hyperbolic slice", () => {
      const {height, project} = slice(model);
      assert.ok(height.every(x => x > 0));
      const dot = ray => ray.reduce((sum, x, i) => sum + x * height[i], 0);
      const {list} = buildGallery(model);
      const expected = vertexAngles(model);
      const lengths = pts => pts.map(([x, y], i) => Math.hypot(x - pts[(i + 1) % 3][0], y - pts[(i + 1) % 3][1]));
      const original = lengths(list[0].rays.map(project));
      for (const {rays, word} of list) {
        assert.ok(rays.every(ray => dot(ray) > 0));
        const vertices = rays.map(project);
        const hyperbolic = model.family === "Hyperbolic";
        if (hyperbolic) {
          vertices.forEach((vertex, i) => {
            const radius = Math.hypot(...vertex);
            assert.ok(radius <= 1 + 1e-9);
            if (expected[i] === 0) assert.ok(close(radius, 1));
            else assert.ok(radius < 1);
          });
        } else {
          lengths(vertices).forEach((edge, i) => assert.ok(close(edge, original[i])));
        }
        for (const [i, p] of vertices.entries()) {
          if (expected[i] === 0) continue;
          const angle = sliceAngle(p, vertices[(i + 1) % 3], vertices[(i + 2) % 3], hyperbolic);
          assert.ok(close(angle, expected[i]), "wrong corner angle at " + (word || "C"));
        }
      }
    });
  }
}

test("finite dihedral chambers have equal angles in invariant Euclidean coordinates", () => {
  for (const model of dihedralModels) {
    const metric = dihedralMetric(model);
    const angle = Math.PI / model.exponents[0][1];
    for (const {rays} of buildGallery(model).list) {
      const [a, b] = rays.map(metric.forward);
      const sweep = Math.atan2(Math.abs(a[0] * b[1] - a[1] * b[0]), a[0] * b[0] + a[1] * b[1]);
      assert.ok(close(sweep, angle));
      for (const [original, shown] of [[rays[0], a], [rays[1], b]]) {
        assert.ok(metric.inverse(shown).every((value, i) => close(value, original[i])));
      }
    }
  }
});

test("spherical H3, affine A2, and the ideal triangle have the expected growth", () => {
  // Coefficients of the product of geometric sums of degrees 1, 5, and 9.
  const spherical = buildGallery(exampleById.get("h3")).countsByLength;
  assert.deepEqual(spherical, [1, 3, 5, 7, 9, 11, 12, 12, 12, 12, 11, 9, 7, 5, 3, 1]);
  const affine = buildGallery(exampleById.get("affine2")).countsByLength;
  const ideal = buildGallery(exampleById.get("ideal")).countsByLength;
  assert.equal(affine[0], 1);
  assert.equal(ideal[0], 1);
  let affineTotal = 1, idealTotal = 1;
  for (let depth = 1; depth < affine.length; depth++) {
    assert.equal(affine[depth], 3 * depth);
    affineTotal += affine[depth];
    assert.equal(affineTotal, 1 + 3 * depth * (depth + 1) / 2);
  }
  for (let depth = 1; depth < ideal.length; depth++) {
    assert.equal(ideal[depth], 3 * 2 ** (depth - 1));
    idealTotal += ideal[depth];
    assert.equal(idealTotal, 1 + 3 * (2 ** depth - 1));
  }
});

test("Poincaré geodesics preserve the corners throughout each gallery", () => {
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const tangent = (from, to) => {
    const [x, y] = toPoincare(from);
    const [u, v] = toPoincare(to);
    const circle = poincareCircle(from, to);
    const chord = [u - x, v - y];
    if (!circle) return chord;
    const [cx, cy] = circle.center;
    assert.ok(close(Math.hypot(x - cx, y - cy), circle.radius));
    assert.ok(close(Math.hypot(u - cx, v - cy), circle.radius));
    assert.ok(close(cx*cx + cy*cy - circle.radius**2, 1));
    const vector = [cy - y, x - cx];
    return dot(vector, chord) < 0 ? vector.map(value => -value) : vector;
  };
  for (const model of examples.filter(example => example.family === "Hyperbolic")) {
    const {project} = slice(model);
    const angles = vertexAngles(model);
    for (const {rays, word} of buildGallery(model).list) {
      const points = rays.map(project);
      for (const [i, point] of points.entries()) {
        const diskPoint = toPoincare(point);
        const restored = toKlein(diskPoint);
        assert.ok(restored.every((value, j) => close(value, point[j])));
        if (!angles[i]) assert.ok(close(Math.hypot(...diskPoint), 1));
        const a = tangent(point, points[(i + 1) % 3]);
        const b = tangent(point, points[(i + 2) % 3]);
        const angle = Math.atan2(Math.abs(a[0] * b[1] - a[1] * b[0]), dot(a, b));
        assert.ok(close(angle, angles[i]), model.id + " " + (word || "C") + " corner " + i);
      }
    }
  }
  assert.equal(poincareCircle([-.5, 0], [.5, 0]), null);
});

test("ideal vertex hit areas extend beyond the disk and preserve an incident selection", () => {
  const model = exampleById.get("ideal");
  const {list, byWord} = buildGallery(model);
  const chambers = list.filter(chamber => chamber.word.length <= 1);
  const {project} = slice(model);
  const side = 400;
  const pointNear = (ray, offset) => project(ray).map(coordinate => side / 2 + coordinate * (.45 * side + offset));
  const newVertex = byWord.get("s").rays[0];
  const sharedVertex = byWord.get("s").rays[1];
  const noop = () => {};
  const context = {
    arc: noop, beginPath: noop, closePath: noop, fill: noop, fillRect: noop, fillText: noop,
    lineTo: noop, moveTo: noop, setLineDash: noop, setTransform: noop, stroke: noop
  };
  const canvas = {
    getContext: () => context,
    getBoundingClientRect: () => ({width: side, height: side})
  };

  for (const projection of ["klein", "poincare"]) {
    let vertices;
    const fromHome = drawPlot(canvas, model, chambers, "", {projection, onIdealVertices: positions => { vertices = positions; }});
    assert.equal(vertices.length, 6, projection);
    assert.ok(vertices.every(({angle}, index) => index === 0 || angle > vertices[index - 1].angle), projection);
    assert.deepEqual(vertices.map(({x, y}) => fromHome(x, y).word).sort(), [null, null, null, "s", "t", "u"], projection);
    assert.equal(fromHome(...pointNear(newVertex, 3)).word, "s", projection);
    assert.equal(fromHome(...pointNear(newVertex, 12)).word, null, projection);

    const fromOtherChamber = drawPlot(canvas, model, chambers, "t", {projection});
    assert.equal(fromOtherChamber(...pointNear(sharedVertex, 3)).word, "", projection);
    const fromIncidentChamber = drawPlot(canvas, model, chambers, "s", {projection});
    assert.equal(fromIncidentChamber(...pointNear(sharedVertex, 3)).word, null, projection);
  }
});

test("hemisphere clipping keeps front vertices and adds intersections on the horizon", () => {
  const k = 1 / Math.sqrt(2);
  const points = [[k, 0, k], [0, k, k], [0, 0, -1]];
  const visible = clipHemisphere(points);
  assert.equal(visible.length, 4);
  assert.deepEqual(visible.slice(0, 2), points.slice(0, 2));
  assert.equal(visible.slice(2).filter(point => point[2] === 0).length, 2);
  assert.ok(visible.every(point => close(Math.hypot(...point), 1)));
  assert.deepEqual(clipHemisphere(points.map(([x, y]) => [x, y, -1])), []);
});

test("sphere rotation sends the center in the drag direction and keeps the camera orthonormal", () => {
  const basis = sphereCamera([[0, 0, 1], [0, 0, 1], [0, 0, 1]]);
  const horizontal = rotateSphereCamera(basis, Math.PI / 2, 0);
  const vertical = rotateSphereCamera(basis, 0, Math.PI / 2);
  assert.ok(close(horizontal[0][2], 1));
  assert.ok(close(vertical[1][2], 1));
  assert.ok(close(horizontal[2][2], 0));
  assert.ok(close(vertical[2][2], 0));

  const turned = rotateSphereCamera(basis, .3, -.8);
  for (const [i, a] of turned.entries()) {
    for (const [j, b] of turned.entries()) {
      const dot = a.reduce((sum, x, k) => sum + x * b[k], 0);
      assert.ok(close(dot, Number(i === j)));
    }
  }
  const restored = rotateSphereCamera(turned, -.3, .8);
  assert.ok(restored.every((row, i) => row.every((value, j) => close(value, basis[i][j]))));
});

test("a shared sphere camera retains its direction and rejects invalid coordinates", () => {
  for (const model of examples.filter(example => example.family === "Spherical")) {
    const [chamber] = buildGallery(model).list;
    let camera = sphereCamera(chamber.rays.map(sphere(model)));
    for (let step = 0; step < 12; step++) {
      camera = rotateSphereCamera(camera, .31 * Math.cos(step), -.47);
      const restored = decodeSphereCamera(encodeSphereCamera(camera));
      assert.ok(restored.every((axis, i) => axis.every((value, j) => Math.abs(value - camera[i][j]) < 2e-6)));
    }
  }
  for (const invalid of [null, "", "1,0,0", "1e6,0,0,0,-1000000,0", "1000000,0,0,-1000000,0,0"]) {
    assert.equal(decodeSphereCamera(invalid), null);
  }
});

test("rank-two probes get the distance from chamber interiors and distinguish limiting rays", () => {
  for (const model of examples.filter(example => example.rank === 2)) {
    const walls = wallNames(model);
    for (const {word, rays, neighbors} of buildGallery(model).list) {
      const [[a, b], [c, d]] = rays.map(ray => ray.map(value => value / Math.hypot(...ray)));
      assert.deepEqual(probeRankTwo(model, [a + c, b + d]),
        {kind: "inside", distance: word.length, onWall: false}, model.id + " " + word);
      rays.forEach((ray, i) => {
        const distance = Math.min(word.length, neighbors[walls[1 - i]]?.length ?? Infinity);
        assert.deepEqual(probeRankTwo(model, ray),
          {kind: "inside", distance, onWall: true}, model.id + " " + word + " " + walls[1 - i]);
      });
    }
    assert.deepEqual(probeRankTwo(model, [0, 0]), {kind: "origin"});
    for (const ray of limitRays(model) ?? []) {
      assert.deepEqual(probeRankTwo(model, ray), {kind: "limit"});
      assert.deepEqual(probeRankTwo(model, [-1, -1]), {kind: "outside"});
    }
  }
  const affine = exampleById.get("affine");
  for (const point of [[-1000000, 1000001], [1000001, -1000000]]) {
    assert.deepEqual(probeRankTwo(affine, point), {kind: "inside", distance: 1000000, onWall: true});
  }
});

test("the (2, 3, m) series crosses all three geometries with stable links", () => {
  const orders = triangleSeries.map(model => model.exponents[0][2]);
  assert.deepEqual(orders, [...Array.from({length: 22}, (_, i) => i + 3), Infinity]);
  for (const model of triangleSeries) {
    const m = model.exponents[0][2];
    assert.equal(model.exponents[0][1], 2);
    assert.equal(model.exponents[1][2], 3);
    assert.equal(model.family, m < 6 ? "Spherical" : m === 6 ? "Affine" : "Hyperbolic");
    assert.equal(exampleById.get(model.id), model);
  }
  assert.deepEqual(triangleSeries.slice(0, 5).map(model => model.id), ["a3", "b3", "h3", "affine-g2", "hurwitz"]);
  assert.equal(triangleSeries.at(-1).id, "one-cusp");
});

test("the (2, 4, m) series includes affine, compact and one-cusp triangles", () => {
  assert.deepEqual(triangleSeriesWithFour.map(model => model.exponents[0][2]),
    [...Array.from({length: 21}, (_, i) => i + 4), Infinity]);
  assert.deepEqual(triangleSeriesWithFour.slice(0, 2).map(model => model.id), ["affine-c2", "compact-245"]);
  for (const model of triangleSeriesWithFour) {
    const m = model.exponents[0][2];
    assert.deepEqual(model.exponents, [[1, 2, m], [2, 1, 4], [m, 4, 1]]);
    assert.equal(model.family, m === 4 ? "Affine" : "Hyperbolic");
    assert.equal(exampleById.get(model.id), model);
  }
  const cusp = triangleSeriesWithFour.at(-1);
  assert.equal(cusp.id, "triangle-24-infinity");
  assert.equal(exampleFormulae(cusp).angleSum, "\\frac{3\\pi}{4}");
  assert.equal(exampleFormulae(cusp).area, "\\frac{\\pi}{4}");
  assert.equal(exampleFormulae(exampleById.get("triangle-24-24")).area, "\\frac{5\\pi}{24}");
});

test("the two-cusp series varies its interior angle and preserves the ideal endpoint", () => {
  assert.deepEqual(twoCuspSeries.map(model => model.exponents[0][1]),
    [...Array.from({length: 23}, (_, i) => i + 2), Infinity]);
  assert.equal(twoCuspSeries[1].id, "two-cusps");
  assert.equal(twoCuspSeries.at(-1).id, "ideal");
  for (const model of twoCuspSeries) {
    const m = model.exponents[0][1];
    assert.deepEqual(model.exponents, [[1, m, Infinity], [m, 1, Infinity], [Infinity, Infinity, 1]]);
    assert.deepEqual(vertexAngles(model), [0, 0, Math.PI / m]);
    assert.deepEqual(idealVertexIndices(model), m === Infinity ? [0, 1, 2] : [0, 1]);
    assert.equal(exampleById.get(model.id), model);
  }
  assert.equal(exampleFormulae(twoCuspSeries[0]).area, "\\frac{\\pi}{2}");
  assert.equal(exampleFormulae(exampleById.get("triangle-two-cusps-24")).area, "\\frac{23\\pi}{24}");
  assert.deepEqual(idealVertexIndices(exampleById.get("one-cusp")), [1]);
  assert.deepEqual(idealVertexIndices(exampleById.get("hurwitz")), []);
});

test("an ideal vertex gallery shares the same ideal ray at every step", () => {
  for (const [id, vertex, word] of [["two-cusps", 0, "tututu"], ["one-cusp", 1, "sususu"], ["ideal", 0, "tututu"]]) {
    const model = exampleById.get(id);
    assert.deepEqual(idealVertexGallery(model), {vertex, word});
    const {byWord} = buildGallery(model);
    const ray = byWord.get("").rays[vertex];
    for (let length = 1; length <= word.length; length++) {
      assert.deepEqual(byWord.get(word.slice(0, length)).rays[vertex], ray);
    }
  }
  assert.equal(idealVertexGallery(exampleById.get("hurwitz")), null);
});

test("finite dihedral products have 4m chambers and preserve preset links", () => {
  assert.deepEqual(dihedralProductModels.map(model => model.exponents[0][1]),
    [...Array.from({length: 23}, (_, index) => index + 2), Infinity]);
  for (const model of dihedralProductModels.slice(0, -1)) {
    const m = model.exponents[0][1];
    assert.deepEqual(model.exponents, [[1, m, 2], [m, 1, 2], [2, 2, 1]]);
    assert.equal(buildGallery(model).list.length, 4 * m);
    assert.equal(buildGallery(model).countsByLength.at(-1), 1);
    assert.equal(exampleById.get(model.id), model);
  }
  assert.equal(dihedralProductModels[0].id, "a1-cubed");
  assert.equal(dihedralProductModels[3].id, "a1-i25");
  assert.equal(exampleFormulae(exampleById.get("a1-i2-24")).area, "\\frac{\\pi}{24}");
});

test("the affine dihedral product tiles its slice by unit half-strips", () => {
  const {list, byWord, countsByLength} = buildGallery(affineDihedralProduct);
  const strip = word => affineProductStrip(byWord.get(word));
  assert.equal(exampleById.get("a1-i2-infinity"), affineDihedralProduct);
  assert.deepEqual(strip(""), {left: 0, right: 1, above: true, sOnLeft: true});
  assert.deepEqual(strip("s"), {left: -1, right: 0, above: true, sOnLeft: false});
  assert.deepEqual(strip("t"), {left: 1, right: 2, above: true, sOnLeft: false});
  assert.deepEqual(strip("u"), {left: 0, right: 1, above: false, sOnLeft: true});
  assert.deepEqual(strip("st"), {left: -2, right: -1, above: true, sOnLeft: true});
  assert.deepEqual(strip("ts"), {left: 2, right: 3, above: true, sOnLeft: true});
  const point = [.25, .75, 2];
  assert.deepEqual(act(point, "st", affineDihedralProduct), [-1.75, 2.75, 2]);
  assert.deepEqual(act(point, "ts", affineDihedralProduct), [2.25, -1.25, 2]);
  for (const wall of ["s", "t"]) {
    const word = wall + "u";
    assert.equal(byWord.get(wall).neighbors.u, word);
    assert.equal(byWord.get("u").neighbors[wall], word);
    assert.deepEqual(act(point, word, affineDihedralProduct), act(point, "u" + wall, affineDihedralProduct));
  }
  assert.deepEqual(countsByLength, [1, 3, ...Array(affineDihedralProduct.max - 1).fill(4)]);
  for (const chamber of list) {
    const {left, right, above, sOnLeft} = affineProductStrip(chamber);
    assert.equal(right - left, 1);
    for (const [s, t, u] of chamber.rays.slice(0, 2)) {
      assert.equal(s + t, 1);
      assert.equal(u, 0);
    }
    assert.deepEqual(chamber.rays[2], [0, 0, above ? 1 : -1]);
    for (const [wall, neighbor] of Object.entries(chamber.neighbors)) {
      const next = strip(neighbor);
      if (wall === "u") assert.deepEqual(next, {left, right, above: !above, sOnLeft});
      else {
        assert.equal(next.above, above);
        assert.equal(next.sOnLeft, !sOnLeft);
        const crossesLeft = (wall === "s") === sOnLeft;
        assert.equal(crossesLeft ? next.right : next.left, crossesLeft ? left : right);
      }
    }
  }
  assert.equal(exampleFormulae(affineDihedralProduct).angles, undefined);
});

test("matrix entries, eigenvalues and triangle angles stay exact in the inspector", () => {
  const entry = id => gramEntry(exampleById.get(id), 0, 1);
  assert.equal(entry("a2"), "-\\frac{1}{2}");
  assert.equal(entry("b2"), "-\\frac{\\sqrt{2}}{2}");
  assert.equal(entry("i25"), "-\\frac{1+\\sqrt{5}}{4}");
  assert.equal(entry("indefinite"), "-\\frac{27}{20}");
  assert.equal(entry("near-affine"), "-\\frac{21}{20}");
  assert.equal(entry("affine"), "-1");
  const eigenvalues = id => exampleFormulae(exampleById.get(id)).eigenvalues;
  assert.equal(eigenvalues("orthogonal"), "\\lambda_+=\\lambda_-=1");
  assert.equal(eigenvalues("affine"), "\\lambda_+=2,\\quad \\lambda_-=0");
  assert.equal(eigenvalues("i2-infinity-5-4"), "\\lambda_+=\\frac{9}{4},\\quad \\lambda_-=-\\frac{1}{4}");
  assert.equal(eigenvalues("i2-24"), "\\lambda_{\\pm}=1\\pm\\cos\\!\\left(\\frac{\\pi}{24}\\right)");
  const angleSum = id => exampleFormulae(exampleById.get(id)).angleSum;
  assert.equal(angleSum("h3"), "\\frac{31\\pi}{30}");
  assert.equal(angleSum("affine-g2"), "\\pi");
  assert.equal(angleSum("hurwitz"), "\\frac{41\\pi}{42}");
  assert.equal(angleSum("triangle-23-24"), "\\frac{7\\pi}{8}");
  assert.equal(angleSum("ideal"), "0");
  assert.equal(exampleFormulae(exampleById.get("hurwitz")).area, "\\frac{\\pi}{42}");
  assert.equal(exampleFormulae(exampleById.get("triangle-23-24")).area, "\\frac{\\pi}{8}");
  assert.equal(exampleFormulae(exampleById.get("h3")).area, "\\frac{\\pi}{30}");
  for (const example of examples) {
    const {matrix} = exampleFormulae(example);
    assert.doesNotMatch(matrix, /\d\.\d/);
    assert.equal(matrix.split("\\\\").length, example.rank);
  }
});

test("the MathJax modules contain every formula and resolve their shared glyphs", async () => {
  const plugin = coxeterMath();
  const prefix = "export default ";
  const readModule = async specifier => {
    const id = plugin.resolveId(specifier);
    const source = await plugin.load(id);
    assert.ok(source?.startsWith(prefix), specifier);
    return JSON.parse(source.slice(prefix.length));
  };
  const ids = ["virtual:coxeter-extra-math", "virtual:coxeter-triangle-math", "virtual:coxeter-triangle-24-math",
    "virtual:coxeter-two-cusp-math", "virtual:coxeter-product-math", "virtual:coxeter-notes-math"];
  const [{formulas, glyphs, deferred}, ...catalogs] = await Promise.all(
    ["virtual:coxeter-math", ...ids].map(readModule)
  );

  const collect = models => models.flatMap(model => Object.values(exampleFormulae(model)).filter(Boolean));
  const initial = new Set([...Object.values(inspectorMath), ...collect(presets)]);
  const sources = [
    examples.filter(model => !triangleSeries.includes(model) && !triangleSeriesWithFour.includes(model) &&
      !twoCuspSeries.includes(model) && !dihedralProductModels.includes(model)),
    triangleSeries,
    triangleSeriesWithFour,
    twoCuspSeries,
    dihedralProductModels
  ].map(models => new Set(collect(models)));
  sources.push(new Set(Object.values(mathNotes)));
  sources.forEach((source, index) => {
    for (const tex of source) {
      if (sources.some((other, otherIndex) => otherIndex !== index && other.has(tex))) initial.add(tex);
    }
  });
  assert.deepEqual(new Set(Object.keys(formulas)), initial);
  const expectedDeferred = {};
  catalogs.forEach((catalog, index) => {
    const expected = new Set([...sources[index]].filter(tex => !initial.has(tex)));
    assert.ok(expected.size > 0);
    assert.deepEqual(new Set(Object.keys(catalog)), expected);
    for (const tex of expected) expectedDeferred[tex] = ids[index];
  });
  assert.deepEqual(deferred, expectedDeferred);

  const glyphIds = Array.from(glyphs.matchAll(/\bid="([^"]+)"/g), match => match[1]);
  const glyphCache = new Set(glyphIds);
  assert.equal(glyphCache.size, glyphIds.length);
  assert.ok(glyphCache.size > 0);
  const rendered = Object.assign({}, formulas, ...catalogs);
  assert.deepEqual(new Set(Object.keys(rendered)), new Set([...initial, ...collect(examples), ...Object.values(mathNotes)]));
  for (const [tex, html] of Object.entries(rendered)) {
    assert.match(html, /<svg\b/, tex);
    for (const [, reference] of html.matchAll(/<use\b[^>]*\bhref="#([^"]+)"/g)) {
      assert.ok(glyphCache.has(reference), tex + " references missing glyph " + reference);
    }
  }
});
