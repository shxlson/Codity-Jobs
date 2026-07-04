import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoadingState } from "./components/ui/Spinner";

// Pages
import { LoginPage } from "./pages/Login";
import { RegisterPage } from "./pages/Register";
import { OverviewPage } from "./pages/Overview";
import { QueuesPage } from "./pages/Queues";
import { JobsPage } from "./pages/Jobs";
import { JobDetailPage } from "./pages/JobDetail";
import { WorkersPage } from "./pages/Workers";
import { MetricsPage } from "./pages/Metrics";
import { DLQPage } from "./pages/DLQ";
import { OrganizationsPage } from "./pages/Organizations";
import { ProjectsPage } from "./pages/Projects";
import { ProfilePage } from "./pages/Profile";

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-canvas)" }}>
        <LoadingState />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }: { children: React.ReactElement }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-canvas)" }}>
        <LoadingState />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function QueueRedirect() {
  const { queueId } = useParams();
  return <Navigate to={`/jobs?queueId=${queueId}`} replace />;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

          {/* Protected Application Routes */}
          <Route path="/" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
          <Route path="/queues" element={<ProtectedRoute><QueuesPage /></ProtectedRoute>} />
          <Route path="/queues/:queueId" element={<ProtectedRoute><QueueRedirect /></ProtectedRoute>} />
          <Route path="/jobs" element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
          <Route path="/jobs/:jobId" element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>} />
          <Route path="/workers" element={<ProtectedRoute><WorkersPage /></ProtectedRoute>} />
          <Route path="/metrics" element={<ProtectedRoute><MetricsPage /></ProtectedRoute>} />
          <Route path="/dlq" element={<ProtectedRoute><DLQPage /></ProtectedRoute>} />
          <Route path="/organizations" element={<ProtectedRoute><OrganizationsPage /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
