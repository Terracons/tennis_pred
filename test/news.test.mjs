import test from "node:test";
import assert from "node:assert/strict";
import { parseNewsFeed } from "../lib/news.mjs";
const now = Date.parse("2026-11-09T12:00:00Z");
const item = (
  title,
  url = "https://www.bbc.co.uk/sport/tennis/articles/123",
  date = "Mon, 09 Nov 2026 07:20:00 GMT",
) =>
  `<item><title><![CDATA[${title}]]></title><link>${url}</link><pubDate>${date}</pubDate></item>`;
const feed = (items) => `<rss><channel>${items}</channel></rss>`;
test("news prioritizes relevant surnames and preserves source dates", () => {
  const result = parseNewsFeed(
    feed(item("Other tennis news") + item("Sinner reaches final")),
    [{ name: "Jannik Sinner" }],
    now,
  );
  assert.equal(result.scope, "player");
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].source, "BBC Sport");
});
test("unmatched news is labeled general, never player-specific", () => {
  const result = parseNewsFeed(
    feed(item("Other tennis news")),
    [{ name: "Jannik Sinner" }],
    now,
  );
  assert.equal(result.scope, "general");
  assert.match(result.message, /General tennis/);
});
test("unsafe URLs, future dates and stale articles are discarded", () => {
  const result = parseNewsFeed(
    feed(
      item("Unsafe", "javascript:alert(1)") +
        item("Old", undefined, "Mon, 01 Jan 2024 00:00:00 GMT") +
        item("Future", undefined, "Mon, 09 Nov 2027 00:00:00 GMT"),
    ),
    [{ name: "Jannik Sinner" }],
    now,
  );
  assert.equal(result.articles.length, 0);
});
test("malformed feed fails explicitly", () =>
  assert.throws(() => parseNewsFeed("broken", [], now)));
