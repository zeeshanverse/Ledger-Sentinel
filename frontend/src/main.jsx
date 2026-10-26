import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

// Empty string = same origin, Vite proxies /api -> http://localhost:8080 (see vite.config.js).
// For a deployed build set VITE_API_URL, e.g. https://your-backend.onrender.com
const API = import.meta.env.VITE_API_URL || '';
const NUMERIC = ['amount', 'balanceBefore', 'balanceAfter', 'hour', 'velocity15m'];

const COUNTRIES = ['IN', 'US', 'GB', 'AE', 'SG', 'DE', 'NG', 'RU'];
const CATEGORIES = ['GENERAL', 'GROCERY', 'TRAVEL', 'ELECTRONICS', 'CRYPTO', 'GAMBLING', 'HIGH_RISK'];

const PRESETS = [
  {
    label: 'Everyday purchase',
    icon: '🛒',
    values: { amount: 1200, balanceBefore: 50000, balanceAfter: 48800, country: 'IN', merchantCategory: 'GROCERY', hour: 14, velocity15m: 1 },
  },
  {
    label: 'Suspicious crypto',
    icon: '🪙',
    values: { amount: 92000, balanceBefore: 100000, balanceAfter: 8000, country: 'IN', merchantCategory: 'CRYPTO', hour: 2, velocity15m: 7 },
  },
  {
    label: 'Overseas spree',
    icon: '✈️',
    values: { amount: 45000, balanceBefore: 90000, balanceAfter: 45000, country: 'NG', merchantCategory: 'ELECTRONICS', hour: 3, velocity15m: 5 },
  },
];

const INITIAL = {
  transactionId: 'txn-demo',
  accountId: 'acct-7',
  ...PRESETS[1].values,
};

const DECISION_META = {
  ALLOW: { label: 'Approved', tone: 'allow', blurb: 'Looks like normal behaviour. Let it through.' },
  REVIEW: { label: 'Manual review', tone: 'review', blurb: 'Some signals look off. Send to an analyst.' },
  BLOCK: { label: 'Blocked', tone: 'block', blurb: 'High fraud likelihood. Stop this transaction.' },
};

const inr = (n) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);

function Gauge({ score, tone }) {
  // Semicircle gauge. Length of the arc = π * r
  const r = 90;
  const arc = Math.PI * r;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  const tick = (p) => {
    const a = Math.PI * (1 - p);
    return { x1: 110 + Math.cos(a) * 78, y1: 110 - Math.sin(a) * 78, x2: 110 + Math.cos(a) * 102, y2: 110 - Math.sin(a) * 102 };
  };

  return (
    <svg viewBox="0 0 220 125" className={`gauge ${tone}`} role="img" aria-label={`Risk score ${(score * 100).toFixed(1)} percent`}>
      <defs>
        <linearGradient id="g-track" x1="0" x2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="0.5" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#fb7185" />
        </linearGradient>
      </defs>
      <path d="M 20 110 A 90 90 0 0 1 200 110" className="gauge-bg" />
      <path
        d="M 20 110 A 90 90 0 0 1 200 110"
        className="gauge-fg"
        strokeDasharray={arc}
        strokeDashoffset={arc * (1 - Math.min(Math.max(shown, 0), 1))}
      />
      <line {...tick(0.45)} className="gauge-tick" />
      <line {...tick(0.8)} className="gauge-tick" />
      <text x="110" y="100" textAnchor="middle" className="gauge-num">{(score * 100).toFixed(1)}%</text>
      <text x="110" y="120" textAnchor="middle" className="gauge-cap">RISK SCORE</text>
    </svg>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}{hint && <em>{hint}</em>}</span>
      {children}
    </label>
  );
}

