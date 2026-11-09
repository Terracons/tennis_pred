import model from "../../../data/model.json";
import { parseNewsFeed } from "../../../lib/news.mjs";
export const runtime = "nodejs";
async function publicNews(players) {
  const response = await fetch(
    "https://feeds.bbci.co.uk/sport/tennis/rss.xml",
    { signal: AbortSignal.timeout(10000), next: { revalidate: 1800 } },
  );
  if (!response.ok) throw new Error("Public news feed unavailable");
  return parseNewsFeed(await response.text(), players);
}
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const ids = [params.get("a"), params.get("b")];
  const players = ids.map((id) => model.players.find((p) => p.id === id));
  if (players.some((p) => !p) || ids[0] === ids[1])
    return Response.json(
      { error: "Choose two valid players." },
      { status: 400 },
    );
  if (!process.env.THENEWSAPI_TOKEN) {
    try {
      return Response.json(await publicNews(players));
    } catch {
      return Response.json(
        {
          status: "error",
          articles: [],
          message:
            "The public tennis-news feed is unavailable. Try again later; current injury information is not included.",
        },
        { status: 502 },
      );
    }
  }
  const url = new URL("https://api.thenewsapi.com/v1/news/all");
  url.searchParams.set("api_token", process.env.THENEWSAPI_TOKEN);
  url.searchParams.set(
    "search",
    players.map((p) => '"' + p.name + '"').join(" | "),
  );
  url.searchParams.set("language", "en");
  url.searchParams.set("limit", "3");
  url.searchParams.set(
    "published_after",
    new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
  );
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error("News provider unavailable");
    const result = await response.json();
    if (!Array.isArray(result.data)) throw new Error("Invalid response");
    const articles = result.data
      .filter((a) => {
        try {
          return new URL(a.url).protocol === "https:";
        } catch {
          return false;
        }
      })
      .map((a) => ({
        title: String(a.title || "Untitled"),
        url: a.url,
        source: String(a.source || "News"),
        publishedAt: a.published_at,
      }));
    return Response.json({
      status: "connected",
      articles,
      checkedAt: new Date().toISOString(),
      message: articles.length
        ? "News is context only. Verify injuries and withdrawals with official sources."
        : "No matching articles were returned for the past 14 days. This does not establish fitness.",
    });
  } catch {
    return Response.json(
      {
        status: "error",
        articles: [],
        message:
          "News could not be loaded. Try again later; predictions do not include current injury information.",
      },
      { status: 502 },
    );
  }
}
