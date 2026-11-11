"use client";
import { useEffect, useState } from "react";
import { buildSlip, slipText } from "../lib/slips.mjs";
import { lagosDay } from "../lib/live-board.mjs";
const percent = (n) => (n * 100).toFixed(1) + "%";
const displayDate = (s) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(s));
const plusDays = (day, n) =>
  new Date(Date.parse(day) + n * 86400000).toISOString().slice(0, 10);
export default function SlipBuilder({ model }) {
  const [range, setRange] = useState({ from: "", to: "" }),
    [target, setTarget] = useState("20"),
    [maxLegs, setMaxLegs] = useState("8"),
    [minimum, setMinimum] = useState("55"),
    [stake, setStake] = useState("100");
  const [board, setBoard] = useState(null),
    [slip, setSlip] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [expired, setExpired] = useState(false);
  useEffect(() => {
    const day = lagosDay();
    setRange({ from: day, to: day });
  }, []);
  useEffect(() => {
    if (!board) return;
    const check = () =>
      setExpired(
        Date.parse(board.expiresAt) <= Date.now() ||
          !!slip?.legs.some((p) => Date.parse(p.startsAt) <= Date.now()),
      );
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [board, slip]);
  function invalidate() {
    setSlip(null);
    setMessage("");
    setError("");
  }
  function presetDates(offset, days) {
    const start = plusDays(lagosDay(), offset);
    setRange({ from: start, to: plusDays(start, days - 1) });
    setBoard(null);
    invalidate();
  }
  async function generate(event) {
    event.preventDefault();
    invalidate();
    setBoard(null);
    setBusy(true);
    try {
      const response = await fetch(
        `/api/board?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not load the Stake fixture feed.");
      setBoard(data);
      setExpired(false);
      setSlip(
        buildSlip(data.candidates, {
          target: Number(target),
          maxLegs: Number(maxLegs),
          minProbability: Number(minimum) / 100,
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      if (
        expired ||
        slip.legs.some(
          (p) =>
            Date.parse(p.startsAt) <= Date.now() ||
            Date.parse(p.expiresAt) <= Date.now(),
        )
      )
        throw new Error(
          "This slip has expired. Generate it again to refresh Stake prices.",
        );
      await navigator.clipboard.writeText(slipText(slip));
      setMessage(
        "Slip copied with Stake match links. This is not a Stake booking code.",
      );
    } catch (e) {
      setError(
        e.message || "Could not copy. Select the slip text below instead.",
      );
    }
  }
  return (
    <>
      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">
              LIVE FIXTURES / STAKE MATCH-WINNER ODDS
            </span>
            <h2>Your dates. Your target.</h2>
          </div>
          <span className="tag">ATP SINGLES</span>
        </div>
        <p>
          Fetch upcoming matches automatically, analyze historical strength,
          recent recorded form and head-to-head, then combine eligible Stake
          selections.
        </p>
        <form onSubmit={generate}>
          <fieldset disabled={busy}>
            <legend>WHEN SHOULD THE MATCHES START? · AFRICA/LAGOS</legend>
            <div className="preset-buttons">
              {[
                ["Today", 0, 1],
                ["Tomorrow", 1, 1],
                ["Next 3 days", 0, 3],
                ["Next 7 days", 0, 7],
              ].map(([label, offset, days]) => (
                <button
                  type="button"
                  className="secondary"
                  key={label}
                  onClick={() => presetDates(offset, days)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="odds-inputs">
              <label>
                FROM DATE
                <input
                  required
                  type="date"
                  value={range.from}
                  onChange={(e) => {
                    setRange({ ...range, from: e.target.value });
                    setBoard(null);
                    invalidate();
                  }}
                />
              </label>
              <label>
                THROUGH DATE
                <input
                  required
                  type="date"
                  value={range.to}
                  onChange={(e) => {
                    setRange({ ...range, to: e.target.value });
                    setBoard(null);
                    invalidate();
                  }}
                />
              </label>
            </div>
          </fieldset>
          <fieldset disabled={busy}>
            <legend>TARGET ACCUMULATOR ODDS</legend>
            <div className="preset-buttons">
              {[5, 10, 20, 50, 100].map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-pressed={Number(target) === n}
                  className={
                    Number(target) === n ? "secondary chosen" : "secondary"
                  }
                  onClick={() => {
                    setTarget(String(n));
                    invalidate();
                  }}
                >
                  {n} odds
                </button>
              ))}
            </div>
            <div className="slip-controls">
              <label>
                CUSTOM TARGET
                <input
                  type="number"
                  min="1.01"
                  max="10000"
                  step=".01"
                  required
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    invalidate();
                  }}
                />
              </label>
              <label>
                MAXIMUM LEGS
                <select
                  value={maxLegs}
                  onChange={(e) => {
                    setMaxLegs(e.target.value);
                    invalidate();
                  }}
                >
                  {Array.from({ length: 8 }, (_, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1} {i === 0 ? "leg" : "legs"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                MINIMUM MODEL PROBABILITY (%)
                <input
                  type="number"
                  min="50"
                  max="95"
                  step="1"
                  required
                  value={minimum}
                  onChange={(e) => {
                    setMinimum(e.target.value);
                    invalidate();
                  }}
                />
              </label>
            </div>
          </fieldset>
          <button
            className="primary"
            disabled={busy || !range.from || !range.to}
          >
            {busy
              ? "Fetching fixtures, Stake odds and model analysis…"
              : "Generate Stake slip"}
            <span>↗</span>
          </button>
          <p className="micro">
            Target band ±10% · One match per player · Match winner only · No
            automatic betting
          </p>
        </form>
      </section>
      <div aria-live="polite">
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && <p className="text-link">{message}</p>}
      </div>
      {board && (
        <>
          <section className="panel signals">
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  API COVERAGE / {board.from} TO {board.to}
                </span>
                <h2>{board.candidates.length} analyzed Stake selections</h2>
              </div>
              <span className="tag">
                {expired ? "REFRESH REQUIRED" : "API PRICES"}
              </span>
            </div>
            <p>
              {board.fixturesFound} tennis fixtures in the requested window;{" "}
              {board.supportedFixtures} upcoming ATP main-tour singles matches.
              Only matched players with active two-sided Stake winner prices
              qualify. Up to 16 candidates are shortlisted by model probability.
            </p>
            <p>
              Feed fetched {displayDate(board.fetchedAt)}. Refresh after{" "}
              {displayDate(board.expiresAt)}. The historical model's latest
              tournament is {board.modelDataThrough}; live odds do not update
              its player histories.
            </p>
            {board.coverageLimited && (
              <p className="notice">
                Coverage was limited to 12 tournaments for this request. Narrow
                the dates to cover more of a specific day.
              </p>
            )}
            {board.candidates.length > 0 && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Fixture / start (Lagos)</th>
                      <th>Model pick</th>
                      <th>Stake odds</th>
                      <th>Model estimate</th>
                      <th>H2H (A : B)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.candidates.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.aName} vs {p.bName}
                          <small className="cell-note">
                            {displayDate(p.startsAt)} · {p.tournament}
                          </small>
                          <small className="cell-note">
                            {p.surface} · {p.surfaceSource}
                          </small>
                        </td>
                        <td>
                          {p.pick}
                          {p.fixtureUrl && (
                            <a
                              className="cell-note text-link"
                              href={p.fixtureUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open match on Stake ↗
                            </a>
                          )}
                        </td>
                        <td>
                          {p.odds.toFixed(2)}
                          <small className="cell-note">
                            Price last changed {displayDate(p.priceChangedAt)}
                          </small>
                        </td>
                        <td>{percent(p.probability)}</td>
                        <td>
                          {p.h2h.aWins} : {p.h2h.bWins}
                          <small className="cell-note">
                            Surface {p.h2h.surface.aWins} :{" "}
                            {p.h2h.surface.bWins}
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {board.excluded.length > 0 && (
              <details className="export-text">
                <summary>
                  Why {board.excluded.length} fixtures were excluded
                </summary>
                <ul>
                  {board.excluded.map((p, i) => (
                    <li key={i}>
                      {p.match}: {p.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
          {slip && (
            <section className="panel signals" aria-live="polite">
              <div className="section-head">
                <div>
                  <span className="eyebrow">YOUR STAKE CHECKLIST</span>
                  <h2>
                    {expired
                      ? "Prices expired: generate a fresh slip"
                      : slip.matched
                        ? "A combination near your target"
                        : slip.legs.length
                          ? "Target unavailable: closest combination"
                          : "No eligible combination"}
                  </h2>
                </div>
                <span className="tag">TARGET {slip.target.toFixed(2)}</span>
              </div>
              <p>
                {slip.eligible} eligible picks; {slip.excluded} excluded by
                probability or expiry. Target band:{" "}
                {(slip.target * 0.9).toFixed(2)} to{" "}
                {(slip.target * 1.1).toFixed(2)}. An unavailable target is never
                filled with invented fixtures or prices.
              </p>
              {slip.legs.length > 0 && (
                <>
                  <ol className="slip-legs">
                    {slip.legs.map((p) => (
                      <li key={p.id}>
                        <div>
                          <strong>{p.pick} to win</strong>
                          <span>
                            {p.aName} vs {p.bName} · {p.surface}
                          </span>
                          <small>
                            {displayDate(p.startsAt)} · Model{" "}
                            {percent(p.probability)} · H2H {p.h2h.aWins}:
                            {p.h2h.bWins}
                          </small>
                          {p.fixtureUrl && (
                            <a
                              className="text-link"
                              href={p.fixtureUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View this match on Stake ↗
                            </a>
                          )}
                        </div>
                        <b>{p.odds.toFixed(2)}</b>
                      </li>
                    ))}
                  </ol>
                  <div className="slip-totals">
                    <div>
                      <span>COMBINED STAKE DECIMAL ODDS</span>
                      <strong>{slip.odds.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span>MODEL JOINT ESTIMATE</span>
                      <strong>{percent(slip.probability)}</strong>
                    </div>
                  </div>
                  <p className="result-note">
                    Joint probability assumes independent results; shared
                    conditions can cause correlation. The model uses a
                    historical snapshot, not current fitness. Verify prices,
                    availability and tennis retirement rules on Stake. There is
                    no booking code, automatic bet placement, or verified
                    profitability.
                  </p>
                  <div className="stake-preview">
                    <label>
                      OPTIONAL STAKE (YOUR CURRENCY)
                      <input
                        type="number"
                        min="0"
                        max="1000000000"
                        step=".01"
                        value={stake}
                        onChange={(e) => setStake(e.target.value)}
                      />
                    </label>
                    <p>
                      {Number.isFinite(Number(stake)) &&
                      Number(stake) > 0 &&
                      Number(stake) <= 1e9 ? (
                        <>
                          If every leg wins:{" "}
                          <strong>
                            {(Number(stake) * slip.odds).toLocaleString(
                              undefined,
                              { maximumFractionDigits: 2 },
                            )}
                          </strong>{" "}
                          total return, including stake. A losing leg loses the
                          stake; voids can change the total.
                        </>
                      ) : (
                        "Enter a valid stake to preview a possible return."
                      )}
                    </p>
                  </div>
                  <button
                    className="secondary"
                    disabled={expired}
                    onClick={copy}
                  >
                    Copy slip and Stake links
                  </button>
                  {!expired && (
                    <details className="export-text">
                      <summary>View copyable slip text</summary>
                      <textarea
                        aria-label="Slip text"
                        readOnly
                        value={slipText(slip)}
                      />
                    </details>
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
