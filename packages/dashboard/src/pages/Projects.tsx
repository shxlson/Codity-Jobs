import React, { useState, useCallback, useEffect } from "react";
import { Layout } from "../components/layout/Layout";
import { Modal } from "../components/ui/Modal";
import { LoadingState } from "../components/ui/Spinner";
import { IconPlus, IconFolder, IconRefresh } from "../components/ui/Icons";
import { projects, organizations, Project, Organization } from "../api/client";
import { usePolling } from "../hooks/usePolling";

export function ProjectsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [projList, setProjList] = useState<Project[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const [form, setForm] = useState({
    name: "",
    description: "",
  });

  const load = useCallback(async () => {
    try {
      const orgList = await organizations.list();
      setOrgs(orgList);

      const firstOrg = selectedOrg || (orgList[0]?.organization_id ?? "");
      if (!firstOrg) {
        setLoading(false);
        return;
      }
      if (!selectedOrg) setSelectedOrg(firstOrg);

      const data = await projects.list(firstOrg);
      setProjList(data);
    } catch {
      // Silent catch
    } finally {
      setLoading(false);
    }
  }, [selectedOrg]);

  usePolling(load, 15_000);

  useEffect(() => {
    load();
  }, [selectedOrg]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (!selectedOrg && orgs.length === 0) {
        setError("You must create an organization first");
        return;
      }
      const orgId = selectedOrg || orgs[0].organization_id;
      await projects.create({
        organizationId: orgId,
        name: form.name,
        description: form.description || undefined,
      });
      setForm({ name: "", description: "" });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  if (loading) {
    return (
      <Layout title="Projects">
        <LoadingState />
      </Layout>
    );
  }

  return (
    <Layout
      title="Projects"
      subtitle={`${projList.length} project${projList.length !== 1 ? "s" : ""} in selected organization`}
      actions={
        <>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <IconRefresh size={13} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <IconPlus size={13} /> New Project
          </button>
        </>
      }
    >
      {/* Org Selector */}
      <div className="filter-bar">
        <select
          className="form-select"
          style={{ width: "auto", minWidth: 220 }}
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
        >
          {orgs.length === 0 && <option value="">No organizations</option>}
          {orgs.map((o) => (
            <option key={o.organization_id} value={o.organization_id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {projList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconFolder size={18} />
          </div>
          <div className="empty-state-title">No projects in this organization</div>
          <div className="empty-state-desc">
            Projects contain job queues and isolate workloads. Create a project to start configuring queues.
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <IconPlus size={13} /> Create Project
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="card-body no-pad">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Project ID</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {projList.map((proj) => (
                    <tr key={proj.project_id}>
                      <td className="td-mono">#{proj.project_id.slice(-8)}</td>
                      <td className="primary">{proj.name}</td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {proj.description || <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                      </td>
                      <td style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
                        {new Date(proj.created_at).toLocaleDateString()}
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
        onClose={() => {
          setShowCreate(false);
          setError("");
        }}
        title="New Project"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" form="create-proj-form" type="submit">
              Create Project
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error mb-4">{error}</div>}
        <form id="create-proj-form" onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Organization</label>
            <select
              className="form-select"
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              disabled
            >
              {orgs.map((o) => (
                <option key={o.organization_id} value={o.organization_id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input
              className="form-input"
              placeholder="e.g., Billing Service"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea
              className="form-textarea"
              placeholder="Background job processing for billing and invoicing"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
