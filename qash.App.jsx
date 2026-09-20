import { useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const KEYS = {
  url: "qashops.apiUrl",
  checks: "qashops.checklist",
  banner: "qashops.bannerDismissed",
};
const MAX_CHARS = 8000;
const TIMEOUT_MS = 30000;
const RISK_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

// This app is a public service: visitors never see or type an endpoint. Before you deploy, paste
// your API Gateway invoke URL below (it is not a secret, the server-side limits protect it).
// Only set SELF_HOST to true if you want the old "enter your own URL" field in the header.
const PUBLIC_API_URL = "";
const SELF_HOST = false;
const ENV_URL = PUBLIC_API_URL.trim();
const PUBLIC_MODE = !SELF_HOST;

const TABS = [
  { id: "audit", label: "Audit Engine", icon: "🛡️" },
  { id: "guide", label: "Self-Host Guide", icon: "📘" },
  { id: "arch", label: "Architecture & PRD", icon: "🏗️" },
  { id: "privacy", label: "Privacy & Security", icon: "🔒" },
];

const RISK = {
  CRITICAL: {
    label: "Critical",
    chip: "bg-red-500/10 text-red-300 ring-red-500/40",
    dot: "bg-red-400",
    glow: "shadow-[0_0_44px_-10px_rgba(239,68,68,0.6)]",
    edge: "border-l-red-500",
    pill: "bg-red-500/15 text-red-300",
    tag: "border-red-500/40 bg-red-500/10 text-red-300",
  },
  HIGH: {
    label: "High",
    chip: "bg-orange-500/10 text-orange-300 ring-orange-500/40",
    dot: "bg-orange-400",
    glow: "shadow-[0_0_44px_-10px_rgba(249,115,22,0.6)]",
    edge: "border-l-orange-500",
    pill: "bg-orange-500/15 text-orange-300",
    tag: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  },
  MEDIUM: {
    label: "Medium",
    chip: "bg-amber-500/10 text-amber-300 ring-amber-500/40",
    dot: "bg-amber-400",
    glow: "shadow-[0_0_44px_-10px_rgba(245,158,11,0.6)]",
    edge: "border-l-amber-500",
    pill: "bg-amber-500/15 text-amber-300",
    tag: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  LOW: {
    label: "Low",
    chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/40",
    dot: "bg-emerald-400",
    glow: "shadow-[0_0_44px_-10px_rgba(16,185,129,0.6)]",
    edge: "border-l-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-300",
    tag: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  UNKNOWN: {
    label: "Unknown",
    chip: "bg-slate-500/10 text-slate-300 ring-slate-500/40",
    dot: "bg-slate-400",
    glow: "",
    edge: "border-l-slate-500",
    pill: "bg-slate-500/15 text-slate-300",
    tag: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  },
};

const SAMPLES = [
  {
    id: "s3-public",
    name: "Public S3 Bucket Policy",
    expected: "CRITICAL",
    blurb: "Anonymous read and write on every object in a bucket.",
    code: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadWrite",
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::qash-demo-bucket/*"
    }
  ]
}`,
  },
  {
    id: "iam-admin",
    name: "Wildcard Admin IAM",
    expected: "HIGH",
    blurb: "Every action on every resource for the attached identity.",
    code: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "FullAdmin",
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    }
  ]
}`,
  },
  {
    id: "kms-open",
    name: "Overly Permissive KMS Key",
    expected: "MEDIUM",
    blurb: "An app role can use and administer the key with no conditions.",
    code: `{
  "Version": "2012-10-17",
  "Id": "key-policy-demo",
  "Statement": [
    {
      "Sid": "EnableRootAccountAccess",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::123456789012:root" },
      "Action": "kms:*",
      "Resource": "*"
    },
    {
      "Sid": "AppRoleFullKeyControl",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::123456789012:role/app-role" },
      "Action": "kms:*",
      "Resource": "*"
    }
  ]
}`,
  },
  {
    id: "s3-least",
    name: "Least-Privilege S3 Read",
    expected: "LOW",
    blurb: "Read-only access to one prefix, HTTPS required.",
    code: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadReportsOnly",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::qash-demo-bucket/reports/*",
      "Condition": { "Bool": { "aws:SecureTransport": "true" } }
    },
    {
      "Sid": "ListReportsPrefix",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::qash-demo-bucket",
      "Condition": { "StringLike": { "s3:prefix": "reports/*" } }
    }
  ]
}`,
  },
];

const CSS = `
@keyframes q-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes q-flow-x{0%{left:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{left:100%;opacity:0}}
@keyframes q-flow-y{0%{top:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{top:100%;opacity:0}}
.q-fade{animation:q-fade .3s ease-out both}
.q-flow-x{animation:q-flow-x 2.2s linear infinite}
.q-flow-y{animation:q-flow-y 2.2s linear infinite}
details>summary::-webkit-details-marker{display:none}
@media (prefers-reduced-motion:reduce){
  .q-fade,.q-flow-x,.q-flow-y,.animate-spin,.animate-ping,.animate-pulse{animation:none!important}
}
`;

const CARD = "rounded-2xl border border-slate-800 bg-slate-900/70";
const EDITOR_TEXT = "pt-3 font-mono text-[13px] leading-5";
const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const cx = (...a) => a.filter(Boolean).join(" ");

const store = {
  get(key, fallback = "") {
    try {
      const v = window.localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  },
};

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

const CATEGORY_RULES = [
  ["Public exposure", /public|anonymous|everyone|internet|any principal|principal.{0,20}\*|0\.0\.0\.0/i],
  ["Access control", /wildcard|\*|admin|privilege|permissive|least.privilege|mfa|escalat/i],
  ["Encryption", /encrypt|kms|tls|ssl|transport|https|rotation/i],
  ["Logging and monitoring", /logging|cloudtrail|monitor|audit trail|access log/i],
];

function categorize(text) {
  const hit = CATEGORY_RULES.find(([, re]) => re.test(text));
  return hit ? hit[0] : "General";
}

function inferSeverity(text, overall) {
  const t = text.toLowerCase();
  let idx = 0;
  if (/public|anonymous|anyone|internet|any principal|all principals|everyone|unrestricted|full (admin|access)|any resource|all resources|"\*"/.test(t)) idx = 3;
  else if (/wildcard|\*|admin|escalat|no mfa|without (a )?condition|overly permissive/.test(t)) idx = 2;
  else if (/missing|no condition|logging|encrypt|rotation|broad|permissive/.test(t)) idx = 1;
  const cap = RISK_ORDER.indexOf(overall);
  if (cap >= 0) idx = Math.min(idx, cap);
  return RISK_ORDER[idx];
}

function normalize(data) {
  const level = String(data.risk_level || "").toUpperCase();
  const overall = RISK_ORDER.includes(level) ? level : "UNKNOWN";
  const raw = Array.isArray(data.vulnerabilities)
    ? data.vulnerabilities
    : data.vulnerabilities
    ? [data.vulnerabilities]
    : [];
  const findings = raw.map((v) => {
    if (v && typeof v === "object") {
      const text = String(v.description || v.title || v.issue || JSON.stringify(v));
      const sev = String(v.severity || "").toUpperCase();
      return {
        text,
        category: v.category ? String(v.category) : categorize(text),
        severity: RISK_ORDER.includes(sev) ? sev : inferSeverity(text, overall),
      };
    }
    const text = String(v);
    return { text, category: categorize(text), severity: inferSeverity(text, overall) };
  });
  let cli = String(data.remediation_cli || "");
  if (!cli.includes("\n") && cli.includes("\\n")) cli = cli.replace(/\\n/g, "\n");
  return { level: overall, summary: String(data.summary || ""), findings, cli: cli.trim() };
}

async function callAudit(url, policy) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const started = performance.now();
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policy }),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw { kind: "timeout" };
    throw { kind: "network" };
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* handled below */
  }
  if (!res.ok) {
    throw {
      kind: "http",
      status: res.status,
      message: (data && (data.error || data.message)) || text.slice(0, 200),
    };
  }
  if (!data || typeof data !== "object") throw { kind: "parse" };
  if (typeof data.body === "string") {
    try {
      data = JSON.parse(data.body);
    } catch {
      throw { kind: "parse" };
    }
  }
  if (!data || !data.risk_level) throw { kind: "shape" };
  return { data, ms: Math.round(performance.now() - started) };
}

const CORS_HINTS = [
  "On the HTTP API, enable CORS: allow origin *, header content-type, and methods POST and OPTIONS.",
  "Make sure the URL starts with https:// and ends with your route, for example /audit.",
  "Open the browser console (F12) and check the Network tab. A blocked OPTIONS request confirms a CORS problem.",
];

function publicExplain(err) {
  const said = err.message || (err.status ? `The service answered with status ${err.status}.` : "");
  switch (err.kind) {
    case "no-url":
    case "bad-url":
      return { tone: "amber", title: "Service endpoint not set", message: "This copy of the app has no valid API address yet.", hints: ["Owner: paste your API Gateway invoke URL into PUBLIC_API_URL at the top of App.jsx and redeploy."] };
    case "network":
      return { tone: "red", title: "Could not reach the service", message: "Check your connection and try again. If it keeps happening, the service may be down.", hints: [] };
    case "timeout":
      return { tone: "red", title: "The analysis took too long", message: "Try again in a moment. Shorter policies finish faster.", hints: [] };
    case "parse":
    case "shape":
      return { tone: "red", title: "Unexpected response", message: "The service replied in a format this page does not understand. Please try again.", hints: [] };
    case "http":
      if (err.status === 429)
        return { tone: "amber", title: "Usage limit reached", message: said, hints: ["Limits keep this free service available to everyone and its running cost under control."] };
      if (err.status === 400 || err.status === 413) return { tone: "amber", title: "Input not accepted", message: said, hints: [] };
      if (err.status === 403) return { tone: "red", title: "Request blocked", message: said, hints: [] };
      return { tone: "red", title: "The service is having trouble", message: "Something failed on our side. Please try again shortly.", hints: [] };
    default:
      return null;
  }
}

function explain(e) {
  const err = e && e.kind ? e : { kind: "unknown", message: e && e.message };
  if (PUBLIC_MODE) {
    const p = publicExplain(err);
    if (p) return p;
  }
  switch (err.kind) {
    case "too-long":
      return {
        tone: "amber",
        title: "Policy is too long",
        message: `The limit is ${MAX_CHARS.toLocaleString()} characters. Trim it to the statements you want reviewed and run again.`,
        hints: ["Long input is rejected instead of cut off, because a truncated policy could hide the risky part."],
      };
    case "no-url":
      return {
        tone: "amber",
        title: "Add your API Gateway URL",
        message: "The audit needs an endpoint to call. Paste the invoke URL into the API URL field in the header.",
        hints: ["It looks like https://abc123.execute-api.us-east-1.amazonaws.com/audit", "Not deployed yet? The Quickstart tab walks through it."],
        guide: true,
      };
    case "bad-url":
      return {
        tone: "amber",
        title: "That URL does not look right",
        message: "Enter a full https:// address for your API Gateway route.",
        hints: ["Example: https://abc123.execute-api.us-east-1.amazonaws.com/audit"],
        guide: true,
      };
    case "no-policy":
      return {
        tone: "amber",
        title: "Nothing to analyze yet",
        message: "Paste a policy or template into the editor, or load one of the samples.",
        hints: [],
      };
    case "network":
      return {
        tone: "red",
        title: "Could not reach the API",
        message: "The browser stopped the request before any response came back. This is almost always a CORS setting or a wrong URL.",
        hints: CORS_HINTS,
        guide: true,
      };
    case "timeout":
      return {
        tone: "red",
        title: `No response after ${TIMEOUT_MS / 1000} seconds`,
        message: "The request timed out before Lambda finished.",
        hints: [
          "Set the Lambda timeout to 30 seconds. The HTTP API integration limit is also 30 seconds.",
          "Try again. The first call after idle time is slower because of the cold start.",
          "Check the Lambda logs in CloudWatch to see whether Bedrock is responding.",
        ],
        guide: true,
      };
    case "http": {
      const s = err.status;
      const said = err.message ? `The server said: ${err.message}` : `The API answered with status ${s}.`;
      if (s === 400)
        return { tone: "red", title: "The API rejected the request (400)", message: said, hints: ["The Lambda expects JSON shaped like { \"policy\": \"...\" }. Redeploy the Lambda from this project if you changed it."] };
      if (s === 401 || s === 403)
        return {
          tone: "red",
          title: `Access denied (${s})`,
          message: said,
          hints: [
            "Check the route for an authorizer or resource policy that blocks anonymous calls.",
            "If the message mentions AccessDeniedException, the Lambda role needs bedrock:InvokeModel and Bedrock access to Claude 3 Haiku.",
          ],
          guide: true,
        };
      if (s === 404)
        return { tone: "red", title: "Route not found (404)", message: said, hints: ["Confirm the API has a POST route for the path in your URL, or a $default route.", "Check the stage name if you created one other than $default."], guide: true };
      if (s === 413) return { tone: "amber", title: "Request too large (413)", message: said, hints: [`Keep the policy under ${MAX_CHARS.toLocaleString()} characters.`] };
      if (s === 429)
        return { tone: "amber", title: "Usage limit reached (429)", message: said, hints: ["Per-visitor or daily limits are protecting the endpoint. Wait and retry, or raise IP_PER_MIN, IP_PER_DAY, or GLOBAL_PER_DAY on the Lambda."] };
      if (s >= 500)
        return {
          tone: "red",
          title: `The backend failed (${s})`,
          message: said,
          hints: [
            "Run: aws logs tail /aws/lambda/qash-ops-audit --follow, then retry to see the error.",
            "Confirm Claude 3 Haiku access is enabled in Bedrock for us-east-1.",
            "A 500 straight from API Gateway often means it lacks permission to invoke the Lambda.",
          ],
          guide: true,
        };
      return { tone: "red", title: `Request failed (${s})`, message: said, hints: [] };
    }
    case "parse":
    case "shape":
      return {
        tone: "red",
        title: "Unexpected response format",
        message: "The API answered, but not with the audit JSON this app expects.",
        hints: ["The response must include risk_level, summary, vulnerabilities, and remediation_cli.", "Make sure the route points to the Qash-Ops Lambda and not another function."],
        guide: true,
      };
    default:
      return { tone: "red", title: "Something went wrong", message: err.message || "Unknown error.", hints: [] };
  }
}

function validateInputs(url, policy) {
  const u = url.trim();
  if (!u) return explain({ kind: "no-url" });
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    return explain({ kind: "bad-url" });
  }
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) return explain({ kind: "bad-url" });
  if (policy !== null && !policy.trim()) return explain({ kind: "no-policy" });
  if (policy !== null && policy.length > MAX_CHARS) return explain({ kind: "too-long" });
  return null;
}

const TOKEN = /(#.*$)|("(?:[^"\\]|\\.)*")(\s*:)?|(--[\w-]+)|(\baws\b)|(\b(?:true|false|null)\b)/g;

function highlight(line) {
  const out = [];
  let last = 0;
  let m;
  let i = 0;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [full, comment, str, colon, flag, cmd, kw] = m;
    let cls = "";
    if (comment) cls = "text-slate-500 italic";
    else if (str) cls = colon ? "text-cyan-300" : "text-emerald-300";
    else if (flag) cls = "text-amber-300";
    else if (cmd) cls = "font-semibold text-cyan-400";
    else if (kw) cls = "text-amber-200";
    out.push(
      <span key={i++} className={cls}>
        {full}
      </span>
    );
    last = m.index + full.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/* ------------------------------------------------------------------ */
/* Shared UI                                                          */
/* ------------------------------------------------------------------ */

function Spinner({ className = "h-4 w-4" }) {
  return <span aria-hidden="true" className={cx("inline-block animate-spin rounded-full border-2 border-current border-t-transparent", className)} />;
}

function CopyButton({ text, label = "Copy", doneLabel = "Copied", className = "" }) {
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  const onClick = async () => {
    const ok = await copyText(text);
    if (ok && mounted.current) {
      setDone(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 2000);
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-md border px-2.5 py-1 text-xs font-medium transition active:scale-95",
        FOCUS,
        done
          ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
          : "border-slate-700 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300",
        className
      )}
    >
      <span aria-live="polite">{done ? `✓ ${doneLabel}` : label}</span>
    </button>
  );
}

function CodeBlock({ code, title = "aws-cli", copyLabel = "Copy Commands", doneLabel = "Copied" }) {
  const lines = code.split("\n");
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-2">
        <span className="font-mono text-xs text-slate-500">{title}</span>
        <CopyButton text={code} label={copyLabel} doneLabel={doneLabel} />
      </div>
      <pre className="max-h-80 overflow-x-auto overflow-y-auto p-4 font-mono text-[13px] leading-6 text-slate-300">
        <code>
          {lines.map((l, i) => (
            <div key={i} className="whitespace-pre">
              {l === "" ? "\u00a0" : highlight(l)}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

const CALLOUT = {
  red: { box: "border-red-500/40 bg-red-500/10", title: "text-red-200", icon: "⛔" },
  amber: { box: "border-amber-500/40 bg-amber-500/10", title: "text-amber-200", icon: "⚠️" },
  cyan: { box: "border-cyan-500/30 bg-cyan-500/10", title: "text-cyan-200", icon: "ℹ️" },
  emerald: { box: "border-emerald-500/40 bg-emerald-500/10", title: "text-emerald-200", icon: "✅" },
};

function Callout({ tone = "cyan", title, children, onDismiss, role }) {
  const t = CALLOUT[tone];
  return (
    <div role={role} className={cx("flex gap-3 rounded-xl border p-4 text-sm", t.box)}>
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {t.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx("font-semibold", t.title)}>{title}</p>
        <div className="mt-1 space-y-2 text-slate-300">{children}</div>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className={cx("h-6 w-6 shrink-0 rounded text-slate-400 hover:text-white", FOCUS)}>
          ×
        </button>
      )}
    </div>
  );
}

function SectionTitle({ title, children }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
      {children && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">{children}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Audit Engine tab                                                   */
/* ------------------------------------------------------------------ */

const VALIDITY = {
  empty: { text: "Empty", dot: "bg-slate-600", cls: "text-slate-500" },
  json: { text: "Valid JSON", dot: "bg-emerald-400", cls: "text-emerald-300" },
  invalid: { text: "Invalid JSON, will still be analyzed", dot: "bg-amber-400", cls: "text-amber-300" },
  text: { text: "Template or YAML", dot: "bg-cyan-400", cls: "text-cyan-300" },
};

function AuditTab({ a }) {
  const { input, setInput, selected, setSelected, run, loading, result, error, ms, goTab, bannerOpen, dismissBanner } = a;
  const gutterRef = useRef(null);
  const [note, setNote] = useState("");

  const lineCount = Math.max(input.split("\n").length, 18);
  const over = input.length > MAX_CHARS;

  const validity = useMemo(() => {
    const t = input.trim();
    if (!t) return "empty";
    try {
      JSON.parse(t);
      return "json";
    } catch {
      return t.startsWith("{") || t.startsWith("[") ? "invalid" : "text";
    }
  }, [input]);

  const groups = useMemo(() => {
    if (!result) return [];
    const map = new Map();
    result.findings.forEach((f) => {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category).push(f);
    });
    const rank = (s) => RISK_ORDER.indexOf(s);
    return [...map.entries()]
      .map(([cat, items]) => [cat, items.sort((x, y) => rank(y.severity) - rank(x.severity))])
      .sort((x, y) => rank(y[1][0].severity) - rank(x[1][0].severity));
  }, [result]);

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setInput(t);
        setSelected(null);
        setNote("");
      }
    } catch {
      setNote("Clipboard access is blocked. Click the editor and press Ctrl+V (Cmd+V on Mac).");
    }
  };

  const v = VALIDITY[validity];
  const r = result ? RISK[result.level] : null;

  return (
    <div className="space-y-6">
      {bannerOpen && (
        <Callout tone="cyan" title="How the audit works" onDismiss={dismissBanner}>
          <p>
            Paste an IAM policy, an S3 or KMS policy, or a CloudFormation snippet. Your browser sends it to this service's API, a Lambda function asks Claude 3 Haiku on Amazon Bedrock to review it, and you get a risk level, findings, and AWS CLI fixes.
          </p>
          <p>Your policy is not stored. This free service has fair-use limits per visitor and per day. Never paste access keys, secrets, or tokens.</p>
        </Callout>
      )}

      <section aria-labelledby="samples-h">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="samples-h" className="text-sm font-semibold text-white">
            Sample policies
          </h2>
          <p className="text-xs text-slate-500">Tags show the risk we expect. The model may rate a policy differently.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SAMPLES.map((s) => {
            const active = selected === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setInput(s.code);
                  setSelected(s.id);
                  setNote("");
                }}
                aria-pressed={active}
                className={cx(
                  "group rounded-xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 active:scale-[0.99]",
                  FOCUS,
                  active
                    ? "border-cyan-400/60 bg-cyan-400/5 shadow-[0_0_28px_-10px_rgba(6,182,212,0.7)]"
                    : "border-slate-800 bg-slate-900/70 hover:border-slate-600"
                )}
              >
                <span className={cx("inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold", RISK[s.expected].tag)}>
                  {s.expected === "LOW" ? "Low, compliant" : `Expected: ${RISK[s.expected].label}`}
                </span>
                <p className="mt-2 text-sm font-semibold text-white">{s.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="editor-h" className="flex min-w-0 flex-col gap-4">
          <div className={cx(CARD, "overflow-hidden")}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <h2 id="editor-h" className="text-sm font-semibold text-white">
                  Policy or template
                </h2>
                <span className={cx("flex items-center gap-1.5 text-xs", v.cls)}>
                  <span className={cx("h-1.5 w-1.5 rounded-full", v.dot)} />
                  {v.text}
                </span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={paste} className={cx("rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-400/60 hover:text-cyan-300 active:scale-95", FOCUS)}>
                  Paste
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInput("");
                    setSelected(null);
                    setNote("");
                  }}
                  disabled={!input}
                  className={cx("rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-red-400/60 hover:text-red-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40", FOCUS)}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex h-[26rem] bg-slate-950/70">
              <div
                ref={gutterRef}
                aria-hidden="true"
                className={cx(EDITOR_TEXT, "select-none overflow-hidden border-r border-slate-800/80 pb-6 pl-3 pr-3 text-right text-slate-600")}
                style={{ width: `${String(lineCount).length + 4}ch` }}
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setSelected(null);
                }}
                onScroll={(e) => {
                  if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop;
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    run();
                  }
                }}
                wrap="off"
                spellCheck={false}
                aria-label="Policy or infrastructure template"
                placeholder="Paste an IAM policy, S3 bucket policy, KMS key policy, or CloudFormation snippet"
                className={cx(EDITOR_TEXT, "h-full min-w-0 flex-1 resize-none overflow-auto whitespace-pre bg-transparent pb-3 pl-3 pr-4 text-slate-200 placeholder-slate-600 outline-none")}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-2 text-xs">
              <span className={cx("tabular-nums", over ? "text-amber-300" : "text-slate-500")}>
                {input.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters{over ? ". Too long to analyze. Trim it to run." : ""}
              </span>
              <span className="text-slate-600">Ctrl+Enter to run</span>
            </div>
          </div>

          {note && (
            <p role="status" className="text-xs text-amber-300">
              {note}
            </p>
          )}

          <button
            type="button"
            onClick={run}
            disabled={loading || over}
            className={cx(
              "flex items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-semibold text-slate-950 transition duration-200",
              "shadow-[0_0_28px_rgba(6,182,212,0.4)] hover:shadow-[0_0_42px_rgba(6,182,212,0.65)] active:scale-[0.98]",
              "disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none",
              FOCUS
            )}
            style={{ backgroundImage: "linear-gradient(90deg, #06b6d4, #10b981)" }}
          >
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? "Analyzing..." : "Run Analysis"}
          </button>
        </section>

        <section aria-labelledby="results-h" aria-live="polite" className="min-w-0">
          <h2 id="results-h" className="sr-only">
            Audit results
          </h2>

          {error && (
            <div className="mb-4">
              <Callout tone={error.tone} title={error.title} role="alert">
                <p>{error.message}</p>
                {error.hints.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-slate-400 marker:text-slate-600">
                    {error.hints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                )}
                {error.guide && (
                  <button type="button" onClick={() => goTab("guide")} className={cx("mt-1 rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-300", FOCUS)}>
                    Open the setup guide
                  </button>
                )}
              </Callout>
            </div>
          )}

          {!result && !loading && !error && (
            <div className={cx(CARD, "flex min-h-[26rem] flex-col items-center justify-center gap-5 p-8 text-center")}>
              <div>
                <p className="text-base font-semibold text-white">No analysis yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Your risk level, findings, and fix commands will show up here.</p>
              </div>
              <ol className="w-full max-w-xs space-y-2 text-left text-sm text-slate-400">
                {["Load a sample or paste your own policy", "Run the analysis", "Review the findings and copy the fixes"].map((s, i) => (
                  <li key={s} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 text-xs font-semibold text-cyan-300">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {loading && (
            <div role="status" className={cx(CARD, "min-h-[26rem] space-y-4 p-5")}>
              <p className="flex items-center gap-2 text-sm text-cyan-300">
                <Spinner /> Reviewing your policy with Claude 3 Haiku on Amazon Bedrock
              </p>
              <div className="h-14 animate-pulse rounded-xl bg-slate-800/70" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-800/50" />
              <div className="h-32 animate-pulse rounded-xl bg-slate-800/40" />
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              <div className={cx(CARD, "flex flex-wrap items-center justify-between gap-3 p-4", r.glow)}>
                <div className="flex items-center gap-3">
                  <span className={cx("inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-sm font-bold tracking-wide ring-1", r.chip)}>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", r.dot)} />
                      <span className={cx("relative inline-flex h-2.5 w-2.5 rounded-full", r.dot)} />
                    </span>
                    {result.level}
                  </span>
                  <span className="text-sm text-slate-400">Overall risk</span>
                </div>
                {ms != null && <span className="text-xs tabular-nums text-slate-500">Analyzed in {(ms / 1000).toFixed(1)} s</span>}
              </div>

              {result.summary && (
                <div className={cx(CARD, "p-5")}>
                  <h3 className="text-sm font-semibold text-white">Executive summary</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{result.summary}</p>
                </div>
              )}

              <div className={cx(CARD, "p-5")}>
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">Vulnerabilities</h3>
                  <span className="text-xs text-slate-500">{result.findings.length} found</span>
                </div>
                {groups.length === 0 ? (
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200">No vulnerabilities reported for this input.</p>
                ) : (
                  <div className="space-y-4">
                    {groups.map(([cat, items]) => (
                      <div key={cat}>
                        <h4 className="mb-1.5 text-xs font-semibold text-slate-400">
                          {cat} <span className="text-slate-600">({items.length})</span>
                        </h4>
                        <ul className="space-y-2">
                          {items.map((f, i) => (
                            <li key={i} className={cx("flex items-start gap-3 rounded-lg border border-l-2 border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300", RISK[f.severity].edge)}>
                              <span className={cx("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold", RISK[f.severity].pill)}>{RISK[f.severity].label}</span>
                              <span className="min-w-0 break-words leading-relaxed">{f.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-slate-600">Groups and per-item severity are worked out in the browser from each finding, capped at the overall risk.</p>
              </div>

              <div className={cx(CARD, "p-5")}>
                <h3 className="mb-3 text-sm font-semibold text-white">Remediation</h3>
                <CodeBlock code={result.cli || "# No changes required"} />
                <p className="mt-3 text-xs leading-relaxed text-amber-300/90">AI-generated commands. Read each one and try it outside production first, since tightening access can break workloads that depend on it.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quickstart tab                                                     */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    title: "Turn on Claude 3 Haiku in Amazon Bedrock",
    body: "Switch the console to US East (N. Virginia), open Amazon Bedrock, go to Model access, and request or confirm access to Anthropic Claude 3 Haiku.",
    code: `aws bedrock list-foundation-models --region us-east-1 --by-provider anthropic --query "modelSummaries[].modelId"`,
    note: "The list shows what the region offers. A successful connectivity test is what proves your account can invoke the model. Leave Bedrock model invocation logging off so prompts are never written anywhere.",
  },
  {
    title: "Create the Lambda function",
    body: "Runtime Python 3.12, handler lambda_function.lambda_handler, 30 second timeout, 256 MB memory. Upload lambda_function.py from this project.",
    code: `zip function.zip lambda_function.py

aws lambda create-function \\
  --function-name qash-ops-audit \\
  --runtime python3.12 \\
  --handler lambda_function.lambda_handler \\
  --timeout 30 --memory-size 256 \\
  --role arn:aws:iam::<ACCOUNT_ID>:role/qash-ops-lambda-role \\
  --zip-file fileb://function.zip \\
  --region us-east-1`,
    note: "Give the role AWSLambdaBasicExecutionRole plus an inline policy allowing bedrock:InvokeModel on arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0 and dynamodb:UpdateItem on arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/qash-ops-limits. That is tighter than AmazonBedrockFullAccess.",
  },
  {
    title: "Create the usage-limits table",
    body: "A public endpoint needs limits that survive across Lambda instances. This table holds only anonymous counters (a salted hash, a count, an expiry time), never policies. The Lambda refuses to run without it, so a missing table cannot turn into an open, unmetered endpoint.",
    code: `aws dynamodb create-table \\
  --table-name qash-ops-limits \\
  --attribute-definitions AttributeName=k,AttributeType=S \\
  --key-schema AttributeName=k,KeyType=HASH \\
  --billing-mode PAY_PER_REQUEST \\
  --region us-east-1

aws dynamodb update-time-to-live \\
  --table-name qash-ops-limits \\
  --time-to-live-specification "Enabled=true,AttributeName=ttl" \\
  --region us-east-1

aws lambda update-function-configuration \\
  --function-name qash-ops-audit \\
  --environment "Variables={TABLE_NAME=qash-ops-limits,IP_SALT=<RANDOM_STRING>,ALLOWED_ORIGINS=*,IP_PER_MIN=5,IP_PER_DAY=30,GLOBAL_PER_DAY=1500}" \\
  --region us-east-1`,
    note: "Make the salt with: openssl rand -hex 16. After step 6 gives you your Amplify domain, re-run the last command with ALLOWED_ORIGINS=https://<YOUR_AMPLIFY_DOMAIN>. It replaces all variables, so keep the full list. At about $0.0013 per audit (verify current Haiku pricing), 1,500 audits a day is roughly $2 a day at most.",
  },
  {
    title: "Create the HTTP API",
    body: "The quick-create API forwards every request to the Lambda, so /audit works as a path. CORS must allow the content-type header, because the browser sends JSON. You will restrict the allowed origin in step 6.",
    code: `aws apigatewayv2 create-api \\
  --name qash-ops-api \\
  --protocol-type HTTP \\
  --target arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:qash-ops-audit \\
  --cors-configuration "AllowOrigins=*,AllowHeaders=content-type,AllowMethods=POST,OPTIONS" \\
  --region us-east-1

aws lambda add-permission \\
  --function-name qash-ops-audit \\
  --statement-id apigw-invoke \\
  --action lambda:InvokeFunction \\
  --principal apigateway.amazonaws.com \\
  --source-arn "arn:aws:execute-api:us-east-1:<ACCOUNT_ID>:<API_ID>/*/*" \\
  --region us-east-1`,
    note: "Your invoke URL is https://<API_ID>.execute-api.us-east-1.amazonaws.com/audit. The create-api response includes the API ID. Assume this URL is public: the protection comes from the limits, not from hiding it.",
  },
  {
    title: "Harden the public endpoint",
    body: "Every call spends Bedrock tokens, so cap spend at several layers: API throttling, a Lambda concurrency cap, log expiry, and a budget alert. The per-visitor and daily caps from step 3 are the hard stop, because budget alerts arrive hours late.",
    code: `aws apigatewayv2 update-stage \\
  --api-id <API_ID> \\
  --stage-name '$default' \\
  --default-route-settings ThrottlingBurstLimit=10,ThrottlingRateLimit=5 \\
  --region us-east-1

aws lambda put-function-concurrency \\
  --function-name qash-ops-audit \\
  --reserved-concurrent-executions 5 \\
  --region us-east-1

aws logs put-retention-policy \\
  --log-group-name /aws/lambda/qash-ops-audit \\
  --retention-in-days 7 \\
  --region us-east-1

aws budgets create-budget \\
  --account-id <ACCOUNT_ID> \\
  --budget '{"BudgetName":"qash-ops-monthly","BudgetLimit":{"Amount":"10","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}' \\
  --notifications-with-subscribers '[{"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":80,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"<YOUR_EMAIL>"}]}]'`,
    note: "If AWS rejects the concurrency cap because your account limit is low, skip that command. The daily cap still protects you. The API throttle is shared by all visitors, so one heavy user can crowd out others. To stop that at the edge, put CloudFront with an AWS WAF rate-based rule in front of the API.",
  },
  {
    title: "Deploy the frontend on AWS Amplify and lock CORS",
    body: "Push this project to a Git repository and connect it in Amplify Hosting. Before you push, paste your invoke URL into the PUBLIC_API_URL constant at the top of App.jsx, so visitors never see an endpoint field. Once Amplify shows your domain, restrict CORS to it.",
    code: `aws apigatewayv2 update-api \\
  --api-id <API_ID> \\
  --cors-configuration "AllowOrigins=https://<YOUR_AMPLIFY_DOMAIN>,AllowHeaders=content-type,AllowMethods=POST,OPTIONS" \\
  --region us-east-1`,
    note: "CORS stops other websites from calling the API from a visitor's browser. It does not stop scripts, which is why the limits exist. Then run the connectivity test below.",
  },
];

const CHECKLIST = [
  { id: "bedrock", text: "Claude 3 Haiku is enabled in Amazon Bedrock (us-east-1)" },
  { id: "lambda", text: "Lambda: Python 3.12, handler lambda_function.lambda_handler, 30 s timeout" },
  { id: "limits", text: "Limits table exists with TTL on ttl, and the Lambda environment variables are set" },
  { id: "iam", text: "Lambda role allows bedrock:InvokeModel, dynamodb:UpdateItem on the limits table, and CloudWatch logs" },
  { id: "route", text: "The HTTP API accepts POST /audit and can invoke the Lambda" },
  { id: "cors", text: "CORS allows only your site origin, the content-type header, and POST and OPTIONS" },
  { id: "cost", text: "Throttle, concurrency cap, 7-day log retention, and budget alert are in place" },
  { id: "url", text: "PUBLIC_API_URL is set in App.jsx (or the URL is saved in the header when self-hosting)" },
  { id: "test", text: "The connectivity test returns a risk level" },
];

const TROUBLE = [
  {
    q: "Failed to fetch, or a CORS error in the console",
    a: ["Enable CORS on the HTTP API with your site origin, header content-type, and methods POST and OPTIONS. The origin must match your Amplify domain exactly, including https://.", "Check the URL for typos, the wrong region, or a missing /audit.", "If you use a REST API instead of an HTTP API, the Lambda's CORS headers must also be returned through the integration."],
  },
  {
    q: "429 Usage limit reached",
    a: ["The message says which limit fired: per minute, per day for one connection, or the shared daily capacity.", "Raise IP_PER_MIN, IP_PER_DAY, or GLOBAL_PER_DAY in the Lambda environment if your traffic is legitimate. People behind one office or campus network share one per-connection limit.", "A 503 saying the service is unavailable means the limits table could not be reached. Check the table name and the dynamodb:UpdateItem permission."],
  },
  {
    q: "403 or AccessDeniedException",
    a: ["A 403 from API Gateway points to an authorizer or resource policy.", "AccessDeniedException in the Lambda log means the role lacks bedrock:InvokeModel, or model access is not enabled for Claude 3 Haiku in us-east-1."],
  },
  {
    q: "500 or 502 from the API",
    a: ["Run: aws logs tail /aws/lambda/qash-ops-audit --follow, then send another request.", "If API Gateway itself returns 500, re-run the add-permission command from the setup steps.", "A 502 with a message about an unreadable response means the model returned something that was not JSON. Retrying usually clears it."],
  },
  {
    q: "Timeout after 30 seconds",
    a: ["Raise the Lambda timeout to 30 seconds. HTTP API integrations cannot run longer than that.", "Try once more. The first request after a quiet period includes a cold start."],
  },
  {
    q: "The result looks empty or wrong",
    a: ["The response must contain risk_level, summary, vulnerabilities, and remediation_cli.", "Confirm the route points to qash-ops-audit and not a different function."],
  },
];

function QuickstartTab({ apiUrl, checks, setChecks, setHealth }) {
  const [test, setTest] = useState({ state: "idle" });

  const done = CHECKLIST.filter((c) => checks[c.id]).length;
  const pct = Math.round((done / CHECKLIST.length) * 100);

  const toggle = (id) => setChecks((c) => ({ ...c, [id]: !c[id] }));

  const runTest = async () => {
    const bad = validateInputs(apiUrl, null);
    if (bad) {
      setTest({ state: "fail", info: bad });
      return;
    }
    setTest({ state: "running" });
    try {
      const { data, ms } = await callAudit(apiUrl.trim(), SAMPLES[3].code);
      setHealth("ok");
      setChecks(Object.fromEntries(CHECKLIST.map((c) => [c.id, true])));
      setTest({ state: "ok", level: String(data.risk_level).toUpperCase(), ms });
    } catch (e) {
      setHealth("error");
      setTest({ state: "fail", info: explain(e) });
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Self-host guide">
        Deploy your own copy of the backend in seven steps, with the limits a public endpoint needs. Commands use us-east-1 and the names in this project. Replace anything in angle brackets with your own values.
      </SectionTitle>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <ol className="relative min-w-0 space-y-5 border-l border-slate-800 pl-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="absolute -left-[3.15rem] flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/40 bg-slate-950 text-sm font-semibold text-cyan-300 shadow-[0_0_18px_-4px_rgba(6,182,212,0.6)]">
                {i + 1}
              </span>
              <div className={cx(CARD, "space-y-3 p-5")}>
                <h3 className="text-base font-semibold text-white">{s.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{s.body}</p>
                {s.code && <CodeBlock code={s.code} title="terminal" copyLabel="Copy" />}
                {s.note && <p className="text-xs leading-relaxed text-slate-500">{s.note}</p>}
              </div>
            </li>
          ))}
        </ol>

        <div className="min-w-0 space-y-6 lg:sticky lg:top-40 lg:self-start">
          <div className={cx(CARD, "p-5")}>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-white">Setup checklist</h3>
              <span className="text-xs tabular-nums text-slate-500">
                {done} of {CHECKLIST.length}
              </span>
            </div>
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist progress">
              <div className="h-full rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)] transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <ul className="space-y-2">
              {CHECKLIST.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg p-1.5 text-sm text-slate-300 transition hover:bg-slate-800/50">
                    <input type="checkbox" checked={!!checks[c.id]} onChange={() => toggle(c.id)} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400" />
                    <span className={checks[c.id] ? "text-slate-500 line-through" : ""}>{c.text}</span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={runTest}
                disabled={test.state === "running"}
                className={cx("flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/50 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 active:scale-[0.98] disabled:opacity-60", FOCUS)}
              >
                {test.state === "running" && <Spinner />}
                {test.state === "running" ? "Testing..." : "Run connectivity test"}
              </button>
              <p className="mt-2 text-xs text-slate-500">Sends one small sample policy to the URL in the header. A success ticks every item above, because the whole chain had to work.</p>

              <div className="mt-3" aria-live="polite">
                {test.state === "ok" && (
                  <Callout tone="emerald" title="Connected">
                    <p>
                      The API answered in {(test.ms / 1000).toFixed(1)} s with risk level {test.level}.
                    </p>
                  </Callout>
                )}
                {test.state === "fail" && (
                  <Callout tone={test.info.tone} title={test.info.title}>
                    <p>{test.info.message}</p>
                    {test.info.hints.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-slate-400 marker:text-slate-600">
                        {test.info.hints.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    )}
                  </Callout>
                )}
              </div>
            </div>
          </div>

          <div className={cx(CARD, "p-5")}>
            <h3 className="mb-3 text-sm font-semibold text-white">Troubleshooting</h3>
            <div className="space-y-2">
              {TROUBLE.map((t) => (
                <details key={t.q} className="group rounded-lg border border-slate-800 bg-slate-950/50 open:border-slate-700">
                  <summary className={cx("flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-200 hover:text-white", FOCUS)}>
                    <span aria-hidden="true" className="text-xs text-cyan-400 transition-transform group-open:rotate-90">
                      ▶
                    </span>
                    {t.q}
                  </summary>
                  <ul className="list-disc space-y-1.5 px-3 pb-3 pl-8 text-sm leading-relaxed text-slate-400 marker:text-slate-600">
                    {t.a.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Architecture & PRD tab                                             */
/* ------------------------------------------------------------------ */

const TONES = {
  cyan: { border: "border-cyan-500/30", text: "text-cyan-300", glow: "shadow-[0_0_32px_-14px_rgba(6,182,212,0.8)]", dot: "bg-cyan-400" },
  emerald: { border: "border-emerald-500/30", text: "text-emerald-300", glow: "shadow-[0_0_32px_-14px_rgba(16,185,129,0.8)]", dot: "bg-emerald-400" },
  amber: { border: "border-amber-500/30", text: "text-amber-300", glow: "shadow-[0_0_32px_-14px_rgba(245,158,11,0.8)]", dot: "bg-amber-400" },
};

const NODES = [
  { name: "React UI", sub: "AWS Amplify", text: "Static single-page app. The endpoint URL is set in App.jsx. Sends POST /audit with the policy text and renders the result.", tone: "cyan" },
  { name: "API Gateway", sub: "HTTP API, /audit", text: "Public HTTPS entry point with CORS locked to the site and throttling. Hands the request to Lambda.", tone: "cyan" },
  { name: "Lambda", sub: "Python 3.12, us-east-1", text: "Validates the body, rejects input over 8,000 characters, enforces per-visitor and daily limits, calls Bedrock, and returns clean JSON.", tone: "emerald" },
  { name: "Amazon Bedrock", sub: "Claude 3 Haiku", text: "Reviews the policy at temperature 0 and answers with a strict JSON object, capped at 500 tokens.", tone: "amber" },
];

const SPECS = [
  { k: "Response target", v: "Under 5 s", d: "Design goal for a typical policy, measured end to end. The first call after idle adds a cold start." },
  { k: "Model", v: "Claude 3 Haiku", d: "anthropic.claude-3-haiku-20240307-v1:0 at temperature 0 for repeatable answers." },
  { k: "Output limit", v: "500 tokens", d: "max_tokens on every Bedrock call. The prompt also asks for under 400." },
  { k: "Input limit", v: "8,000 characters", d: "Longer input is rejected, not cut off, so a truncated policy cannot hide a risky statement." },
  { k: "Visitor limits", v: "5 per min, 30 per day", d: "Counted per network address in a small DynamoDB table. Adjustable with Lambda environment variables." },
  { k: "Daily capacity", v: "1,500 audits", d: "Shared by all visitors. Caps worst-case Bedrock spend at roughly $2 a day at current Haiku pricing. Verify pricing for your account." },
  { k: "Runtime", v: "Python 3.12", d: "256 MB memory and a 30 second timeout are recommended." },
  { k: "Timeout ceiling", v: "30 s", d: "HTTP API integrations stop at 30 seconds. The browser gives up at the same point." },
  { k: "Region", v: "us-east-1", d: "Lambda and Bedrock both run in N. Virginia." },
  { k: "Persistence", v: "None for content", d: "Policies are never stored. Only anonymous, expiring usage counters and diagnostic logs are written." },
  { k: "Transport", v: "HTTPS", d: "Browser to API Gateway and Lambda to Bedrock both use TLS." },
];

const COMPLIANCE = [
  "Submitted policies are never written to a database, bucket, or cache.",
  "Only anonymous usage counters are kept: a salted hash, a count, and an expiry time.",
  "Daily caps, a concurrency limit, and a budget alert keep one visitor from running up the bill.",
  "Users must not submit credentials, keys, tokens, or personal data.",
  "Logs hold request metadata and error codes only, never input text, and expire on a schedule.",
  "All processing stays inside AWS. No external model provider receives the input.",
  "Findings are advisory. They are not an audit, a penetration test, or a compliance certification.",
  "The Lambda role should allow only bedrock:InvokeModel on the Claude 3 Haiku model and dynamodb:UpdateItem on the limits table.",
];

const PRD = [
  { h: "Problem", p: "Developers under time pressure commit permissive IAM policies (Action * on Resource *) and open S3 bucket policies. Enterprise scanners need licenses and setup that a hackathon team does not have." },
  { h: "Solution", p: "A web page where anyone pastes a policy and gets a severity rating and runnable AWS CLI fixes within seconds, powered by Amazon Bedrock and a single Lambda function." },
  { h: "Audience", p: "Cloud engineers, DevOps practitioners, and hackathon builders on AWS who want a fast security check without installing anything." },
  { h: "Out of scope for v1", p: "Accounts, saved history, live account scanning, and automatic remediation. Nothing is applied to your AWS account for you." },
];

const FEATURES = [
  "Reads IAM policies, S3 and KMS policies, and CloudFormation snippets",
  "Four preloaded scenarios for quick demos",
  "Four severity levels: Critical, High, Medium, Low",
  "Copyable AWS CLI remediation commands",
  "Zero persistence of submitted content",
  "Built-in abuse and cost limits for a public endpoint",
];

const REQUEST_EXAMPLE = `POST /audit
Content-Type: application/json

{ "policy": "{ \\"Version\\": \\"2012-10-17\\", ... }" }`;

const RESPONSE_EXAMPLE = `{
  "risk_level": "CRITICAL",
  "summary": "The bucket policy grants anonymous read and write access.",
  "vulnerabilities": [
    "Principal is * so anyone on the internet can read objects",
    "s3:PutObject is allowed for all principals"
  ],
  "remediation_cli": "aws s3api put-public-access-block ..."
}`;

function Connector() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-10 w-px bg-cyan-500/40 lg:h-px lg:w-14 lg:self-center">
      <span className="q-flow-y absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(6,182,212,0.8)] lg:hidden" />
      <span className="q-flow-x absolute top-1/2 hidden h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(6,182,212,0.8)] lg:block" />
    </div>
  );
}

function ArchitectureTab() {
  return (
    <div className="space-y-10">
      <section>
        <SectionTitle title="System flow">Every audit passes through four managed AWS pieces. Nothing runs on a server you have to maintain.</SectionTitle>
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          {NODES.map((n, i) => {
            const t = TONES[n.tone];
            return (
              <div key={n.name} className="contents">
                <div className={cx("flex-1 rounded-2xl border bg-slate-900/70 p-5", t.border, t.glow)}>
                  <div className="flex items-center gap-2">
                    <span className={cx("h-2 w-2 rounded-full", t.dot)} />
                    <h3 className="text-base font-semibold text-white">{n.name}</h3>
                  </div>
                  <p className={cx("mt-0.5 text-xs font-medium", t.text)}>{n.sub}</p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{n.text}</p>
                </div>
                {i < NODES.length - 1 && <Connector />}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle title="Request and response">The whole contract is one route that takes a policy string and returns four fields.</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <CodeBlock code={REQUEST_EXAMPLE} title="request" copyLabel="Copy" />
          <CodeBlock code={RESPONSE_EXAMPLE} title="response" copyLabel="Copy" />
        </div>
      </section>

      <section>
        <SectionTitle title="Technical specifications" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SPECS.map((s) => (
            <div key={s.k} className={cx(CARD, "p-4 transition hover:border-slate-600")}>
              <p className="text-xs text-slate-500">{s.k}</p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-cyan-300">{s.v}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle title="Compliance rules" />
          <ul className={cx(CARD, "space-y-3 p-5")}>
            {COMPLIANCE.map((c) => (
              <li key={c} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                <span aria-hidden="true" className="mt-0.5 text-emerald-400">
                  ✓
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionTitle title="Key features" />
          <ul className={cx(CARD, "space-y-3 p-5")}>
            {FEATURES.map((f) => (
              <li key={f} className="flex gap-3 text-sm leading-relaxed text-slate-300">
                <span aria-hidden="true" className="mt-0.5 text-cyan-400">
                  ▸
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <SectionTitle title="Product requirements" />
        <div className="grid gap-4 md:grid-cols-2">
          {PRD.map((p) => (
            <div key={p.h} className={cx(CARD, "p-5")}>
              <h3 className="text-sm font-semibold text-white">{p.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.p}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Privacy & Security tab                                             */
/* ------------------------------------------------------------------ */

const PRIVACY_HIGHLIGHTS = [
  { t: "Content not stored", d: "No database, bucket, or cache holds your policies. Only anonymous usage counters are kept.", tone: "emerald" },
  { t: "Encrypted in transit", d: "HTTPS from your browser and TLS to Bedrock.", tone: "cyan" },
  { t: "Logs expire", d: "Diagnostic logs are deleted after a short retention period.", tone: "amber" },
  { t: "No tracking", d: "No accounts, cookies, or analytics in this app.", tone: "cyan" },
];

const PRIVACY = [
  {
    id: "scope",
    title: "1. Scope",
    p: ["Qash-Ops Lite reviews AWS policies and infrastructure snippets that you choose to submit and returns a security assessment. This policy explains what happens to that content. It takes effect on September 20, 2026."],
  },
  {
    id: "data",
    title: "2. What we process",
    p: ["We process only what you submit and what the analysis returns."],
    list: [
      "The policy or template text you paste into the editor.",
      "The assessment generated for it: risk level, summary, findings, and CLI commands.",
      "Basic request metadata created by AWS services, such as time, request ID, status code, and duration.",
      "A one-way, salted hash of your network address, used only to count requests for fair-use limits.",
    ],
    after: "The app asks for no personal information, has no accounts, sets no cookies, and includes no analytics or advertising trackers.",
  },
  {
    id: "persistence",
    title: "3. Zero-persistence of your content",
    p: [
      "Submitted content is held in the memory of the Lambda function only while your request runs. It is not written to a database, storage bucket, cache, or file, so there is nothing to retrieve or delete later.",
      "Results exist only in your browser tab. Refreshing or closing the tab removes them.",
    ],
  },
  {
    id: "logging",
    title: "4. Diagnostic logging and usage counters",
    p: [
      "AWS Lambda automatically sends logs to Amazon CloudWatch Logs. The handler in this project logs only an error code or error type when a call fails, alongside the standard platform lines for start, end, duration, and memory. It does not log the policy you submit, the answer the model returns, or error text that could echo your input. If API Gateway access logging is turned on, it records the time, route, status, latency, and source IP of each request.",
      "To keep this free service available and its cost under control, each request is counted against per-visitor and daily limits. The counter key is a one-way hash of your network address mixed with a secret value and the date, so the address itself is not stored. A counter record holds only that hash, a number, and an expiry time. Records expire automatically, and DynamoDB can take up to about two days after expiry to remove them. Requests over a limit are rejected.",
      "Logs are kept only for the retention period set on the log group. The setup guide sets it to 7 days, after which CloudWatch deletes them automatically. A log group with no retention setting keeps logs indefinitely, so operators should always set one.",
    ],
  },
  {
    id: "encryption",
    title: "5. Encryption",
    p: [
      "Traffic from your browser to API Gateway uses HTTPS. The Lambda function reaches Amazon Bedrock through the AWS SDK over TLS. Because submitted content is never stored, there is no payload at rest. CloudWatch Logs encrypts stored log data by default.",
    ],
  },
  {
    id: "ai",
    title: "6. AI processing and third parties",
    p: [
      "Analysis runs on Anthropic Claude 3 Haiku through Amazon Bedrock in the us-east-1 region. According to AWS documentation, Bedrock does not store your prompts or completions, does not use them to train models, and does not give model providers access to them.",
      "The frontend is served from AWS Amplify as static files. Submitted policies go directly to the API Gateway endpoint and never pass through the hosting layer. No data is shared with third parties outside AWS.",
    ],
  },
  {
    id: "browser",
    title: "7. Data kept in your browser",
    p: ["To save you time, the app keeps up to three things in your browser's local storage:"],
    list: ["Self-hosted setups only: the API Gateway URL you entered.", "Your progress on the setup checklist.", "Whether you dismissed the intro banner."],
    after: "The editor contents are not saved. Clearing site data in your browser removes all of it.",
  },
  {
    id: "responsibilities",
    title: "8. Your responsibilities",
    list: [
      "Never submit access keys, secret keys, session tokens, passwords, or personal or customer data.",
      "Replace account IDs and resource names with placeholders if they are sensitive.",
      "Read every generated command before you run it, and try it outside production first.",
    ],
  },
  {
    id: "limits",
    title: "9. Limits of the analysis",
    p: ["AI-generated findings can miss real problems and can flag safe configurations. The output is guidance, not a security audit, penetration test, or compliance certification. Commands that tighten access may interrupt workloads that rely on the old permissions."],
  },
  {
    id: "changes",
    title: "10. Changes and questions",
    p: ["If this policy changes, the new version will be published here with an updated effective date. For questions, open an issue in the project repository."],
  },
];

function PrivacyTab() {
  const jump = (id) => {
    const el = document.getElementById(`privacy-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="space-y-8">
      <SectionTitle title="Privacy and security policy">Effective September 20, 2026. The short version: your policies are processed in memory, sent over encrypted connections, and not kept. Only anonymous usage counters are stored, and they expire.</SectionTitle>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PRIVACY_HIGHLIGHTS.map((h) => (
          <div key={h.t} className={cx("rounded-2xl border bg-slate-900/70 p-4", TONES[h.tone].border, TONES[h.tone].glow)}>
            <p className={cx("text-sm font-semibold", TONES[h.tone].text)}>{h.t}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{h.d}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Policy sections" className="hidden lg:block">
          <ul className="sticky top-40 space-y-1 border-l border-slate-800">
            {PRIVACY.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => jump(s.id)} className={cx("-ml-px block w-full border-l border-transparent py-1 pl-3 text-left text-sm text-slate-500 transition hover:border-cyan-400 hover:text-cyan-300", FOCUS)}>
                  {s.title.replace(/^\d+\.\s/, "")}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <article className={cx(CARD, "max-w-3xl space-y-8 p-6 sm:p-8")}>
          {PRIVACY.map((s) => (
            <section key={s.id} id={`privacy-${s.id}`} className="scroll-mt-40">
              <h3 className="text-base font-semibold text-white">{s.title}</h3>
              <div className="mt-2 space-y-3 text-sm leading-7 text-slate-400">
                {s.p && s.p.map((t, i) => <p key={i}>{t}</p>)}
                {s.list && (
                  <ul className="list-disc space-y-1.5 pl-5 marker:text-cyan-500">
                    {s.list.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                )}
                {s.after && <p>{s.after}</p>}
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                */
/* ------------------------------------------------------------------ */

export default function App() {
  const [tab, setTab] = useState("audit");
  const [apiUrl, setApiUrl] = useState(() => (PUBLIC_MODE ? ENV_URL : store.get(KEYS.url)));
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [ms, setMs] = useState(null);
  const [health, setHealth] = useState("unknown");
  const [bannerOpen, setBannerOpen] = useState(() => store.get(KEYS.banner) !== "1");
  const [checks, setChecks] = useState(() => {
    try {
      return JSON.parse(store.get(KEYS.checks, "{}")) || {};
    } catch {
      return {};
    }
  });
  const tabRefs = useRef({});

  useEffect(() => {
    if (!PUBLIC_MODE) store.set(KEYS.url, apiUrl);
  }, [apiUrl]);

  useEffect(() => {
    store.set(KEYS.checks, JSON.stringify(checks));
  }, [checks]);

  const goTab = (id) => {
    setTab(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const dismissBanner = () => {
    setBannerOpen(false);
    store.set(KEYS.banner, "1");
  };

  const run = async () => {
    if (loading) return;
    const bad = validateInputs(apiUrl, input);
    if (bad) {
      setError(bad);
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, ms: took } = await callAudit(apiUrl.trim(), input);
      setResult(normalize(data));
      setMs(took);
      setHealth("ok");
    } catch (e) {
      setError(explain(e));
      setHealth("error");
    } finally {
      setLoading(false);
    }
  };

  const onTabKey = (e) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let n = null;
    if (e.key === "ArrowRight") n = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = TABS.length - 1;
    if (n === null) return;
    e.preventDefault();
    setTab(TABS[n].id);
    const el = tabRefs.current[TABS[n].id];
    if (el) el.focus();
  };

  const selfStatus = !apiUrl.trim()
    ? { text: "Endpoint not set", dot: "bg-amber-400", ping: false }
    : health === "ok"
    ? { text: "Connected", dot: "bg-emerald-400", ping: true }
    : health === "error"
    ? { text: "Last request failed", dot: "bg-red-400", ping: false }
    : { text: "Saved in this browser", dot: "bg-cyan-400", ping: false };
  const status = PUBLIC_MODE
    ? health === "error"
      ? { text: "Last request failed", dot: "bg-red-400", ping: false }
      : health === "ok"
      ? { text: "Service reachable", dot: "bg-emerald-400", ping: true }
      : !ENV_URL
      ? { text: "Endpoint not configured", dot: "bg-amber-400", ping: false }
      : { text: "Free public service", dot: "bg-cyan-400", ping: false }
    : selfStatus;

  const audit = { apiUrl, input, setInput, selected, setSelected, run, loading, result, error, ms, goTab, bannerOpen, dismissBanner };

  return (
    <div className="relative min-h-screen bg-slate-950 font-sans text-slate-200 antialiased">
      <style>{CSS}</style>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(60rem 30rem at 8% -10%, rgba(6,182,212,0.12), transparent 60%), radial-gradient(50rem 30rem at 100% 110%, rgba(16,185,129,0.10), transparent 60%)",
        }}
      />

      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-900/50 shadow-[0_1px_0_0_rgba(6,182,212,0.18)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_22px_-4px_rgba(6,182,212,0.7)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold leading-tight tracking-tight text-white">Qash-Ops Lite</h1>
                <p className="text-xs text-slate-400">AWS security and IAM posture auditor</p>
              </div>
            </div>

            {PUBLIC_MODE ? (
              <p role="status" className="flex items-center gap-2 text-xs text-slate-400">
                <span className="relative flex h-2 w-2">
                  {status.ping && <span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", status.dot)} />}
                  <span className={cx("relative inline-flex h-2 w-2 rounded-full", status.dot)} />
                </span>
                {status.text}
              </p>
            ) : (
            <label className="flex w-full flex-col gap-1 lg:w-[30rem]">
              <span className="flex items-center justify-between text-xs text-slate-400">
                API Gateway URL
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    {status.ping && <span className={cx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", status.dot)} />}
                    <span className={cx("relative inline-flex h-2 w-2 rounded-full", status.dot)} />
                  </span>
                  {status.text}
                </span>
              </span>
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={apiUrl}
                onChange={(e) => {
                  setApiUrl(e.target.value);
                  setHealth("unknown");
                }}
                placeholder="https://abc123.execute-api.us-east-1.amazonaws.com/audit"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-600 outline-none transition focus:border-cyan-400 focus:shadow-[0_0_0_3px_rgba(6,182,212,0.15)]"
              />
            </label>
            )}
          </div>

          <nav role="tablist" aria-label="Sections" onKeyDown={onTabKey} className="-mx-1 flex gap-1 overflow-x-auto pb-0.5">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el;
                  }}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={active}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={active ? 0 : -1}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cx(
                    "relative flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200",
                    FOCUS,
                    active ? "text-cyan-200" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <span aria-hidden="true">{t.icon}</span>
                  {t.label}
                  <span
                    aria-hidden="true"
                    className={cx(
                      "absolute inset-x-3 bottom-0 h-0.5 origin-center rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.9)] transition-transform duration-300",
                      active ? "scale-x-100" : "scale-x-0"
                    )}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-6">
        <div key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="q-fade">
          {tab === "audit" && <AuditTab a={audit} />}
          {tab === "guide" && <QuickstartTab apiUrl={apiUrl} checks={checks} setChecks={setChecks} setHealth={setHealth} />}
          {tab === "arch" && <ArchitectureTab />}
          {tab === "privacy" && <PrivacyTab />}
        </div>
      </main>

      <footer className="relative border-t border-slate-800/80 py-6 text-center text-xs text-slate-600">
        Qash-Ops Lite. Free service with fair-use limits. AI-generated findings are advisory. Review every command before you run it.
      </footer>
    </div>
  );
}
