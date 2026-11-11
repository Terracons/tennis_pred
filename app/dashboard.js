"use client";
import { useState } from "react";
import { predict, SURFACES } from "../lib/model.mjs";
import HeadToHead from "./head-to-head";
import SlipBuilder from "./slip-builder";
const pct = (n) => (100 * n).toFixed(1) + "%";
const count = (n) => n.toLocaleString("en-US");
export default function Dashboard({ model }) {
  const active = model.players.filter((p) => p.lastDate >= "2025-01-01");
  const [aId, setA] = useState(active[0]?.id || model.players[0].id),
    [bId, setB] = useState(active[1]?.id || model.players[1].id),
    [surface, setSurface] = useState("Hard");
  const [result, setResult] = useState(null),
    [news, setNews] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [oddsA, setOddsA] = useState(""),
    [oddsB, setOddsB] = useState(""),
    [tab, setTab] = useState("slips"),
    [query, setQuery] = useState("");
  const players = active.length >= 2 ? active : model.players;
  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );
  function change(set, value) {
    set(value);
    setResult(null);
    setNews(null);
    setError("");
    setOddsA("");
    setOddsB("");
  }
  async function run(event) {
    event.preventDefault();
    setError("");
    setNews(null);
    try {
      const next = predict(model, aId, bId, surface);
      setResult(next);
      setBusy(true);
      try {
        const response = await fetch(
          `/api/news?a=${encodeURIComponent(aId)}&b=${encodeURIComponent(bId)}`,
        );
        setNews(await response.json());
      } catch {
        setNews({
          status: "error",
          message:
            "News connection failed. Historical model results remain available.",
          articles: [],
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const a = model.players.find((p) => p.id === aId),
    b = model.players.find((p) => p.id === bId);
  const staleDays = Math.floor(
    (Date.parse(model.asOf) - Date.parse(model.lastTournamentDate)) / 86400000,
  );
  const ageDays = Math.floor((Date.now() - Date.parse(model.asOf)) / 86400000);
  const validOdds =
    Number(oddsA) > 1 &&
    Number(oddsB) > 1 &&
    Number.isFinite(Number(oddsA)) &&
    Number.isFinite(Number(oddsB));
  const fairA = validOdds
    ? 1 / Number(oddsA) / (1 / Number(oddsA) + 1 / Number(oddsB))
    : null;
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Baseline home">
          <span className="brand-icon">◒</span> baseline
          <span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">TENNIS INTELLIGENCE</div>
        <nav aria-label="Main navigation">
          {[
            ["slips", "▧", "Slip builder"],
            ["predict", "◉", "Match lab"],
            ["performance", "▥", "Model performance"],
            ["data", "▤", "Data & methodology"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={tab === id ? "nav-item selected" : "nav-item"}
              onClick={() => setTab(id)}
            >
              <span>{icon}</span>
              {label}
              {tab === id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" /> ATP singles model{" "}
          <p>
            Historical signals.
            <br />A clearer view of the match.
          </p>
          <small>PERSONAL RESEARCH EDITION · 01</small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            WORKSPACE <span className="slash">/</span>{" "}
            {tab === "predict"
              ? "Match lab"
              : tab === "slips"
                ? "Slip builder"
                : tab === "performance"
                  ? "Model performance"
                  : "Data & methodology"}
          </span>
          <span className="snapshot">
            <span className="status-dot" /> Snapshot · {model.asOf}
          </span>
        </header>
        <div className="content">
          <div className="heading">
            <div>
              <div className="eyebrow">THE EDGE IS IN THE DETAILS</div>
              <h1>
                {tab === "predict" ? (
                  <>
                    Read the match.
                    <br />
                    <em>Know the numbers.</em>
                  </>
                ) : tab === "slips" ? (
                  <>
                    Your target.
                    <br />
                    <em>Your match slip.</em>
                  </>
                ) : tab === "performance" ? (
                  <>
                    Evidence before
                    <br />
                    <em>confidence.</em>
                  </>
                ) : (
                  <>
                    Every prediction
                    <br />
                    <em>has a source.</em>
                  </>
                )}
              </h1>
              <p>
                {tab === "predict"
                  ? "Historical form, court surface, and a trained model. One considered view."
                  : tab === "slips"
                    ? "Live fixtures. Stake prices. Machine learning, statistics and head-to-head behind each pick."
                    : tab === "performance"
                      ? "Measured on later matches the model did not use to learn its weights."
                      : "Trace the data, understand the model, and see its limits."}
              </p>
            </div>
            <div className="court" aria-hidden="true">
              <div className="court-inside" />
              <div className="court-mid" />
              <div className="court-net" />
              <span className="ball" />
              <span className="court-caption">BASELINE / ATP</span>
            </div>
          </div>
          <div className="metrics">
            <Metric
              label="HISTORICAL MATCHES"
              value={count(model.matchCount)}
              note="Completed ATP singles"
            />
            <Metric
              label="HELD-OUT ACCURACY"
              value={pct(model.metrics.accuracy)}
              note={`${count(model.metrics.count)} later matches tested`}
            />
            <Metric
              label="MODEL BRIER SCORE"
              value={model.metrics.brier.toFixed(3)}
              note="Lower is better · 0.250 coin flip"
            />
            <Metric
              label="DATA THROUGH"
              value={model.lastTournamentDate}
              note="Tournament start date"
              small
            />
          </div>
          {(staleDays > 45 || ageDays > 7) && (
            <div className="notice">
              Historical snapshot: {model.asOf}. Latest included tournament
              started {model.lastTournamentDate}. Refresh and retrain before
              relying on current form.
            </div>
          )}
          {tab === "predict" && (
            <>
              <section className="lab-grid">
                <div className="panel matchup">
                  <div className="section-head">
                    <div>
                      <span className="eyebrow">01 / BUILD YOUR MATCHUP</span>
                      <h2>Two players. One court.</h2>
                    </div>
                    <span className="tag">ATP SINGLES</span>
                  </div>
                  <form onSubmit={run}>
                    <div className="player-selects">
                      <label>
                        PLAYER A
                        <select
                          value={aId}
                          disabled={busy}
                          onChange={(e) => change(setA, e.target.value)}
                        >
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <span>
                          {Math.round(a.elo)} Elo · {a.matches} matches
                        </span>
                      </label>
                      <span className="versus">VS</span>
                      <label>
                        PLAYER B
                        <select
                          value={bId}
                          disabled={busy}
                          onChange={(e) => change(setB, e.target.value)}
                        >
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <span>
                          {Math.round(b.elo)} Elo · {b.matches} matches
                        </span>
                      </label>
                    </div>
                    <fieldset>
                      <legend>COURT SURFACE</legend>
                      <div className="surface-options">
                        {SURFACES.map((s) => (
                          <button
                            disabled={busy}
                            key={s}
                            type="button"
                            aria-pressed={s === surface}
                            onClick={() => change(setSurface, s)}
                            className={
                              s === surface ? "surface active" : "surface"
                            }
                          >
                            <span
                              className={`surface-dot ${s.toLowerCase()}`}
                            />
                            {s}{" "}
                            {s === surface && <span className="check">✓</span>}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <details className="odds">
                      <summary>
                        Compare with Stake odds <span>optional +</span>
                      </summary>
                      <p>
                        Enter odds for a manual comparison here, or use Slip
                        builder to fetch Stake prices automatically.
                      </p>
                      <div className="odds-inputs">
                        <label>
                          {a.name}
                          <input
                            aria-label="Player A decimal odds"
                            type="number"
                            step=".01"
                            min="1.01"
                            placeholder="e.g. 1.80"
                            value={oddsA}
                            onChange={(e) => setOddsA(e.target.value)}
                          />
                        </label>
                        <label>
                          {b.name}
                          <input
                            aria-label="Player B decimal odds"
                            type="number"
                            step=".01"
                            min="1.01"
                            placeholder="e.g. 2.10"
                            value={oddsB}
                            onChange={(e) => setOddsB(e.target.value)}
                          />
                        </label>
                      </div>
                    </details>
                    {error && (
                      <p role="alert" className="error">
                        {error}
                      </p>
                    )}
                    <button className="primary" disabled={busy || aId === bId}>
                      {busy ? "Checking recent news…" : "Analyze matchup"}
                      <span>↗</span>
                    </button>
                    {aId === bId && (
                      <p className="error">Choose two different players.</p>
                    )}
                    <p className="micro">
                      Trained statistical model · No fabricated picks or results
                    </p>
                  </form>
                </div>
                <div className="panel forecast" aria-live="polite">
                  <span className="eyebrow">02 / MODEL OUTLOOK</span>
                  {!result ? (
                    <div className="empty-state">
                      <div className="empty-mark">↗</div>
                      <h2>
                        A prediction starts
                        <br />
                        with a matchup.
                      </h2>
                      <p>
                        Choose your players and surface.
                        <br />
                        See the probabilities and the evidence behind them.
                      </p>
                      <span className="tag">READY WHEN YOU ARE</span>
                    </div>
                  ) : (
                    <>
                      <div className="result-heading">
                        <span>MODEL FAVORS</span>
                        <h2>
                          {result.p >= 0.5 ? result.a.name : result.b.name}
                        </h2>
                      </div>
                      <div className="probability">
                        {pct(Math.max(result.p, 1 - result.p))}
                        <span>estimated win probability</span>
                      </div>
                      <div className="probability-bar">
                        <span style={{ width: pct(result.p) }} />
                      </div>
                      <div className="probability-labels">
                        <span>
                          {result.a.name}
                          <b>{pct(result.p)}</b>
                        </span>
                        <span>
                          {result.b.name}
                          <b>{pct(1 - result.p)}</b>
                        </span>
                      </div>
                      <div className="fair-odds">
                        <span>Model fair odds</span>
                        <b>
                          {(1 / result.p).toFixed(2)} /{" "}
                          {(1 / (1 - result.p)).toFixed(2)}
                        </b>
                      </div>
                      <div className="result-note">
                        {result.limited
                          ? "Limited surface history: at least one player has fewer than 20 matches on this court."
                          : "Historical estimate; player fitness and current injuries are not included."}
                      </div>
                      {fairA !== null && (
                        <div className="comparison">
                          <span>Market probability, margin removed</span>
                          <b>
                            {pct(fairA)} / {pct(1 - fairA)}
                          </b>
                          <small>
                            Player A model difference:{" "}
                            {((result.p - fairA) * 100).toFixed(1)} percentage
                            points. A difference is not proof of a profitable
                            bet.
                          </small>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
              {result && (
                <section className="panel signals">
                  <div className="section-head">
                    <div>
                      <span className="eyebrow">BEHIND THE ESTIMATE</span>
                      <h2>The signals in play</h2>
                    </div>
                    <span className="tag">{surface.toUpperCase()} COURT</span>
                  </div>
                  <div className="signal-grid">
                    {[
                      "Overall strength",
                      "Surface experience",
                      "Recent form",
                      "Head-to-head record",
                      "Same-surface meetings",
                    ].map((label, i) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>
                          {Math.abs(result.contributions[i]) < 0.01
                            ? "Balanced"
                            : result.contributions[i] > 0
                              ? result.a.name
                              : result.b.name}
                        </strong>
                        <small>
                          {i === 0
                            ? "Learned overall Elo contribution"
                            : i === 1
                              ? `${result.a.surfaceMatches[surface]} vs ${result.b.surfaceMatches[surface]} recorded matches`
                              : i === 2
                                ? "Last 10 recorded results; not a fitness assessment"
                                : i === 3
                                  ? `${result.h2h.aWins} : ${result.h2h.bWins} across ${result.h2h.total} meetings`
                                  : `${result.h2h.surface.aWins} : ${result.h2h.surface.bWins} on ${surface}`}
                        </small>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {result && <HeadToHead result={result} surface={surface} />}
              <section className="news-row">
                <div>
                  <span className="eyebrow">03 / OFF THE COURT</span>
                  <h2>The news matters, too.</h2>
                  <p>
                    Recent reporting can reveal information the historical model
                    cannot see.
                  </p>
                  <span className="text-link">
                    Context, separate from probability ↗
                  </span>
                </div>
                <div className="panel news-panel">
                  <span className="tag">
                    {busy
                      ? "CHECKING"
                      : news?.status === "connected"
                        ? "NEWS CONNECTED"
                        : "NEWS STATUS"}
                  </span>
                  <p>
                    {busy
                      ? "Looking for recent player coverage…"
                      : news?.message ||
                        "Analyze a matchup to check the news connection and find recent player coverage."}
                  </p>
                  {news?.articles?.map((article) => (
                    <a
                      className="article"
                      key={article.url}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <small>
                        {article.source} · {article.publishedAt?.slice(0, 10)}
                      </small>
                      <strong>{article.title} ↗</strong>
                    </a>
                  ))}
                </div>
              </section>
            </>
          )}
          {tab === "slips" && <SlipBuilder model={model} />}
          {tab === "performance" && (
            <section className="panel details-panel">
              <span className="eyebrow">OUT-OF-TIME EVALUATION</span>
              <h2>How the model holds up</h2>
              <p>
                Weights learned from {count(model.trainingCount)} earlier
                matches. Evaluation begins {model.cutoff}, with earlier test
                results updating ratings only once their 21-day availability
                delay passes. No odds or news are used in this test.
              </p>
              <div className="score-grid">
                <Metric
                  label="LOG LOSS"
                  value={model.metrics.logLoss.toFixed(3)}
                  note="Lower is better · 0.693 coin flip"
                />
                <Metric
                  label="ELO BASELINE BRIER"
                  value={model.metrics.baselineBrier.toFixed(3)}
                  note="Compare with learned model"
                />
              </div>
              <h3>Does confidence match reality?</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Probability band</th>
                      <th>Matches</th>
                      <th>Mean confidence</th>
                      <th>Observed wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.metrics.bins.map((bin, i) => (
                      <tr key={i}>
                        <td>
                          {Math.round(bin.from * 100)}% to{" "}
                          {Math.round(bin.to * 100)}%
                        </td>
                        <td>{bin.count}</td>
                        <td>
                          {bin.predicted === null
                            ? "Insufficient data"
                            : pct(bin.predicted)}
                        </td>
                        <td>
                          {bin.observed === null
                            ? "Insufficient data"
                            : pct(bin.observed)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="result-note">
                Accuracy is not betting profit. These results exclude walkovers
                and retirements and cover players with at least 10 prior
                matches. There is no verified betting ROI, bookmaker comparison,
                or independent calibration guarantee.
              </p>
            </section>
          )}
          {tab === "data" && (
            <>
              <section className="panel details-panel">
                <span className="eyebrow">
                  MODEL CARD / VERSION {model.version}
                </span>
                <h2>Small model. Visible assumptions.</h2>
                <p>{model.method}</p>
                <h3>What goes in</h3>
                <p>
                  Overall Elo difference, surface Elo difference, and the
                  difference in each player's win rate over their last 10
                  recorded matches, plus recency-weighted overall and
                  same-surface head-to-head records. These records use a
                  two-year half-life and six neutral prior observations to limit
                  small-sample effects. Coefficients are learned with
                  regularized logistic regression. The model handles ATP singles
                  match winners only.
                </p>
                <h3>What stays out</h3>
                <p>
                  No current injury or withdrawal analysis, WTA, in-play
                  predictions, set scores, or total-games predictions. News
                  headlines are displayed as source links; they do not
                  automatically modify probabilities. The slip builder fetches
                  upcoming ATP singles fixtures and Stake winner prices through
                  OddsPapi, separately from the historical model.
                </p>
                <h3>Data freshness and rights</h3>
                <p>
                  Snapshot generated {model.generatedAt.slice(0, 10)}.
                  Tournament dates describe event starts. A conservative 21-day
                  delay keeps overlapping tournament results out of earlier
                  predictions. This also makes ratings less current.
                </p>
                <p>{model.license}</p>
                <a
                  className="text-link"
                  href="https://github.com/Tennismylife/TML-Database"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  TennisMyLife database & usage terms ↗
                </a>
                <p>
                  Data sources: {model.sources.map((s) => s.year).join(", ")}.
                  Per-file hashes are recorded in the model artifact for
                  provenance. This app is not affiliated with Stake or the ATP.
                </p>
              </section>
              <section className="panel details-panel">
                <h2>Explore player coverage</h2>
                <label className="search-label">
                  Search players
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search a player…"
                  />
                </label>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Elo</th>
                        <th>Matches</th>
                        <th>Last event start</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 50).map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{Math.round(p.elo)}</td>
                          <td>{p.matches}</td>
                          <td>{p.lastDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  Showing {Math.min(filtered.length, 50)} of {filtered.length}{" "}
                  matching players active since 2025.
                </p>
              </section>
            </>
          )}
          <footer>
            <span>
              baseline<span className="brand-dot">.</span>{" "}
              <small>TENNIS INTELLIGENCE</small>
            </span>
            <p>
              Probabilities, not promises. Research before risking money. 18+.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
function Metric({ label, value, note, small }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={small ? "small-value" : ""}>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
