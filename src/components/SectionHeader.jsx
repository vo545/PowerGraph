export default function SectionHeader({ title, children, className = '' }) {
  return (
    <div className={`panel-header ${className}`.trim()}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
