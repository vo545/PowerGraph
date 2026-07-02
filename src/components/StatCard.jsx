export default function StatCard({ icon, title, value, unit, glow = 'blue', className = '' }) {
  return (
    <article className={`glass-panel stat-card fade-in-up ${className}`.trim()}>
      <div className={`stat-icon ${glow}-glow`}>{icon}</div>
      <div>
        <p className="stat-title">{title}</p>
        <h3 className="stat-value">
          {value} {unit ? <span className="unit">{unit}</span> : null}
        </h3>
      </div>
    </article>
  );
}
