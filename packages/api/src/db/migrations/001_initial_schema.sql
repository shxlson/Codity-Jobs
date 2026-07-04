-- =============================================================================
--  Migration: 001_initial_schema
--  Description: Creates the complete database schema for Codity Jobs.
--
--  Tables (in dependency order):
--    1.  users
--    2.  organizations
--    3.  projects
--    4.  queues
--    5.  retry_policies
--    6.  jobs
--    7.  scheduled_jobs
--    8.  workers
--    9.  worker_heartbeats
--    10. job_executions
--    11. job_logs
--    12. dead_letter_queue
--    13. migrations (schema versioning)
--
--  Run via: npm run migrate --workspace=packages/api
-- =============================================================================

BEGIN;

-- ── Extensions ────────────────────────────────────────────────────────────────

-- pgcrypto provides gen_random_uuid() which we use for idempotency keys
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Custom Enum Types ─────────────────────────────────────────────────────────

CREATE TYPE job_status AS ENUM (
  'queued',
  'scheduled',
  'claimed',
  'running',
  'completed',
  'failed',
  'retrying',
  'dead'
);

CREATE TYPE retry_strategy AS ENUM (
  'fixed',
  'linear',
  'exponential'
);

CREATE TYPE worker_status AS ENUM (
  'active',
  'idle',
  'draining',
  'offline'
);

CREATE TYPE execution_status AS ENUM (
  'running',
  'completed',
  'failed'
);

CREATE TYPE log_level AS ENUM (
  'debug',
  'info',
  'warn',
  'error'
);

