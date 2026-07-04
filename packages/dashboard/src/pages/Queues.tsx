import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { Modal } from "../components/ui/Modal";
import { StatusBadge } from "../components/ui/Badge";
import { LoadingState } from "../components/ui/Spinner";
import { IconPlus, IconPause, IconPlay, IconTrash, IconRefresh, IconQueue } from "../components/ui/Icons";
import { queues, organizations, projects, Queue, Organization, Project } from "../api/client";
import { usePolling } from "../hooks/usePolling";

export function QueuesPage() {
  const navigate = useNavigate();
  const [allQueues, setAllQueues] = useState<Queue[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [projs, setProjs] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [error, setError] = useState("");

  // Create form state
  const [form, setForm] = useState({
    name: "", priority: "0", concurrency: "1",
    strategy: "exponential", maxAttempts: "3", delaySeconds: "60",
  });

  const load = useCallback(async () => {
    try {
      const orgList = await organizations.list();
      setOrgs(orgList);
      if (!selectedOrg && orgList.length > 0) {
        setSelectedOrg(orgList[0].organization_id);
      }

      const firstOrg = selectedOrg || (orgList[0]?.organization_id ?? "");
      if (!firstOrg) { setLoading(false); return; }

      const projList = await projects.list(firstOrg);
      setProjs(projList);

      const firstProj = selectedProject || (projList[0]?.project_id ?? "");
      if (!firstProj) { setAllQueues([]); setLoading(false); return; }

      const qList = await queues.list(firstProj);
      setAllQueues(qList);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, selectedProject]);

  usePolling(load, 10_000);

  useEffect(() => {
    load();
  }, [selectedOrg, selectedProject]);

  async function handlePause(q: Queue) {
    await (q.paused ? queues.resume(q.queue_id) : queues.pause(q.queue_id));
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this queue? All associated jobs will be removed.")) return;
    await queues.delete(id);
    load();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const projId = selectedProject || projs[0]?.project_id;
      if (!projId) { setError("Select a project first"); return; }
      await queues.create({
        projectId: projId,
        name: form.name,
        priority: parseInt(form.priority),
        concurrency: parseInt(form.concurrency),
        retryPolicy: {
          strategy: form.strategy,
          maxAttempts: parseInt(form.maxAttempts),
          delaySeconds: parseInt(form.delaySeconds),
        },
      });
      setShowCreate(false);
      setForm({ name: "", priority: "0", concurrency: "1", strategy: "exponential", maxAttempts: "3", delaySeconds: "60" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create queue");
    }
  }

  const createActions = (
    <>
      <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
      <button className="btn btn-primary" form="create-queue-form" type="submit">Create Queue</button>
    </>
  );

  if (loading) return <Layout title="Queues"><LoadingState /></Layout>;

  return (
    <Layout
      title="Queues"
      subtitle={`${allQueues.length} queue${allQueues.length !== 1 ? "s" : ""}`}
      actions={
        <>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <IconRefresh size={13} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <IconPlus size={13} /> New Queue
          </button>
        </>
      }
    >
      {/* Scope selectors */}
      <div className="filter-bar">
        <div>
          <select
            className="form-select"
            style={{ width: "auto", minWidth: 180 }}
            value={selectedOrg}
            onChange={(e) => { setSelectedOrg(e.target.value); setSelectedProject(""); }}
          >
            <option value="">Select organization</option>
            {orgs.map((o) => (
              <option key={o.organization_id} value={o.organization_id}>{o.name}</option>
            ))}
          </select>
        </div>
        {selectedOrg && (
          <div>
            <select
              className="form-select"
              style={{ width: "auto", minWidth: 180 }}
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">All projects</option>
              {projs.map((p) => (
                <option key={p.project_id} value={p.project_id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {allQueues.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><IconQueue size={18} /></div>
          <div className="empty-state-title">No queues yet</div>
          <div className="empty-state-desc">Create your first queue to start dispatching jobs.</div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <IconPlus size={13} /> Create Queue
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="card-body no-pad">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Priority</th>
                    <th>Concurrency</th>
                    <th>Retry Strategy</th>
                    <th>Max Attempts</th>
                    <th>Status</th>
                    <th style={{ width: 120 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {allQueues.map((q) => (
                    <tr
                      key={q.queue_id}
                      onClick={() => navigate(`/jobs?queueId=${q.queue_id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="primary">{q.name}</td>
                      <td className="td-mono">{q.priority}</td>
                      <td className="td-mono">{q.concurrency}</td>
                      <td>
                        {q.strategy ? (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", textTransform: "capitalize" }}>
                            {q.strategy}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>None</span>
                        )}
                      </td>
                      <td className="td-mono">{q.max_attempts ?? "—"}</td>
                      <td>
                        <StatusBadge status={q.paused ? "dead" : "completed"} label={q.paused ? "Paused" : "Active"} dot />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handlePause(q)}
                            title={q.paused ? "Resume queue" : "Pause queue"}
                          >
                            {q.paused ? <IconPlay size={13} /> : <IconPause size={13} />}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(q.queue_id)}
                            title="Delete queue"
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setError(""); }}
        title="New Queue"
        footer={createActions}
      >
        {error && <div className="alert alert-error mb-4">{error}</div>}
        <form id="create-queue-form" onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Queue Name</label>
            <input className="form-input" placeholder="e.g., email-notifications" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <input type="number" className="form-input" min="0" value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              <span className="form-hint">Higher = processed first</span>
            </div>
            <div className="form-group">
              <label className="form-label">Concurrency</label>
              <input type="number" className="form-input" min="1" max="100" value={form.concurrency}
                onChange={(e) => setForm({ ...form, concurrency: e.target.value })} />
              <span className="form-hint">Max parallel jobs</span>
            </div>
          </div>
          <div className="divider" />
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
            Retry Policy
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)" }}>
            <div className="form-group">
              <label className="form-label">Strategy</label>
              <select className="form-select" value={form.strategy}
                onChange={(e) => setForm({ ...form, strategy: e.target.value })}>
                <option value="fixed">Fixed</option>
                <option value="linear">Linear</option>
                <option value="exponential">Exponential</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Max Attempts</label>
              <input type="number" className="form-input" min="1" max="20" value={form.maxAttempts}
                onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Base Delay (s)</label>
              <input type="number" className="form-input" min="0" value={form.delaySeconds}
                onChange={(e) => setForm({ ...form, delaySeconds: e.target.value })} />
            </div>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
