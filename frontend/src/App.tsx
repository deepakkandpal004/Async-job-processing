import { useCallback, useEffect, useRef, useState } from "react";
import { api, getAdminKey, getBaseUrl, randomKey, setAdminKey, setBaseUrl } from "./api";
import { STATUSES, type CreateJobInput, type Job, type JobStatus, type Pagination } from "./types";
import "./styles.css";

/* ---------------- helpers ---------------- */

const STATUS_CLASS: Record<JobStatus, string> = {
  QUEUED: "st-queued",
  PROCESSING: "st-processing",
  COMPLETED: "st-completed",
  FAILED: "st-failed",
  DEAD: "st-dead",
  CANCELLED: "st-cancelled",
};

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { hour12: false });
}

function useToast() {
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    setMsg({ text, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 4000);
  }, []);
  return { msg, show };
}

/* ---------------- header / settings ---------------- */

function Header({
  online,
  onBaseUrl,
  onAdminKey,
}: {
  online: boolean | null;
  onBaseUrl: (v: string) => void;
  onAdminKey: (v: string) => void;
}) {
  const [url, setUrl] = useState(getBaseUrl());
  const [key, setKey] = useState(getAdminKey());
  const [showKey, setShowKey] = useState(false);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">⚙</span>
        <div>
          <div className="brand-title">Job Queue — Test Console</div>
          <div className="brand-sub">async-job-processing backend tester</div>
        </div>
        <span className={`dot ${online === null ? "dot-idle" : online ? "dot-on" : "dot-off"}`} />
        <span className="online-text">
          {online === null ? "checking…" : online ? "API reachable" : "API unreachable"}
        </span>
      </div>
      <div className="settings">
        <label>
          API URL
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setBaseUrl(e.target.value);
              onBaseUrl(e.target.value);
            }}
            placeholder="(empty = proxy → :3000)"
            spellCheck={false}
          />
        </label>
        <label>
          Admin key
          <div className="keywrap">
            <input
              type={showKey ? "text" : "password"}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setAdminKey(e.target.value);
                onAdminKey(e.target.value);
              }}
              placeholder="ADMIN_API_KEY"
              spellCheck={false}
            />
            <button className="iconbtn" onClick={() => setShowKey((s) => !s)} title="show/hide">
              {showKey ? "🙈" : "👁"}
            </button>
          </div>
        </label>
      </div>
    </header>
  );
}

/* ---------------- job table ---------------- */

function JobTable({
  jobs,
  pagination,
  page,
  setPage,
  onSelect,
  onCancel,
  refreshing,
}: {
  jobs: Job[];
  pagination: Pagination | null;
  page: number;
  setPage: (p: number) => void;
  onSelect: (j: Job) => void;
  onCancel: (j: Job) => void;
  refreshing: boolean;
}) {
  if (jobs.length === 0) {
    return <div className="empty">No jobs found. Create one from the "Create job" tab.</div>;
  }
  return (
    <>
      <table className="jobs">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Status</th>
            <th>Pri</th>
            <th>Attempts</th>
            <th>Worker</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} onClick={() => onSelect(j)} className="row">
              <td className="mono" title={j.id}>{shortId(j.id)}</td>
              <td className="mono">{j.type}</td>
              <td><span className={`badge ${STATUS_CLASS[j.status]}`}>{j.status}</span></td>
              <td>{j.priority}</td>
              <td>{j.attempts}/{j.maxAttempts}</td>
              <td className="mono">{j.workerId ? shortId(j.workerId) : "—"}</td>
              <td className="mono small">{fmtTime(j.createdAt)}</td>
              <td>
                {j.status === "QUEUED" && (
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={refreshing}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancel(j);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && pagination.totalPages > 1 && (
        <div className="pager">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
          <span>Page {pagination.page} / {pagination.totalPages} ({pagination.total} total)</span>
          <button className="btn btn-sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next ›</button>
        </div>
      )}
    </>
  );
}

/* ---------------- job detail drawer ---------------- */