-- =============================================================================
--  TABLE: users
--  Central identity table. One user can own many organizations.
-- =============================================================================
CREATE TABLE users (
  user_id       BIGSERIAL    PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users              IS 'Application users. A user owns one or more organizations.';
COMMENT ON COLUMN users.email        IS 'Unique email used for authentication.';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash — never store plaintext passwords.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Lookup by email is the most common query (login, uniqueness check)
CREATE UNIQUE INDEX idx_users_email ON users (email);

-- =============================================================================
--  TABLE: organizations
--  A user owns an organization; an org contains many projects.
-- =============================================================================
CREATE TABLE organizations (
  organization_id BIGSERIAL    PRIMARY KEY,
  owner_id        BIGINT       NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE organizations IS 'Top-level organizational unit. Owned by one user.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_organizations_owner ON organizations (owner_id);

-- =============================================================================
--  TABLE: projects
--  A project belongs to one organization and owns many queues.
-- =============================================================================
CREATE TABLE projects (
  project_id      BIGSERIAL    PRIMARY KEY,
  organization_id BIGINT       NOT NULL REFERENCES organizations (organization_id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_projects_org_name UNIQUE (organization_id, name)
);

COMMENT ON TABLE projects IS 'Logical grouping of queues within an organization.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_projects_organization ON projects (organization_id);

-- =============================================================================
--  TABLE: queues
--  A queue belongs to one project. Holds configuration for job processing.
-- =============================================================================
CREATE TABLE queues (
  queue_id    BIGSERIAL    PRIMARY KEY,
  project_id  BIGINT       NOT NULL REFERENCES projects (project_id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  -- Higher priority queues are polled first by the worker
  priority    INT          NOT NULL DEFAULT 0,
  -- Maximum number of jobs that can run simultaneously for this queue
  concurrency INT          NOT NULL DEFAULT 1,
  -- When paused, workers will not pick up new jobs from this queue
  paused      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_queues_project_name UNIQUE (project_id, name),
  CONSTRAINT chk_queues_concurrency CHECK (concurrency >= 1),
  CONSTRAINT chk_queues_priority    CHECK (priority >= 0)
);

COMMENT ON TABLE  queues             IS 'Named queue owned by a project. Controls job execution behavior.';
COMMENT ON COLUMN queues.concurrency IS 'Max concurrent running jobs. Enforced by the worker at poll time.';
COMMENT ON COLUMN queues.paused      IS 'When true, workers skip this queue entirely.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_queues_project ON queues (project_id);
-- Worker polls by paused status and priority
CREATE INDEX idx_queues_poll ON queues (paused, priority DESC);

-- =============================================================================
--  TABLE: retry_policies
--  Each queue has at most one retry policy. Controls retry behavior for
--  failed jobs in that queue.
-- =============================================================================
CREATE TABLE retry_policies (
  policy_id      BIGSERIAL      PRIMARY KEY,
  queue_id       BIGINT         NOT NULL REFERENCES queues (queue_id) ON DELETE CASCADE,
  strategy       retry_strategy NOT NULL DEFAULT 'exponential',
  max_attempts   INT            NOT NULL DEFAULT 3,
  -- Base delay in seconds. Interpretation depends on strategy:
  --   fixed:       always wait delay_seconds
  --   linear:      wait attempt * delay_seconds
  --   exponential: wait delay_seconds * 2^(attempt-1)
  delay_seconds  INT            NOT NULL DEFAULT 60,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_retry_policy_queue UNIQUE (queue_id),
  CONSTRAINT chk_retry_max_attempts CHECK (max_attempts >= 1),
  CONSTRAINT chk_retry_delay        CHECK (delay_seconds >= 0)
);

COMMENT ON TABLE  retry_policies          IS 'One retry policy per queue. Absent = no retries (fail immediately).';
COMMENT ON COLUMN retry_policies.strategy IS 'fixed | linear | exponential — controls backoff calculation.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX idx_retry_policies_queue ON retry_policies (queue_id);

-- =============================================================================
--  TABLE: jobs
--  Central job table. The worker polls this table for claimable work.
--
--  CRITICAL QUERY (worker poll):
--    SELECT * FROM jobs
--    WHERE queue_id = $1
--      AND status = 'queued'
--      AND (scheduled_time IS NULL OR scheduled_time <= NOW())
--    ORDER BY priority DESC, created_at ASC
--    LIMIT $2
--    FOR UPDATE SKIP LOCKED;
-- =============================================================================
CREATE TABLE jobs (
  job_id         BIGSERIAL    PRIMARY KEY,
  queue_id       BIGINT       NOT NULL REFERENCES queues (queue_id) ON DELETE CASCADE,
  status         job_status   NOT NULL DEFAULT 'queued',
  -- Arbitrary JSON payload delivered to the job executor
  payload        JSONB        NOT NULL DEFAULT '{}',
  -- Higher priority = processed sooner within the same queue
  priority       INT          NOT NULL DEFAULT 0,
  -- NULL = immediate; future timestamp = delayed/scheduled execution
  scheduled_time TIMESTAMPTZ,
  -- Tracks how many execution attempts have been made
  attempt_count  INT          NOT NULL DEFAULT 0,
  -- Optional idempotency key to prevent duplicate job submission
  idempotency_key VARCHAR(255),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_jobs_priority      CHECK (priority >= 0),
  CONSTRAINT chk_jobs_attempt_count CHECK (attempt_count >= 0),
  CONSTRAINT uq_jobs_idempotency    UNIQUE (queue_id, idempotency_key)
);

COMMENT ON TABLE  jobs                  IS 'Core job table. Workers atomically claim rows using SELECT FOR UPDATE SKIP LOCKED.';
COMMENT ON COLUMN jobs.status           IS 'Job lifecycle state — see job_status enum.';
COMMENT ON COLUMN jobs.payload          IS 'JSONB payload delivered to the executor. Supports indexing on keys.';
COMMENT ON COLUMN jobs.attempt_count    IS 'Incremented each time a worker attempts this job.';
COMMENT ON COLUMN jobs.idempotency_key  IS 'Optional caller-provided key to prevent duplicate job creation.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- PRIMARY worker poll index — composite covering all WHERE/ORDER BY clauses
-- This is the most performance-critical index in the system
CREATE INDEX idx_jobs_poll ON jobs (
  queue_id,
  status,
  priority DESC,
  scheduled_time ASC NULLS FIRST
) WHERE status IN ('queued', 'retrying');

-- Scheduler sweep index — find scheduled jobs whose time has come
CREATE INDEX idx_jobs_scheduled_sweep ON jobs (scheduled_time)
  WHERE status = 'scheduled';

-- General status filter (for API job listing)
CREATE INDEX idx_jobs_status ON jobs (status);
CREATE INDEX idx_jobs_created_at ON jobs (created_at DESC);

-- =============================================================================
--  TABLE: scheduled_jobs
--  Tracks recurring (cron) jobs. The scheduler service reads next_run and
--  either promotes a job to 'queued' or spawns a new job instance.
-- =============================================================================
CREATE TABLE scheduled_jobs (
  schedule_id     BIGSERIAL    PRIMARY KEY,
  -- The template job that gets cloned on each tick
  job_id          BIGINT       NOT NULL REFERENCES jobs (job_id) ON DELETE CASCADE,
  cron_expression VARCHAR(255) NOT NULL,
  next_run        TIMESTAMPTZ  NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  scheduled_jobs               IS 'Cron schedule definitions. The scheduler creates a new job instance per tick.';
COMMENT ON COLUMN scheduled_jobs.cron_expression IS 'Standard 5-field cron expression (e.g. "*/5 * * * *").';
COMMENT ON COLUMN scheduled_jobs.next_run       IS 'UTC timestamp of the next scheduled execution. Indexed for fast scheduler lookups.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_scheduled_jobs_next_run ON scheduled_jobs (next_run);

-- =============================================================================
--  TABLE: workers
--  Each running worker process registers itself here on startup and
--  marks itself offline on shutdown.
-- =============================================================================
CREATE TABLE workers (
  worker_id   BIGSERIAL     PRIMARY KEY,
  hostname    VARCHAR(255)  NOT NULL,
  -- Process ID — helps correlate with OS-level metrics
  pid         INT,
  status      worker_status NOT NULL DEFAULT 'active',
  started_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- Set when the worker shuts down gracefully
  stopped_at  TIMESTAMPTZ
);

COMMENT ON TABLE workers IS 'One row per running worker process. Updated on heartbeat/shutdown.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_workers_status ON workers (status);

-- =============================================================================
--  TABLE: worker_heartbeats
--  Each worker emits a heartbeat every N seconds. Used to detect stale/
--  crashed workers (if last heartbeat > timeout, the worker is offline).
-- =============================================================================
CREATE TABLE worker_heartbeats (
  heartbeat_id   BIGSERIAL   PRIMARY KEY,
  worker_id      BIGINT      NOT NULL REFERENCES workers (worker_id) ON DELETE CASCADE,
  heartbeat_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cpu_usage      FLOAT,      -- 0.0–100.0 percent
  memory_usage   FLOAT       -- bytes used
);

COMMENT ON TABLE  worker_heartbeats            IS 'Periodic health signals from each worker process.';
COMMENT ON COLUMN worker_heartbeats.cpu_usage  IS 'Process CPU usage as a percentage (0–100).';
COMMENT ON COLUMN worker_heartbeats.memory_usage IS 'Process RSS memory in bytes.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Latest heartbeat per worker — used by stale-detection query
CREATE INDEX idx_worker_heartbeats_worker_time ON worker_heartbeats (worker_id, heartbeat_time DESC);

-- =============================================================================
--  TABLE: job_executions
--  Every attempt to run a job creates a new execution record.
--  Multiple executions per job are normal (retries).
-- =============================================================================
CREATE TABLE job_executions (
  execution_id BIGSERIAL        PRIMARY KEY,
  job_id       BIGINT           NOT NULL REFERENCES jobs (job_id) ON DELETE CASCADE,
  worker_id    BIGINT           NOT NULL REFERENCES workers (worker_id),
  attempt      INT              NOT NULL DEFAULT 1,
  status       execution_status NOT NULL DEFAULT 'running',
  started_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  -- Duration in milliseconds — computed and stored for fast metrics queries
  duration_ms  INT
);

COMMENT ON TABLE  job_executions           IS 'One row per job execution attempt. Retries produce multiple rows per job.';
COMMENT ON COLUMN job_executions.attempt   IS 'Attempt number starting at 1. Matches jobs.attempt_count at time of claim.';
COMMENT ON COLUMN job_executions.duration_ms IS 'Execution wall-clock duration in milliseconds.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_job_executions_job      ON job_executions (job_id);
CREATE INDEX idx_job_executions_worker   ON job_executions (worker_id);
CREATE INDEX idx_job_executions_status   ON job_executions (status);

-- =============================================================================
--  TABLE: job_logs
--  Structured log lines emitted during a job execution.
--  Linked to execution_id, not directly to job_id.
-- =============================================================================
CREATE TABLE job_logs (
  log_id       BIGSERIAL   PRIMARY KEY,
  execution_id BIGINT      NOT NULL REFERENCES job_executions (execution_id) ON DELETE CASCADE,
  level        log_level   NOT NULL DEFAULT 'info',
  message      TEXT        NOT NULL,
  -- Optional structured metadata (e.g. error details, progress)
  meta         JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  job_logs       IS 'Structured log lines produced during a job execution.';
COMMENT ON COLUMN job_logs.meta  IS 'Optional JSONB blob for structured context (stack traces, counters, etc.).';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_job_logs_execution  ON job_logs (execution_id);
CREATE INDEX idx_job_logs_created_at ON job_logs (created_at DESC);

-- =============================================================================
--  TABLE: dead_letter_queue
--  Jobs that have exhausted all retry attempts are moved here.
--  Operators can inspect failures and manually requeue if needed.
-- =============================================================================
CREATE TABLE dead_letter_queue (
  dlq_id    BIGSERIAL   PRIMARY KEY,
  job_id    BIGINT      NOT NULL REFERENCES jobs (job_id) ON DELETE CASCADE,
  reason    TEXT,
  -- Full error detail (stack trace, error message, etc.)
  error_detail JSONB,
  moved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  dead_letter_queue         IS 'Permanent failures. Inspect and requeue manually.';
COMMENT ON COLUMN dead_letter_queue.reason  IS 'Human-readable failure summary.';
COMMENT ON COLUMN dead_letter_queue.error_detail IS 'Full error context from the last failed execution.';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_dlq_job_id  ON dead_letter_queue (job_id);
CREATE INDEX idx_dlq_moved_at ON dead_letter_queue (moved_at DESC);

-- =============================================================================
--  TABLE: migrations
--  Simple schema version tracking. Each migration inserts one row.
-- =============================================================================
CREATE TABLE IF NOT EXISTS migrations (
  migration_id BIGSERIAL    PRIMARY KEY,
  name         VARCHAR(255) NOT NULL UNIQUE,
  applied_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Record this migration
INSERT INTO migrations (name) VALUES ('001_initial_schema');

COMMIT;
