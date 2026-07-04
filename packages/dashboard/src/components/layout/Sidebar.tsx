import React, { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LogoMark,
  IconLayoutDashboard,
  IconQueue,
  IconBox,
  IconServer,
  IconChartLine,
  IconAlertOctagon,
  IconFolder,
  IconBuilding,
  IconLogOut,
} from "../ui/Icons";

interface NavItemDef {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  badge?: number;
  alertBadge?: boolean;
}

const primaryNav: NavItemDef[] = [
  { to: "/", label: "Overview", icon: IconLayoutDashboard },
  { to: "/queues", label: "Queues", icon: IconQueue },
  { to: "/jobs", label: "Jobs", icon: IconBox },
  { to: "/workers", label: "Workers", icon: IconServer },
];

const secondaryNav: NavItemDef[] = [
  { to: "/metrics", label: "Metrics", icon: IconChartLine },
  { to: "/dlq", label: "Dead Letter Queue", icon: IconAlertOctagon },
];

const mgmtNav: NavItemDef[] = [
  { to: "/organizations", label: "Organizations", icon: IconBuilding },
  { to: "/projects", label: "Projects", icon: IconFolder },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  function NavItems({ items }: { items: NavItemDef[] }) {
    return (
      <>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `nav-item${isActive ? " active" : ""}`
            }
          >
            <item.icon size={15} />
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span className={`nav-badge${item.alertBadge ? " alert" : ""}`}>
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </>
    );
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <LogoMark size={12} />
        </div>
        <div>
          <div className="sidebar-logo-text">Codity Jobs</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div style={{ padding: "4px 0" }}>
          <NavItems items={primaryNav} />
        </div>

        <div className="sidebar-section">
          <span className="sidebar-section-label">Observability</span>
        </div>
        <div style={{ padding: "4px 0" }}>
          <NavItems items={secondaryNav} />
        </div>

        <div className="sidebar-section">
          <span className="sidebar-section-label">Management</span>
        </div>
        <div style={{ padding: "4px 0" }}>
          <NavItems items={mgmtNav} />
        </div>
      </nav>

      {/* User footer */}
      <div className="sidebar-footer" style={{ position: "relative" }} ref={menuRef}>
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: "var(--space-3)",
              right: "var(--space-3)",
              marginBottom: "var(--space-2)",
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-1)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                navigate("/profile");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                background: "transparent",
                color: "var(--text-main)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                border: "none",
                width: "100%",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: "14px" }}>👤</span> View Profile
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                background: "transparent",
                color: "var(--color-error)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
                border: "none",
                width: "100%",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <IconLogOut size={14} /> Sign Out
            </button>
          </div>
        )}
        <div
          className="sidebar-user"
          onClick={() => setMenuOpen(!menuOpen)}
          title="Account options"
          style={{ cursor: "pointer" }}
        >
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name ?? "User"}</div>
            <div className="sidebar-user-email">{user?.email}</div>
          </div>
          <IconLogOut size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0, marginLeft: "auto" }} />
        </div>
      </div>
    </aside>
  );
}
