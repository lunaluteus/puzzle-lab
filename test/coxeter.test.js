import assert from "node:assert/strict";
import test from "node:test";
import { buildGallery, exampleById, examples, limitRays, reflect, slice, sphere, vertexAngles, wallNames } from "../src/coxeter/model.js";
import { clipHemisphere } from "../src/coxeter/spherical.js";
import { exampleFormulae, gramEntry } from "../src/coxeter/formulas.js";

function close(a, b) {
  return Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(a), Math.abs(b));
}

function act(point, word, model) {
  return Array.from(word).reverse().reduce((vector, wall) => reflect(vector, wall, model), point);
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
      for (const {rays} of list) {
        const vertices = rays.map(project);
        for (const [i, a] of vertices.entries()) {
          assert.ok(close(Math.hypot(...a), 1));
          const tangent = b => b.map((x, k) => x - a[k] * dot(a, b));
          const b = tangent(vertices[(i + 1) % 3]), c = tangent(vertices[(i + 2) % 3]);
          const angle = Math.acos(dot(b, c) / (Math.hypot(...b) * Math.hypot(...c)));
          assert.ok(close(angle, angles[i]));
        }
      }
    });
  } else if (model.rank === 3) {
    test(model.id + " projects to its expected Euclidean or hyperbolic slice", () => {
      const {height, project} = slice(model);
      assert.ok(height.every(x => x > 0));
      const dot = ray => ray.reduce((sum, x, i) => sum + x * height[i], 0);
      const {list} = buildGallery(model);
      const expected = vertexAngles(model);
      const lengths = pts => pts.map(([x, y], i) => Math.hypot(x - pts[(i + 1) % 3][0], y - pts[(i + 1) % 3][1]));
      const original = lengths(list[0].rays.map(project));
      for (const {rays} of list) {
        assert.ok(rays.every(ray => dot(ray) > 0));
        const vertices = rays.map(project);
        if (model.family === "Hyperbolic") {
          vertices.forEach((vertex, i) => {
            const radius = Math.hypot(...vertex);
            assert.ok(radius <= 1 + 1e-9);
            if (expected[i] === 0) assert.ok(close(radius, 1));
            else assert.ok(radius < 1);
          });
        } else {
          lengths(vertices).forEach((edge, i) => assert.ok(close(edge, original[i])));
        }
      }
    });
  }
}

test("affine A2 and the ideal triangle have the expected growth", () => {
  const affine = buildGallery(exampleById.get("affine2")).list;
  const ideal = buildGallery(exampleById.get("ideal")).list;
  for (let depth = 0; depth <= 7; depth++) {
    assert.equal(affine.filter(c => c.word.length <= depth).length, 1 + 3 * depth * (depth + 1) / 2);
    assert.equal(ideal.filter(c => c.word.length <= depth).length, 1 + 3 * (2 ** depth - 1));
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

test("matrix entries and angle deficits stay exact in the inspector", () => {
  const entry = id => gramEntry(exampleById.get(id), 0, 1);
  assert.equal(entry("a2"), "-\\frac{1}{2}");
  assert.equal(entry("b2"), "-\\frac{\\sqrt{2}}{2}");
  assert.equal(entry("i25"), "-\\frac{1+\\sqrt{5}}{4}");
  assert.equal(entry("indefinite"), "-\\frac{27}{20}");
  assert.equal(entry("near-affine"), "-\\frac{21}{20}");
  assert.equal(entry("affine"), "-1");
  assert.equal(exampleFormulae(exampleById.get("hurwitz")).area, "\\frac{\\pi}{42}");
  assert.equal(exampleFormulae(exampleById.get("h3")).area, "\\frac{\\pi}{30}");
  for (const example of examples) {
    const {matrix} = exampleFormulae(example);
    assert.doesNotMatch(matrix, /\d\.\d/);
    assert.equal(matrix.split("\\\\").length, example.rank);
  }
});
