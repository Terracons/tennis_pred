import { downloadHistory, historyState } from "./history.mjs";
let cached = null,
  pending = null;
export async function refreshModel(
  base,
  { now = Date.now(), fetcher = fetch } = {},
) {
  const asOf = new Date(now).toISOString().slice(0, 10);
  const data = await downloadHistory(asOf, { fetcher });
  if (data.matches.length < 1000)
    throw new Error(
      "Current history is incomplete; no stale prediction was substituted.",
    );
  const state = historyState(data.matches);
  if (state.lastTournamentDate < base.lastTournamentDate)
    throw new Error("History provider regressed behind the trained snapshot.");
  return {
    ...base,
    ...state,
    asOf,
    historyCheckedAt: new Date(now).toISOString(),
    historySources: data.sources,
    historyStatus: "current",
    weightsTrainedAt: base.generatedAt,
  };
}
export async function getCurrentModel(base) {
  const now = Date.now(),
    day = new Date(now).toISOString().slice(0, 10);
  if (
    cached?.version === base.version &&
    cached.day === day &&
    cached.until > now
  )
    return cached.model;
  if (pending) return pending;
  pending = refreshModel(base, { now })
    .then((model) => {
      cached = { model, version: base.version, day, until: now + 15 * 60000 };
      return model;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}
