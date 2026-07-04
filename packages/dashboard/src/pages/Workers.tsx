import React, { useState } from "react";
import { Layout } from "../components/layout/Layout";
import { Modal } from "../components/ui/Modal";
import { StatusBadge } from "../components/ui/Badge";
import { LoadingState } from "../components/ui/Spinner";
import { IconRefresh, IconServer } from "../components/ui/Icons";
import { workers, Worker } from "../api/client";
import { usePolling } from "../hooks/usePolling";

function bytes(b: number | null): string {
  if (b === null) return "—";
  const mb = b / 1024 / 1024;
  return mb < 1024 ? `${mb.toFixed(0)} MB` : `${(mb / 1024).toFixed(1)} GB`;
}

export function WorkersPage() {
  const [workerList, setWorkerList] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);

  async function load() {
    const data = await workers.list();
    setWorkerList(data);
    setLoading(false);
  }

  usePolling(load, 15_000);

  if (loading) return <Layout title="Workers"><LoadingState /></Layout>;

  const activeCount = workerList.filter((w) => w.status === "active").length;
  const idleCount = workerList.filter((w) => w.status === "idle").length;

  return (
    <Layout
      title="Workers"
      subtitle={`${activeCount} active, ${idleCount} idle, ${workerList.length} total`}
      actions={
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <IconRefresh size={13} /> Refresh
        </button>
      }
    >
      {workerList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><IconServer size={18} /></div>
          <div className="empty-state-title">No workers running</div>
          <div className="empty-state-desc">Start a worker process to begin processing jobs.</div>
          <code style={{
            background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
            padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-md)",
            fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--text-secondary)"
          }}>
            npm run dev:worker
          </code>
        </div>
      ) : (
        <>
          <div className="worker-grid mb-8">
            {workerList.map((w) => (
              <div
                key={w.worker_id}
                className="worker-card"
                onClick={() => setSelectedWorker(w)}
                style={{ cursor: "pointer", transition: "transform 0.15s ease, border-color 0.15s ease" }}
              >
                <div className="worker-card-header">
                  <div className={`worker-indicator ${w.status}`} />
                  <div>
                    <div className="worker-hostname">{w.hostname}</div>
                    <div className="worker-pid">PID {w.pid ?? "—"}</div>
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <StatusBadge status={w.status} dot={false} />
                  </div>
                </div>

                <div className="worker-metrics">
                  <div className="worker-metric">
                    <div className="worker-metric-label">Active Jobs</div>
                    <div className="worker-metric-val" style={{ color: w.active_jobs > 0 ? "var(--accent)" : "var(--text-primary)" }}>
                      {w.active_jobs}
                    </div>
                  </div>
                  <div className="worker-metric">
                    <div className="worker-metric-label">CPU</div>
                    <div className="worker-metric-val">
                      {w.cpu_usage != null ? `${w.cpu_usage.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                  <div className="worker-metric">
                    <div className="worker-metric-label">Memory</div>
                    <div className="worker-metric-val">{bytes(w.memory_usage)}</div>
                  </div>
                  <div className="worker-metric">
                    <div className="worker-metric-label">Heartbeat</div>
                    <div className="worker-metric-val" style={{ fontSize: "var(--text-sm)" }}>
                      {w.last_heartbeat
                        ? `${Math.floor((Date.now() - new Date(w.last_heartbeat).getTime()) / 1000)}s ago`
                        : "—"}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                    Started {w.started_at ? new Date(w.started_at).toLocaleString() : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* All workers table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">All Workers</span>
            </div>
            <div className="card-body no-pad">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Worker ID</th>
                      <th>Hostname</th>
                      <th>Status</th>
                      <th>Active Jobs</th>
                      <th>CPU</th>
                      <th>Memory</th>
                      <th>Last Heartbeat</th>
                      <th>Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerList.map((w) => (
                      <tr key={w.worker_id} onClick={() => setSelectedWorker(w)} style={{ cursor: "pointer" }}>
                        <td className="td-mono">#{w.worker_id.slice(-8)}</td>
                        <td className="primary" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>{w.hostname}</td>
                        <td><StatusBadge status={w.status} /></td>
                        <td style={{ color: w.active_jobs > 0 ? "var(--accent)" : "var(--text-tertiary)" }} className="td-mono">
                          {w.active_jobs}
                        </td>
                        <td className="td-mono">{w.cpu_usage != null ? `${w.cpu_usage.toFixed(1)}%` : "—"}</td>
                        <td className="td-mono">{bytes(w.memory_usage)}</td>
                        <td style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                          {w.last_heartbeat
                            ? `${Math.floor((Date.now() - new Date(w.last_heartbeat).getTime()) / 1000)}s ago`
                            : "—"}
                        </td>
                        <td style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                          {w.started_at ? new Date(w.started_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Worker Detail Modal */}
      <Modal
        open={!!selectedWorker}
        onClose={() => setSelectedWorker(null)}
        title={selectedWorker ? `Worker Node: ${selectedWorker.hostname}` : "Worker Details"}
        width={560}
        footer={
          <button className="btn btn-secondary w-full" onClick={() => setSelectedWorker(null)} style={{ justifyContent: "center" }}>
            Close Detail View
          </button>
        }
      >
        {selectedWorker && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-canvas)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <div className={`worker-indicator ${selectedWorker.status}`} style={{ width: 12, height: 12 }} />
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-main)", fontFamily: "var(--font-mono)" }}>
                    #{selectedWorker.worker_id.slice(-12)}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    PID: {selectedWorker.pid ?? "N/A"} • Host: {selectedWorker.hostname}
                  </div>
                </div>
              </div>
              <StatusBadge status={selectedWorker.status} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-4)" }}>
              <div style={{ background: "var(--bg-subtle)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
                  Active Processing Jobs
                </div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: selectedWorker.active_jobs > 0 ? "var(--accent)" : "var(--text-main)", marginTop: "4px" }}>
                  {selectedWorker.active_jobs}
                </div>
              </div>

              <div style={{ background: "var(--bg-subtle)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
                  CPU Utilization
                </div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-main)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                  {selectedWorker.cpu_usage != null ? `${selectedWorker.cpu_usage.toFixed(1)}%` : "—"}
                </div>
              </div>

              <div style={{ background: "var(--bg-subtle)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
                  Memory Consumption
                </div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-main)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                  {bytes(selectedWorker.memory_usage)}
                </div>
              </div>

              <div style={{ background: "var(--bg-subtle)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 600 }}>
                  Last Heartbeat Sync
                </div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", marginTop: "6px" }}>
                  {selectedWorker.last_heartbeat
                    ? `${Math.floor((Date.now() - new Date(selectedWorker.last_heartbeat).getTime()) / 1000)}s ago`
                    : "—"}
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "var(--space-4)", fontSize: "13px", color: "var(--text-secondary)", display: "flex", justifyContent: "space-between" }}>
              <span>Process Started At:</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-main)" }}>
                {selectedWorker.started_at ? new Date(selectedWorker.started_at).toLocaleString() : "—"}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
