export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-action">{action}</div>}

      <style>{`
        .page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .page-title {
          font-size: 1.5rem;
        }
        .page-subtitle {
          margin-top: 4px;
          font-size: 0.88rem;
          color: var(--ink-soft);
        }
      `}</style>
    </div>
  );
}
