import { freshPlayer, parseCsv, updatePlayers, SURFACES } from "./model.mjs";
import { updateHeadToHead } from "./h2h.mjs";
import { createHash } from "node:crypto";
export const sourceDate = (r) =>
  `${r.tourney_date.slice(0, 4)}-${r.tourney_date.slice(4, 6)}-${r.tourney_date.slice(6, 8)}`;
export function completedScore(score, bestOf) {
  if (![3, 5].includes(Number(bestOf)) || /RET|W\/O|DEF|ABN/i.test(score || ""))
    return false;
  const sets = String(score || "")
    .trim()
    .split(/\s+/);
  const needed = Math.ceil(Number(bestOf) / 2);
  let wins = 0,
    losses = 0;
  for (const set of sets) {
    if (
      wins === needed ||
      losses === needed ||
      !/^\d+-\d+(?:\(\d+\))?$/.test(set)
    )
      return false;
    const [a, b] = set.split("-").map((n) => parseInt(n, 10));
    const finished = (x, y) =>
      (x >= 6 && x - y === 2) || (x === 7 && y === 6) || (x === 6 && y <= 4);
    if (finished(a, b)) wins++;
    else if (finished(b, a)) losses++;
    else return false;
  }
  return wins === needed;
}
export function prepareMatches(rows, asOf) {
  const unique = new Map();
  for (const r of rows) {
    if (
      !/^\d{8}$/.test(r.tourney_date || "") ||
      !SURFACES.includes(r.surface) ||
      !["A", "250", "500", "G", "M", "F"].includes(r.tourney_level) ||
      !r.winner_id ||
      !r.loser_id ||
      r.winner_id === r.loser_id ||
      !completedScore(r.score, r.best_of)
    )
      continue;
    const date = sourceDate(r);
    if (
      date > asOf ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      continue;
    // Annual and ongoing files can overlap. The later current feed entry wins.
    unique.set(
      [r.tourney_id, r.match_num, r.winner_id, r.loser_id].join(":"),
      r,
    );
  }
  return [...unique.values()].sort(
    (a, b) =>
      sourceDate(a).localeCompare(sourceDate(b)) ||
      a.tourney_id.localeCompare(b.tourney_id) ||
      Number(a.match_num) - Number(b.match_num),
  );
}
export function historyState(matches) {
  const players = new Map(),
    headToHead = {},
    tournamentSurfaces = {};
  const get = (id, name) => {
    if (!players.has(id)) players.set(id, freshPlayer(id, name));
    return players.get(id);
  };
  for (const r of matches) {
    const date = sourceDate(r);
    updatePlayers(
      get(r.winner_id, r.winner_name),
      get(r.loser_id, r.loser_name),
      r.surface,
      date,
    );
    updateHeadToHead(headToHead, r.winner_id, r.loser_id, r.surface, date);
    tournamentSurfaces[r.tourney_name] = { surface: r.surface, date };
  }
  return {
    players: [...players.values()]
      .filter((p) => p.matches >= 10)
      .sort((a, b) => b.elo - a.elo),
    headToHead,
    tournamentSurfaces,
    matchCount: matches.length,
    lastTournamentDate: matches.length ? sourceDate(matches.at(-1)) : null,
  };
}
export async function downloadHistory(asOf, { fetcher = fetch } = {}) {
  const origin = "https://stats.tennismylife.org";
  async function read(url, json = false) {
    let r;
    try {
      r = await fetcher(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error(
        "Current match history could not be reached. Predictions were not refreshed.",
      );
    }
    if (!r.ok)
      throw new Error(`Current history provider returned HTTP ${r.status}.`);
    return json ? r.json() : r.text();
  }
  const catalogue = await read(origin + "/api/data-files", true);
  if (!Array.isArray(catalogue.files))
    throw new Error("Invalid history catalogue.");
  const year = Number(asOf.slice(0, 4));
  const names = [
    ...Array.from({ length: year - 2020 + 1 }, (_, i) => `${2020 + i}.csv`),
    "ongoing_tourneys.csv",
  ];
  const files = names.map((name) => {
    const file = catalogue.files.find((f) => f.name === name);
    if (!file) throw new Error(`Current history is missing ${name}.`);
    const url = new URL(file.url);
    if (url.origin !== origin || url.pathname !== `/data/${name}`)
      throw new Error("Unexpected history source URL.");
    return file;
  });
  const batches = await Promise.all(
    files.map(async (f) => {
      const csv = await read(f.url);
      const rows = parseCsv(csv);
      if (
        !csv.startsWith("tourney_id,") ||
        rows.some((r) => !("winner_id" in r))
      )
        throw new Error("Invalid match history CSV.");
      return {
        rows,
        source: {
          name: f.name,
          url: f.url,
          updatedAt: f.mtime,
          sha256: createHash("sha256").update(csv).digest("hex"),
        },
      };
    }),
  );
  return {
    matches: prepareMatches(
      batches.flatMap((b) => b.rows),
      asOf,
    ),
    sources: batches.map((b) => b.source),
  };
}
