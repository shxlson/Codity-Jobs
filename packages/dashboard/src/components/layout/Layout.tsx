import React, { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Layout({ children, title, subtitle, actions }: LayoutProps) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <header className="page-header">
          <div className="page-header-left">
            <div>
              <div className="page-title">{title}</div>
              {subtitle && <div className="page-subtitle">{subtitle}</div>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>
        <main className="page-body">{children}</main>
      </div>
    </div>
  );
}
