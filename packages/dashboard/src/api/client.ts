// ─────────────────────────────────────────────────────────────────────────────
//  Typed API Client
//  Single source of truth for all HTTP calls. Reads the base URL from the
//  Vite proxy so no hard-coded host is needed in development.
// ─────────────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("codity_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }

  return data.data ?? data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  register: (body: { name: string; email: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () => request<User>("/auth/me"),
};

// ── Organizations ─────────────────────────────────────────────────────────────
export const organizations = {
  list: () => request<Organization[]>("/organizations"),
  create: (body: { name: string }) =>
    request<Organization>("/organizations", { method: "POST", body: JSON.stringify(body) }),
  delete: (id: string | number) =>
    request<void>(`/organizations/${id}`, { method: "DELETE" }),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projects = {
  list: (organizationId: string | number) =>
    request<Project[]>(`/projects?organizationId=${organizationId}`),
  create: (body: { organizationId: string | number; name: string; description?: string }) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
};

// ── Queues ────────────────────────────────────────────────────────────────────
export const queues = {
  list: (projectId: string | number) =>
    request<Queue[]>(`/queues?projectId=${projectId}`),
  create: (body: CreateQueueBody) =>
    request<Queue>("/queues", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string | number, body: Partial<Queue>) =>
    request<Queue>(`/queues/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (id: string | number) =>
    request<void>(`/queues/${id}`, { method: "DELETE" }),
  pause: (id: string | number) =>
    request<Queue>(`/queues/${id}/pause`, { method: "POST" }),
  resume: (id: string | number) =>
    request<Queue>(`/queues/${id}/resume`, { method: "POST" }),
  stats: (id: string | number) =>
    request<Record<string, number>>(`/queues/${id}/stats`),
};

// ── Jobs ──────────────────────────────────────────────────────────────────────
export const jobs = {
  list: (params: { queueId: string | number; status?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && qs.set(k, String(v)));
    return request<PaginatedResponse<Job>>(`/jobs?${qs.toString()}`);
  },
  get: (id: string | number) => request<JobDetail>(`/jobs/${id}`),
  create: (body: CreateJobBody) =>
    request<Job>("/jobs", { method: "POST", body: JSON.stringify(body) }),
  cancel: (id: string | number) =>
    request<Job>(`/jobs/${id}/cancel`, { method: "POST" }),
  requeue: (id: string | number) =>
    request<Job>(`/jobs/${id}/requeue`, { method: "POST" }),
  logs: (id: string | number) => request<JobLog[]>(`/jobs/${id}/logs`),
  dlq: (queueId: string | number, page = 1) =>
    request<PaginatedResponse<DLQEntry>>(`/jobs/dlq?queueId=${queueId}&page=${page}`),
};

// ── Workers ───────────────────────────────────────────────────────────────────
export const workers = {
  list: () => request<Worker[]>("/workers"),
  get: (id: string | number) => request<WorkerDetail>(`/workers/${id}`),
};

// ── Metrics ───────────────────────────────────────────────────────────────────
export const metrics = {
  overview: () => request<OverviewMetrics>("/metrics/overview"),
  queues: () => request<QueueMetric[]>("/metrics/queues"),
  throughput: (hours = 24) => request<ThroughputBucket[]>(`/metrics/throughput?hours=${hours}`),
  workers: () => request<WorkerMetric[]>("/metrics/workers"),
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  userId: string;
  name: string;
  email: string;
  createdAt?: string;
}

export interface Organization {
  organization_id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface Project {
  project_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Queue {
  queue_id: string;
  project_id: string;
  name: string;
  priority: number;
  concurrency: number;
  paused: boolean;
  created_at: string;
  policy_id?: string | null;
  strategy?: string | null;
  max_attempts?: number | null;
  delay_seconds?: number | null;
}

export interface Job {
  job_id: string;
  queue_id: string;
  status: string;
  payload: Record<string, unknown>;
  priority: number;
  scheduled_time: string | null;
  attempt_count: number;
  idempotency_key: string | null;
  created_at: string;
}

export interface JobExecution {
  execution_id: string;
  worker_id: string;
  attempt: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  worker_hostname?: string;
}

export interface JobDetail extends Job {
  executions: JobExecution[];
}

export interface JobLog {
  log_id: string;
  execution_id: string;
  level: string;
  message: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface DLQEntry {
  dlq_id: string;
  job_id: string;
  reason: string | null;
  error_detail: Record<string, unknown> | null;
  moved_at: string;
  payload?: Record<string, unknown>;
  priority?: number;
  job_created_at?: string;
}

export interface Worker {
  worker_id: string;
  hostname: string;
  pid: number | null;
  status: string;
  started_at: string;
  stopped_at: string | null;
  last_heartbeat: string | null;
  cpu_usage: number | null;
  memory_usage: number | null;
  active_jobs: number;
}

export interface WorkerDetail extends Worker {
  heartbeats: Array<{
    heartbeat_id: string;
    heartbeat_time: string;
    cpu_usage: number | null;
    memory_usage: number | null;
  }>;
  recentExecutions: JobExecution[];
}

export interface WorkerMetric {
  worker_id: string;
  hostname: string;
  status: string;
  jobs_completed: string;
  jobs_failed: string;
  avg_duration_ms: string | null;
  cpu_usage: number | null;
  memory_usage: number | null;
}

export interface OverviewMetrics {
  jobs: Record<string, number>;
  workers: Record<string, number>;
  deadLetterQueue: number;
}

export interface QueueMetric {
  queue_id: string;
  name: string;
  paused: boolean;
  concurrency: number;
  priority: number;
  queued_count: string;
  running_count: string;
  completed_count: string;
  failed_count: string;
  dead_count: string;
  avg_duration_ms: string | null;
}

export interface ThroughputBucket {
  bucket: string;
  completed: string;
  failed: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateQueueBody {
  projectId: string | number;
  name: string;
  priority?: number;
  concurrency?: number;
  retryPolicy?: {
    strategy: string;
    maxAttempts: number;
    delaySeconds: number;
  };
}

export interface CreateJobBody {
  queueId: string | number;
  payload?: Record<string, unknown>;
  priority?: number;
  scheduledTime?: string;
  cronExpression?: string;
  idempotencyKey?: string;
}
