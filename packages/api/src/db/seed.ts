// ─────────────────────────────────────────────────────────────────────────────
//  Production-Scale Database Seeder
//  Populates the database with rich, realistic synthetic data across all modules:
//  6 Organizations, 15 Projects, 25 Queues, 12 Workers, 200+ Completed Jobs,
//  80+ Queued Jobs, 30+ Scheduled Jobs, and 25+ DLQ items with deep error traces.
//
//  Usage: npm run seed
// ─────────────────────────────────────────────────────────────────────────────

import bcrypt from "bcryptjs";
import { query, closePool, withTransaction } from "../config/database";
import { logger } from "../utils/logger";

async function seed() {
  logger.info("🌱 Starting production-scale database seed...");

  await withTransaction(async (client) => {
    // 1. Create or get Demo User
    const email = "demo@codity.ai";
    const password = "Password123!";
    const passwordHash = await bcrypt.hash(password, 12);

    let userId: string;
    const existingUser = await client.query("SELECT user_id FROM users WHERE email = $1", [email]);
    if (existingUser.rowCount && existingUser.rowCount > 0) {
      userId = existingUser.rows[0].user_id;
      logger.info(`User ${email} already exists (id: ${userId})`);
    } else {
      const res = await client.query(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id",
        ["Demo Engineering Team", email, passwordHash]
      );
      userId = res.rows[0].user_id;
      logger.info(`Created demo user: ${email}`);
    }

    // Clean existing data for a fresh rich seed
    logger.info("Cleaning previous demo data for a fresh production seed...");
    await client.query("DELETE FROM organizations WHERE owner_id = $1", [userId]);
    await client.query("DELETE FROM scheduled_jobs");
    await client.query("DELETE FROM job_executions");
    await client.query("DELETE FROM job_logs");
    await client.query("DELETE FROM dead_letter_queue");
    await client.query("DELETE FROM jobs");
    await client.query("DELETE FROM queues");
    await client.query("DELETE FROM projects");
    await client.query("DELETE FROM workers");

    // 2. Create 6 Organizations
    const orgsData = [
      { name: "Acme Cloud Platform" },
      { name: "Global Fintech Operations" },
      { name: "Nebula AI & ML Labs" },
      { name: "HyperScale Media Network" },
      { name: "Vanguard E-Commerce Group" },
      { name: "Quantum Health Diagnostics" },
    ];
    const orgIds: string[] = [];
    for (const o of orgsData) {
      const res = await client.query(
        "INSERT INTO organizations (owner_id, name) VALUES ($1, $2) RETURNING organization_id",
        [userId, o.name]
      );
      orgIds.push(res.rows[0].organization_id);
    }
    logger.info(`Seeded ${orgIds.length} organizations`);

    // 3. Create 15 Projects across Organizations
    const projsData = [
      // Acme Cloud Platform
      { orgId: orgIds[0], name: "Core Messaging Engine", desc: "High-throughput email, SMS, and push notifications gateway" },
      { orgId: orgIds[0], name: "User Identity & Auth", desc: "SSO, OAuth2 token issuance, and MFA verification services" },
      { orgId: orgIds[0], name: "API Gateway & Rate Limiting", desc: "Edge routing, API token validation, and rate limit enforcement" },
      // Global Fintech Operations
      { orgId: orgIds[1], name: "Payment Settlement Pipeline", desc: "Daily banking reconciliation, ACH transfers, and SWIFT dispatch" },
      { orgId: orgIds[1], name: "Fraud Scoring Engine", desc: "Real-time transaction risk scoring and anomaly detection models" },
      { orgId: orgIds[1], name: "Stripe Webhook Reconciliation", desc: "Async processing of subscription renewals, disputes, and invoices" },
      // Nebula AI & ML Labs
      { orgId: orgIds[2], name: "LLM Embedding Generation", desc: "Vector embeddings pipeline using OpenAI text-embedding-3-large" },
      { orgId: orgIds[2], name: "Model Fine-Tuning Workers", desc: "GPU cluster job scheduling for LoRA and full weights fine-tuning" },
      { orgId: orgIds[2], name: "Vector Database Indexer", desc: "Pinecone and Milvus index shard updates and compaction" },
      // HyperScale Media Network
      { orgId: orgIds[3], name: "4K Video Transcoding", desc: "FFmpeg distributed encoding for H.264, HEVC, and AV1 bitrates" },
      { orgId: orgIds[3], name: "Image Compression & WebP", desc: "Dynamic thumbnail generation, WebP conversion, and S3 upload" },
      { orgId: orgIds[3], name: "Live Stream DVR Sharding", desc: "HLS segment archiving and CDN edge cache invalidation" },
      // Vanguard E-Commerce Group
      { orgId: orgIds[4], name: "Order Fulfillment & Routing", desc: "Warehouse dispatch, shipping label generation, and tracking sync" },
      { orgId: orgIds[4], name: "Inventory Sync & Catalog", desc: "Multi-channel inventory updates across Shopify, Amazon, and eBay" },
      // Quantum Health Diagnostics
      { orgId: orgIds[5], name: "Genomic Sequence Alignment", desc: "FASTQ read alignment and variant calling pipelines" },
    ];
    const projIds: string[] = [];
    for (const p of projsData) {
      const res = await client.query(
        "INSERT INTO projects (organization_id, name, description) VALUES ($1, $2, $3) RETURNING project_id",
        [p.orgId, p.name, p.desc]
      );
      projIds.push(res.rows[0].project_id);
    }
    logger.info(`Seeded ${projIds.length} projects`);

    // 4. Create 25 Queues + Retry Policies
    const queuesData = [
      { projId: projIds[0], name: "transactional-emails", priority: 50, concurrency: 25, strategy: "fixed", max: 3, delay: 5, paused: false },
      { projId: projIds[0], name: "sms-otp-codes", priority: 100, concurrency: 50, strategy: "fixed", max: 2, delay: 2, paused: false },
      { projId: projIds[0], name: "push-notifications", priority: 20, concurrency: 30, strategy: "exponential", max: 4, delay: 10, paused: false },
      { projId: projIds[1], name: "oauth-token-revocation", priority: 80, concurrency: 10, strategy: "linear", max: 5, delay: 15, paused: false },
      { projId: projIds[1], name: "mfa-backup-codes", priority: 40, concurrency: 5, strategy: "fixed", max: 3, delay: 5, paused: false },
      { projId: projIds[2], name: "rate-limit-sync", priority: 90, concurrency: 20, strategy: "fixed", max: 3, delay: 1, paused: false },
      { projId: projIds[3], name: "ach-bank-transfers", priority: 75, concurrency: 5, strategy: "exponential", max: 5, delay: 120, paused: false },
      { projId: projIds[3], name: "swift-wire-dispatch", priority: 85, concurrency: 2, strategy: "exponential", max: 6, delay: 300, paused: false },
      { projId: projIds[4], name: "tx-risk-scoring", priority: 95, concurrency: 40, strategy: "linear", max: 3, delay: 5, paused: false },
      { projId: projIds[5], name: "stripe-webhook-events", priority: 60, concurrency: 35, strategy: "exponential", max: 8, delay: 15, paused: false },
      { projId: projIds[6], name: "embedding-batch-jobs", priority: 30, concurrency: 15, strategy: "exponential", max: 4, delay: 30, paused: false },
      { projId: projIds[7], name: "lora-finetuning-gpu", priority: 10, concurrency: 2, strategy: "linear", max: 2, delay: 60, paused: false },
      { projId: projIds[8], name: "pinecone-index-sync", priority: 25, concurrency: 8, strategy: "exponential", max: 5, delay: 20, paused: false },
      { projId: projIds[9], name: "ffmpeg-4k-encode", priority: 15, concurrency: 4, strategy: "linear", max: 3, delay: 60, paused: false },
      { projId: projIds[9], name: "av1-codec-transcode", priority: 5, concurrency: 2, strategy: "exponential", max: 3, delay: 120, paused: true },
      { projId: projIds[10], name: "webp-thumbnail-gen", priority: 35, concurrency: 20, strategy: "fixed", max: 3, delay: 5, paused: false },
      { projId: projIds[11], name: "hls-segment-archive", priority: 20, concurrency: 10, strategy: "exponential", max: 4, delay: 30, paused: false },
      { projId: projIds[12], name: "warehouse-dispatch", priority: 70, concurrency: 15, strategy: "exponential", max: 5, delay: 15, paused: false },
      { projId: projIds[12], name: "shipping-label-print", priority: 65, concurrency: 10, strategy: "fixed", max: 3, delay: 10, paused: false },
      { projId: projIds[13], name: "shopify-inventory-sync", priority: 45, concurrency: 25, strategy: "exponential", max: 6, delay: 20, paused: false },
      { projId: projIds[13], name: "amazon-catalog-update", priority: 40, concurrency: 12, strategy: "exponential", max: 5, delay: 30, paused: false },
      { projId: projIds[14], name: "fastq-read-alignment", priority: 8, concurrency: 3, strategy: "linear", max: 2, delay: 180, paused: false },
      { projId: projIds[14], name: "variant-calling-vcf", priority: 12, concurrency: 4, strategy: "exponential", max: 3, delay: 120, paused: false },
      { projId: projIds[0], name: "audit-log-shipper", priority: 1, concurrency: 10, strategy: "exponential", max: 10, delay: 60, paused: false },
      { projId: projIds[1], name: "gdpr-account-export", priority: 5, concurrency: 3, strategy: "linear", max: 3, delay: 45, paused: true },
    ];
    const queueIds: string[] = [];
    for (const q of queuesData) {
      const res = await client.query(
        "INSERT INTO queues (project_id, name, priority, concurrency, paused) VALUES ($1, $2, $3, $4, $5) RETURNING queue_id",
        [q.projId, q.name, q.priority, q.concurrency, q.paused]
      );
      const queueId = res.rows[0].queue_id;
      queueIds.push(queueId);
      await client.query(
        "INSERT INTO retry_policies (queue_id, strategy, max_attempts, delay_seconds) VALUES ($1, $2, $3, $4)",
        [queueId, q.strategy, q.max, q.delay]
      );
    }
    logger.info(`Seeded ${queueIds.length} queues with retry policies`);

    // 5. Seed 12 Synthetic Workers across global regions
    const workersData = [
      { host: "worker-us-east-1a", pid: 1042, status: "active", cpu: 24.5, mem: 142000000 },
      { host: "worker-us-east-1b", pid: 1892, status: "active", cpu: 68.2, mem: 412000000 },
      { host: "worker-us-west-2a", pid: 3041, status: "active", cpu: 45.1, mem: 289000000 },
      { host: "worker-eu-central-1a", pid: 4102, status: "active", cpu: 82.7, mem: 890000000 },
      { host: "worker-eu-central-1b", pid: 2088, status: "active", cpu: 31.4, mem: 198000000 },
      { host: "worker-eu-west-1a", pid: 5910, status: "idle", cpu: 2.1, mem: 85000000 },
      { host: "worker-ap-southeast-1a", pid: 6102, status: "active", cpu: 54.8, mem: 340000000 },
      { host: "worker-ap-northeast-1a", pid: 7219, status: "active", cpu: 71.9, mem: 510000000 },
      { host: "worker-gpu-cluster-01", pid: 8810, status: "active", cpu: 89.4, mem: 3400000000 },
      { host: "worker-gpu-cluster-02", pid: 8811, status: "draining", cpu: 14.2, mem: 1200000000 },
      { host: "worker-high-mem-01", pid: 9021, status: "active", cpu: 62.0, mem: 1850000000 },
      { host: "worker-batch-spot-01", pid: 9540, status: "offline", cpu: 0.0, mem: 0 },
    ];
    const workerIds: string[] = [];
    for (const w of workersData) {
      const res = await client.query(
        "INSERT INTO workers (hostname, pid, status) VALUES ($1, $2, $3) RETURNING worker_id",
        [w.host, w.pid, w.status]
      );
      const wId = res.rows[0].worker_id;
      workerIds.push(wId);
      if (w.status !== "offline") {
        await client.query(
          "INSERT INTO worker_heartbeats (worker_id, cpu_usage, memory_usage) VALUES ($1, $2, $3)",
          [wId, w.cpu, w.mem]
        );
      }
    }
    logger.info(`Seeded ${workerIds.length} workers with heartbeats`);

    // 6. Seed Jobs across all lifecycle states
    logger.info("Seeding 300+ synthetic jobs across all queues and states...");

    // A. 200 Completed Jobs (Historical throughput & charts)
    for (let i = 1; i <= 200; i++) {
      const qId = queueIds[i % queueIds.length];
      const createdAgoMinutes = Math.floor(Math.random() * 1440) + 5; // Up to 24h ago
      const durationMs = Math.floor(Math.random() * 2500) + 35;
      const attemptCount = Math.random() > 0.85 ? 2 : 1; // 15% required a retry before completing

      const startTime = new Date(Date.now() - createdAgoMinutes * 60 * 1000);
      const debugTime = new Date(startTime.getTime() + 10);
      const endTime = new Date(startTime.getTime() + durationMs);

      const jobRes = await client.query(
        `INSERT INTO jobs (queue_id, status, payload, priority, attempt_count, created_at)
         VALUES ($1, 'completed', $2, $3, $4, $5)
         RETURNING job_id`,
        [
          qId,
          JSON.stringify({ task_id: `job_exec_${10000 + i}`, customer_id: `cus_${500 + (i % 50)}`, region: i % 2 === 0 ? "us-east-1" : "eu-west-1", timestamp: Date.now() }),
          Math.floor(Math.random() * 50),
          attemptCount,
          startTime,
        ]
      );
      const jobId = jobRes.rows[0].job_id;
      const assignedWorker = workerIds[i % (workerIds.length - 1)];

      // If it retried, add a failed attempt 1 first
      if (attemptCount === 2) {
        const failTime = new Date(startTime.getTime() - 5000);
        const failExecRes = await client.query(
          `INSERT INTO job_executions (job_id, worker_id, attempt, status, started_at, completed_at, duration_ms)
           VALUES ($1, $2, 1, 'failed', $3, $4, 450)
           RETURNING execution_id`,
          [jobId, assignedWorker, failTime, new Date(failTime.getTime() + 450)]
        );
        await client.query(
          `INSERT INTO job_logs (execution_id, level, message, created_at)
           VALUES
           ($1, 'info', 'Job execution started (attempt 1)', $2),
           ($1, 'warn', 'Transient network timeout while contacting external API', $3),
           ($1, 'error', 'Attempt 1 failed. Scheduling retry with exponential backoff.', $3)`,
          [failExecRes.rows[0].execution_id, failTime, new Date(failTime.getTime() + 450)]
        );
      }

      // Add successful attempt execution record
      const execRes = await client.query(
        `INSERT INTO job_executions (job_id, worker_id, attempt, status, started_at, completed_at, duration_ms)
         VALUES ($1, $2, $3, 'completed', $4, $5, $6)
         RETURNING execution_id`,
        [jobId, assignedWorker, attemptCount, startTime, endTime, durationMs]
      );
      const execId = execRes.rows[0].execution_id;

      // Add detailed logs
      await client.query(
        `INSERT INTO job_logs (execution_id, level, message, created_at)
         VALUES
         ($1, 'info', 'Job execution started by worker process', $2),
         ($1, 'debug', 'Payload validated against JSON schema successfully', $3),
         ($1, 'info', 'Job completed successfully without errors', $4)`,
        [execId, startTime, debugTime, endTime]
      );
    }

    // B. 80 Queued Jobs (Ready for workers)
    for (let i = 1; i <= 80; i++) {
      const qId = queueIds[i % queueIds.length];
      await client.query(
        `INSERT INTO jobs (queue_id, status, payload, priority, attempt_count)
         VALUES ($1, 'queued', $2, $3, 0)`,
        [
          qId,
          JSON.stringify({ action: "process_transaction", order_id: `ord_${80000 + i}`, amount: (Math.random() * 500 + 10).toFixed(2), currency: "USD" }),
          Math.floor(Math.random() * 100),
        ]
      );
    }

    // C. 30 Scheduled Jobs (Future timestamps & cron expressions)
    for (let i = 1; i <= 30; i++) {
      const qId = queueIds[i % queueIds.length];
      const hoursFuture = (i % 24) + 1;
      const scheduledTime = new Date(Date.now() + hoursFuture * 3600 * 1000);
      const jobRes = await client.query(
        `INSERT INTO jobs (queue_id, status, payload, priority, scheduled_time, attempt_count)
         VALUES ($1, 'scheduled', $2, 50, $3, 0)
         RETURNING job_id`,
        [
          qId,
          JSON.stringify({ report_type: "recurring_billing_sync", interval: "daily", batch_size: 500, target_email: `billing_${i}@acme.com` }),
          scheduledTime,
        ]
      );
      const jobId = jobRes.rows[0].job_id;

      // Add to scheduled_jobs table with realistic cron expressions
      const crons = ["0 0 * * *", "*/15 * * * *", "0 */4 * * *", "0 2 * * 1", "30 23 * * *"];
      await client.query(
        `INSERT INTO scheduled_jobs (job_id, cron_expression, next_run)
         VALUES ($1, $2, $3)`,
        [jobId, crons[i % crons.length], scheduledTime]
      );
    }

    // D. 25 Dead Letter Queue (DLQ) Items (Rich permanent failures)
    const dlqErrors = [
      { reason: "StripeCardDeclinedError: Card declined due to insufficient funds", detail: { error: "StripeCardDeclinedError", code: "card_declined", decline_code: "insufficient_funds", charge_id: "ch_3M0291", attempts: 5 } },
      { reason: "OpenAIRateLimitError: 429 Too Many Requests on /v1/embeddings", detail: { error: "OpenAIRateLimitError", status: 429, endpoint: "https://api.openai.com/v1/embeddings", retry_after_ms: 60000, attempts: 4 } },
      { reason: "AWS S3 NoSuchBucket: Bucket 'acme-media-prod-backup' does not exist", detail: { error: "NoSuchBucket", bucket: "acme-media-prod-backup", region: "us-east-1", status_code: 404, attempts: 3 } },
      { reason: "SMTPAuthenticationError: Username and Password not accepted", detail: { error: "SMTPAuthenticationError", host: "smtp.mailgun.org", port: 587, code: 535, response: "5.7.8 Authentication failed", attempts: 3 } },
      { reason: "PostgresDeadlockDetected: Process 49281 waits for ShareLock", detail: { error: "DeadlockDetected", sql_state: "40P01", pid: 49281, blocked_by: 10294, query: "UPDATE accounts SET balance = balance - 100 WHERE id = 482" } },
      { reason: "RedisOutOfMemoryError: OOM command not allowed when used memory > 'maxmemory'", detail: { error: "RedisOutOfMemoryError", command: "LPUSH queue:transactional-emails", used_memory: "4.2GB", maxmemory: "4.0GB" } },
      { reason: "WebhookSignatureMismatch: HMAC SHA256 signature verification failed", detail: { error: "WebhookSignatureMismatch", endpoint: "https://api.shopify.com/webhooks/orders/create", header: "x-shopify-hmac-sha256", status: 401 } },
      { reason: "KubernetesPodEvicted: Pod worker-gpu-cluster-01 was evicted", detail: { error: "PodEvicted", reason: "EphemeralStoragePressure", pod: "worker-gpu-cluster-01-789c", node: "ip-10-0-4-19.ec2.internal" } },
      { reason: "SSLCertificateExpired: certificate has expired for domain api.partner-bank.io", detail: { error: "CERT_HAS_EXPIRED", valid_from: "2025-01-01T00:00:00Z", valid_to: "2026-06-30T23:59:59Z", host: "api.partner-bank.io" } },
      { reason: "SendGridAccountSuspended: 403 Forbidden - Account suspended for compliance", detail: { error: "SendGridError", status_code: 403, reason: "Compliance Review Required", ticket_id: "SG-99201" } },
      { reason: "TwilioSMSRateExceeded: Error 20429 - Too many requests sent to phone number", detail: { error: "TwilioError", code: 20429, more_info: "https://www.twilio.com/docs/errors/20429", destination: "+15558920192" } },
      { reason: "ElasticsearchClusterYellow: Index 'logs-2026-07' is yellow; shard unassigned", detail: { error: "ClusterHealthError", index: "logs-2026-07", status: "yellow", unassigned_shards: 2 } },
      { reason: "OAuthTokenExpiredError: Refresh token expired for Salesforce CRM", detail: { error: "OAuthTokenExpiredError", provider: "salesforce", org_id: "00D80000000aB2P", error_description: "expired access/refresh token" } },
      { reason: "FFmpegCodecNotSupported: Decoder for format 'prores' not found", detail: { error: "FFmpegError", exit_code: 1, stderr: "[prores @ 0x7f8d90] Decoder not found for codec prores", command: "ffmpeg -i input.mov output.mp4" } },
      { reason: "GitHubAPIAbuseLimit: Triggered abuse detection mechanism", detail: { error: "GitHubAbuseLimitError", status: 403, message: "You have triggered an abuse detection mechanism. Please wait a few minutes." } },
      { reason: "ShopifyRateLimitExceeded: Exceeded 40 requests per second bucket limit", detail: { error: "ShopifyRateLimitError", bucket_size: 40, leak_rate: "2/sec", status: 429 } },
      { reason: "MongoDBConnectionTimeout: Timed out after 10000ms while waiting for server", detail: { error: "MongoTimeoutError", topology: "ReplicaSetNoPrimary", servers: ["mongo-node-1:27017", "mongo-node-2:27017"] } },
      { reason: "ApplePushNotificationError: BadDeviceToken - Token is invalid or revoked", detail: { error: "APNSError", status: 400, reason: "BadDeviceToken", device_token: "8f9a2b1c3d4e..." } },
      { reason: "FirebaseMessagingQuotaExceeded: Daily message quota exceeded for project", detail: { error: "FCMQuotaExceeded", project_id: "codity-mobile-prod", quota_reset_time: "2026-07-05T00:00:00Z" } },
      { reason: "SlackWebhookRevoked: 404 Not Found - Webhook URL has been disabled or removed", detail: { error: "SlackWebhookError", status: 404, response_body: "invalid_token_or_channel" } },
      { reason: "DropboxAPIError: path/not_found/ - File or folder not found at specified path", detail: { error: "DropboxPathError", tag: "path_lookup/not_found", path: "/exports/2026/financial_summary.pdf" } },
      { reason: "PayPalTransactionRefused: INSTRUMENT_DECLINED - The payment method was declined", detail: { error: "PayPalError", name: "INSTRUMENT_DECLINED", debug_id: "8f9e0d1c2b3a", status: "DECLINED" } },
      { reason: "Auth0RateLimitExceeded: 429 Too Many Requests on Management API", detail: { error: "Auth0RateLimitError", limit: 10, remaining: 0, reset: 1720100000 } },
      { reason: "AzureBlobStorageTimeout: Request timed out while uploading block blob", detail: { error: "AzureBlobTimeoutError", container: "media-assets", blob: "video-transcode-4k-8921.mp4", timeout_ms: 120000 } },
      { reason: "BoxAPIAccessDenied: 403 Forbidden - User does not have permission to write folder", detail: { error: "BoxPermissionError", folder_id: "90218491", user_email: "service-account@codity.ai" } },
    ];

    for (let i = 0; i < dlqErrors.length; i++) {
      const qId = queueIds[i % queueIds.length];
      const err = dlqErrors[i];
      const createdAt = new Date(Date.now() - (i + 1) * 3600 * 1000);
      const movedAt = new Date(Date.now() - (i * 15 + 10) * 60 * 1000);

      const jobRes = await client.query(
        `INSERT INTO jobs (queue_id, status, payload, priority, attempt_count, created_at)
         VALUES ($1, 'dead', $2, 10, 5, $3)
         RETURNING job_id`,
        [qId, JSON.stringify({ dlq_item_id: `dlq_${9000 + i}`, failed_action: `execute_task_${i}`, payload_size: "24.8 KB", retries_exhausted: true }), createdAt]
      );
      const jobId = jobRes.rows[0].job_id;

      await client.query(
        `INSERT INTO dead_letter_queue (job_id, reason, error_detail, moved_at)
         VALUES ($1, $2, $3, $4)`,
        [jobId, err.reason, JSON.stringify(err.detail), movedAt]
      );
    }

    logger.info("✅ Production-scale database seed completed successfully!");
    console.log("\n─────────────────────────────────────────────────────────────────");
    console.log("  CODITY JOBS — PRODUCTION-SCALE SYNTHETIC DATA SEEDED");
    console.log("─────────────────────────────────────────────────────────────────");
    console.log("  Login Credentials:");
    console.log(`    Email:    ${email}`);
    console.log(`    Password: ${password}`);
    console.log("─────────────────────────────────────────────────────────────────");
    console.log("  Seeded Production Content:");
    console.log("    • 6 Organizations (Acme, Fintech, Nebula AI, Media, etc.)");
    console.log("    • 15 Projects with 25 Queues & configured Retry Policies");
    console.log("    • 12 Global Workers (US, EU, Asia, GPU clusters) with telemetry");
    console.log("    • 200 Completed jobs with multi-attempt histories & log traces");
    console.log("    • 80 Queued jobs ready for processing");
    console.log("    • 30 Scheduled future jobs with cron expressions");
    console.log("    • 25 Dead Letter Queue items with deep JSON stack traces");
    console.log("─────────────────────────────────────────────────────────────────\n");
  });
}

seed()
  .catch((err) => {
    logger.error("Seeder failed", { error: err.message, stack: err.stack });
    process.exit(1);
  })
  .finally(async () => {
    await closePool();
  });

