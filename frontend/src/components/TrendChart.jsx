import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const BAR_COLORS = [
  '#6366f1',
  '#818cf8',
  '#a5b4fc',
  '#6366f1',
  '#818cf8',
  '#a5b4fc',
  '#6366f1',
];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="chart-tooltip">
      <p className="tooltip-label">{label}</p>
      <p className="tooltip-value">
        Avg Score: <strong>{payload[0].value}</strong>
      </p>
      <p className="tooltip-count">
        Reports: {payload[0].payload.count}
      </p>
    </div>
  );
}

export default function TrendChart({ data }) {
  return (
    <div className="card trend-chart">
      <div className="card-header">
        <span className="card-icon">📈</span>
        <h2>7-Day Score Trend</h2>
      </div>
      <p className="card-subtitle">Average daily waste sorting score</p>

      <div className="chart-container">
        {data.every((d) => d.avgScore === 0) ? (
          <div className="empty-state">
            <span className="empty-icon">📉</span>
            <p>No trend data available yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -15, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.15)"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={{ stroke: 'rgba(148,163,184,0.2)' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Bar
                dataKey="avgScore"
                radius={[6, 6, 0, 0]}
                maxBarSize={50}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BAR_COLORS[index % BAR_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
