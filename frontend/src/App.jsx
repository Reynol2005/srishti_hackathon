import { useWasteReports } from './hooks/useWasteReports';
import LeaderboardPage from './components/LeaderboardPage';
import TodayAverage from './components/TodayAverage';
import TrendChart from './components/TrendChart';
import StatusBar from './components/StatusBar';

export default function App() {
  const { leaderboard, todayAverage, trendData, reports, loading, error } =
    useWasteReports();

  return (
    <div className="app">
      {/* Ambient background blobs */}
      <div className="bg-blob blob-1" />
      <div className="bg-blob blob-2" />
      <div className="bg-blob blob-3" />

      <header className="header">
        <div className="header-content">
          <div className="logo-group">
            <svg className="logo-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="50%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
                <filter id="leafGlow">
                  <feGaussianBlur stdDeviation="2" result="glow" />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <g filter="url(#leafGlow)">
                <path
                  d="M24 4C24 4 8 12 8 28c0 8.837 7.163 16 16 16s16-7.163 16-16C40 12 24 4 24 4z"
                  fill="url(#leafGrad)"
                  opacity="0.15"
                />
                <path
                  d="M24 4C24 4 8 12 8 28c0 8.837 7.163 16 16 16s16-7.163 16-16C40 12 24 4 24 4z"
                  stroke="url(#leafGrad)"
                  strokeWidth="2"
                  fill="none"
                />
                <path
                  d="M24 44V20"
                  stroke="url(#leafGrad)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M24 28c-5-5-10-3-12-1"
                  stroke="url(#leafGrad)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M24 22c4-4 9-3 11-1"
                  stroke="url(#leafGrad)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            </svg>
            <div>
              <h1 className="title">EcoVoice</h1>
              <p className="tagline">Community Dashboard</p>
            </div>
          </div>
          <StatusBar loading={loading} error={error} reportCount={reports.length} />
        </div>
      </header>

      <main className="dashboard">
        {error && (
          <div className="error-banner">
            <span>⚠️</span>
            <p>
              Could not connect to the database. Make sure your Supabase
              credentials in <code>.env</code> are correct.
            </p>
          </div>
        )}

        <div className="dashboard-grid">
          {/* Row 1: Today's Average + Trend Chart side by side */}
          <div className="grid-hero">
            <TodayAverage value={todayAverage} />
          </div>

          <div className="grid-trend-side">
            <TrendChart data={trendData} />
          </div>

          {/* Row 2: Full-width Leaderboard Page */}
          <div className="grid-leaderboard-full">
            <LeaderboardPage reports={reports} />
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>Hackathon 2026</p>
      </footer>
    </div>
  );
}
