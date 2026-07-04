export default function ProgressBar({ label, value, max = 100, detail, tone = 'primary' }) {
  const safeMax = Math.max(1, Number(max) || 1);
  const pct = Math.max(0, Math.min(100, Math.round((Number(value) || 0) / safeMax * 100)));

  return (
    <div className={`progress-line progress-line-${tone}`}>
      <div className="progress-line-head">
        <span>{label}</span>
        <strong>{detail || `${pct}%`}</strong>
      </div>
      <div className="progress-line-track" aria-label={`${label} ${pct}%`}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
