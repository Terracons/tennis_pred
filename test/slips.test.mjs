import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSlip, createCandidate, slipText } from "../lib/slips.mjs";
const model = JSON.parse(
  readFileSync(new URL("../data/model.json", import.meta.url)),
);
const now = Date.parse("2026-11-09T12:00:00Z");
const candidate = (n, odds = 2, probability = 0.7) => ({
  id: `a${n}:b${n}`,
  aId: `a${n}`,
  bId: `b${n}`,
  aName: `A${n}`,
  bName: `B${n}`,
  pick: `A${n}`,
  surface: "Hard",
  odds,
  probability,
  startsAt: "2026-11-10T12:00:00Z",
  quotedAt: "2026-11-09T12:00:00Z",
});
test("finds a 20-odds slip using multiplication", () => {
  const slip = buildSlip(
    [candidate(1, 2), candidate(2, 2), candidate(3, 5, 0.6)],
    { target: 20 },
    now,
  );
  assert.equal(slip.matched, true);
  assert.equal(slip.odds, 20);
  assert.equal(slip.legs.length, 3);
  assert.ok(Math.abs(slip.probability - 0.294) < 1e-12);
  assert.match(slipText(slip), /Not a booking code/);
});
test("chooses highest probability in band, not merely closest odds", () => {
  const slip = buildSlip(
    [candidate(1, 20, 0.55), candidate(2, 19, 0.7)],
    { target: 20, maxLegs: 1 },
    now,
  );
  assert.equal(slip.odds, 19);
  assert.equal(slip.probability, 0.7);
});
test("does not combine repeated players across different fixtures", () => {
  const second = { ...candidate(2), aId: "a1", id: "a1:b2" };
  const slip = buildSlip([candidate(1), second], { target: 4 }, now);
  assert.equal(slip.matched, false);
  assert.equal(slip.legs.length, 1);
});
test("impossible target returns labeled nearest available combination", () => {
  const slip = buildSlip(
    [candidate(1, 2), candidate(2, 2)],
    { target: 20 },
    now,
  );
  assert.equal(slip.matched, false);
  assert.equal(slip.odds, 4);
});
test("expired prices, started fixtures and weak picks are excluded", () => {
  const slip = buildSlip(
    [
      { ...candidate(1), quotedAt: "2026-11-07T00:00:00Z" },
      { ...candidate(2), startsAt: "2026-11-09T11:00:00Z" },
      candidate(3, 2, 0.51),
    ],
    { target: 20 },
    now,
  );
  assert.equal(slip.legs.length, 0);
  assert.equal(slip.excluded, 3);
});
test("max legs is enforced even when a larger slip reaches target", () => {
  const slip = buildSlip(
    [candidate(1), candidate(2), candidate(3)],
    { target: 8, maxLegs: 2 },
    now,
  );
  assert.equal(slip.odds, 4);
  assert.equal(slip.matched, false);
});
test("invalid settings, duplicates and oversized pools fail explicitly", () => {
  assert.throws(() => buildSlip([], { target: NaN }, now));
  assert.throws(() => buildSlip([], { target: 0 }, now));
  assert.throws(() => buildSlip([], { maxLegs: 9 }, now));
  assert.throws(() => buildSlip([candidate(1), candidate(1)], {}, now));
  assert.throws(() =>
    buildSlip(
      Array.from({ length: 17 }, (_, i) => candidate(i)),
      {},
      now,
    ),
  );
  assert.throws(() =>
    buildSlip([{ ...candidate(1), odds: Infinity }], {}, now),
  );
});
test("candidate uses entered market odds and model favorite, never fair odds", () => {
  const [a, b] = model.players;
  const input = {
    aId: a.id,
    bId: b.id,
    surface: "Hard",
    oddsA: "2.10",
    oddsB: "1.80",
    startsAt: "2026-11-10T12:00:00Z",
  };
  const p = createCandidate(model, input, now);
  assert.equal(p.odds, p.pick === a.name ? 2.1 : 1.8);
  assert.ok(p.h2h);
  assert.ok(p.probability >= 0.5);
  assert.throws(() => createCandidate(model, { ...input, oddsA: "" }, now));
  assert.throws(() =>
    createCandidate(model, { ...input, startsAt: "2026-11-08" }, now),
  );
});
