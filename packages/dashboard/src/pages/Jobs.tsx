import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { Modal } from "../components/ui/Modal";
import { StatusBadge, PriorityBadge } from "../components/ui/Badge";
import { LoadingState } from "../components/ui/Spinner";
import { IconPlus, IconRefresh, IconBox, IconSearch, IconChevronRight, IconChevronLeft } from "../components/ui/Icons";
import { jobs, queues, organizations, projects, Job, Queue, Organization, Project } from "../api/client";
import { usePolling } from "../hooks/usePolling";

const JOB_STATUSES = ["queued", "scheduled", "claimed", "running", "completed", "failed", "retrying", "dead"];

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function JobsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlQueueId = searchParams.get("queueId") || "";
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [allQueues, setAllQueues] = useState<Queue[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [projs, setProjs] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedQueue, setSelectedQueue] = useState(urlQueueId);
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState("");

  const [form, setForm] = useState({
    queueId: "", payload: '{ "type": "noop" }',
    priority: "0", jobType: "immediate",
    scheduledTime: "", cronExpression: "",
    idempotencyKey: "",
  });

  const load = useCallback(async () => {
    try {
      const orgList = await organizations.list();
      setOrgs(orgList);

      let targetOrg = selectedOrg;
      if (urlQueueId && !selectedQueue) {
        for (const o of orgList) {
          const pList = await projects.list(o.organization_id);
          for (const p of pList) {
            const qs = await queues.list(p.project_id);
            if (qs.some(q => q.queue_id === urlQueueId)) {
              targetOrg = o.organization_id;
              break;
            }
          }
          if (targetOrg !== selectedOrg && targetOrg) break;
        }
      }

      const firstOrg = targetOrg || selectedOrg || (orgList[0]?.organization_id ?? "");
      if (!firstOrg) { setLoading(false); return; }
      if (targetOrg && targetOrg !== selectedOrg) setSelectedOrg(targetOrg);
      else if (!selectedOrg) setSelectedOrg(firstOrg);

      const projList = await projects.list(firstOrg);
      setProjs(projList);

      const qList: Queue[] = [];
      await Promise.all(projList.map(async (p) => {
        const qs = await queues.list(p.project_id);
        qList.push(...qs);
      }));
      setAllQueues(qList);

      const qId = urlQueueId || selectedQueue || (qList[0]?.queue_id ?? "");
      if (!qId) { setAllJobs([]); setLoading(false); return; }
      if (!selectedQueue && qId) setSelectedQueue(qId);

      const result = await jobs.list({
        queueId: qId,
        status: statusFilter || undefined,
        page,
        pageSize: 20,
      });

      setAllJobs(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, selectedQueue, statusFilter, page, urlQueueId]);

  usePolling(load, 8_000);

  useEffect(() => {
    if (urlQueueId && urlQueueId !== selectedQueue) {
      setSelectedQueue(urlQueueId);
    }
    load();
  }, [selectedOrg, selectedQueue, statusFilter, page, urlQueueId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    try {
      let payload: Record<string, unknown> = {};
      try { payload = JSON.parse(form.payload); } catch {
        setCreateError("Payload must be valid JSON"); return;
      }

      await jobs.create({
        queueId: form.queueId || allQueues[0]?.queue_id,
        payload,
        priority: parseInt(form.priority),
        scheduledTime: form.jobType === "delayed" ? form.scheduledTime : undefined,
        cronExpression: form.jobType === "cron" ? form.cronExpression : undefined,
        idempotencyKey: form.idempotencyKey || undefined,
      });
      setShowCreate(false);
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create job");
    }
  }

  if (loading) return <Layout title="Jobs"><LoadingState /></Layout>;

  return (
    <Layout
      title="Jobs"
      subtitle={`${total.toLocaleString()} total`}
      actions={
        <>
          <button className="btn btn-ghost btn-sm" onClick={load}><IconRefresh size={13} /> Refresh</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <IconPlus size={13} /> New Job
          </button>
        </>
      }
    >
      {/* Filters */}
      <div className="filter-bar">
        <select className="form-select" style={{ width: "auto", minWidth: 160 }}
          value={selectedOrg}
          onChange={(e) => { setSelectedOrg(e.target.value); setSelectedQueue(""); setPage(1); }}>
          <option value="">Select org</option>
          {orgs.map((o) => <option key={o.organization_id} value={o.organization_id}>{o.name}</option>)}
        </select>

        <select className="form-select" style={{ width: "auto", minWidth: 180 }}
          value={selectedQueue}
          onChange={(e) => { setSelectedQueue(e.target.value); setPage(1); }}>
          <option value="">All queues</option>
          {allQueues.map((q) => <option key={q.queue_id} value={q.queue_id}>{q.name}</option>)}
        </select>

        <select className="form-select" style={{ width: "auto" }}
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {allJobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><IconBox size={18} /></div>
          <div className="empty-state-title">No jobs found</div>
          <div className="empty-state-desc">Dispatch your first job using the API or the button above.</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body no-pad">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Attempts</th>
                    <th>Created</th>
                    <th>Scheduled</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {allJobs.map((j) => (
                    <tr key={j.job_id} onClick={() => navigate(`/jobs/${j.job_id}`)} style={{ cursor: "pointer" }}>
                      <td className="td-mono" style={{ color: "var(--text-secondary)" }}>
                        #{j.job_id.slice(-8)}
                      </td>
                      <td><StatusBadge status={j.status} /></td>
                      <td><PriorityBadge priority={j.priority} /></td>
                      <td className="td-mono">{j.attempt_count}</td>
                      <td style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
                        {relativeTime(j.created_at)}
                      </td>
                      <td style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
                        {j.scheduled_time ? new Date(j.scheduled_time).toLocaleString() : "—"}
                      </td>
                      <td>
                        <IconChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <span className="pagination-info">{total} jobs</span>
              <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                <IconChevronLeft size={12} />
              </button>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                {page} / {totalPages}
              </span>
              <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                <IconChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Job Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateError(""); }}
        title="Dispatch Job"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" form="create-job-form" type="submit">Dispatch</button>
          </>
        }
      >
        {createError && <div className="alert alert-error mb-4">{createError}</div>}
        <form id="create-job-form" onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Queue</label>
            <select className="form-select" value={form.queueId}
              onChange={(e) => setForm({ ...form, queueId: e.target.value })}>
              {allQueues.map((q) => <option key={q.queue_id} value={q.queue_id}>{q.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Job Type</label>
            <select className="form-select" value={form.jobType}
              onChange={(e) => setForm({ ...form, jobType: e.target.value })}>
              <option value="immediate">Immediate</option>
              <option value="delayed">Delayed (specific time)</option>
              <option value="cron">Recurring (cron)</option>
            </select>
          </div>
          {form.jobType === "delayed" && (
            <div className="form-group">
              <label className="form-label">Scheduled Time</label>
              <input type="datetime-local" className="form-input"
                value={form.scheduledTime}
                onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })} />
            </div>
          )}
          {form.jobType === "cron" && (
            <div className="form-group">
              <label className="form-label">Cron Expression</label>
              <input type="text" className="form-input" placeholder="*/5 * * * *"
                value={form.cronExpression}
                onChange={(e) => setForm({ ...form, cronExpression: e.target.value })} />
              <span className="form-hint">Standard 5-field cron expression</span>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Payload (JSON)</label>
            <textarea className="form-textarea" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}
              value={form.payload}
              onChange={(e) => setForm({ ...form, payload: e.target.value })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <input type="number" className="form-input" min="0" value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Idempotency Key</label>
              <input type="text" className="form-input" placeholder="Optional unique key"
                value={form.idempotencyKey}
                onChange={(e) => setForm({ ...form, idempotencyKey: e.target.value })} />
            </div>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