function JobDetail({ job, onClose }: { job: Job; onClose: () => void }) {
  const [full, setFull] = useState<Job | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.getJob(job.id).then((r) => setFull(r.data)).catch((e) => setErr(e.message));
  }, [job.id]);

  const j = full ?? job;
  const rows: [string, React.ReactNode][] = [
    ["ID", <span className="mono">{j.id}</span>],
    ["Type", <span className="mono">{j.type}</span>],
    ["Status", <span className={`badge ${STATUS_CLASS[j.status]}`}>{j.status}</span>],
    ["Priority", j.priority],
    ["Attempts", `${j.attempts} / ${j.maxAttempts}`],
    ["Worker", <span className="mono">{j.workerId ?? "—"}</span>],
    ["Fencing token", <span className="mono">{j.fencingToken}</span>],
    ["Lease until", <span className="mono small">{fmtTime(j.leaseUntil)}</span>],
    ["Available at", <span className="mono small">{fmtTime(j.availableAt)}</span>],
    ["Idempotent key", <span className="mono small">{j.idempotentKey}</span>],
    ["Timeout", j.timeoutMs ? `${j.timeoutMs} ms` : "—"],
    ["Last error", j.lastError ? <span className="err-text">{j.lastError}</span> : "—"],
    ["Dead at", <span className="mono small">{fmtTime(j.deadAt)}</span>],
    ["Created", <span className="mono small">{fmtTime(j.createdAt)}</span>],
    ["Updated", <span className="mono small">{fmtTime(j.updatedAt)}</span>],
  ];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>Job detail</h3>
          <button className="iconbtn" onClick={onClose}>✕</button>
        </div>
        {err && <div className="alert err">{err}</div>}
        <dl className="detail">
          {rows.map(([k, v]) => (
            <div key={k} className="drow"><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <h4>Payload</h4>
        <pre className="json">{JSON.stringify(j.payload, null, 2)}</pre>
      </div>
    </div>
  );
}

/* ---------------- create form ---------------- */

function CreateForm({ show }: ReturnType<typeof useToast>) {
  const [type, setType] = useState("EMAIL_SEND");
  const [key, setKey] = useState(randomKey());
  const [priority, setPriority] = useState(0);
  const [delay, setDelay] = useState(0);
  const [timeoutMs, setTimeoutMs] = useState("");
  const [payload, setPayload] = useState('{\n  "to": "test@example.com"\n}');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let parsed: unknown;
    try {
      parsed = payload.trim() ? JSON.parse(payload) : {};
    } catch {
      show("Payload is not valid JSON", "err");
      return;
    }
    const input: CreateJobInput = {
      type: type.trim(),
      payload: parsed,
      idempotentKey: key.trim(),
      priority,
      delay,
      ...(timeoutMs ? { timeoutMs: Number(timeoutMs) } : {}),
    };
    if (!input.type) return show("Type is required", "err");
    if (!input.idempotentKey) return show("Idempotent key is required", "err");
    setBusy(true);
    try {
      const r = await api.createJob(input);
      show(`Job created — ${r.data.id.slice(0, 8)}… (${r.data.status})`);
      setKey(randomKey());
    } catch (e) {
      show(e instanceof Error ? e.message : "Create failed", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h3>Create job <span className="hint">POST /jobs → 202</span></h3>
      <div className="grid2">
        <label>Type*
          <input value={type} onChange={(e) => setType(e.target.value)} spellCheck={false} />
        </label>
        <label>Idempotent key*
          <div className="keywrap">
            <input value={key} onChange={(e) => setKey(e.target.value)} spellCheck={false} />
            <button type="button" className="iconbtn" title="generate" onClick={() => setKey(randomKey())}>🎲</button>
          </div>
        </label>
        <label>Priority (-10 … 10)
          <input type="number" min={-10} max={10} value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
        </label>
        <label>Delay (ms)
          <input type="number" min={0} value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
        </label>
        <label>Timeout (ms, optional)
          <input type="number" min={0} value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value)} placeholder="30000" />
        </label>
      </div>
      <label>Payload (JSON)
        <textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={6} spellCheck={false} className="mono" />
      </label>
      <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Enqueue job"}</button>
      <p className="note">Same idempotent key twice → returns the existing job, no duplicate. That's the dedupe test.</p>
    </form>
  );
}

/* ---------------- dead letter ---------------- */

