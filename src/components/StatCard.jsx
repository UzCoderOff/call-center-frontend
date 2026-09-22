export default function StatCard({ label, value, sub, tone = "neutral" }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}

      <style>{`
        .stat-card {
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: var(--shadow-card);
        }
        .stat-label {
          font-size: 0.76rem;
          font-weight: 600;
          color: var(--ink-soft);
        }
        .stat-value {
          font-family: var(--font-display);
          font-size: 2rem;
          font-weight: 600;
          line-height: 1.1;
          color: var(--ink);
        }
        .stat-sub {
          font-size: 0.76rem;
          color: var(--ink-soft);
          font-weight: 500;
        }
        .tone-clay .stat-value { color: var(--clay); }
        .tone-sage .stat-value { color: var(--sage); }
        .tone-navy .stat-value { color: var(--navy); }
        .tone-brass .stat-value { color: var(--brass); }
      `}</style>
    </div>
  );
}
