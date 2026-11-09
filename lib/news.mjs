import { XMLParser } from "fast-xml-parser";
export function parseNewsFeed(xml, players, now = Date.now()) {
  if (xml.length > 2000000) throw new Error("News feed too large");
  const parsed = new XMLParser({
    ignoreAttributes: true,
    processEntities: true,
  }).parse(xml);
  const items = parsed?.rss?.channel?.item;
  if (!items) throw new Error("Invalid news feed");
  const articles = (Array.isArray(items) ? items : [items]).flatMap((item) => {
    try {
      const url = new URL(String(item.link));
      const date = new Date(item.pubDate);
      if (
        url.protocol !== "https:" ||
        !/(^|\.)bbc\.(co\.uk|com)$/.test(url.hostname) ||
        !Number.isFinite(+date) ||
        +date > now + 86400000 ||
        +date < now - 14 * 86400000
      )
        return [];
      return [
        {
          title: String(item.title || "Tennis news"),
          url: url.href,
          publishedAt: date.toISOString(),
          source: "BBC Sport",
        },
      ];
    } catch {
      return [];
    }
  });
  const normalize = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const matched = articles.filter((article) =>
    players.some((p) =>
      normalize(article.title).includes(normalize(p.name.split(" ").at(-1))),
    ),
  );
  return {
    status: "connected",
    articles: (matched.length ? matched : articles).slice(0, 3),
    scope: matched.length ? "player" : "general",
    checkedAt: new Date(now).toISOString(),
    message: matched.length
      ? "Recent BBC tennis headlines mentioning a selected surname. Check each article for relevance; headlines do not establish player fitness."
      : "General tennis headlines from BBC Sport. No selected-player surname matches were found; this does not establish fitness.",
  };
}
