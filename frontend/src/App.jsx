import { useWasteReports } from './hooks/useWasteReports';
import Leaderboard from './components/Leaderboard';
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
          {/* Today's Average — hero position */}
          <div className="grid-hero">
            <TodayAverage value={todayAverage} />
          </div>

          {/* Leaderboard */}
          <div className="grid-leaderboard">
            <Leaderboard data={leaderboard} />
          </div>

          {/* Trend Chart — full width */}
          <div className="grid-trend">
            <TrendChart data={trendData} />
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>Built for Srishti Hackathon 2026 · Realtime powered by Supabase</p>
      </footer>
    </div>
  );
}
