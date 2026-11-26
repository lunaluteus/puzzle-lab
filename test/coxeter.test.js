import assert from "node:assert/strict";
import test from "node:test";
import { buildGallery, exampleById, examples, limitRays, reflect, slice, vertexAngles, wallNames } from "../src/coxeter/model.js";

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

  if (model.rank === 3) {
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
