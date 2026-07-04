import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LogoMark } from "../components/ui/Icons";
import { Spinner } from "../components/ui/Spinner";

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
          <h2 className="auth-card-title">Create account</h2>
          <p className="auth-card-sub">Set up your workspace in seconds</p>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: "var(--space-5)" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                className="form-input"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                autoFocus
              />
            </div>

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
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Min. 8 characters, one uppercase, one number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <span className="form-hint">At least 8 characters, one uppercase letter, one number</span>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
              style={{ justifyContent: "center", marginTop: "var(--space-2)" }}
            >
              {loading && <Spinner />}
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account?{" "}
            <Link to="/login">Sign in</Link>
          </div>

          <div style={{ marginTop: "var(--space-3)", textAlign: "center" }}>
            <Link to="/login" style={{ fontSize: "12px", color: "var(--text-tertiary)", textDecoration: "underline" }}>
              Evaluating for demo purposes? Use Demo Login →
            </Link>
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
