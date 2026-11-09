import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  freshPlayer,
  features,
  probability,
  fit,
  predict,
  parseCsv,
  updatePlayers,
  evaluate,
} from "../lib/model.mjs";
const model = JSON.parse(
  readFileSync(new URL("../data/model.json", import.meta.url), "utf8"),
);
test("prediction is symmetric when players swap on every surface", () => {
  for (const surface of ["Hard", "Clay", "Grass"]) {
    const a = predict(model, model.players[0].id, model.players[1].id, surface);
    const b = predict(model, model.players[1].id, model.players[0].id, surface);
    assert.ok(Math.abs(a.p + b.p - 1) < 1e-12);
    assert.ok(a.p > 0 && a.p < 1);
  }
});
test("invalid matchups cannot produce predictions", () => {
  const [a, b] = model.players;
  assert.throws(() => predict(model, a.id, a.id, "Hard"));
  assert.throws(() => predict(model, a.id, b.id, "Ice"));
  assert.throws(() => predict(model, "unknown", b.id, "Hard"));
});
test("equal player histories predict 50%, independent of names", () => {
  assert.equal(
    probability(
      features(freshPlayer("1", "A"), freshPlayer("2", "B"), "Clay"),
      model.weights,
    ),
    0.5,
  );
});
test("an Elo update conserves points and changes only the played surface", () => {
  const a = freshPlayer("1", "A"),
    b = freshPlayer("2", "B");
  updatePlayers(a, b, "Clay", "2025-01-01");
  assert.equal(a.elo + b.elo, 3000);
  assert.equal(a.surfaces.Hard, 1500);
  assert.equal(a.surfaces.Clay, 1516);
  assert.equal(b.surfaces.Clay, 1484);
  assert.deepEqual(a.recent, [1]);
  assert.deepEqual(b.recent, [0]);
  assert.equal(a.matches, 1);
});
test("learner fits a strong signal rather than constant odds", () => {
  const w = fit(Array.from({ length: 100 }, () => ({ x: [1, 1, 0] })));
  assert.ok(probability([1, 1, 0], w) > 0.8);
  assert.ok(probability([-1, -1, 0], w) < 0.2);
});
test("held-out scoring uses losses and handles coin flips fairly", () => {
  const m = evaluate([{ x: [0, 0, 0], baseline: 0.5 }], [0, 0, 0]);
  assert.equal(m.accuracy, 0.5);
  assert.equal(m.brier, 0.25);
  assert.ok(Math.abs(m.logLoss - Math.log(2)) < 1e-12);
});
test("CSV parser handles quotes, commas, CRLF, and missing final newline", () => {
  assert.deepEqual(parseCsv('id,name\r\n1,"Smith, John"\r\n2,"A ""B"""'), [
    { id: "1", name: "Smith, John" },
    { id: "2", name: 'A "B"' },
  ]);
  assert.throws(() => parseCsv('name\n"broken'));
});
test("artifact has real provenance and consistent held-out sample counts", () => {
  assert.ok(model.matchCount > 1000);
  assert.ok(model.trainingCount > model.metrics.count);
  assert.equal(
    model.metrics.bins.reduce((n, b) => n + b.count, 0),
    model.metrics.count,
  );
  assert.ok(model.sources.every((s) => /^[a-f0-9]{64}$/.test(s.sha256)));
  assert.ok(model.lastTournamentDate <= model.asOf);
  assert.ok(
    model.players.every((p) => p.lastDate <= model.asOf && p.matches >= 10),
  );
});