function App() {
  const [form, setForm] = useState(INITIAL);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [api, setApi] = useState('checking');
  const resultRef = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: NUMERIC.includes(k) ? (v === '' ? '' : Number(v)) : v }));

  // API health indicator
  useEffect(() => {
    let alive = true;
    const ping = () =>
      fetch(`${API}/api/v1/risk/health`)
        .then((r) => alive && setApi(r.ok ? 'online' : 'offline'))
        .catch(() => alive && setApi('offline'));
    ping();
    const t = setInterval(ping, 8000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const ratio = useMemo(() => {
    const b = Number(form.balanceBefore) || 0;
    return b > 0 ? Math.min(1, (Number(form.amount) || 0) / b) : 0;
  }, [form.amount, form.balanceBefore]);

  const applyPreset = (p) => {
    setForm((f) => ({ ...f, ...p.values, transactionId: `txn-${Math.floor(Math.random() * 9000 + 1000)}` }));
    setResult(null);
    setError(null);
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, NUMERIC.includes(k) ? Number(v) || 0 : String(v).trim()])
      );
      const res = await fetch(`${API}/api/v1/risk/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      let data = null;
      try { data = await res.json(); } catch { /* non-JSON body */ }

      if (!res.ok) {
        if (data?.fields) {
          throw new Error(Object.entries(data.fields).map(([k, m]) => `${k}: ${m}`).join(' · '));
        }
        throw new Error(data?.message || data?.error || `Server responded with HTTP ${res.status}`);
      }
      if (!data || typeof data.riskScore !== 'number') throw new Error('Unexpected response from the API.');

      setResult(data);
      setHistory((h) => [{ ...data, at: new Date(), amount: payload.amount }, ...h].slice(0, 6));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    } catch (e) {
      setResult(null);
      if (e.name === 'AbortError') setError('Request timed out after 15s. Is the ML service running on port 8001?');
      else if (e instanceof TypeError) setError('Cannot reach the API. Make sure Spring Boot is running on http://localhost:8080 (and the ML service on 8001).');
      else setError(e.message);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  const meta = result ? DECISION_META[result.decision] || DECISION_META.REVIEW : null;

  return (
    <>
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <main>
        <header className="topbar">
          <div className="brand">
            <div className="logo">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <strong>LEDGER SENTINEL</strong>
              <small>AI transaction risk engine</small>
            </div>
          </div>
          <div className={`status ${api}`}>
            <span className="dot" />
            API {api === 'checking' ? 'checking…' : api}
          </div>
        </header>

        <section className="hero">
          <h1>Transaction <span className="grad">Risk Console</span></h1>
          <p>Hybrid rules + ML scoring. Pick a scenario or craft your own transaction and get an instant verdict.</p>
          <div className="presets">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="chip" onClick={() => applyPreset(p)}>
                <span>{p.icon}</span>{p.label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid">
          <form className="panel" onSubmit={(e) => { e.preventDefault(); run(); }}>
            <div className="panel-title"><span className="pill">01</span> Transaction details</div>

            <div className="row two">
              <Field label="Transaction ID">
                <input value={form.transactionId} onChange={(e) => set('transactionId', e.target.value)} required />
              </Field>
              <Field label="Account ID">
                <input value={form.accountId} onChange={(e) => set('accountId', e.target.value)} required />
              </Field>
            </div>

            <div className="row three">
              <Field label="Amount" hint="₹">
                <input type="number" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
              </Field>
              <Field label="Balance before" hint="₹">
                <input type="number" min="0" value={form.balanceBefore} onChange={(e) => set('balanceBefore', e.target.value)} />
              </Field>
              <Field label="Balance after" hint="₹">
                <input type="number" min="0" value={form.balanceAfter} onChange={(e) => set('balanceAfter', e.target.value)} />
              </Field>
            </div>

            <div className="meter">
              <div className="meter-head"><span>Share of balance spent</span><b>{(ratio * 100).toFixed(0)}%</b></div>
              <div className="meter-bar"><div style={{ width: `${ratio * 100}%` }} className={ratio >= 0.8 ? 'hot' : ratio >= 0.5 ? 'warm' : ''} /></div>
            </div>

            <div className="row two">
              <Field label="Country">
                <select value={form.country} onChange={(e) => set('country', e.target.value)}>
                  {[...new Set([form.country, ...COUNTRIES])].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Merchant category">
                <select value={form.merchantCategory} onChange={(e) => set('merchantCategory', e.target.value)}>
                  {[...new Set([form.merchantCategory, ...CATEGORIES])].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <div className="row two">
              <Field label="Hour of day" hint={`${String(form.hour).padStart(2, '0')}:00`}>
                <input type="range" min="0" max="23" value={form.hour} onChange={(e) => set('hour', e.target.value)} />
              </Field>
              <Field label="Transactions in last 15 min">
                <input type="number" min="0" value={form.velocity15m} onChange={(e) => set('velocity15m', e.target.value)} />
              </Field>
            </div>

            <button className="cta" type="submit" disabled={loading}>
              {loading ? <><span className="spinner" /> Analysing…</> : <>Evaluate transaction <span aria-hidden="true">→</span></>}
            </button>

            {error && (
              <div className="alert" role="alert">
                <b>Couldn’t evaluate</b>
                <span>{error}</span>
              </div>
            )}
          </form>

          <div className="stack">
            <div className={`panel result ${meta ? meta.tone : ''}`} ref={resultRef}>
              <div className="panel-title"><span className="pill">02</span> Decision</div>

              {!result && !loading && (
                <div className="empty">
                  <div className="radar"><i /><i /><i /></div>
                  <p>No evaluation yet.<br />Hit <b>Evaluate transaction</b> to see the verdict.</p>
                </div>
              )}

              {loading && !result && (
                <div className="empty"><div className="radar"><i /><i /><i /></div><p>Scanning signals…</p></div>
              )}

              {result && meta && (
                <div className="verdict" key={result.transactionId + result.riskScore}>
                  <Gauge score={result.riskScore} tone={meta.tone} />
                  <div className={`badge ${meta.tone}`}>{result.decision}<small>{meta.label}</small></div>
                  <p className="blurb">{meta.blurb}</p>

                  <div className="kv">
                    <div><span>Transaction</span><b>{result.transactionId}</b></div>
                    <div><span>Model</span><b className="mono">{result.modelVersion}</b></div>
                  </div>

                  <h3>Why this score</h3>
                  <ul className="reasons">
                    {(result.reasons || []).map((x, i) => (
                      <li key={i} style={{ animationDelay: `${i * 70}ms` }}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div className="panel">
                <div className="panel-title"><span className="pill">03</span> Recent evaluations</div>
                <ul className="history">
                  {history.map((h, i) => (
                    <li key={i}>
                      <span className={`tag ${h.decision}`}>{h.decision}</span>
                      <span className="h-id">{h.transactionId}</span>
                      <span className="h-amt">₹{inr(h.amount)}</span>
                      <span className="h-score">{(h.riskScore * 100).toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <footer>React → Spring Boot → FastAPI · ALLOW &lt; 45% ≤ REVIEW &lt; 80% ≤ BLOCK</footer>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
