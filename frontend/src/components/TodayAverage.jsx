export default function TodayAverage({ value }) {
  const numericVal = parseFloat(value) || 0;

  // Determine quality level for visual feedback
  let quality, qualityColor;
  if (numericVal >= 16) {
    quality = 'Excellent';
    qualityColor = 'quality-excellent';
  } else if (numericVal >= 12) {
    quality = 'Good';
    qualityColor = 'quality-good';
  } else if (numericVal >= 8) {
    quality = 'Average';
    qualityColor = 'quality-average';
  } else if (numericVal > 0) {
    quality = 'Needs Improvement';
    qualityColor = 'quality-low';
  } else {
    quality = 'No Data';
    qualityColor = 'quality-none';
  }

  return (
    <div className="card today-average">
      <div className="card-header">
        <span className="card-icon">📊</span>
        <h2>Today's Average</h2>
      </div>
      <p className="card-subtitle">Community score for today</p>

      <div className="average-display">
        <span className="average-number">{numericVal > 0 ? numericVal : '—'}</span>
        <span className="average-unit">/ 20</span>
      </div>

      <div className={`quality-badge ${qualityColor}`}>
        {quality}
      </div>

      {/* Animated pulse ring */}
      {numericVal > 0 && <div className="pulse-ring" />}
    </div>
  );
}
