import test from "node:test";
import assert from "node:assert/strict";
import { freshPlayer } from "../lib/model.mjs";
import {
  dateWindow,
  lagosDay,
  normalizeName,
  resolvePlayer,
  resolveSurface,
  isSupportedFixture,
  winnerMarket,
  stakeCandidate,
  makeBoard,
} from "../lib/live-board.mjs";
import { loadBoard } from "../lib/provider.mjs";
import { buildSlip } from "../lib/slips.mjs";
const now = Date.parse("2026-11-09T12:00:00Z");
const model = {
  asOf: "2026-11-09",
  lastTournamentDate: "2026-01-17",
  players: [
    freshPlayer("A", "Jannik Sinner"),
    freshPlayer("B", "Carlos Alcaraz"),
  ],
  weights: [1, 1, 0, 0.1, 0.1],
  headToHead: {},
  tournamentSurfaces: { Stockholm: { surface: "Hard", date: "2025-10-01" } },
};
const fixture = {
  fixtureId: "fixture1",
  participant1Id: 11,
  participant2Id: 12,
  participant1Name: "Sinner, Jannik",
  participant2Name: "Alcaraz, Carlos",
  sportId: 12,
  statusId: 0,
  categorySlug: "atp",
  tournamentId: 3091,
  tournamentName: "ATP Stockholm, Sweden Men Singles",
  startTime: "2026-11-10T15:00:00Z",
};
const market = {
  marketId: 121,
  marketName: "Winner",
  sportId: 12,
  period: "result",
  playerProp: false,
  outcomes: [
    { outcomeId: 121, outcomeName: "1" },
    { outcomeId: 122, outcomeName: "2" },
  ],
};
const odds = () => ({
  ...fixture,
  bookmakerOdds: {
    stake: {
      bookmakerIsActive: true,
      suspended: false,
      fixturePath: "https://stake.com/sports/tennis/test",
      markets: {
        121: {
          marketActive: true,
          outcomes: {
            121: {
              players: {
                0: {
                  active: true,
                  price: 1.8,
                  changedAt: "2026-11-09T10:00:00Z",
                },
              },
            },
            122: {
              players: {
                0: {
                  active: true,
                  price: 2.1,
                  changedAt: "2026-11-09T10:00:00Z",
                },
              },
            },
          },
        },
      },
    },
  },
});
test("Lagos date boundaries include the preceding UTC evening", () => {
  assert.equal(lagosDay(Date.parse("2026-11-09T23:30:00Z")), "2026-11-10");
  const w = dateWindow("2026-11-10", "2026-11-10", now);
  assert.equal(new Date(w.start).toISOString(), "2026-11-09T23:00:00.000Z");
  assert.equal(new Date(w.end).toISOString(), "2026-11-10T22:59:59.999Z");
  assert.throws(() => dateWindow("2026-11-08", "2026-11-09", now));
  assert.throws(() => dateWindow("2026-11-10", "2026-11-20", now));
  assert.throws(() => dateWindow("2026-02-30", "2026-02-30", now));
});
test("identity mapping is exact and unambiguous, not surname-only", () => {
  assert.equal(normalizeName("Alcaráz, Carlos"), "carlosalcaraz");
  assert.equal(resolvePlayer(model, "Sinner, Jannik").id, "A");
  assert.equal(resolvePlayer(model, "J. Sinner"), null);
  assert.equal(
    resolvePlayer(
      {
        ...model,
        players: [...model.players, { ...model.players[0], id: "duplicate" }],
      },
      "Jannik Sinner",
    ),
    null,
  );
});
test("unknown surfaces are rejected, historical surface source is dated", () => {
  assert.equal(resolveSurface(model, fixture).surface, "Hard");
  assert.match(resolveSurface(model, fixture).source, /2025-10-01/);
  assert.equal(resolveSurface(model, { tournamentName: "Unknown" }), null);
});
test("only future ATP main-tour singles in the requested dates qualify", () => {
  const w = dateWindow("2026-11-09", "2026-11-11", now);
  assert.equal(isSupportedFixture(fixture, w, now), true);
  for (const change of [
    { statusId: 1 },
    { categorySlug: "wta" },
    { tournamentName: "ATP Doubles" },
    { tournamentName: "ATP Challenger Singles" },
    { startTime: "2026-11-09T11:00:00Z" },
  ])
    assert.equal(isSupportedFixture({ ...fixture, ...change }, w, now), false);
});
test("catalog selects match winner, not sets, props or another sport", () => {
  assert.equal(
    winnerMarket([
      market,
      { ...market, period: "firstset" },
      { ...market, playerProp: true },
      { ...market, sportId: 25 },
    ]).length,
    1,
  );
});
test("Stake candidate preserves actual price, fixture link and five-minute expiry", () => {
  const p = stakeCandidate(model, fixture, odds(), [market], now);
  assert.equal(p.odds, 1.8);
  assert.equal(p.source, "Stake via OddsPapi");
  assert.equal(p.fixtureUrl, "https://stake.com/sports/tennis/test");
  assert.equal(Date.parse(p.expiresAt), now + 300000);
  assert.equal(
    buildSlip([p], { target: 1.8, minProbability: 0.5 }, now + 300001).legs
      .length,
    0,
  );
});
test("missing Stake, suspensions, swapped players and inactive markets are rejected", () => {
  const missing = odds();
  missing.bookmakerOdds = { otherbook: missing.bookmakerOdds.stake };
  assert.throws(() => stakeCandidate(model, fixture, missing, [market], now));
  const suspended = odds();
  suspended.bookmakerOdds.stake.suspended = true;
  assert.throws(() => stakeCandidate(model, fixture, suspended, [market], now));
  const inactive = odds();
  inactive.bookmakerOdds.stake.markets[121].outcomes[122].players[0].active = false;
  assert.throws(() => stakeCandidate(model, fixture, inactive, [market], now));
  assert.throws(() =>
    stakeCandidate(
      model,
      fixture,
      { ...odds(), participant1Id: 12 },
      [market],
      now,
    ),
  );
});
test("non-Stake URLs are never exported as bookmaker links", () => {
  const row = odds();
  row.bookmakerOdds.stake.fixturePath = "https://stake.com.evil.test/";
  assert.equal(
    stakeCandidate(model, fixture, row, [market], now).fixtureUrl,
    null,
  );
});
test("board exposes exclusion reasons and no fabricated substitutes", () => {
  const board = makeBoard(
    model,
    [fixture],
    [],
    [market],
    dateWindow("2026-11-09", "2026-11-11", now),
    now,
  );
  assert.equal(board.candidates.length, 0);
  assert.equal(board.excluded.length, 1);
});
test("provider integration requests Stake explicitly and never sends a key to the output", async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    return {
      ok: true,
      json: async () =>
        url.pathname.endsWith("/fixtures")
          ? [fixture]
          : url.pathname.endsWith("/markets")
            ? [market]
            : [odds()],
    };
  };
  const board = await loadBoard(model, "2026-11-09", "2026-11-11", {
    key: "test-secret",
    fetcher,
    now,
  });
  assert.equal(board.candidates.length, 1);
  assert.equal(calls[2].searchParams.get("bookmaker"), "stake");
  assert.ok(!JSON.stringify(board).includes("test-secret"));
});
test("missing credentials and rate limits produce actionable, sanitized errors", async () => {
  await assert.rejects(
    () => loadBoard(model, "2026-11-09", "2026-11-11", { key: "", now }),
    /ODDSPAPI_KEY/,
  );
  await assert.rejects(
    () =>
      loadBoard(model, "2026-11-09", "2026-11-11", {
        key: "test-secret",
        now,
        fetcher: async () => ({ ok: false, status: 429 }),
      }),
    /rate limit/,
  );
});
