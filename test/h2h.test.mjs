import test from "node:test";
import assert from "node:assert/strict";
import { headToHead, updateHeadToHead } from "../lib/h2h.mjs";
import { features, freshPlayer, probability } from "../lib/model.mjs";
test("missing meetings are neutral, not invented", () => {
  const h = headToHead({}, "a", "b", "Hard", "2026-01-01");
  assert.equal(h.total, 0);
  assert.equal(h.signal, 0);
  assert.equal(h.surface.signal, 0);
  assert.equal(h.lastDate, null);
  assert.equal(h.latest.count, 0);
  assert.equal(h.latest.signal, 0);
});
test("latest five discards the oldest and preserves winner identities on reversal", () => {
  const index = {};
  for (let day = 1; day <= 6; day++)
    updateHeadToHead(
      index,
      day < 3 ? "a" : "b",
      day < 3 ? "b" : "a",
      "Hard",
      `2026-01-0${day}`,
    );
  const h = headToHead(index, "a", "b", "Hard", "2026-01-07");
  const reverse = headToHead(index, "b", "a", "Hard", "2026-01-07");
  assert.equal(h.total, 6);
  assert.equal(h.latest.count, 5);
  assert.equal(h.latest.aWins, 1);
  assert.equal(h.latest.bWins, 4);
  assert.deepEqual(
    h.latest.meetings.map((m) => m.date),
    ["2026-01-06", "2026-01-05", "2026-01-04", "2026-01-03", "2026-01-02"],
  );
  assert.deepEqual(h.latest.meetings, reverse.latest.meetings);
  assert.equal(h.latest.signal, -reverse.latest.signal);
  const x = features(freshPlayer("a", "A"), freshPlayer("b", "B"), "Hard", h);
  assert.equal(x[5], h.latest.signal);
  assert.ok(probability(x, [0, 0, 0, 0, 0, 1]) < 0.5);
});
test("fewer than five meetings stays a small sample", () => {
  const index = {};
  updateHeadToHead(index, "a", "b", "Grass", "2026-01-01");
  const h = headToHead(index, "a", "b", "Hard", "2026-01-02");
  assert.equal(h.latest.count, 1);
  assert.equal(h.surface.latest.count, 0);
  assert.ok(h.latest.signal < 1 / 7);
});
test("head-to-head swaps correctly and separates surface records", () => {
  const index = {};
  updateHeadToHead(index, "a", "b", "Hard", "2025-01-01");
  updateHeadToHead(index, "b", "a", "Clay", "2025-02-01");
  updateHeadToHead(index, "a", "b", "Hard", "2025-03-01");
  const a = headToHead(index, "a", "b", "Hard", "2025-04-01"),
    b = headToHead(index, "b", "a", "Hard", "2025-04-01");
  assert.equal(a.aWins, 2);
  assert.equal(a.bWins, 1);
  assert.equal(a.surface.total, 2);
  assert.equal(a.surface.bWins, 0);
  assert.equal(a.signal, -b.signal);
  assert.equal(a.surface.signal, -b.surface.signal);
});
test("one meeting is shrunk and old meetings decay", () => {
  const index = {};
  updateHeadToHead(index, "a", "b", "Hard", "2024-01-01");
  const recent = headToHead(index, "a", "b", "Hard", "2024-01-01");
  const old = headToHead(index, "a", "b", "Hard", "2026-01-01");
  assert.equal(recent.signal, 1 / 7);
  assert.ok(old.signal < recent.signal);
  assert.equal(old.aWins, 1);
});
test("future meetings are rejected rather than leaked", () => {
  const index = {};
  updateHeadToHead(index, "a", "b", "Hard", "2025-01-01");
  assert.throws(
    () => headToHead(index, "a", "b", "Hard", "2024-12-01"),
    /future/,
  );
});
test("head-to-head contributes to model features with symmetry", () => {
  const index = {};
  updateHeadToHead(index, "a", "b", "Hard", "2025-01-01");
  const a = freshPlayer("a", "A"),
    b = freshPlayer("b", "B");
  const weights = [1, 1, 0, 0.5, 0.5, 0.5];
  const pa = probability(
    features(a, b, "Hard", headToHead(index, "a", "b", "Hard", "2025-01-01")),
    weights,
  );
  const pb = probability(
    features(b, a, "Hard", headToHead(index, "b", "a", "Hard", "2025-01-01")),
    weights,
  );
  assert.ok(pa > 0.5);
  assert.ok(Math.abs(pa + pb - 1) < 1e-12);
});
