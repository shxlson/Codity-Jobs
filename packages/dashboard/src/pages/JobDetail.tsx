import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { StatusBadge, PriorityBadge } from "../components/ui/Badge";
import { LoadingState } from "../components/ui/Spinner";
import { IconChevronLeft, IconRepeat, IconX, IconClock } from "../components/ui/Icons";
import { jobs, JobDetail, JobLog } from "../api/client";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "160px 1fr",
      gap: "var(--space-4)", padding: "var(--space-3) 0",
      borderBottom: "1px solid var(--border-subtle)",
    }}>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{children}</span>
    </div>
  );
}

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!jobId) return;
    Promise.all([jobs.get(jobId), jobs.logs(jobId)])
      .then(([j, l]) => { setJob(j); setLogs(l); })
      .finally(() => setLoading(false));
  }, [jobId]);

  async function handleCancel() {
    if (!jobId) return;
    try { await jobs.cancel(jobId); const j = await jobs.get(jobId); setJob(j); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleRequeue() {
    if (!jobId) return;
    try { await jobs.requeue(jobId); const j = await jobs.get(jobId); setJob(j); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Failed"); }
  }

  if (loading) return <Layout title="Job Detail"><LoadingState /></Layout>;
  if (!job) return <Layout title="Job Detail"><div className="empty-state"><div className="empty-state-title">Job not found</div></div></Layout>;

  const canCancel = ["queued", "scheduled", "retrying"].includes(job.status);
  const canRequeue = ["failed", "dead"].includes(job.status);

  return (
    <Layout
      title={`Job #${job.job_id.slice(-10)}`}
      subtitle={`Queue ${job.queue_id.slice(-8)}`}
      actions={
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            <IconChevronLeft size={13} /> Back
          </button>
          {canCancel && (
            <button className="btn btn-danger btn-sm" onClick={handleCancel}>
              <IconX size={13} /> Cancel
            </button>
          )}
          {canRequeue && (
            <button className="btn btn-secondary btn-sm" onClick={handleRequeue}>
              <IconRepeat size={13} /> Requeue
            </button>
          )}
        </div>
      }
    >
      {actionError && <div className="alert alert-error mb-6">{actionError}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)", alignItems: "start" }}>
        {/* Left: Job details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Job Details</span></div>
            <div className="card-body">
              <DetailRow label="Status"><StatusBadge status={job.status} /></DetailRow>
              <DetailRow label="Priority"><PriorityBadge priority={job.priority} /></DetailRow>
              <DetailRow label="Attempt Count">
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>
                  {job.attempt_count}
                </span>
              </DetailRow>
              <DetailRow label="Created At">
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                  {new Date(job.created_at).toLocaleString()}
                </span>
              </DetailRow>
              {job.scheduled_time && (
                <DetailRow label="Scheduled For">
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                    {new Date(job.scheduled_time).toLocaleString()}
                  </span>
                </DetailRow>
              )}
              {job.idempotency_key && (
                <DetailRow label="Idempotency Key">
                  <code style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                    {job.idempotency_key}
                  </code>
                </DetailRow>
              )}
            </div>
          </div>

          {/* Payload */}
          <div className="card">
            <div className="card-header"><span className="card-title">Payload</span></div>
            <div className="card-body">
              <pre className="log-viewer" style={{ maxHeight: 200, padding: "var(--space-4)" }}>
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Right: Executions + Logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Execution history */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Execution History</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                {job.executions?.length ?? 0} attempt{(job.executions?.length ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="card-body no-pad">
              {(!job.executions || job.executions.length === 0) ? (
                <div className="empty-state" style={{ padding: "var(--space-8)" }}>
                  <div className="empty-state-icon"><IconClock size={14} /></div>
                  <div className="empty-state-title" style={{ fontSize: "var(--text-sm)" }}>No executions yet</div>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Attempt</th>
                        <th>Status</th>
                        <th>Worker</th>
                        <th>Duration</th>
                        <th>Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.executions.map((ex) => (
                        <tr key={ex.execution_id}>
                          <td className="td-mono">#{ex.attempt}</td>
                          <td><StatusBadge status={ex.status} /></td>
                          <td style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                            {ex.worker_hostname ?? ex.worker_id?.slice(-8) ?? "—"}
                          </td>
                          <td className="td-mono">
                            {ex.duration_ms != null ? `${ex.duration_ms.toFixed(0)} ms` : "—"}
                          </td>
                          <td style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
                            {new Date(ex.started_at).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Logs */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Execution Logs</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{logs.length} entries</span>
            </div>
            <div className="card-body">
              {logs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "var(--space-6)", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
                  No log entries available
                </div>
              ) : (
                <div className="log-viewer">
                  {logs.map((log) => (
                    <div key={log.log_id} className="log-line">
                      <span className="log-time">
                        {new Date(log.created_at).toTimeString().slice(0, 8)}
                      </span>
                      <span className={`log-level ${log.level}`}>
                        {log.level.toUpperCase().slice(0, 4)}
                      </span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
