import React, { useState } from "react";
import { Layout } from "../components/layout/Layout";
import { Modal } from "../components/ui/Modal";
import { LoadingState } from "../components/ui/Spinner";
import { IconPlus, IconBuilding, IconTrash, IconRefresh } from "../components/ui/Icons";
import { organizations, Organization } from "../api/client";
import { usePolling } from "../hooks/usePolling";

export function OrganizationsPage() {
  const [orgList, setOrgList] = useState<Organization[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [orgName, setOrgName] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function load() {
    try {
      const data = await organizations.list();
      setOrgList(data);
    } catch {
      // Silent catch
    } finally {
      setLoading(false);
    }
  }

  usePolling(load, 15_000);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await organizations.create({ name: orgName });
      setOrgName("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this organization? All projects, queues, and jobs within it will be permanently removed.")) {
      return;
    }
    try {
      await organizations.delete(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete organization");
    }
  }

  if (loading) {
    return (
      <Layout title="Organizations">
        <LoadingState />
      </Layout>
    );
  }

  return (
    <Layout
      title="Organizations"
      subtitle={`${orgList.length} organization${orgList.length !== 1 ? "s" : ""}`}
      actions={
        <>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            <IconRefresh size={13} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <IconPlus size={13} /> New Organization
          </button>
        </>
      }
    >
      {orgList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconBuilding size={18} />
          </div>
          <div className="empty-state-title">No organizations created</div>
          <div className="empty-state-desc">
            Organizations group your projects and teams together. Create your first organization to get started.
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <IconPlus size={13} /> Create Organization
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="card-body no-pad">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Organization ID</th>
                    <th>Name</th>
                    <th>Created At</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {orgList.map((org) => (
                    <tr key={org.organization_id}>
                      <td className="td-mono">#{org.organization_id.slice(-8)}</td>
                      <td className="primary">{org.name}</td>
                      <td style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(org.organization_id)}
                          title="Delete organization"
                        >
                          <IconTrash size={13} />
                        </button>
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
        title="New Organization"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" form="create-org-form" type="submit">
              Create
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error mb-4">{error}</div>}
        <form id="create-org-form" onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Organization Name</label>
            <input
              className="form-input"
              placeholder="e.g., Acme Corp Production"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              autoFocus
            />
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
