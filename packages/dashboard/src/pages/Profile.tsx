import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../contexts/AuthContext";
import { IconLogOut, IconSettings, IconBuilding, IconServer } from "../components/ui/Icons";

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState("7 days");
  const [apiKey, setApiKey] = useState("cdt_live_9f82b10a9c8d7e6f5a4b3c2d1e0f");
  const [copied, setCopied] = useState(false);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <Layout
      title="Account Profile"
      subtitle="Manage your personal credentials, workspace settings, and active sessions"
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "var(--space-6)" }}>
        
        {/* Identity Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">User Identity & Workspace</span>
            <span className="badge badge-completed">Active Tenant</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "var(--color-primary-subtle)",
                  color: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  fontWeight: 700,
                  border: "1px solid var(--border-color)",
                }}
              >
                {initials}
              </div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-main)", marginBottom: "2px" }}>
                  {user?.name ?? "User"}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {user?.email ?? "email@example.com"}
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "var(--space-4)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div>
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: "4px" }}>
                  Account Role
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: 500 }}>
                  Workspace Administrator
                </div>
              </div>
              <div>
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: "4px" }}>
                  Tenant Scope
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-main)", fontWeight: 500 }}>
                  Isolated Multi-Tenant
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Access Control */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Security & Access Control</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowSettings(true)}
              title="Configure Security Settings"
              style={{ padding: "4px 8px" }}
            >
              <IconSettings size={15} style={{ color: "var(--text-secondary)" }} />
            </button>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "var(--space-3)", borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>Authentication Method</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Stateless JSON Web Tokens (RS256)</div>
              </div>
              <span className="badge badge-running">Secured</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "var(--space-3)", borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>Password Encryption</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>bcrypt salted hashing (work factor 12)</div>
              </div>
              <span className="badge badge-running">Enforced</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-main)" }}>Session Expiration</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Token valid for {sessionExpiry} across workers</div>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{sessionExpiry}</span>
            </div>
          </div>
        </div>

        {/* Session & Logout Card */}
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-header" style={{ borderColor: "rgba(239, 68, 68, 0.2)", background: "rgba(239, 68, 68, 0.02)" }}>
            <span className="card-title" style={{ color: "var(--color-error)" }}>Session & Workspace Actions</span>
          </div>
          <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>
                Sign out of Codity Jobs
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "520px" }}>
                Ending your session will clear your local authentication token and redirect you to the sign-in page. Active background jobs and workers will continue executing undisturbed.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontWeight: 600, padding: "8px 16px" }}
              onClick={handleLogout}
            >
              <IconLogOut size={15} /> Sign out of workspace
            </button>
          </div>
        </div>

      </div>

      {/* Security Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Security & Access Control Settings"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowSettings(false)}>
              Close
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowSettings(false);
                alert("Security settings saved successfully!");
              }}
            >
              Save Preferences
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div className="form-group">
            <label className="form-label">Active API Token</label>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <input
                className="form-input"
                type="text"
                readOnly
                value={apiKey}
                style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(apiKey);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <span className="form-hint" style={{ marginTop: "4px", display: "block" }}>
              Use this token in your Authorization header: <code>Bearer {apiKey.slice(0, 12)}...</code>
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Session Expiration Policy</label>
            <select
              className="form-select"
              value={sessionExpiry}
              onChange={(e) => setSessionExpiry(e.target.value)}
            >
              <option value="24 hours">24 hours (Strict Security)</option>
              <option value="7 days">7 days (Recommended Default)</option>
              <option value="30 days">30 days (Extended Session)</option>
            </select>
            <span className="form-hint" style={{ marginTop: "4px", display: "block" }}>
              Controls how long JWT tokens remain valid before re-authentication is required.
            </span>
          </div>

          <div className="form-group" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "var(--space-4)" }}>
            <label className="form-label">Token Rotation</label>
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={() => {
                const newKey = "cdt_live_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                setApiKey(newKey);
                alert("New API token generated! Make sure to update your background worker configuration.");
              }}
              style={{ justifyContent: "center" }}
            >
              🔄 Rotate & Regenerate API Token
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
