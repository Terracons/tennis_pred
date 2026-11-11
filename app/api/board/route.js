import { unstable_cache } from "next/cache";
import model from "../../../data/model.json";
import { loadBoard } from "../../../lib/provider.mjs";
import { dateWindow } from "../../../lib/live-board.mjs";
export const runtime = "nodejs";
export const maxDuration = 60;
const cachedBoard = unstable_cache(
  (from, to) => loadBoard(model, from, to),
  ["stake-tennis-board-v2"],
  { revalidate: 60 },
);
export async function GET(request) {
  const params = new URL(request.url).searchParams,
    from = params.get("from") || "",
    to = params.get("to") || "";
  try {
    dateWindow(from, to);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  try {
    return Response.json(await cachedBoard(from, to), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: process.env.ODDSPAPI_KEY ? 502 : 503 },
    );
  }
}
