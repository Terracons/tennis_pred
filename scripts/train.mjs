import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  parseCsv,
  freshPlayer,
  features,
  eloProbability,
  updatePlayers,
  fit,
  evaluate,
  SURFACES,
} from "../lib/model.mjs";
const asOf = process.env.DATA_AS_OF || new Date().toISOString().slice(0, 10);
const asOfDate = new Date(asOf + "T00:00:00Z");
if (!Number.isFinite(+asOfDate)) throw new Error("Invalid DATA_AS_OF");
const endYear = asOfDate.getUTCFullYear(),
  sources = [],
  rows = [];
for (let year = 2020; year <= endYear; year++) {
  const url = `https://raw.githubusercontent.com/Tennismylife/TML-Database/master/${year}.csv`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok)
    throw new Error(
      `Data source ${year} returned HTTP ${response.status}; existing model preserved.`,
    );
  const csv = await response.text();
  const data = parseCsv(csv);
  if (!data[0]?.winner_id) throw new Error(`Invalid CSV for ${year}`);
  sources.push({
    year,
    url,
    sha256: createHash("sha256").update(csv).digest("hex"),
  });
  rows.push(...data);
  console.log(`Fetched ${year}: ${data.length} rows`);
}
const dateOf = (r) =>
  `${r.tourney_date.slice(0, 4)}-${r.tourney_date.slice(4, 6)}-${r.tourney_date.slice(6, 8)}`;
// Tournament dates are start dates, not match timestamps. Delay all results by
// 21 days so overlapping tournaments cannot leak future results into features.
const availableAt = (r) =>
  new Date(+new Date(dateOf(r) + "T00:00:00Z") + 21 * 86400000)
    .toISOString()
    .slice(0, 10);
const seen = new Set();
const matches = rows
  .filter((r) => {
    const key = [r.tourney_id, r.match_num, r.winner_id, r.loser_id].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return (
      /^\d{8}$/.test(r.tourney_date) &&
      SURFACES.includes(r.surface) &&
      ["A", "250", "500", "G", "M", "F"].includes(r.tourney_level) &&
      r.winner_id &&
      r.loser_id &&
      r.winner_id !== r.loser_id &&
      r.score &&
      !/RET|W\/O|DEF|ABN/i.test(r.score) &&
      availableAt(r) <= asOf
    );
  })
  .sort(
    (a, b) =>
      dateOf(a).localeCompare(dateOf(b)) ||
      a.tourney_id.localeCompare(b.tourney_id) ||
      Number(a.match_num) - Number(b.match_num),
  );
if (matches.length < 1000) throw new Error("Insufficient historical matches");
const players = new Map(),
  samples = [],
  pending = [];
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
      dateOf(r),
    );
  }
}
for (const r of matches) {
  const date = dateOf(r);
  settle(date);
  const a = get(r.winner_id, r.winner_name),
    b = get(r.loser_id, r.loser_name);
  if (Math.min(a.matches, b.matches) >= 10)
    samples.push({
      date,
      available: availableAt(r),
      x: features(a, b, r.surface),
      baseline: eloProbability(a.elo, b.elo),
    });
  pending.push({ available: availableAt(r), row: r });
}
settle(asOf);
const cutoff = samples[Math.floor(samples.length * 0.75)].date;
const train = samples.filter((r) => r.available < cutoff),
  test = samples.filter((r) => r.date >= cutoff);
const weights = fit(train),
  metrics = evaluate(test, weights);
const artifact = {
  version: 1,
  asOf,
  generatedAt: new Date().toISOString(),
  lastTournamentDate: dateOf(matches.at(-1)),
  cutoff,
  trainingCount: train.length,
  matchCount: matches.length,
  weights,
  metrics,
  sources,
  players: [...players.values()]
    .filter((p) => p.matches >= 10)
    .sort((a, b) => b.elo - a.elo),
  method:
    "Regularized logistic regression on overall Elo, surface Elo and last-10 form. Fixed weights trained on earlier data; later matches tested chronologically. All results delayed 21 days because only tournament start dates are available.",
  license:
    "TennisMyLife data: personal, educational and non-commercial research only. Commercial use requires written permission. Raw data is not redistributed.",
};
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../data/model.json", import.meta.url),
  JSON.stringify(artifact),
);
console.log(
  JSON.stringify(
    {
      matches: artifact.matchCount,
      players: artifact.players.length,
      training: train.length,
      test: metrics,
      cutoff,
      latest: artifact.lastTournamentDate,
      weights,
    },
    null,
    2,
  ),
);
