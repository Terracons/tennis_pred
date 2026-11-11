import test from "node:test";
import assert from "node:assert/strict";
import {
  completedScore,
  prepareMatches,
  historyState,
  downloadHistory,
} from "../lib/history.mjs";
import { refreshModel } from "../lib/current-history.mjs";
const row = {
  tourney_id: "2026-1",
  match_num: "1",
  tourney_date: "20261111",
  tourney_name: "Test",
  tourney_level: "A",
  surface: "Hard",
  winner_id: "a",
  loser_id: "b",
  winner_name: "A",
  loser_name: "B",
  score: "6-4 7-6(5)",
  best_of: "3",
};
test("only completed played scores update statistics", () => {
  for (const score of ["6-4 7-6(5)", "4-6 6-4 6-0"])
    assert.equal(completedScore(score, 3), true);
  assert.equal(completedScore("6-4 6-4 6-2", 5), true);
  assert.equal(completedScore("6-4 6-4", 5), false);
  for (const score of [
    "6-4 2-1",
    "6-4 6-4 RET",
    "W/O",
    "6-4 6-4 1-0",
    "garbage 6-4 6-4",
    "4-6 4-6",
    "",
  ])
    assert.equal(completedScore(score, 3), false, score);
});
test("annual and ongoing overlaps count once; future, doubles and incomplete rows are excluded", () => {
  const matches = prepareMatches(
    [
      row,
      { ...row },
      { ...row, match_num: "2", tourney_date: "20261112" },
      { ...row, match_num: "3", score: "6-4" },
      { ...row, match_num: "4", tourney_level: "D" },
      { ...row, match_num: "5", tourney_date: "20260230" },
    ],
    "2026-11-11",
  );
  assert.equal(matches.length, 1);
  const state = historyState(matches);
  assert.equal(state.lastTournamentDate, "2026-11-11");
  assert.equal(state.headToHead["a:b"].wins[0], 1);
  assert.equal(state.headToHead["a:b"].recent[0].date, "2026-11-11");
});
const origin = "https://stats.tennismylife.org";
function fakeFeed({ badUrl = false, down = false, count = 1000 } = {}) {
  const names = [
    "2020",
    "2021",
    "2022",
    "2023",
    "2024",
    "2025",
    "2026",
    "ongoing_tourneys",
  ].map((n) => n + ".csv");
  const header = Object.keys(row).join(",");
  return async (url) => {
    if (down) throw new Error("offline");
    if (url.endsWith("/api/data-files"))
      return {
        ok: true,
        json: async () => ({
          files: names.map((name) => ({
            name,
            url:
              (badUrl ? "https://untrusted.example" : origin) + "/data/" + name,
            mtime: "2026-11-11T10:00:00Z",
          })),
        }),
      };
    const rows = url.endsWith("ongoing_tourneys.csv")
      ? Array.from({ length: count }, (_, i) =>
          Object.values({ ...row, match_num: String(i) }).join(","),
        )
      : [];
    return { ok: true, text: async () => [header, ...rows].join("\n") };
  };
}
test("active catalogue loads ongoing results and records content hashes", async () => {
  const data = await downloadHistory("2026-11-11", {
    fetcher: fakeFeed({ count: 1 }),
  });
  assert.equal(data.matches.length, 1);
  assert.equal(data.sources.length, 8);
  assert.ok(data.sources.every((s) => /^[a-f0-9]{64}$/.test(s.sha256)));
  await assert.rejects(
    downloadHistory("2026-11-11", { fetcher: fakeFeed({ badUrl: true }) }),
    /Unexpected/,
  );
});
test("live refresh uses newly completed results immediately and keeps trained weights", async () => {
  const base = {
    weights: [1, 2, 3, 4, 5, 6],
    lastTournamentDate: "2026-01-17",
    generatedAt: "2026-11-10T00:00:00Z",
  };
  const model = await refreshModel(base, {
    now: Date.parse("2026-11-11T12:00:00Z"),
    fetcher: fakeFeed(),
  });
  assert.equal(model.lastTournamentDate, "2026-11-11");
  assert.equal(model.players[0].matches, 1000);
  assert.equal(model.headToHead["a:b"].recent.length, 5);
  assert.equal(model.historyStatus, "current");
  assert.deepEqual(model.weights, base.weights);
  assert.equal(model.historyCheckedAt, "2026-11-11T12:00:00.000Z");
});
test("provider failures, incomplete history and regression do not silently reuse stale data", async () => {
  const now = Date.parse("2026-11-11T12:00:00Z");
  await assert.rejects(
    refreshModel({}, { now, fetcher: fakeFeed({ down: true }) }),
    /could not be reached/,
  );
  await assert.rejects(
    refreshModel({}, { now, fetcher: fakeFeed({ count: 2 }) }),
    /incomplete/,
  );
  await assert.rejects(
    refreshModel(
      { lastTournamentDate: "2026-11-12" },
      { now, fetcher: fakeFeed() },
    ),
    /regressed/,
  );
});
