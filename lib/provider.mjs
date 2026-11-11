import {
  dateWindow,
  isSupportedFixture,
  winnerMarket,
  makeBoard,
} from "./live-board.mjs";
export async function loadBoard(
  model,
  from,
  to,
  { key = process.env.ODDSPAPI_KEY, fetcher = fetch, now = Date.now() } = {},
) {
  const window = dateWindow(from, to, now);
  if (!key)
    throw new Error(
      "ODDSPAPI_KEY is not configured. Add your existing OddsPapi key in Vercel environment variables and redeploy.",
    );
  async function get(path, params) {
    const url = new URL("https://api.oddspapi.io/v4" + path);
    for (const [k, v] of Object.entries({ ...params, apiKey: key }))
      url.searchParams.set(k, String(v));
    let response;
    try {
      response = await fetcher(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error(
        "The tennis data provider could not be reached. Try again later.",
      );
    }
    if (
      response.status === 404 &&
      ["/fixtures", "/odds-by-tournaments"].includes(path)
    ) {
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      if (body?.error?.code === "FIXTURE_NOT_FOUND") return [];
    }
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "Provider rate limit reached. Please wait before refreshing."
          : response.status === 401 || response.status === 403
            ? "The data provider rejected the key or your subscription does not cover this endpoint."
            : `Tennis provider returned HTTP ${response.status}.`,
      );
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("The tennis data provider returned invalid JSON.");
    }
    if (!Array.isArray(data))
      throw new Error(
        "The tennis data provider returned an unexpected response.",
      );
    return data;
  }
  // UTC date envelope includes the whole Lagos interval, including the preceding UTC evening.
  const fixtures = await get("/fixtures", {
    sportId: 12,
    from: new Date(window.start).toISOString().slice(0, 10),
    to: new Date(window.end + 86400000).toISOString().slice(0, 10),
    statusId: 0,
  });
  const supported = fixtures.filter((f) => isSupportedFixture(f, window, now));
  if (!supported.length) return makeBoard(model, fixtures, [], [], window, now);
  const catalog = winnerMarket(await get("/markets", { sportId: 12 }));
  if (!catalog.length)
    throw new Error("No verified tennis match-winner market was found.");
  const allIds = [...new Set(supported.map((f) => String(f.tournamentId)))];
  const ids = allIds.slice(0, 12),
    rows = [];
  for (let i = 0; i < ids.length; i += 4)
    rows.push(
      ...(await get("/odds-by-tournaments", {
        bookmaker: "stake",
        tournamentIds: ids.slice(i, i + 4).join(","),
      })),
    );
  const board = makeBoard(model, fixtures, rows, catalog, window, now);
  board.coverageLimited = allIds.length > ids.length;
  return board;
}
