import React, { useState, useEffect } from "react";
import { Layout } from "../components/layout/Layout";
import { LoadingState } from "../components/ui/Spinner";
import { IconRefresh, IconChartLine } from "../components/ui/Icons";
import { metrics, ThroughputBucket, QueueMetric } from "../api/client";
import { usePolling } from "../hooks/usePolling";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CHART_STYLE = {
  fontSize: "11px",
  fontFamily: "Inter, sans-serif",
};

export function MetricsPage() {
  const [timeframe, setTimeframe] = useState<number>(24);
  const [throughput, setThroughput] = useState<ThroughputBucket[]>([]);
  const [queueMetrics, setQueueMetrics] = useState<QueueMetric[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  async function load() {
    try {
      const [tp, qm] = await Promise.all([
        metrics.throughput(timeframe),
        metrics.queues(),
      ]);
      setThroughput(tp);
      setQueueMetrics(qm);
    } catch {
      // Silent catch for background polling
    } finally {
      setLoading(false);
    }
  }

  usePolling(load, 15_000);

  useEffect(() => {
    load();
  }, [timeframe]);

  if (loading) {
    return (
      <Layout title="Metrics">
        <LoadingState />
      </Layout>
    );
  }

  const formattedThroughput = throughput.map((b) => ({
    time: new Date(b.bucket).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    completed: parseInt(b.completed, 10),
    failed: parseInt(b.failed, 10),
  }));

  const totalCompleted = formattedThroughput.reduce((acc, curr) => acc + curr.completed, 0);
  const totalFailed = formattedThroughput.reduce((acc, curr) => acc + curr.failed, 0);
  const totalProcessed = totalCompleted + totalFailed;
  const successRate = totalProcessed > 0 ? ((totalCompleted / totalProcessed) * 100).toFixed(1) : "100.0";

  return (
    <Layout
      title="Metrics & Telemetry"
      subtitle="System throughput, latency distributions, and queue health"
      actions={
        <>
          <select
            className="form-select"
            style={{ width: "auto" }}
            value={timeframe}
            onChange={(e) => {
              setTimeframe(Number(e.target.value));
              setLoading(true);
            }}
          >
            <option value={1}>Last 1 Hour</option>
            <option value={6}>Last 6 Hours</option>
            <option value={24}>Last 24 Hours</option>
            <option value={72}>Last 3 Days</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <IconRefresh size={13} /> Refresh
          </button>
        </>
      }
    >
      {/* Top Stat Summary */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Processed ({timeframe}h)</div>
          <div className="stat-value">{totalProcessed.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Successful Executions</div>
          <div className="stat-value green">{totalCompleted.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failed Executions</div>
          <div className="stat-value red">{totalFailed.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Success Rate</div>
          <div className="stat-value accent">{successRate}%</div>
        </div>
      </div>

      {/* Throughput Chart */}
      <div className="card mb-8">
        <div className="card-header">
          <span className="card-title">Job Execution Throughput</span>
        </div>
        <div className="card-body">
          {formattedThroughput.length === 0 ? (
            <div className="empty-state" style={{ padding: "var(--space-8)" }}>
              <div className="empty-state-icon">
                <IconChartLine size={18} />
              </div>
              <div className="empty-state-title">No telemetry recorded yet</div>
              <div className="empty-state-desc">
                Throughput data will appear here once workers begin executing jobs.
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={formattedThroughput} style={CHART_STYLE}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
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
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                  iconType="circle"
                />
                <Bar name="Completed" dataKey="completed" fill="var(--status-completed-text)" radius={[2, 2, 0, 0]} maxBarSize={36} />
                <Bar name="Failed" dataKey="failed" fill="var(--status-failed-text)" radius={[2, 2, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Queue Performance Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Queue Performance Breakdown</span>
        </div>
        <div className="card-body no-pad">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Queue Name</th>
                  <th>Priority</th>
                  <th>Concurrency</th>
                  <th>Completed</th>
                  <th>Failed</th>
                  <th>Dead Letter</th>
                  <th>Avg Execution Time</th>
                </tr>
              </thead>
              <tbody>
                {queueMetrics.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "var(--space-6)", color: "var(--text-tertiary)" }}>
                      No queues configured
                    </td>
                  </tr>
                ) : (
                  queueMetrics.map((q) => (
                    <tr key={q.queue_id}>
                      <td className="primary">{q.name}</td>
                      <td className="td-mono">P{q.priority}</td>
                      <td className="td-mono">{q.concurrency}</td>
                      <td style={{ color: "var(--status-completed-text)" }} className="td-mono">
                        {parseInt(q.completed_count, 10).toLocaleString()}
                      </td>
                      <td style={{ color: parseInt(q.failed_count, 10) > 0 ? "var(--status-failed-text)" : "var(--text-tertiary)" }} className="td-mono">
                        {parseInt(q.failed_count, 10).toLocaleString()}
                      </td>
                      <td style={{ color: parseInt(q.dead_count, 10) > 0 ? "var(--status-dead-text)" : "var(--text-tertiary)" }} className="td-mono">
                        {parseInt(q.dead_count, 10).toLocaleString()}
                      </td>
                      <td className="td-mono">
                        {q.avg_duration_ms ? `${parseFloat(q.avg_duration_ms).toFixed(1)} ms` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
