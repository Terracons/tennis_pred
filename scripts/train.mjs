import { mkdir, writeFile } from "node:fs/promises";
import { headToHead, updateHeadToHead } from "../lib/h2h.mjs";
import {
  freshPlayer,
  features,
  eloProbability,
  updatePlayers,
  fit,
  evaluate,
} from "../lib/model.mjs";
import { downloadHistory, historyState, sourceDate } from "../lib/history.mjs";
const asOf = process.env.DATA_AS_OF || new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf)))
  throw new Error("Invalid DATA_AS_OF");
const { matches, sources } = await downloadHistory(asOf);
if (matches.length < 1000) throw new Error("Insufficient historical matches");
// Backtests retain a conservative 21-day delay because source dates are not
// guaranteed exact match-completion times. Live states use published results.
const availableAt = (r) =>
  new Date(Date.parse(sourceDate(r)) + 21 * 86400000)
    .toISOString()
    .slice(0, 10);
const players = new Map(),
  h2h = {},
  pending = [],
  samples = [];
const get = (id, name) => {
  if (!players.has(id)) players.set(id, freshPlayer(id, name));
  return players.get(id);
};
function settle(until) {
  while (pending.length && pending[0].available <= until) {
    const r = pending.shift().row;
    updatePlayers(
      get(r.winner_id, r.winner_name),
      get(r.loser_id, r.loser_name),
      r.surface,
      sourceDate(r),
    );
    updateHeadToHead(h2h, r.winner_id, r.loser_id, r.surface, sourceDate(r));
  }
}
for (const r of matches) {
  const date = sourceDate(r);
  settle(date);
  const a = get(r.winner_id, r.winner_name),
    b = get(r.loser_id, r.loser_name);
  if (Math.min(a.matches, b.matches) >= 10 && availableAt(r) <= asOf)
    samples.push({
      date,
      available: availableAt(r),
      x: features(
        a,
        b,
        r.surface,
        headToHead(h2h, a.id, b.id, r.surface, date),
      ),
      baseline: eloProbability(a.elo, b.elo),
    });
  pending.push({ row: r, available: availableAt(r) });
}
const cutoff = samples[Math.floor(samples.length * 0.75)].date;
const train = samples.filter((r) => r.available < cutoff),
  test = samples.filter((r) => r.date >= cutoff);
const weights = fit(train),
  metrics = evaluate(test, weights);
const state = historyState(matches);
const artifact = {
  version: 3,
  asOf,
  generatedAt: new Date().toISOString(),
  historyCheckedAt: new Date().toISOString(),
  historyStatus: "snapshot",
  historySources: sources,
  ...state,
  cutoff,
  trainingCount: train.length,
  weights,
  metrics,
  sources,
  method:
    "Six-feature regularized logistic regression: overall Elo, surface Elo, last-10 form, overall head-to-head, same-surface head-to-head, and the latest five available head-to-head meetings. Meetings are recency-weighted with a neutral prior. Evaluation delays results by 21 days to protect against uncertain source timestamps. Live inference refreshes published completed results without that delay. Coefficients are fixed between training runs.",
  license:
    "TennisMyLife data: personal, educational and non-commercial research only. Commercial use requires written permission. Raw CSV files are not redistributed.",
};
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../data/model.json", import.meta.url),
  JSON.stringify(artifact),
);
console.log(
  JSON.stringify(
    {
      matches: state.matchCount,
      latestSourceDate: state.lastTournamentDate,
      training: train.length,
      test: metrics,
      weights,
    },
    null,
    2,
  ),
);
