export default function RecentMeetings({ h2h, aId, aName, bName }) {
  const latest = h2h.latest;
  return (
    <div className="recent-meetings">
      <strong>
        Latest {latest.count} of 5 meetings: {latest.aWins} : {latest.bWins}
      </strong>
      {latest.count < 5 && (
        <p className="micro">
          Only {latest.count} completed meetings available since 2020. Missing
          meetings are not estimated.
        </p>
      )}
      {latest.count > 0 && (
        <details>
          <summary>View dates and winners</summary>
          <ol>
            {latest.meetings.map((m, i) => (
              <li key={`${m.date}-${i}`}>
                {m.date} · {m.surface} · {m.winnerId === aId ? aName : bName}{" "}
                won
              </li>
            ))}
          </ol>
          <p className="micro">
            Newest source date first. Source dates may describe tournament
            starts, not exact match times. Retirements and walkovers excluded.
          </p>
        </details>
      )}
    </div>
  );
}
