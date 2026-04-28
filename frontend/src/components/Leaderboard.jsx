import { maskPhone } from '../hooks/useWasteReports';

const medals = ['🥇', '🥈', '🥉', '4', '5'];

export default function Leaderboard({ data }) {
  return (
    <div className="card leaderboard">
      <div className="card-header">
        <span className="card-icon">🏆</span>
        <h2>Top 5 Leaderboard</h2>
      </div>
      <p className="card-subtitle">Highest scorers this week</p>

      {data.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📋</span>
          <p>No reports yet this week</p>
        </div>
      ) : (
        <ul className="leaderboard-list">
          {data.map((entry, index) => (
            <li key={entry.phone} className="leaderboard-item">
              <span className={`rank rank-${index + 1}`}>
                {index < 3 ? medals[index] : medals[index]}
              </span>
              <div className="user-info">
                <span className="phone">{maskPhone(entry.phone)}</span>
              </div>
              <div className="score-badge">
                <span className="score-value">{entry.totalScore}</span>
                <span className="score-label">pts</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
