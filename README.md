# Codity Jobs

> A production-grade distributed job scheduling platform. Execute background jobs reliably across multiple workers with atomic claiming, retry strategies, Dead Letter Queue support, and a real-time React dashboard.

---

## Evaluator Demo & Login Credentials

To immediately evaluate the platform with a rich, production-scale synthetic dataset (including **6 organizations, 15 projects, 25 queues, 12 global workers, 200+ completed jobs with execution histories, 80 queued jobs, 30 scheduled cron jobs, and 25 Dead Letter Queue items with deep JSON stack traces**), log into the dashboard (`http://localhost:5173`) using:

* **Email:** `demo@codity.ai`
* **Password:** `Password123!`

> [!IMPORTANT]
> **Multi-Tenant Isolation Notice:** Per system design requirements, Codity Jobs enforces strict tenant isolation. Each user account owns its own organizations and job queues. If you register a new account or log in with different credentials, you will start with an empty workspace so you can create your own private queues. To view the pre-seeded production demonstration data, please log in with the demo credentials above!

---

## Table of Contents

- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Worker Service](#worker-service)
- [Scheduler Service](#scheduler-service)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)
- [Design Decisions](#design-decisions)

---

## Architecture

```
User
 └─► React Dashboard (port 5173)
      └─► Express REST API (port 3000)
           ├─► JWT Authentication
           └─► PostgreSQL Database
                ▲
                ├── Scheduler Service (promotes scheduled/cron jobs)
                ├── Worker Service 1  ─ poll → claim → execute → log
                ├── Worker Service 2  ─ poll → claim → execute → log
                └── Worker Service N  ─ poll → claim → execute → log
```

**Key technology choices:**

| Component | Technology | Reason |
|---|---|---|
| API | Express.js + TypeScript | Lightweight, battle-tested, typed |
| Database | PostgreSQL 15 | ACID transactions, `FOR UPDATE SKIP LOCKED` |
| Job queue | PostgreSQL (no broker) | Eliminates Redis/RabbitMQ operational overhead |
| Auth | JWT (bcrypt + jsonwebtoken) | Stateless — works across distributed workers |
| Monorepo | npm workspaces | Shared types without duplication |
| Tests | Vitest + Supertest | Fast, ESM-native |

---

## Quick Start

### Prerequisites

- **Node.js 20+**
- **Docker & Docker Compose**

### 1. Clone and install

```bash
git clone <repo-url>
cd codity-jobs
npm install
```

### 2. Start PostgreSQL

```bash
docker-compose up postgres -d
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — the defaults work for local development
```

### 4. Run database migrations

```bash
npm run migrate --workspace=packages/api
```

### 5. Start the API

```bash
npm run dev:api
# → API running at http://localhost:3000
```

### 6. Start a worker

```bash
npm run dev:worker
# → Worker registered, polling for jobs
```

### 7. Start the dashboard

```bash
npm run dev:dashboard
# → Dashboard at http://localhost:5173
```

### Run everything with Docker

```bash
docker-compose up --build
```

---

## Project Structure

```
codity-jobs/
├── packages/
│   ├── api/                    # Express REST API
│   │   ├── src/
│   │   │   ├── config/         # Database pool, env config
│   │   │   ├── db/
│   │   │   │   ├── migrations/ # SQL migration files
│   │   │   │   └── migrate.ts  # Migration runner
│   │   │   ├── middleware/     # Auth, validation, error handling
│   │   │   ├── modules/
│   │   │   │   ├── auth/       # Register, login, JWT
│   │   │   │   ├── organizations/
│   │   │   │   ├── projects/
│   │   │   │   ├── queues/     # Queue CRUD + retry policies
│   │   │   │   ├── jobs/       # All job types + DLQ
│   │   │   │   ├── workers/    # Worker status
│   │   │   │   └── metrics/    # Throughput + health
│   │   │   ├── utils/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   └── tests/
│   │
│   ├── worker/                 # Worker service
│   │   ├── src/
│   │   │   ├── config/         # DB pool, env
│   │   │   ├── executor/       # Job handler registry
│   │   │   ├── retry/          # Backoff strategies
│   │   │   ├── types/
│   │   │   ├── worker.ts       # Main poll loop
│   │   │   └── scheduler.ts    # Cron + delayed job promoter
│   │   └── tests/
│   │
│   ├── dashboard/              # React + Vite dashboard
│   └── shared/                 # Shared TypeScript types
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Database Schema

See `packages/api/src/db/migrations/001_initial_schema.sql` for the full annotated schema.

### Tables

| Table | Purpose |
|---|---|
| `users` | Identity and authentication |
| `organizations` | Top-level tenant grouping |
| `projects` | Logical scope within an org |
| `queues` | Named job queues with config |
| `retry_policies` | Per-queue retry configuration |
| `jobs` | Central job table (the queue) |
| `scheduled_jobs` | Cron expressions and next_run |
| `workers` | Registered worker processes |
| `worker_heartbeats` | Periodic health signals |
| `job_executions` | One row per attempt |
| `job_logs` | Structured logs per execution |
| `dead_letter_queue` | Permanently failed jobs |

### Critical index

The worker poll relies on this composite index for sub-millisecond queue scans:

```sql
CREATE INDEX idx_jobs_poll ON jobs (
  queue_id, status, priority DESC, scheduled_time ASC NULLS FIRST
) WHERE status IN ('queued', 'retrying');
```

---

## API Reference

Base URL: `http://localhost:3000/api/v1`

### Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account, returns JWT |
| POST | `/auth/login` | Authenticate, returns JWT |
| GET | `/auth/me` | Get current user profile |

All other endpoints require `Authorization: Bearer <token>`.

### Organizations

| Method | Path | Description |
|---|---|---|
| GET | `/organizations` | List owned organizations |
| POST | `/organizations` | Create organization |
| GET | `/organizations/:id` | Get organization |
| PATCH | `/organizations/:id` | Update name |
| DELETE | `/organizations/:id` | Delete (cascades to projects/queues/jobs) |

### Queues

| Method | Path | Description |
|---|---|---|
| GET | `/queues?projectId=` | List queues in project |
| POST | `/queues` | Create queue (with optional retry policy) |
| PATCH | `/queues/:id` | Update queue config |
| DELETE | `/queues/:id` | Delete queue |
| POST | `/queues/:id/pause` | Pause queue |
| POST | `/queues/:id/resume` | Resume queue |
| GET | `/queues/:id/stats` | Job counts by status |
| PUT | `/queues/:id/retry-policy` | Upsert retry policy |

### Jobs

| Method | Path | Description |
|---|---|---|
| POST | `/jobs` | Create job (immediate, delayed, or cron) |
| POST | `/jobs/batch` | Create up to 500 jobs in one request |
| GET | `/jobs?queueId=&status=` | List jobs (paginated) |
| GET | `/jobs/:id` | Get job with execution history |
| POST | `/jobs/:id/cancel` | Cancel queued/scheduled job |
| POST | `/jobs/:id/requeue` | Requeue failed/dead job |
| GET | `/jobs/:id/logs` | Get execution logs |
| GET | `/jobs/dlq?queueId=` | List Dead Letter Queue entries |

#### Creating job types

```json
// Immediate job
{ "queueId": 1, "payload": { "type": "send_email", "to": "user@example.com" } }

// Delayed job (runs after 10 minutes)
{ "queueId": 1, "payload": { "type": "noop" }, "scheduledTime": "2024-12-01T12:00:00Z" }

// Recurring cron job (every 5 minutes)
{ "queueId": 1, "payload": { "type": "noop" }, "cronExpression": "*/5 * * * *" }

// Idempotent job (won't create duplicate)
{ "queueId": 1, "payload": { "type": "noop" }, "idempotencyKey": "unique-key-123" }
```

### Metrics

| Method | Path | Description |
|---|---|---|
| GET | `/metrics/overview` | System-wide job + worker counts |
| GET | `/metrics/queues` | Per-queue throughput stats |
| GET | `/metrics/throughput?hours=24` | Hourly job completion chart data |
| GET | `/metrics/workers` | Per-worker performance stats |

---

## Worker Service

The worker implements **exactly** the flow from the worker processing flowchart:

1. **Register** → inserts a row into `workers` table
2. **Poll** → `SELECT FOR UPDATE SKIP LOCKED` on `jobs` table
3. **Claim** → atomically transitions `queued → claimed → running`
4. **Execute** → dispatches to registered job handler
5. **Success** → marks `completed`, stores execution log
6. **Failure**:
   - Fetches retry policy for the queue
   - If attempts remaining: calculates backoff delay, sets `status = 'retrying'`
   - If max exceeded: sets `status = 'dead'`, inserts DLQ record
7. **Heartbeat** → emits CPU/memory stats every 30s
8. **Shutdown** → waits for active jobs, marks worker `offline`

### Retry strategies

| Strategy | Formula | Example (base=60s) |
|---|---|---|
| `fixed` | `base` | Always 60s |
| `linear` | `attempt × base` | 60s, 120s, 180s... |
| `exponential` | `base × 2^(attempt-1)` | 60s, 120s, 240s... |

All strategies add ±10% random jitter to prevent thundering-herd retries.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `PORT` | `3000` | API server port |
| `JWT_SECRET` | — | JWT signing secret (min 32 chars in prod) |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `WORKER_POLL_INTERVAL_MS` | `2000` | Idle poll wait |
| `WORKER_HEARTBEAT_INTERVAL_MS` | `30000` | Heartbeat frequency |
| `WORKER_CONCURRENCY` | `5` | Max simultaneous jobs per worker |
| `WORKER_STALE_THRESHOLD_MS` | `90000` | Heartbeat timeout before worker marked offline |
| `SCHEDULER_TICK_INTERVAL_MS` | `60000` | Scheduler tick frequency |

---

## Running Tests

```bash
# All tests
npm run test

# Worker unit tests (backoff strategies)
npm run test --workspace=packages/worker

# API integration tests
npm run test --workspace=packages/api
```

---

## Design Decisions

### PostgreSQL as the job queue

We use `SELECT FOR UPDATE SKIP LOCKED` instead of a dedicated message broker (Redis, RabbitMQ). This means:

- **No additional infrastructure** — one PostgreSQL instance runs everything
- **ACID guarantees** — job state transitions are transactional
- **Simpler operations** — one system to monitor and back up
- **Slightly higher DB load** under extreme scale — acceptable for most use cases

### Atomic job claiming

The claim transaction does three things atomically:

```sql
BEGIN;
SELECT * FROM jobs WHERE status IN ('queued','retrying') ... FOR UPDATE SKIP LOCKED;
UPDATE jobs SET status = 'claimed', attempt_count = attempt_count + 1;
INSERT INTO job_executions (...);
UPDATE jobs SET status = 'running';
COMMIT;
```

`SKIP LOCKED` means concurrent workers silently skip already-locked rows, preventing any double-execution without blocking.

### Retry jitter

All backoff strategies add ±10% random jitter. Without jitter, a thundering-herd of retries from many workers all failing simultaneously would create retry spikes that hit the database at exactly the same intervals. Jitter spreads these out.

### Monorepo workspace layout

All three packages (`api`, `worker`, `shared`) live in one repository with shared TypeScript types in `@codity/shared`. This eliminates type drift between the API contract and worker consumption — both import from the same source.
