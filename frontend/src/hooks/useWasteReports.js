import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Returns the start of the current ISO week (Monday 00:00:00) and
 * a date 7 days ago from today for the trend chart.
 */
function getWeekBounds() {
  const now = new Date();

  // Start of today
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 7 days ago
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  return { todayStart, sevenDaysAgo };
}

/**
 * Mask a phone number for privacy: 987***123
 */
export function maskPhone(phone) {
  if (!phone) return '***';
  const str = String(phone).replace(/\D/g, '');
  if (str.length < 6) return '***';
  return str.slice(0, 3) + '***' + str.slice(-3);
}

/**
 * Custom hook that fetches waste_reports for the current week,
 * subscribes to realtime changes, and derives:
 *  - leaderboard (top 5 by total score)
 *  - todayAverage (average score for today)
 *  - trendData (average score per day, last 7 days)
 */
export function useWasteReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch initial data — grab current month for monthly leaderboard
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];

      const { data, error: fetchError } = await supabase
        .from('waste_reports')
        .select('*')
        .gte('report_date', monthStartStr)
        .order('report_date', { ascending: false });

      if (fetchError) throw fetchError;
      setReports(data || []);
    } catch (err) {
      console.error('Error fetching waste reports:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('waste_reports_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waste_reports',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setReports((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setReports((prev) =>
              prev.map((r) => (r.id === payload.new.id ? payload.new : r))
            );
          } else if (payload.eventType === 'DELETE') {
            setReports((prev) =>
              prev.filter((r) => r.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ---- Derived data ----

  // Top 5 Leaderboard: aggregate total scores by phone_number
  const leaderboard = (() => {
    const scoreMap = {};
    reports.forEach((r) => {
      const phone = r.phone_number || 'unknown';
      if (!scoreMap[phone]) scoreMap[phone] = 0;
      scoreMap[phone] += Number(r.daily_eco_score) || 0;
    });

    return Object.entries(scoreMap)
      .map(([phone, totalScore]) => ({ phone, totalScore }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5);
  })();

  // Today's Average
  const todayAverage = (() => {
    const { todayStart } = getWeekBounds();
    const todayStr = todayStart.toISOString().split('T')[0];
    const todayReports = reports.filter(
      (r) => r.report_date === todayStr
    );
    if (todayReports.length === 0) return 0;
    const sum = todayReports.reduce((acc, r) => acc + (Number(r.daily_eco_score) || 0), 0);
    return (sum / todayReports.length).toFixed(1);
  })();

  // Trend Data: average score per day over last 7 days
  const trendData = (() => {
    const dayMap = {};
    const now = new Date();

    // Initialize all 7 days using local dates (avoids timezone shift)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      dayMap[key] = { day: key, scores: [] };
    }

    reports.forEach((r) => {
      const key = r.report_date;
      if (dayMap[key]) {
        dayMap[key].scores.push(Number(r.daily_eco_score) || 0);
      }
    });

    return Object.values(dayMap).map((entry) => ({
      day: new Date(entry.day + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      avgScore:
        entry.scores.length > 0
          ? parseFloat(
              (entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length).toFixed(1)
            )
          : 0,
      count: entry.scores.length,
    }));
  })();

  return { reports, leaderboard, todayAverage, trendData, loading, error, refetch: fetchReports };
}
