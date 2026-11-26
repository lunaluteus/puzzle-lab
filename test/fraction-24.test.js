import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const page = readFileSync(new URL("../fraction-24.html", import.meta.url), "utf8");
const rules = page.match(/<script id="fraction-24-rules">([\s\S]+?)<\/script>/);
assert.ok(rules, "The standalone page must include its arithmetic rules");
const {puzzles, calculate, merge, suggestion, undoCountToSolution, value} = runInNewContext(
  rules[1] + "\n({puzzles, calculate, merge, suggestion, undoCountToSolution, value})", {}, {filename: "fraction-24.html"}
);

const card = n => ({n, d: 1});

function hasIntegerSolution(deck) {
  const fullDeck = (1 << deck.length) - 1;
  const reachable = Array.from({length: fullDeck + 1}, () => new Set());
  deck.forEach((rank, index) => reachable[1 << index].add(rank));
  // Each mask preserves the identity of cards with duplicate ranks.
  for (let mask = 1; mask <= fullDeck; mask++) {
    const results = reachable[mask];
    for (let left = (mask - 1) & mask; left; left = (left - 1) & mask) {
      const right = mask ^ left;
      if (left > right) continue;
      for (const a of reachable[left]) {
        for (const b of reachable[right]) {
          results.add(a + b).add(a - b).add(b - a).add(a * b);
          if (b !== 0 && a % b === 0) results.add(a / b);
          if (a !== 0 && b % a === 0) results.add(b / a);
        }
      }
    }
  }
  return reachable[fullDeck].has(24);
}

test("Fraction 24 keeps exact reduced fractions and rejects division by zero", () => {
  assert.equal(value(calculate(card(2), card(6), 3)), "1/3");
  assert.equal(value(calculate(card(6), card(-2), 3)), "-3");
  assert.equal(value(calculate(card(1), {n: 1, d: 3}, 1)), "2/3");
  assert.equal(calculate(card(5), card(0), 3), null);
});

test("every Fraction 24 deck can reach 24 and requires a fraction", () => {
  assert.ok(puzzles.length > 0);
  for (const deck of puzzles) {
    const label = "Deck " + deck.join(", ");
    assert.equal(deck.length, 4, label);
    assert.equal(hasIntegerSolution(deck), false, label);

    let items = deck.map(card);
    for (let remaining = 3; remaining > 0; remaining--) {
      const move = suggestion(items);
      assert.ok(move, label);
      const {left, right, op} = move;
      assert.notEqual(left, right, label);
      const result = calculate(items[left], items[right], op);
      assert.ok(result, label);
      items = merge(items, left, right, result);
      assert.equal(items.length, remaining, label);
    }
    assert.equal(value(items[0]), "24", label);
  }
});

test("Fraction 24 can find the nearest solvable board before a dead end", () => {
  const start = [1, 3, 4, 6].map(card);
  const firstDeadEnd = [4, 6, 4].map(card);
  const secondDeadEnd = [4, 10].map(card);
  assert.equal(undoCountToSolution([start]), 1);
  assert.equal(undoCountToSolution([start, firstDeadEnd, secondDeadEnd]), 3);

  const afterDivision = [card(1), card(6), {n: 3, d: 4}];
  const afterWrongSum = [card(7), {n: 3, d: 4}];
  assert.equal(undoCountToSolution([start, afterDivision, afterWrongSum]), 2);
  assert.equal(undoCountToSolution([]), null);
});
