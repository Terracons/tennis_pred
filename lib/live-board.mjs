import { createCandidate, MAX_CANDIDATES } from "./slips.mjs";
export const lagosDay = (now = Date.now()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
export function dateWindow(from, to, now = Date.now()) {
  const valid = (s) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if (!valid(from) || !valid(to))
    throw new Error("Select valid start and end dates.");
  const today = lagosDay(now),
    latest = new Date(Date.parse(today) + 7 * 86400000)
      .toISOString()
      .slice(0, 10);
  if (from < today || to < from || to > latest)
    throw new Error(
      "Choose dates between today and the next 7 days (Africa/Lagos).",
    );
  return {
    from,
    to,
    start: Date.parse(from + "T00:00:00+01:00"),
    end: Date.parse(to + "T23:59:59.999+01:00"),
  };
}
export function normalizeName(name) {
  let value = String(name || "");
  if (value.includes(",")) {
    const [last, ...first] = value.split(",");
    value = first.join(" ") + " " + last;
  }
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
export function resolvePlayer(model, ...names) {
  const matches = new Map();
  for (const name of names.filter(Boolean))
    for (const player of model.players)
      if (normalizeName(player.name) === normalizeName(name))
        matches.set(player.id, player);
  return matches.size === 1 ? [...matches.values()][0] : null;
}
export function resolveSurface(model, fixture) {
  if (["Hard", "Clay", "Grass"].includes(fixture.surface))
    return { surface: fixture.surface, source: "Fixture API" };
  const label = String(fixture.tournamentName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const records = Object.entries(model.tournamentSurfaces || {})
    .filter(([name]) => {
      const normalized = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      return (
        normalized.length >= 4 &&
        (" " + label + " ").includes(" " + normalized + " ")
      );
    })
    .sort((a, b) => b[0].length - a[0].length);
  if (!records.length) return null;
  const best = records.filter(([name]) => name.length === records[0][0].length);
  if (new Set(best.map(([, r]) => r.surface)).size !== 1) return null;
  return {
    surface: records[0][1].surface,
    source: `Last recorded tournament surface (${records[0][1].date})`,
  };
}
export function isSupportedFixture(f, window, now = Date.now()) {
  return (
    Number(f.sportId) === 12 &&
    Number(f.statusId) === 0 &&
    f.categorySlug === "atp" &&
    /\bsingles\b/i.test(f.tournamentName || "") &&
    !/doubles|challenger|itf|qualif/i.test(f.tournamentName || "") &&
    Date.parse(f.startTime) > now &&
    Date.parse(f.startTime) >= window.start &&
    Date.parse(f.startTime) <= window.end
  );
}
export function winnerMarket(markets) {
  if (!Array.isArray(markets)) throw new Error("Market catalogue unavailable.");
  return markets.filter(
    (m) =>
      Number(m.sportId) === 12 &&
      m.marketName === "Winner" &&
      m.period === "result" &&
      m.playerProp === false &&
      m.outcomes?.length === 2 &&
      m.outcomes.some((o) => o.outcomeName === "1") &&
      m.outcomes.some((o) => o.outcomeName === "2"),
  );
}
export function stakeCandidate(model, fixture, row, catalog, now = Date.now()) {
  if (!row || row.fixtureId !== fixture.fixtureId || Number(row.statusId) !== 0)
    throw new Error("No current pre-match odds row.");
  if (
    row.participant1Id !== fixture.participant1Id ||
    row.participant2Id !== fixture.participant2Id
  )
    throw new Error("Provider participant order mismatch.");
  const bookmaker = row.bookmakerOdds?.stake;
  if (
    !bookmaker ||
    bookmaker.bookmakerIsActive !== true ||
    bookmaker.suspended !== false
  )
    throw new Error("Stake is unavailable or suspended.");
  const a = resolvePlayer(
      model,
      fixture.participant1Name,
      fixture.participant1ShortName,
    ),
    b = resolvePlayer(
      model,
      fixture.participant2Name,
      fixture.participant2ShortName,
    );
  if (!a || !b || a.id === b.id)
    throw new Error(
      "Players could not be matched uniquely to the historical model.",
    );
  const surface = resolveSurface(model, fixture);
  if (!surface) throw new Error("No reliable tournament surface reference.");
  let selected;
  for (const market of catalog) {
    const data = bookmaker.markets?.[market.marketId];
    if (data?.marketActive !== true) continue;
    const sides = ["1", "2"].map(
      (name) =>
        data.outcomes?.[
          market.outcomes.find((o) => o.outcomeName === name).outcomeId
        ]?.players?.["0"],
    );
    if (
      !sides.every(
        (s) =>
          s?.active === true &&
          Number.isFinite(Number(s.price)) &&
          Number(s.price) >= 1.01 &&
          Number(s.price) <= 1000,
      )
    )
      continue;
    if (
      sides.some(
        (s) =>
          !Number.isFinite(Date.parse(s.changedAt)) ||
          Date.parse(s.changedAt) > now + 300000,
      )
    )
      continue;
    selected = { market, sides };
    break;
  }
  if (!selected)
    throw new Error("No active two-sided Stake match-winner market.");
  const candidate = createCandidate(
    model,
    {
      aId: a.id,
      bId: b.id,
      surface: surface.surface,
      oddsA: selected.sides[0].price,
      oddsB: selected.sides[1].price,
      startsAt: fixture.startTime,
    },
    now,
  );
  let fixtureUrl = null;
  try {
    const url = new URL(bookmaker.fixturePath);
    if (url.protocol === "https:" && url.hostname === "stake.com")
      fixtureUrl = url.href;
  } catch {}
  return {
    ...candidate,
    source: "Stake via OddsPapi",
    fixtureId: fixture.fixtureId,
    tournament: fixture.tournamentName,
    fixtureUrl,
    market: "Match winner",
    marketId: String(selected.market.marketId),
    outcomeId: String(
      selected.market.outcomes.find(
        (o) => o.outcomeName === (candidate.pick === a.name ? "1" : "2"),
      ).outcomeId,
    ),
    surfaceSource: surface.source,
    priceChangedAt: selected.sides[candidate.pick === a.name ? 0 : 1].changedAt,
    expiresAt: new Date(now + 5 * 60000).toISOString(),
  };
}
export function makeBoard(
  model,
  fixtures,
  rows,
  catalog,
  window,
  now = Date.now(),
) {
  const byId = new Map(rows.map((r) => [r.fixtureId, r]));
  const excluded = [],
    candidates = [];
  const seen = new Set();
  const supported = fixtures.filter((f) => isSupportedFixture(f, window, now));
  for (const fixture of supported) {
    try {
      const candidate = stakeCandidate(
        model,
        fixture,
        byId.get(fixture.fixtureId),
        catalog,
        now,
      );
      if (seen.has(candidate.id))
        throw new Error("Duplicate player pair already included.");
      seen.add(candidate.id);
      candidates.push(candidate);
    } catch (error) {
      excluded.push({
        match: `${fixture.participant1Name} vs ${fixture.participant2Name}`,
        reason: error.message,
      });
    }
  }
  candidates.sort(
    (a, b) =>
      b.probability - a.probability || a.startsAt.localeCompare(b.startsAt),
  );
  const shortlist = candidates.slice(0, MAX_CANDIDATES);
  for (const p of candidates.slice(MAX_CANDIDATES))
    excluded.push({
      match: `${p.aName} vs ${p.bName}`,
      reason: `Outside the ${MAX_CANDIDATES}-match model-confidence shortlist.`,
    });
  return {
    from: window.from,
    to: window.to,
    timeZone: "Africa/Lagos",
    source: "Stake via OddsPapi",
    fetchedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 5 * 60000).toISOString(),
    fixturesFound: fixtures.filter(
      (f) =>
        Date.parse(f.startTime) >= window.start &&
        Date.parse(f.startTime) <= window.end,
    ).length,
    supportedFixtures: supported.length,
    candidates: shortlist,
    excluded,
    modelAsOf: model.asOf,
    modelDataThrough: model.lastTournamentDate,
  };
}
