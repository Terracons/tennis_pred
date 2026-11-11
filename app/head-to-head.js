import RecentMeetings from "./recent-meetings";
export default function HeadToHead({ result, surface }) {
  const h = result.h2h;
  return (
    <section className="panel signals">
      <div className="section-head">
        <div>
          <span className="eyebrow">
            PAST MEETINGS / DATASET COVERAGE SINCE 2020
          </span>
          <h2>Head to head</h2>
        </div>
        <span className="tag">{h.total} MEETINGS</span>
      </div>
      <RecentMeetings
        h2h={h}
        aId={result.a.id}
        aName={result.a.name}
        bName={result.b.name}
      />
      <p className="micro">All available meetings since 2020</p>
      <div className="h2h-score">
        <span>{result.a.name}</span>
        <strong>
          {h.aWins} <small>:</small> {h.bWins}
        </strong>
        <span>{result.b.name}</span>
      </div>
      <div className="signal-grid">
        <div>
          <span>On {surface.toLowerCase()} courts</span>
          <strong>
            {h.surface.aWins} : {h.surface.bWins}
          </strong>
          <small>{h.surface.total} recorded meetings</small>
        </div>
        <div>
          <span>Latest meeting source date</span>
          <strong>{h.lastDate || "No recorded meetings"}</strong>
          <small>Not an exact match timestamp</small>
        </div>
        <div>
          <span>Recent recorded form</span>
          <strong>
            {result.a.recent.reduce((s, n) => s + n, 0)}/
            {result.a.recent.length} vs{" "}
            {result.b.recent.reduce((s, n) => s + n, 0)}/
            {result.b.recent.length} wins
          </strong>
          <small>
            Last available results, not necessarily recent in calendar time
          </small>
        </div>
      </div>
      <p className="result-note">
        {h.total < 3 ? "Small or missing head-to-head sample. " : ""}Meetings
        influence the model with a two-year half-life and a neutral prior. This
        record covers the available dataset, not the players' entire careers.
        Walkovers and retirements are excluded.
      </p>
    </section>
  );
}