function DeadLetter({ show, refreshSignal }: ReturnType<typeof useToast> & { refreshSignal: number }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api.getDeadJobs().then((r) => setJobs(r.data)).catch((e) => show(e.message, "err"));
  }, [show]);

  useEffect(() => { load(); }, [load, refreshSignal]);

  async function retry(j: Job) {
    setBusy(j.id);
    try {
      await api.retryDeadJob(j.id);
      show(`Job ${shortId(j.id)} moved DEAD → QUEUED`);
      load();
    } catch (e) {
      show(e instanceof Error ? e.message : "Retry failed", "err");
    } finally {
      setBusy(null);
    }
  }

  if (jobs.length === 0) return <div className="empty">Dead-letter queue is empty. Nice.</div>;
  return (
    <div className="dlq">
      {jobs.map((j) => (
        <div key={j.id} className="card dlq-card">
          <div className="dlq-head">
            <span className="mono">{j.type}</span>
            <span className={`badge ${STATUS_CLASS.DEAD}`}>DEAD</span>
          </div>
          <div className="mono small dim" title={j.id}>{j.id}</div>
          <div className="err-text small">✖ {j.lastError ?? "unknown error"}</div>
          <div className="dlq-meta small dim">
            attempts {j.attempts}/{j.maxAttempts} · dead {fmtTime(j.deadAt)}
          </div>
          <button className="btn btn-sm" disabled={busy === j.id} onClick={() => retry(j)}>
            {busy === j.id ? "Retrying…" : "↻ Retry manually"}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- test scenarios ---------------- */

const SCENARIOS: { title: string; desc: string; type: string; key: string }[] = [
  {
    title: "Happy path",
    desc: "Completes normally. Worker simulates ~20s of work per job.",
    type: "TEST_SUCCESS",
    key: "happy",
  },
  {
    title: "Retryable failure",
    desc: "Fails with a retryable error → retried with exponential backoff + jitter → DEAD after max attempts.",
    type: "RETRY_TEST",
    key: "retry",
  },
  {
    title: "Permanent failure",
    desc: "Fails immediately with a permanent error — no retries, straight to FAILED.",
    type: "PERMANENT_TEST",
    key: "perm",
  },
  {
    title: "Delayed job",
    desc: "Queued but not available for 60s — stays QUEUED until availableAt passes.",
    type: "TEST_SUCCESS",
    key: "delayed",
  },
];

function Scenarios({ show }: ReturnType<typeof useToast>) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(s: (typeof SCENARIOS)[number]) {
    setBusy(s.key);
    try {
      const r = await api.createJob({
        type: s.type,
        payload: { scenario: s.key, at: new Date().toISOString() },
        idempotentKey: randomKey(s.key),
        priority: 0,
        delay: s.key === "delayed" ? 60000 : 0,
      });
      show(`${s.title}: enqueued ${r.data.id.slice(0, 8)}… — watch the Jobs tab`);
    } catch (e) {
      show(e instanceof Error ? e.message : "Failed", "err");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="cards">
      {SCENARIOS.map((s) => (
        <div key={s.key} className="card">
          <h4>{s.title}</h4>
          <p className="dim small">{s.desc}</p>
          <code className="mono small">type: {s.type}</code>
          <button className="btn btn-primary btn-sm" disabled={busy === s.key} onClick={() => run(s)}>
            {busy === s.key ? "Enqueueing…" : "▶ Run scenario"}
          </button>
        </div>
      ))}
      <div className="card warn">
        <h4>⚠ Heads up</h4>
        <p className="dim small">
          The worker sleeps ~20s per job (simulated work), and heartbeats every 5s with a 10s lease.
          Kill the worker mid-job to watch recovery requeue it; stop heartbeats (ENABLE_HEARTBEAT=false)
          to watch the fencing token block a stale worker.
        </p>
      </div>
    </div>
  );
}

/* ---------------- app ---------------- */

type Tab = "jobs" | "create" | "dead" | "scenarios";

export default function App() {
  const { msg, show } = useToast();
  const [tab, setTab] = useState<Tab>("jobs");
  const [online, setOnline] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [auto, setAuto] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Job | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.listJobs({
        page,
        limit: 20,
        ...(status ? { status } : {}),
        ...(typeFilter ? { type: typeFilter } : {}),
      });
      setJobs(r.data);
      setPagination(r.pagination);
    } catch (e) {
      show(e instanceof Error ? e.message : "Load failed", "err");
    } finally {
      setLoading(false);
    }
  }, [page, status, typeFilter, show]);

  const checkOnline = useCallback(async () => {
    setOnline(await api.ping());
  }, []);

  useEffect(() => { checkOnline(); }, [checkOnline]);
  useEffect(() => {
    if (tab !== "jobs") return;
    load();
    if (!auto) return;
    const id = window.setInterval(load, 2000);
    return () => window.clearInterval(id);
  }, [load, auto, tab, tick]);

  async function cancel(j: Job) {
    try {
      await api.cancelJob(j.id);
      show(`Job ${shortId(j.id)} cancelled`);
      setTick((t) => t + 1);
    } catch (e) {
      show(e instanceof Error ? e.message : "Cancel failed", "err");
    }
  }

  return (
    <div className="app">
      <Header
        online={online}
        onBaseUrl={() => { checkOnline(); setTick((t) => t + 1); }}
        onAdminKey={() => setTick((t) => t + 1)}
      />

      <nav className="tabs">
        {(["jobs", "create", "dead", "scenarios"] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "jobs" && "Jobs"}
            {t === "create" && "＋ Create job"}
            {t === "dead" && "Dead letter"}
            {t === "scenarios" && "Test scenarios"}
          </button>
        ))}
        {tab === "jobs" && (
          <label className="autorefresh">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            auto-refresh 2s
          </label>
        )}
      </nav>

      {msg && <div className={`toast ${msg.kind}`}>{msg.text}</div>}

      <main>
        {tab === "jobs" && (
          <>
            <div className="filters">
              <label>Status
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                  <option value="">all</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Type
                <input value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} placeholder="e.g. EMAIL_SEND" spellCheck={false} />
              </label>
              <button className="btn btn-sm" onClick={() => { load(); }} disabled={loading}>
                {loading ? "…" : "↻ Refresh"}
              </button>
            </div>
            <JobTable
              jobs={jobs}
              pagination={pagination}
              page={page}
              setPage={setPage}
              onSelect={setSelected}
              onCancel={cancel}
              refreshing={loading}
            />
          </>
        )}
        {tab === "create" && <CreateForm msg={msg} show={show} />}
        {tab === "dead" && <DeadLetter msg={msg} show={show} refreshSignal={tick} />}
        {tab === "scenarios" && <Scenarios msg={msg} show={show} />}
      </main>

      {selected && <JobDetail job={selected} onClose={() => setSelected(null)} />}

      <footer className="foot dim small">
        Backend untouched — this console only calls its HTTP API. Worker metrics (Prometheus) live on :3001, Grafana on :3005.
      </footer>
    </div>
  );
}
