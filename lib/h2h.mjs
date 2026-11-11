export const pairKey = (a, b) => [a, b].sort().join(":");
const decay = (from, to) =>
  2 ** (-Math.max(0, Date.parse(to) - Date.parse(from)) / (730.5 * 86400000));
const empty = () => ({ wins: [0, 0], weighted: [0, 0], lastDate: null });
function recordWin(record, winner, date) {
  const factor = record.lastDate ? decay(record.lastDate, date) : 1;
  record.weighted = record.weighted.map((n) => n * factor);
  record.wins[winner]++;
  record.weighted[winner]++;
  record.lastDate = date;
}
export function updateHeadToHead(index, winnerId, loserId, surface, date) {
  const key = pairKey(winnerId, loserId);
  const record = (index[key] ??= { ...empty(), surfaces: {} });
  const winner = [winnerId, loserId].sort()[0] === winnerId ? 0 : 1;
  recordWin(record, winner, date);
  recordWin((record.surfaces[surface] ??= empty()), winner, date);
}
export function headToHead(index, a, b, surface, date) {
  const record = index[pairKey(a, b)];
  const first = [a, b].sort()[0] === a ? 0 : 1;
  function summary(r) {
    if (r?.lastDate > date)
      throw new Error("Head-to-head history includes future results.");
    const aWins = r?.wins[first] ?? 0,
      bWins = r?.wins[1 - first] ?? 0;
    const factor = r?.lastDate ? decay(r.lastDate, date) : 1;
    const aw = (r?.weighted[first] ?? 0) * factor,
      bw = (r?.weighted[1 - first] ?? 0) * factor;
    return {
      aWins,
      bWins,
      total: aWins + bWins,
      signal: (aw - bw) / (aw + bw + 6),
      lastDate: r?.lastDate ?? null,
    };
  }
  return { ...summary(record), surface: summary(record?.surfaces[surface]) };
}
