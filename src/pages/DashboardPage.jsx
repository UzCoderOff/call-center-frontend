import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { formatDuration, rangePreset } from "../lib/format";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import { Link } from "react-router-dom";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

// A muted, ledger-appropriate rotation for the "who made the most calls"
// slices — cycles if there are more employees than colors.
const SLICE_COLORS = [
  "var(--navy)",
  "var(--brass)",
  "var(--sage)",
  "var(--clay)",
  "var(--navy-soft)",
  "var(--brass-soft)",
];

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}

function SliceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <div className="chart-tooltip slice-tooltip">
      <span className="dot" style={{ background: row.payload.fill }} />
      {row.name}: {row.value}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <div>
        <span className="dot sage" /> Answered: {row.answeredCalls}
      </div>
      <div>
        <span className="dot clay" /> Missed: {row.missedCalls}
      </div>
      <style>{`
        .chart-tooltip {
          background: var(--navy);
          color: var(--paper);
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.78rem;
          line-height: 1.6;
          box-shadow: var(--shadow-raised);
        }
        .dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          margin-right: 5px;
        }
        .dot.sage { background: var(--sage); }
        .dot.clay { background: var(--clay); }
      `}</style>
    </div>
  );
}

function CallShareDonut({ chartData }) {
  const data = useMemo(
    () =>
      chartData
        .filter((e) => e.totalCalls > 0)
        .map((e, i) => ({
          name: e.fullName,
          value: e.totalCalls,
          fill: SLICE_COLORS[i % SLICE_COLORS.length],
        })),
    [chartData]
  );

  if (data.length === 0) {
    return <div className="pie-empty">No calls yet in this period.</div>;
  }

  const leader = data[0];

  return (
    <div className="donut-layout">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={88} paddingAngle={2}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<SliceTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-legend">
        {data.map((d) => (
          <span key={d.name} className="legend-row">
            <i className="sw" style={{ background: d.fill }} />
            {d.name}
            <b>{d.value}</b>
          </span>
        ))}
      </div>
      <p className="top-caller-note">
        <strong>{leader.name}</strong> made the most calls this period, with {leader.value} of the team's total.
      </p>
    </div>
  );
}

