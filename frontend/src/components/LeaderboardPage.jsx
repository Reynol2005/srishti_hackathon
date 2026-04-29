import { useState, useMemo } from 'react';
import { maskPhone } from '../hooks/useWasteReports';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

// ── Colony simulation ────────────────────────────────────────
const COLONY_NAMES = [
  'Green Valley Colony', 'Sunrise Apartments', 'Palm Heights Society',
  'River View Residency', 'Lake Garden Estate',
];

function getColony(phone) {
  const hash = (phone || '').replace(/\D/g, '').split('')
    .reduce((a, c) => a + parseInt(c, 10), 0);
  return COLONY_NAMES[hash % COLONY_NAMES.length];
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function daysLeftInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

// ── Component ────────────────────────────────────────────────

export default function LeaderboardPage({ reports }) {
  const [tab, setTab] = useState('daily');
  const [selectedPhone, setSelectedPhone] = useState(() =>
    localStorage.getItem('ecovoice_phone') || ''
  );

  const allPhones = useMemo(() =>
    [...new Set(reports.map(r => r.phone_number))].sort(),
    [reports]
  );

  // Auto-select first phone if none chosen
  const activePhone = selectedPhone || allPhones[0] || '';

  function selectPhone(phone) {
    setSelectedPhone(phone);
    localStorage.setItem('ecovoice_phone', phone);
  }

  // ── Community data ──────────────────────────────────────
  const communityMap = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      const colony = getColony(r.phone_number);
      if (!map[colony]) map[colony] = { name: colony, phones: new Set(), reports: [] };
      map[colony].phones.add(r.phone_number);
      map[colony].reports.push(r);
    });
    return map;
  }, [reports]);

  const today = todayStr();

  // ── Daily leaderboard ───────────────────────────────────
  const dailyBoard = useMemo(() => {
    const userColony = getColony(activePhone);
    return Object.values(communityMap)
      .map(c => {
        const todayReps = c.reports.filter(r => r.report_date === today);
        const pts = todayReps.reduce((s, r) => s + (r.daily_eco_score || 0), 0);
        const goodCount = todayReps.filter(r => r.is_segregated && r.is_reused).length;
        const verified = todayReps.length > 0 && (goodCount / todayReps.length) > 0.5;
        return { name: c.name, points: pts, members: c.phones.size, verified, count: todayReps.length };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 10)
      .map((item, i) => ({ ...item, rank: i + 1, isUser: item.name === userColony }));
  }, [communityMap, today, activePhone]);

  const maxDailyPts = Math.max(1, ...dailyBoard.map(d => d.points));

  // ── Monthly leaderboard ─────────────────────────────────
  const monthlyBoard = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const midMonth = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 7))
      .toISOString().split('T')[0];
    const userColony = getColony(activePhone);

    return Object.values(communityMap)
      .map(c => {
        const monthReps = c.reports.filter(r => r.report_date >= monthStart);
        const monthPts = monthReps.reduce((s, r) => s + (r.daily_eco_score || 0), 0);
        // This week vs last week
        const thisWeek = monthReps.filter(r => r.report_date >= midMonth)
          .reduce((s, r) => s + (r.daily_eco_score || 0), 0);
        const lastWeek = monthReps.filter(r => r.report_date < midMonth)
          .reduce((s, r) => s + (r.daily_eco_score || 0), 0);
        const trend = thisWeek > lastWeek ? 'up' : thisWeek < lastWeek ? 'down' : 'flat';
        return { name: c.name, points: monthPts, members: c.phones.size, trend };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 10)
      .map((item, i) => ({ ...item, rank: i + 1, isUser: item.name === userColony }));
  }, [communityMap, activePhone]);

  const maxMonthlyPts = Math.max(1, ...monthlyBoard.map(d => d.points));

  // ── My Report ───────────────────────────────────────────
  const myReport = useMemo(() => {
    if (!activePhone) return null;
    const myReps = reports.filter(r => r.phone_number === activePhone);
    const colony = getColony(activePhone);

    // Lifetime
    const lifetimePts = myReps.reduce((s, r) => s + (r.daily_eco_score || 0), 0);

    // Streak
    const dates = [...new Set(myReps.map(r => r.report_date))].sort().reverse();
    let streak = 0;
    if (dates.length > 0) {
      let expected = new Date(today);
      // Allow today or yesterday as start
      if (dates[0] !== today) {
        const yesterday = new Date(expected);
        yesterday.setDate(yesterday.getDate() - 1);
        if (dates[0] !== yesterday.toISOString().split('T')[0]) {
          streak = 0;
        } else {
          expected = yesterday;
        }
      }
      if (streak === 0 && dates[0] >= new Date(expected).toISOString().split('T')[0]) {
        streak = 1;
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i - 1]);
          const curr = new Date(dates[i]);
          if ((prev - curr) / 86400000 === 1) streak++;
          else break;
        }
      }
    }

    // Today's activity
    const todayRep = myReps.find(r => r.report_date === today);

    // Weekly bar chart (last 7 days)
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const rep = myReps.find(r => r.report_date === key);
      weekData.push({
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        points: rep ? rep.daily_eco_score : 0,
      });
    }

    // Monthly summary
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthReps = myReps.filter(r => r.report_date >= monthStart);
    const monthPts = monthReps.reduce((s, r) => s + (r.daily_eco_score || 0), 0);

    // Rank within community
    const colonyData = communityMap[colony];
    const colonyPhones = colonyData ? [...colonyData.phones] : [];
    const phoneScores = colonyPhones.map(p => ({
      phone: p,
      score: reports.filter(r => r.phone_number === p && r.report_date >= monthStart)
        .reduce((s, r) => s + (r.daily_eco_score || 0), 0),
    })).sort((a, b) => b.score - a.score);
    const communityRank = phoneScores.findIndex(p => p.phone === activePhone) + 1;

    // Nudge
    const myColonyPts = communityMap[colony]
      ? communityMap[colony].reports.filter(r => r.report_date === today)
          .reduce((s, r) => s + (r.daily_eco_score || 0), 0)
      : 0;
    const sorted = Object.values(communityMap)
      .map(c => ({ name: c.name, pts: c.reports.filter(r => r.report_date === today)
        .reduce((s, r) => s + (r.daily_eco_score || 0), 0) }))
      .sort((a, b) => b.pts - a.pts);
    const myIdx = sorted.findIndex(c => c.name === colony);
    let nudge = 'Keep logging daily to climb the leaderboard! 💪';
    if (myIdx > 0) {
      const gap = sorted[myIdx - 1].pts - myColonyPts;
      nudge = `You're ${gap} point${gap !== 1 ? 's' : ''} away from moving ${colony} to #${myIdx}. Log tomorrow's waste to get there! 🚀`;
    } else if (myIdx === 0) {
      nudge = `${colony} is #1 today! Keep the streak going to stay on top! 🏆`;
    }

    return {
      phone: activePhone, colony, lifetimePts, streak,
      todayRep, weekData, monthPts, monthReps: monthReps.length,
      communityRank, totalMembers: colonyPhones.length, nudge,
    };
  }, [reports, activePhone, communityMap, today]);

  // ── Share ───────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  function handleShare() {
    if (!myReport) return;
    const text = `I earned ${myReport.todayRep?.daily_eco_score || 0} points for ${myReport.colony} today on EcoVoice! ♻️🌿`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Render ──────────────────────────────────────────────
  const tabs = [
    { key: 'daily', label: 'Community – Daily' },
    { key: 'monthly', label: 'Community – Monthly' },
    { key: 'my', label: 'My Report' },
  ];

  return (
    <div className="card lb-page">
      <div className="card-header">
        <span className="card-icon">🏆</span>
        <h2>Leaderboard</h2>
      </div>

      {/* Tab pills */}
      <div className="tab-pills">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tab-pill ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ DAILY TAB ═══ */}
      {tab === 'daily' && (
        <div className="tab-content">
          {dailyBoard.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">📋</span><p>No reports yet today</p></div>
          ) : (
            <ul className="lb-list">
              {dailyBoard.map(item => (
                <li key={item.name} className={`lb-row ${item.isUser ? 'lb-highlight' : ''}`}>
                  <span className="lb-rank">#{item.rank}</span>
                  <div className="lb-info">
                    <span className="lb-name">
                      {item.name}
                      {item.verified && <span className="lb-verified" title="Verified: >50% eco-friendly logs">✓</span>}
                    </span>
                    <span className="lb-members">{item.members} households · {item.count} logs</span>
                  </div>
                  <div className="lb-bar-wrap">
                    <div className="lb-bar-fill" style={{ width: `${(item.points / maxDailyPts) * 100}%` }} />
                  </div>
                  <span className="lb-pts">{item.points} <small>pts</small></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ═══ MONTHLY TAB ═══ */}
      {tab === 'monthly' && (
        <div className="tab-content">
          <div className="lb-countdown">🗓️ Month ends in <strong>{daysLeftInMonth()}</strong> day{daysLeftInMonth() !== 1 ? 's' : ''}</div>
          {monthlyBoard.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">📋</span><p>No reports this month</p></div>
          ) : (
            <ul className="lb-list">
              {monthlyBoard.map(item => (
                <li key={item.name} className={`lb-row ${item.isUser ? 'lb-highlight' : ''}`}>
                  <span className="lb-rank">#{item.rank}</span>
                  <div className="lb-info">
                    <span className="lb-name">{item.name}</span>
                    <span className="lb-members">{item.members} households</span>
                  </div>
                  <div className="lb-bar-wrap">
                    <div className="lb-bar-fill" style={{ width: `${(item.points / maxMonthlyPts) * 100}%` }} />
                  </div>
                  <span className={`lb-trend lb-trend-${item.trend}`}>
                    {item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'}
                  </span>
                  <span className="lb-pts">{item.points} <small>pts</small></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ═══ MY REPORT TAB ═══ */}
      {tab === 'my' && (
        <div className="tab-content">
          {/* Phone selector */}
          <div className="my-phone-picker">
            <label>Your number:</label>
            <select value={activePhone} onChange={e => selectPhone(e.target.value)}>
              {allPhones.map(p => <option key={p} value={p}>{maskPhone(p)}</option>)}
            </select>
          </div>

          {myReport && (
            <>
              {/* Stats row */}
              <div className="my-stats-row">
                <div className="my-stat">
                  <span className="my-stat-value">{myReport.lifetimePts}</span>
                  <span className="my-stat-label">Lifetime Pts</span>
                </div>
                <div className="my-stat">
                  <span className="my-stat-value">🔥 {myReport.streak}</span>
                  <span className="my-stat-label">Day Streak</span>
                </div>
                <div className="my-stat">
                  <span className="my-stat-value">{myReport.colony}</span>
                  <span className="my-stat-label">Community</span>
                </div>
              </div>

              {/* Today's activity */}
              <div className="my-section">
                <h3>📋 Today's Activity</h3>
                {myReport.todayRep ? (
                  <div className="my-today-card">
                    <div className="my-today-items">
                      <span>{myReport.todayRep.is_segregated ? '✅' : '❌'} Segregated</span>
                      <span>📦 Volume: {['', 'Low', 'Med', 'High'][myReport.todayRep.volume_level]}</span>
                      <span>{myReport.todayRep.is_reused ? '♻️' : '❌'} Reused</span>
                    </div>
                    <div className="my-today-score">+{myReport.todayRep.daily_eco_score} pts</div>
                  </div>
                ) : (
                  <p className="my-no-data">No report logged today. Send your SMS!</p>
                )}
              </div>

              {/* Weekly chart */}
              <div className="my-section">
                <h3>📈 Last 7 Days</h3>
                <div className="my-chart-wrap">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={myReport.weekData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 20]} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#161625', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="points" radius={[4, 4, 0, 0]} maxBarSize={32}>
                        {myReport.weekData.map((_, i) => (
                          <Cell key={i} fill={i === 6 ? '#6366f1' : '#818cf8'} fillOpacity={i === 6 ? 1 : 0.6} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly summary */}
              <div className="my-section">
                <h3>📊 Monthly Summary</h3>
                <div className="my-summary-row">
                  <div className="my-summary-item">
                    <strong>{myReport.monthReps}</strong>
                    <span>Reports</span>
                  </div>
                  <div className="my-summary-item">
                    <strong>{myReport.monthPts}</strong>
                    <span>Points</span>
                  </div>
                  <div className="my-summary-item">
                    <strong>#{myReport.communityRank}</strong>
                    <span>of {myReport.totalMembers}</span>
                  </div>
                </div>
              </div>

              {/* Nudge */}
              <div className="my-nudge">{myReport.nudge}</div>

              {/* Share */}
              <button className="my-share-btn" onClick={handleShare}>
                {copied ? '✅ Copied!' : '📤 Share My Score'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
