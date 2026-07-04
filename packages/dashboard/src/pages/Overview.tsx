import React, { useEffect, useState } from "react";
import { Layout } from "../components/layout/Layout";
import { metrics, OverviewMetrics, QueueMetric } from "../api/client";
import { usePolling } from "../hooks/usePolling";
import { LoadingState } from "../components/ui/Spinner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number | string;
  colorClass?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${colorClass ?? ""}`}>{value}</div>
    </div>
  );
}

const CHART_STYLE = {
  fontSize: "11px",
  fontFamily: "Inter, sans-serif",
};

export function OverviewPage() {
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [queueStats, setQueueStats] = useState<QueueMetric[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [ov, qs] = await Promise.all([metrics.overview(), metrics.queues()]);
    setOverview(ov);
    setQueueStats(qs);
    setLoading(false);
  }

  usePolling(load, 10_000);

  if (loading) return <Layout title="Overview"><LoadingState /></Layout>;

  const jobs = overview?.jobs ?? {};
  const wrks = overview?.workers ?? {};

  const total = Object.values(jobs).reduce((a, b) => a + b, 0);
  const running = jobs.running ?? 0;
  const completed = jobs.completed ?? 0;
  const failed = (jobs.failed ?? 0) + (jobs.dead ?? 0);

  const chartData = queueStats.slice(0, 8).map((q) => ({
    name: q.name.length > 14 ? q.name.slice(0, 12) + "..." : q.name,
    queued: parseInt(q.queued_count, 10),
    running: parseInt(q.running_count, 10),
    completed: parseInt(q.completed_count, 10),
    failed: parseInt(q.failed_count, 10),
  }));

  return (
    <Layout
      title="Overview"
      subtitle="System health and job status at a glance"
    >
      {/* Job stat row */}
      <div className="stat-grid">
        <StatCard label="Total Jobs" value={total.toLocaleString()} />
        <StatCard label="Running" value={running} colorClass="accent" />
        <StatCard label="Completed" value={completed.toLocaleString()} colorClass="green" />
        <StatCard label="Failed / Dead" value={failed} colorClass={failed > 0 ? "red" : ""} />
        <StatCard label="Dead Letter Queue" value={overview?.deadLetterQueue ?? 0} colorClass={(overview?.deadLetterQueue ?? 0) > 0 ? "red" : ""} />
        <StatCard label="Active Workers" value={wrks.active ?? 0} colorClass="green" />
        <StatCard label="Idle Workers" value={wrks.idle ?? 0} />
        <StatCard label="Offline Workers" value={wrks.offline ?? 0} colorClass={wrks.offline ? "red" : ""} />
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
        {/* Queue breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Queue Job Distribution</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} style={CHART_STYLE}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "Inter, sans-serif",
                    color: "var(--text-primary)",
                  }}
                  cursor={{ fill: "var(--bg-hover)" }}
                />
                <Bar dataKey="queued"    fill="var(--text-tertiary)" radius={[2,2,0,0]} maxBarSize={28} />
                <Bar dataKey="running"   fill="var(--accent)"        radius={[2,2,0,0]} maxBarSize={28} />
                <Bar dataKey="completed" fill="var(--status-completed-text)" radius={[2,2,0,0]} maxBarSize={28} />
                <Bar dataKey="failed"    fill="var(--status-failed-text)"    radius={[2,2,0,0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Workers status */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Worker Status</span>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {[
                { key: "active",   label: "Active",   color: "var(--status-completed-text)" },
                { key: "idle",     label: "Idle",     color: "var(--text-tertiary)" },
                { key: "draining", label: "Draining", color: "var(--status-retrying-text)" },
                { key: "offline",  label: "Offline",  color: "var(--status-failed-text)" },
              ].map(({ key, label, color }) => {
                const count = wrks[key] ?? 0;
                const total = Object.values(wrks).reduce((a, b) => a + b, 0) || 1;
                const pct = (count / total) * 100;
                return (
                  <div key={key}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{label}</span>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
                        {count}
                      </span>
                    </div>
                    <div className="health-bar">
                      <div
                        className="health-bar-fill"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Queue table */}
      {queueStats.length > 0 && (
        <div className="card" style={{ marginTop: "var(--space-6)" }}>
          <div className="card-header">
            <span className="card-title">Queue Summary</span>
          </div>
          <div className="card-body no-pad">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Queue</th>
                    <th>Queued</th>
                    <th>Running</th>
                    <th>Completed</th>
                    <th>Failed</th>
                    <th>Avg Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {queueStats.map((q) => (
                    <tr key={q.queue_id}>
                      <td className="primary">{q.name}</td>
                      <td className="td-mono">{q.queued_count}</td>
                      <td style={{ color: "var(--accent)" }} className="td-mono">{q.running_count}</td>
                      <td style={{ color: "var(--status-completed-text)" }} className="td-mono">{q.completed_count}</td>
                      <td style={{ color: parseInt(q.failed_count) > 0 ? "var(--status-failed-text)" : "var(--text-tertiary)" }} className="td-mono">
                        {q.failed_count}
                      </td>
                      <td className="td-mono">
                        {q.avg_duration_ms ? `${parseFloat(q.avg_duration_ms).toFixed(0)} ms` : "—"}
                      </td>
                      <td>
                        {q.paused
                          ? <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Paused</span>
                          : <span style={{ fontSize: "var(--text-xs)", color: "var(--status-completed-text)" }}>Active</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
