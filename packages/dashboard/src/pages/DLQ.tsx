import React, { useState, useCallback, useEffect } from "react";
import { Layout } from "../components/layout/Layout";
import { StatusBadge } from "../components/ui/Badge";
import { LoadingState } from "../components/ui/Spinner";
import {
  IconAlertOctagon,
  IconRefresh,
  IconRepeat,
  IconChevronRight,
  IconChevronLeft,
} from "../components/ui/Icons";
import {
  jobs,
  queues,
  organizations,
  projects,
  Queue,
  Organization,
  Project,
  DLQEntry,
} from "../api/client";
import { usePolling } from "../hooks/usePolling";

export function DLQPage() {
  const [dlqItems, setDlqItems] = useState<DLQEntry[]>([]);
  const [allQueues, setAllQueues] = useState<Queue[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [projs, setProjs] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [selectedQueue, setSelectedQueue] = useState<string>("");
  const [actionError, setActionError] = useState<string>("");

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

      const projList = await projects.list(firstOrg);
      setProjs(projList);

      const qList: Queue[] = [];
      await Promise.all(
        projList.map(async (p) => {
          const qs = await queues.list(p.project_id);
          qList.push(...qs);
        })
      );
      setAllQueues(qList);

      const qId = selectedQueue || (qList[0]?.queue_id ?? "");
      if (!qId) {
        setDlqItems([]);
        setLoading(false);
        return;
      }

      if (!selectedQueue) setSelectedQueue(qId);

      const res = await jobs.dlq(qId, page);
      setDlqItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      // Silent catch
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, selectedQueue, page]);

  usePolling(load, 15_000);

  useEffect(() => {
    load();
  }, [selectedOrg, selectedQueue, page]);

  async function handleRequeue(jobId: string) {
    try {
      setActionError("");
      await jobs.requeue(jobId);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to requeue job");
    }
  }

  if (loading) {
    return (
      <Layout title="Dead Letter Queue">
        <LoadingState />
      </Layout>
    );
  }

  return (
    <Layout
      title="Dead Letter Queue"
      subtitle={`${total.toLocaleString()} permanently failed jobs requiring manual intervention`}
      actions={
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <IconRefresh size={13} /> Refresh
        </button>
      }
    >
      {actionError && <div className="alert alert-error mb-4">{actionError}</div>}

      {/* Scope Selectors */}
      <div className="filter-bar">
        <select
          className="form-select"
          style={{ width: "auto", minWidth: 180 }}
          value={selectedOrg}
          onChange={(e) => {
            setSelectedOrg(e.target.value);
            setSelectedQueue("");
            setPage(1);
          }}
        >
          <option value="">Select organization</option>
          {orgs.map((o) => (
            <option key={o.organization_id} value={o.organization_id}>
              {o.name}
            </option>
          ))}
        </select>

        {selectedOrg && (
          <select
            className="form-select"
            style={{ width: "auto", minWidth: 200 }}
            value={selectedQueue}
            onChange={(e) => {
              setSelectedQueue(e.target.value);
              setPage(1);
            }}
          >
            {allQueues.length === 0 && <option value="">No queues found</option>}
            {allQueues.map((q) => (
              <option key={q.queue_id} value={q.queue_id}>
                {q.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {dlqItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <IconAlertOctagon size={18} />
          </div>
          <div className="empty-state-title">Dead Letter Queue is empty</div>
          <div className="empty-state-desc">
            No permanently failed jobs found in this queue. All jobs have processed successfully or are still retrying.
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body no-pad">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Failure Reason</th>
                    <th>Error Detail</th>
                    <th>Moved To DLQ</th>
                    <th style={{ width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dlqItems.map((entry) => (
                    <tr key={entry.dlq_id}>
                      <td className="td-mono" style={{ color: "var(--text-primary)" }}>
                        #{entry.job_id.slice(-8)}
                      </td>
                      <td>
                        <StatusBadge status="dead" label={entry.reason ?? "Max Retries Exceeded"} dot />
                      </td>
                      <td className="td-mono" style={{ maxWidth: 300 }}>
                        <div className="truncate">
                          {entry.error_detail
                            ? JSON.stringify(entry.error_detail)
                            : "No trace available"}
                        </div>
                      </td>
                      <td style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
                        {new Date(entry.moved_at).toLocaleString()}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRequeue(entry.job_id)}
                          title="Requeue job for execution"
                        >
                          <IconRepeat size={13} /> Requeue
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
              <span className="pagination-info">{total} dead jobs</span>
              <button
                className="page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <IconChevronLeft size={12} />
              </button>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                {page} / {totalPages}
              </span>
              <button
                className="page-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <IconChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
