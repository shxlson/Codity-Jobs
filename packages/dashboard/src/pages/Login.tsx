import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LogoMark } from "../components/ui/Icons";
import { Spinner } from "../components/ui/Spinner";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="auth-logo-mark">
              <LogoMark size={18} />
            </div>
            <span className="auth-logo-name">Codity Jobs</span>
          </div>
          <p className="auth-tagline">Distributed job scheduling platform</p>
        </div>

        <div className="auth-card">
          <h2 className="auth-card-title">Sign in</h2>
          <p className="auth-card-sub">Enter your credentials to access your workspace</p>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: "var(--space-5)" }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: "var(--space-5)" }}>
            <button
              type="button"
              className="btn btn-secondary w-full"
              style={{ justifyContent: "center", fontWeight: 600, borderStyle: "dashed", borderColor: "var(--border-strong)" }}
              onClick={() => {
                setEmail("demo@codity.ai");
                setPassword("Password123!");
              }}
            >
              Demo Login
            </button>
            <p style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "var(--space-2)", textAlign: "center", lineHeight: "1.4" }}>
              For demo purposes only. To test freshly, register or sign in with separate credentials.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
              style={{ justifyContent: "center", marginTop: "var(--space-2)" }}
            >
              {loading && <Spinner />}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="auth-footer">
            No account?{" "}
            <Link to="/register">Create one</Link>
          </div>
        </div>

        {/* Creator Footer */}
        <div
          style={{
            marginTop: "var(--space-6)",
            textAlign: "center",
            fontSize: "13px",
            color: "var(--text-tertiary)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            alignItems: "center",
          }}
        >
          <div>
            Created by <strong style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Shelson Shelly</strong> (RA2311026010116)
          </div>
          <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
            <a
              href="https://github.com/shxlson"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
            >
              GitHub
            </a>
            <span style={{ color: "var(--border-color)" }}>•</span>
            <a
              href="https://www.linkedin.com/in/shelsonshelly/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
