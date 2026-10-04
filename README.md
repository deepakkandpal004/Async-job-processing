# Async Job Processing — Test Console (frontend)

A tiny React dashboard for testing the `async-job-processing` backend.
**It only calls the backend's HTTP API — no backend code was changed.**

## Run

Terminal 1 — backend (needs Postgres + Redis running, `backend/.env` configured):

```bash
cd ../backend
npm install
npx prisma db push
npx prisma generate
npm run dev              # API on http://localhost:3000
```

Terminal 2 — worker:

```bash
cd ../backend
npm run worker            # starts the job worker
```

Terminal 3 — this frontend:

```bash
cd frontend
npm install
npm run dev               # UI on http://localhost:5173
```

## Use

1. Paste your `ADMIN_API_KEY` (from backend `.env`) into the **Admin key** field in the top bar.
   The Jobs list, job detail, Dead letter tab and manual retry all need it
   (backend uses `Authorization: Bearer <key>`).
2. **Jobs** — live list with status/type filters, auto-refresh every 2s. Click a row for full detail
   (payload, fencing token, lease, attempts, errors). Cancel queued jobs inline.
3. **Create job** — enqueue with type, idempotent key, priority, delay, payload JSON.
   Submit the same idempotent key twice to verify dedupe.
4. **Dead letter** — DEAD jobs with last error + one-click manual retry (`POST /admin/jobs/:id/retry`).
5. **Test scenarios** — one-click enqueue for:
   - Happy path (completes; worker simulates ~20s of work)
   - `RETRY_TEST` (retryable failure → backoff retries → DEAD)
   - `PERMANENT_TEST` (fails immediately, no retry)
   - Delayed job (QUEUED for 60s before becoming available)

## Notes

- Worker concurrency, retry delays, lease (10s) and heartbeat (5s) come from backend `.env`.
- Kill the worker mid-job to watch recovery requeue it; run with
  `ENABLE_HEARTBEAT=false` to watch the fencing token block a stale worker.
- Prometheus metrics: backend `:3000/metrics`, worker metrics server `:3001`.