function CompanyMixDonut({ answered, missed }) {
  const data = [
    { name: "Answered", value: answered, fill: "var(--sage)" },
    { name: "Missed", value: missed, fill: "var(--clay)" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <div className="pie-empty">No calls yet in this period.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<SliceTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function EmployeeBreakdown({ employees, companyStats }) {
  const chartData = useMemo(
    () =>
      [...employees]
        .sort((a, b) => b.totalCalls - a.totalCalls)
        .map((e) => ({
          name: e.name.split(" ")[0],
          fullName: e.name,
          employeeId: e.employeeId,
          answeredCalls: e.answeredCalls,
          missedCalls: e.missedCalls,
          totalCalls: e.totalCalls,
        })),
    [employees]
  );

  if (employees.length === 0) {
    return <EmptyState text="No active employees yet. Add someone from the Team tab." />;
  }

  return (
    <div className="breakdown">
      <div className="pie-row">
        <div className="chart-card">
          <h3 className="chart-title">Who made the most calls</h3>
          <CallShareDonut chartData={chartData} />
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Company-wide answered vs. missed</h3>
          <CompanyMixDonut answered={companyStats?.answeredCalls ?? 0} missed={companyStats?.missedCalls ?? 0} />
          <div className="legend">
            <span><i className="sw sage" />Answered</span>
            <span><i className="sw clay" />Missed</span>
          </div>
        </div>
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Calls by employee</h3>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 44)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 5" stroke="var(--line)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={78}
                tick={{ fontSize: 12, fill: "var(--ink)", fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(20,33,61,0.04)" }} />
              <Bar dataKey="answeredCalls" stackId="a" fill="var(--sage)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="missedCalls" stackId="a" fill="var(--clay)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="legend">
          <span><i className="sw sage" />Answered</span>
          <span><i className="sw clay" />Missed</span>
        </div>
      </div>

      <div className="table-card scroll-x">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Total</th>
              <th>Answered</th>
              <th>Missed</th>
              <th>Miss rate</th>
              <th>Talk time</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((e) => {
              const missRate = e.totalCalls ? Math.round((e.missedCalls / e.totalCalls) * 100) : 0;
              const empFull = employees.find((emp) => emp.employeeId === e.employeeId);
              return (
                <tr key={e.employeeId}>
                  <td>
                    <Link to={`/team/${e.employeeId}`} className="row-link">
                      {e.fullName}
                    </Link>
                  </td>
                  <td>{e.totalCalls}</td>
                  <td className="num-sage">{e.answeredCalls}</td>
                  <td className="num-clay">{e.missedCalls}</td>
                  <td>
                    <span className={`pill ${missRate >= 30 ? "pill-clay" : "pill-neutral"}`}>{missRate}%</span>
                  </td>
                  <td>{formatDuration(empFull?.totalTalkTimeSeconds)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        .breakdown {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .chart-card, .table-card {
          background: var(--paper-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius-md);
          padding: 18px;
          box-shadow: var(--shadow-card);
        }
        .table-card { padding: 6px; }
        .chart-title {
          font-size: 0.95rem;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--ink);
        }
        .chart-wrap { width: 100%; }
        .legend {
          display: flex;
          gap: 18px;
          margin-top: 8px;
          font-size: 0.78rem;
          color: var(--ink-soft);
          font-weight: 500;
        }
        .legend span { display: flex; align-items: center; gap: 6px; }
        .sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
        .sw.sage { background: var(--sage); }
        .sw.clay { background: var(--clay); }

        .pie-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        .pie-empty {
          padding: 40px 10px;
          text-align: center;
          color: var(--ink-soft);
          font-size: 0.85rem;
        }
        .donut-layout {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .donut-legend {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .legend-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          color: var(--ink);
        }
        .legend-row b {
          margin-left: auto;
          font-weight: 700;
          color: var(--ink-soft);
        }
        .top-caller-note {
          font-size: 0.8rem;
          color: var(--ink-soft);
          line-height: 1.5;
          padding-top: 8px;
          border-top: 1px dashed var(--line);
        }
        .slice-tooltip {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .slice-tooltip .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        @media (min-width: 760px) {
          .pie-row { grid-template-columns: 1fr 1fr; }
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
          min-width: 520px;
        }
        .data-table th {
          text-align: left;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--ink-soft);
          padding: 10px 12px;
          border-bottom: 1px solid var(--line);
        }
        .data-table td {
          padding: 11px 12px;
          border-bottom: 1px solid var(--line);
        }
        .data-table tbody tr:last-child td { border-bottom: none; }
        .data-table tbody tr:hover { background: var(--paper-sunken); }
        .row-link {
          color: var(--navy);
          font-weight: 600;
          text-decoration: none;
        }
        .row-link:hover { text-decoration: underline; }
        .num-sage { color: var(--sage); font-weight: 600; }
        .num-clay { color: var(--clay); font-weight: 600; }
        .pill {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
        }
        .pill-clay { background: var(--clay-tint); color: var(--clay); }
        .pill-neutral { background: var(--paper-sunken); color: var(--ink-soft); }
      `}</style>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isManager = user.role === "BOSS" || user.role === "DEVELOPER";
  const [range, setRange] = useState("7d");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const { from, to } = rangePreset(range);
    api
      .dashboard({ from, to })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load stats right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const stats = isManager ? data?.company : data?.self;
  const missRate = stats && stats.totalCalls ? Math.round((stats.missedCalls / stats.totalCalls) * 100) : 0;

  return (
    <div>
      <PageHeader
        title={isManager ? "Overview" : "My stats"}
        subtitle={isManager ? "Call activity across the whole team." : "Your call activity."}
        action={
          <div className="range-tabs">
            {RANGES.map((r) => (
              <button
                key={r.key}
                className={`range-tab${range === r.key ? " is-active" : ""}`}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {loading && <EmptyState text="Loading…" />}
      {error && <EmptyState text={error} />}

      {!loading && !error && stats && (
        <>
          <div className="stat-grid">
            <StatCard label="Total calls" value={stats.totalCalls} tone="navy" />
            <StatCard label="Answered" value={stats.answeredCalls} tone="sage" />
            <StatCard label="Missed" value={stats.missedCalls} tone="clay" sub={`${missRate}% miss rate`} />
            <StatCard label="Talk time" value={formatDuration(stats.totalTalkTimeSeconds)} tone="brass" />
          </div>

          {isManager && data.employees && (
            <div className="section">
              <EmployeeBreakdown employees={data.employees} companyStats={data.company} />
            </div>
          )}

          {!isManager && stats.totalCalls === 0 && (
            <EmptyState text="No calls synced for this period yet." />
          )}
        </>
      )}

      <style>{`
        .range-tabs {
          display: flex;
          gap: 2px;
          background: var(--paper-sunken);
          padding: 3px;
          border-radius: var(--radius-md);
        }
        .range-tab {
          background: transparent;
          border: none;
          padding: 7px 12px;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--ink-soft);
          border-radius: 7px;
          white-space: nowrap;
        }
        .range-tab.is-active {
          background: var(--paper-raised);
          color: var(--navy);
          box-shadow: var(--shadow-card);
        }
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .section { margin-top: 8px; }
        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: var(--ink-soft);
          font-size: 0.88rem;
          background: var(--paper-raised);
          border: 1px dashed var(--line-strong);
          border-radius: var(--radius-md);
        }
        @media (min-width: 640px) {
          .stat-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </div>
  );
}
