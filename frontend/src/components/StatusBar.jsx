import { useState, useEffect } from 'react';

export default function StatusBar({ loading, error, reportCount }) {
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className={`status-dot ${error ? 'dot-error' : 'dot-live'}`} />
        <span className="status-text">
          {error ? 'Connection Error' : loading ? 'Syncing...' : 'Live'}
        </span>
      </div>
      <div className="status-center">
        <span className="report-count">{reportCount} reports this week</span>
      </div>
      <div className="status-right">
        <span className="clock">
          {clock.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
