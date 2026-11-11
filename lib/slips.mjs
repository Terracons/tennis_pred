import { predict } from "./model.mjs";
import { pairKey } from "./h2h.mjs";
export const MAX_CANDIDATES = 16;
export function createCandidate(model, input, now = Date.now()) {
  const result = predict(model, input.aId, input.bId, input.surface);
  const oddsA = Number(input.oddsA),
    oddsB = Number(input.oddsB);
  if (
    ![oddsA, oddsB].every((n) => Number.isFinite(n) && n >= 1.01 && n <= 1000)
  )
    throw new Error("Enter both current decimal odds between 1.01 and 1,000.");
  const startsAt = new Date(input.startsAt);
  if (!Number.isFinite(+startsAt) || +startsAt <= now)
    throw new Error("Enter a future match start time.");
  const pickA = result.p >= 0.5;
  return {
    id: pairKey(input.aId, input.bId),
    aId: input.aId,
    bId: input.bId,
    aName: result.a.name,
    bName: result.b.name,
    surface: input.surface,
    startsAt: startsAt.toISOString(),
    odds: pickA ? oddsA : oddsB,
    probability: pickA ? result.p : 1 - result.p,
    pick: pickA ? result.a.name : result.b.name,
    h2h: result.h2h,
    quotedAt: new Date(now).toISOString(),
    modelAsOf: model.asOf,
  };
}
export function buildSlip(
  pool,
  { target = 20, maxLegs = 8, minProbability = 0.55, tolerance = 0.1 } = {},
  now = Date.now(),
) {
  if (!Number.isFinite(target) || target < 1.01 || target > 10000)
    throw new Error("Target odds must be between 1.01 and 10,000.");
  if (!Number.isInteger(maxLegs) || maxLegs < 1 || maxLegs > 8)
    throw new Error("Choose between 1 and 8 legs.");
  if (
    !Number.isFinite(minProbability) ||
    minProbability < 0.5 ||
    minProbability > 0.95
  )
    throw new Error("Minimum model probability must be 50% to 95%.");
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 0.25)
    throw new Error("Invalid target tolerance.");
  if (pool.length > MAX_CANDIDATES)
    throw new Error(`Use at most ${MAX_CANDIDATES} matchups.`);
  const ids = new Set();
  for (const p of pool) {
    if (
      !p.aId ||
      !p.bId ||
      p.aId === p.bId ||
      p.id !== pairKey(p.aId, p.bId) ||
      ids.has(p.id) ||
      !Number.isFinite(p.odds) ||
      p.odds <= 1 ||
      p.odds > 1000 ||
      !Number.isFinite(p.probability) ||
      p.probability <= 0 ||
      p.probability >= 1 ||
      !Number.isFinite(Date.parse(p.startsAt)) ||
      !Number.isFinite(Date.parse(p.quotedAt))
    )
      throw new Error("Invalid or duplicate matchup in the pool.");
    ids.add(p.id);
  }
  // Old prices and already-started fixtures are never silently reused.
  const eligible = pool.filter(
    (p) =>
      Date.parse(p.startsAt) > now &&
      (p.expiresAt
        ? Number.isFinite(Date.parse(p.expiresAt)) &&
          Date.parse(p.expiresAt) > now
        : now - Date.parse(p.quotedAt) <= 86400000) &&
      Date.parse(p.quotedAt) <= now &&
      p.probability >= minProbability,
  );
  let best = null,
    closest = null;
  function visit(start, legs, odds, probability, used) {
    if (legs.length) {
      const candidate = {
        legs: [...legs],
        odds,
        probability,
        distance: Math.abs(Math.log(odds / target)),
      };
      if (
        !closest ||
        candidate.distance < closest.distance - 1e-12 ||
        (Math.abs(candidate.distance - closest.distance) < 1e-12 &&
          probability > closest.probability)
      )
        closest = candidate;
      if (
        odds >= target * (1 - tolerance) - 1e-10 &&
        odds <= target * (1 + tolerance) + 1e-10 &&
        (!best ||
          probability > best.probability + 1e-12 ||
          (Math.abs(probability - best.probability) < 1e-12 &&
            candidate.distance < best.distance))
      )
        best = candidate;
    }
    if (legs.length === maxLegs) return;
    for (let i = start; i < eligible.length; i++) {
      const p = eligible[i];
      if (used.has(p.aId) || used.has(p.bId)) continue;
      visit(
        i + 1,
        [...legs, p],
        odds * p.odds,
        probability * p.probability,
        new Set([...used, p.aId, p.bId]),
      );
    }
  }
  visit(0, [], 1, 1, new Set());
  return {
    ...(best || closest || { legs: [], odds: null, probability: null }),
    target,
    matched: !!best,
    eligible: eligible.length,
    excluded: pool.length - eligible.length,
    builtAt: new Date(now).toISOString(),
  };
}
export function slipText(slip) {
  return [
    `Baseline research slip | target ${slip.target.toFixed(2)} | ${slip.matched ? "within 10% target band" : "closest available, target not reached"}`,
    ...slip.legs.map(
      (p, i) =>
        `${i + 1}. ${p.aName} vs ${p.bName} | ${p.startsAt} | ${p.surface} | ${p.pick} to win @ ${p.odds.toFixed(2)} | model ${(p.probability * 100).toFixed(1)}% | ${p.source || "Manual entry"}${p.fixtureUrl ? " | " + p.fixtureUrl : ""}`,
    ),
    `Combined odds: ${slip.odds.toFixed(2)}`,
    `Model joint probability (assumes independence): ${(slip.probability * 100).toFixed(2)}%`,
    "Verify prices, availability and retirement rules on Stake before use. Not a booking code. Published result histories are refreshed; fitness and news are not model inputs.",
  ].join("\n");
}
