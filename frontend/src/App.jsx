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
            <span className="logo-icon">♻️</span>
            <div>
              <h1 className="title">EcoVoice</h1>
              <p className="tagline">Community Waste Sorting Dashboard</p>
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
        <p>Built for Srishti Hackathon 2026 · Realtime powered by Supabase</p>
      </footer>
    </div>
  );
}
