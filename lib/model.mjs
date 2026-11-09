export const SURFACES = ["Hard", "Clay", "Grass"];
export function freshPlayer(id, name) {
  return {
    id,
    name,
    elo: 1500,
    surfaces: { Hard: 1500, Clay: 1500, Grass: 1500 },
    surfaceMatches: { Hard: 0, Clay: 0, Grass: 0 },
    matches: 0,
    wins: 0,
    recent: [],
    lastDate: null,
  };
}
export const sigmoid = (z) =>
  1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
export const eloProbability = (a, b) => 1 / (1 + 10 ** ((b - a) / 400));
const form = (p) =>
  p.recent.length ? p.recent.reduce((a, b) => a + b, 0) / p.recent.length : 0.5;
export function features(a, b, surface) {
  return [
    (a.elo - b.elo) / 400,
    ((a.surfaces[surface] ?? 1500) - (b.surfaces[surface] ?? 1500)) / 400,
    form(a) - form(b),
  ];
}
export const probability = (x, weights) =>
  sigmoid(x.reduce((s, v, i) => s + v * weights[i], 0));
export function fit(rows) {
  if (!rows.length) throw new Error("No training observations");
  const weights = [1, 1, 0];
  // Each winner-oriented row is paired implicitly with its reversed loss.
  // No intercept preserves P(A,B) + P(B,A) = 1.
  for (let epoch = 0; epoch < 500; epoch++) {
    const gradient = weights.map(() => 0);
    for (const row of rows) {
      const error = probability(row.x, weights) - 1;
      row.x.forEach((v, i) => (gradient[i] += error * v));
    }
    weights.forEach(
      (v, i) => (weights[i] -= 0.25 * (gradient[i] / rows.length + 0.015 * v)),
    );
  }
  return weights;
}
export function evaluate(rows, weights) {
  if (!rows.length) throw new Error("No held-out observations");
  let correct = 0,
    brier = 0,
    logLoss = 0,
    baselineBrier = 0;
  const bins = Array.from({ length: 5 }, (_, i) => ({
    from: 0.5 + i * 0.1,
    to: 0.6 + i * 0.1,
    count: 0,
    correct: 0,
    confidence: 0,
  }));
  for (const row of rows) {
    const p = probability(row.x, weights);
    correct += p > 0.5 ? 1 : p === 0.5 ? 0.5 : 0;
    brier += (1 - p) ** 2;
    logLoss -= Math.log(p);
    baselineBrier += (1 - row.baseline) ** 2;
    const confidence = Math.max(p, 1 - p),
      bin = bins[Math.min(4, Math.floor((confidence - 0.5) * 10))];
    bin.count++;
    bin.correct += p > 0.5 ? 1 : p === 0.5 ? 0.5 : 0;
    bin.confidence += confidence;
  }
  return {
    count: rows.length,
    accuracy: correct / rows.length,
    brier: brier / rows.length,
    logLoss: logLoss / rows.length,
    baselineBrier: baselineBrier / rows.length,
    bins: bins.map((b) => ({
      ...b,
      observed: b.count ? b.correct / b.count : null,
      predicted: b.count ? b.confidence / b.count : null,
    })),
  };
}
export function updatePlayers(a, b, surface, date) {
  const delta = 32 * (1 - eloProbability(a.elo, b.elo));
  a.elo += delta;
  b.elo -= delta;
  const surfaceDelta =
    32 * (1 - eloProbability(a.surfaces[surface], b.surfaces[surface]));
  a.surfaces[surface] += surfaceDelta;
  b.surfaces[surface] -= surfaceDelta;
  for (const [p, win] of [
    [a, 1],
    [b, 0],
  ]) {
    p.matches++;
    p.wins += win;
    p.surfaceMatches[surface]++;
    p.recent = [...p.recent, win].slice(-10);
    p.lastDate = date;
  }
}
export function predict(artifact, aId, bId, surface) {
  if (aId === bId) throw new Error("Choose two different players.");
  if (!SURFACES.includes(surface)) throw new Error("Unsupported surface.");
  const a = artifact.players.find((p) => p.id === aId),
    b = artifact.players.find((p) => p.id === bId);
  if (!a || !b) throw new Error("Choose players in the historical dataset.");
  const x = features(a, b, surface),
    p = probability(x, artifact.weights);
  return {
    a,
    b,
    p,
    contributions: x.map((v, i) => v * artifact.weights[i]),
    limited:
      Math.min(a.surfaceMatches[surface], b.surfaceMatches[surface]) < 20,
  };
}
export function parseCsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Malformed quoted CSV");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows.map((values) =>
    Object.fromEntries(header.map((h, i) => [h, values[i] ?? ""])),
  );
}
