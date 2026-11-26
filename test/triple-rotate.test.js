import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const page = readFileSync(new URL("../triple-rotate.html", import.meta.url), "utf8");
const rules = page.match(/<script id="triple-rotate-rules">([\s\S]+?)<\/script>/);
assert.ok(rules, "The standalone page must include its rotation rules");
const {rotate, solverFor} = runInNewContext(
  rules[1] + "\n({rotate, solverFor})", {}, {filename: "triple-rotate.html"}
);

test("Triple Rotate moves exactly three consecutive cards in the chosen direction", () => {
  assert.equal(rotate("123456", 1, "left"), "134256");
  assert.equal(rotate("123456", 1, "right"), "142356");
  assert.equal(rotate(rotate("123456", 1, "left"), 1, "right"), "123456");
});

function inversionCount(state) {
  let count = 0;
  for (let left = 0; left < state.length; left++) {
    for (let right = left + 1; right < state.length; right++) {
      if (state[left] > state[right]) count++;
    }
  }
  return count;
}

for (const [size, count, diameter] of [[5, 60, 5], [6, 360, 7], [7, 2520, 10], [8, 20160, 14]]) {
  test("Triple Rotate gives shortest hints for every reachable " + size + "-card board", () => {
    const {goal, states, hints} = solverFor(size);
    assert.equal(states.length, count);
    assert.equal(new Set(states).size, count);
    assert.equal(hints.size, count);
    let longest = 0;

    for (const state of states) {
      assert.equal([...state].sort().join(""), goal, state);
      assert.equal(inversionCount(state) % 2, 0, state);
      const hint = hints.get(state);
      assert.ok(Number.isInteger(hint.remaining) && hint.remaining >= 0, state);
      assert.equal(hint.remaining === 0, state === goal, state);
      longest = Math.max(longest, hint.remaining);

      // No move can save more than one step, and each hint saves exactly one.
      for (let first = 0; first < size - 2; first++) {
        for (const direction of ["left", "right"]) {
          const next = hints.get(rotate(state, first, direction));
          assert.ok(next && Math.abs(next.remaining - hint.remaining) <= 1, state);
        }
      }
      if (state !== goal) {
        assert.ok(hint.first >= 0 && hint.first < size - 2, state);
        assert.ok(hint.direction === "left" || hint.direction === "right", state);
        const next = hints.get(rotate(state, hint.first, hint.direction));
        assert.equal(next.remaining, hint.remaining - 1, state);
      }
    }
    assert.equal(longest, diameter);
  });
}
