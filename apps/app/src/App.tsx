import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "./hooks/useWallet.js";
import { apiGet, apiPost } from "./lib/api.js";

type View = "dashboard" | "notarize" | "attest" | "history";

interface NotarizationRecord {
  id: string; documentHash: string; mimeType: string;
  label?: string; createdAt: string; anchor?: { chain: string; txHash: string } | null;
}
interface AttestationRecord {
  id: string; subjectId: string; claim: Record<string, unknown>;
  issuedAt: string; expiresAt?: string | null;
}

export function App() {
  const wallet = useWallet();
  const [view, setView] = useState<View>("dashboard");
  const [notarizations, setNotarizations] = useState<NotarizationRecord[]>([]);
  const [attestations, setAttestations] = useState<AttestationRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!wallet.isConnected) return;
    try {
      const [n, a] = await Promise.all([
        apiGet<NotarizationRecord[]>("/notarizations"),
        apiGet<AttestationRecord[]>("/attestations"),
      ]);
      setNotarizations(n);
      setAttestations(a);
    } catch (e: any) { setLoadError(e.message); }
  }, [wallet.isConnected]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!wallet.isConnected) {
    return (
      <LoginScreen
        walletType={wallet.walletType}
        onConnect={wallet.connect}
        busy={wallet.isAuthenticating}
        error={wallet.error}
      />
    );
  }

  return (
    <div style={s.shell}>
      <Sidebar
        address={wallet.address!}
        walletType={wallet.walletType}
        view={view}
        onNav={setView}
        onSignOut={wallet.disconnect}
      />
      <div style={s.content}>
        {(wallet.error || loadError) && (
          <div style={s.errorBanner}>
            {wallet.error ?? loadError}
            <button onClick={() => { wallet.clearError(); setLoadError(null); }} style={s.dismiss}>✕</button>
          </div>
        )}
        {view === "dashboard" && <Dashboard notarizations={notarizations} attestations={attestations} />}
        {view === "notarize" && <NotarizeView onDone={() => { setView("history"); loadData(); }} />}
        {view === "attest" && <AttestView address={wallet.address!} onDone={() => { setView("history"); loadData(); }} />}
        {view === "history" && <HistoryView notarizations={notarizations} attestations={attestations} />}
      </div>
    </div>
  );
}

function LoginScreen({ walletType, onConnect, busy, error }: {
  walletType: string; onConnect: () => void; busy: boolean; error: string | null;
}) {
  const hasWallet = walletType !== "none";
  const isSovegentWallet = walletType === "sovegent-wallet";

  return (
    <div style={s.loginPage}>
      <div style={s.loginCard}>
        <div style={s.bigLogo}>⬡</div>
        <h1 style={s.loginTitle}>Sovegent Identity</h1>
        <p style={s.loginSub}>Identity & Verification — powered by your wallet</p>

        {isSovegentWallet && (
          <div style={s.walletBadge}>
            <span style={{ color: "var(--green)" }}>●</span> Sovegent Wallet detected
          </div>
        )}

        <button onClick={onConnect} disabled={busy || !hasWallet} style={s.connectBtn}>
          {busy ? "Check your wallet…" : hasWallet ? "Connect Wallet" : "No Wallet Found"}
        </button>

        {!hasWallet && (
          <a
            href="https://github.com/sovegent/sovegent-wallet"
            target="_blank"
            rel="noopener noreferrer"
            style={s.installLink}
          >
            ↗ Install Sovegent Wallet
          </a>
        )}

        {error && <p style={s.loginError}>{error}</p>}
        <p style={s.loginHint}>Compatible with Sovegent Wallet, MetaMask, and any EIP-1193 wallet</p>
      </div>
    </div>
  );
}

function Sidebar({ address, walletType, view, onNav, onSignOut }: {
  address: string; walletType: string; view: View; onNav: (v: View) => void; onSignOut: () => void;
}) {
  const nav: { id: View; label: string; icon: string }[] = [
    { id: "dashboard", label: "Overview", icon: "◈" },
    { id: "notarize", label: "Notarize", icon: "⊞" },
    { id: "attest", label: "Attest", icon: "◎" },
    { id: "history", label: "History", icon: "≡" },
  ];
  return (
    <aside style={s.sidebar}>
      <div style={s.sidebarLogo}><span style={{ color: "var(--accent)" }}>⬡</span> Sovegent Identity</div>
      <nav style={s.nav}>
        {nav.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)}
            style={{ ...s.navBtn, ...(view === n.id ? s.navBtnActive : {}) }}>
            <span>{n.icon}</span> {n.label}
          </button>
        ))}
      </nav>
      <div style={s.sidebarFooter}>
        <p style={s.walletTypeBadge}>{walletType === "sovegent-wallet" ? "🔐 Sovegent Wallet" : "🦊 " + walletType}</p>
        <p style={s.addressChip}>{address.slice(0, 6)}…{address.slice(-4)}</p>
        <button onClick={onSignOut} style={s.signOutBtn}>Sign out</button>
      </div>
    </aside>
  );
}

function Dashboard({ notarizations, attestations }: { notarizations: NotarizationRecord[]; attestations: AttestationRecord[] }) {
  return (
    <div style={s.page}>
      <h2 style={s.pageTitle}>Overview</h2>
      <div style={s.statGrid}>
        <StatCard label="Notarizations" value={notarizations.length} icon="⊞" />
        <StatCard label="Attestations issued" value={attestations.length} icon="◎" />
        <StatCard label="Anchored on-chain" value={notarizations.filter(n => n.anchor).length} icon="⛓" />
      </div>
      {notarizations.length > 0 && (
        <>
          <h3 style={s.sectionTitle}>Recent Notarizations</h3>
          {notarizations.slice(0, 5).map(n => (
            <ProofRow key={n.id} id={n.id}
              title={n.label ?? n.documentHash.slice(0, 24) + "…"}
              sub={n.createdAt} anchored={!!n.anchor} />
          ))}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div style={s.statCard}>
      <span style={s.statIcon}>{icon}</span>
      <span style={s.statValue}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

function ProofRow({ id, title, sub, anchored }: { id: string; title: string; sub: string; anchored: boolean }) {
  return (
    <div style={s.proofRow}>
      <div>
        <p style={s.proofTitle}>{title}</p>
        <p style={s.proofSub}>{sub}</p>
      </div>
      <div style={s.proofActions}>
        {anchored && <span style={s.anchorBadge}>⛓ Anchored</span>}
        <a href={`https://verify.identity.sovegent.com/p/${encodeURIComponent(id)}`}
          target="_blank" rel="noopener noreferrer" style={s.verifyLink}>Verify ↗</a>
      </div>
    </div>
  );
}

function NotarizeView({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NotarizationRecord | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const buf = await file.arrayBuffer();
      const hashBuf = await crypto.subtle.digest("SHA-256", buf);
      const hashHex = Array.from(new Uint8Array(hashBuf))
        .map(b => b.toString(16).padStart(2, "0")).join("");
      const record = await apiPost<NotarizationRecord>("/notarizations", {
        documentHash: hashHex,
        mimeType: file.type || "application/octet-stream",
        label: label || file.name,
        proofJson: JSON.stringify({
          payloadHash: hashHex,
          created: new Date().toISOString(),
          note: "Browser hash — use Sovegent Wallet extension for full cryptographic proof",
        }),
      });
      setResult(record);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (result) return (
    <div style={s.page}>
      <h2 style={s.pageTitle}>Notarization Created ✓</h2>
      <div style={s.successCard}>
        <p style={{ color: "var(--green)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Document notarized</p>
        <p style={s.mono}>ID: {result.id}</p>
        <p style={s.mono}>SHA-256: {result.documentHash}</p>
        <p style={{ marginTop: 16, color: "var(--muted)", fontSize: 13 }}>Share this link to let anyone verify:</p>
        <a href={`https://verify.identity.sovegent.com/p/${encodeURIComponent(result.id)}`}
          target="_blank" rel="noopener noreferrer" style={s.verifyLink}>
          verify.identity.sovegent.com/p/… ↗
        </a>
        <button onClick={onDone} style={{ ...s.connectBtn, marginTop: 24 }}>View history</button>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <h2 style={s.pageTitle}>Notarize a Document</h2>
      <p style={s.pageDesc}>Hash and timestamp any file. The SHA-256 fingerprint is stored with a cryptographic proof.</p>
      <form onSubmit={handleSubmit} style={s.form}>
        <label style={s.label}>File</label>
        <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} style={s.fileInput} required />
        {file && <p style={s.fileMeta}>{file.name} · {(file.size / 1024).toFixed(1)} KB · {file.type || "unknown"}</p>}
        <label style={s.label}>Label (optional)</label>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Contract 2026" style={s.textInput} />
        {error && <p style={s.formError}>{error}</p>}
        <button type="submit" disabled={busy || !file} style={s.connectBtn}>
          {busy ? "Notarizing…" : "Notarize Document"}
        </button>
      </form>
    </div>
  );
}

function AttestView({ address, onDone }: { address: string; onDone: () => void }) {
  const [subject, setSubject] = useState("");
  const [claimKey, setClaimKey] = useState("");
  const [claimVal, setClaimVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AttestationRecord | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const claim = { [claimKey]: claimVal };
      const issuedAt = new Date().toISOString();
      const record = await apiPost<AttestationRecord>("/attestations", {
        subject: subject.toLowerCase(),
        claimJson: JSON.stringify(claim),
        proofJson: JSON.stringify({ issuer: address, claim, issuedAt }),
        issuedAt,
      });
      setResult(record);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (result) return (
    <div style={s.page}>
      <h2 style={s.pageTitle}>Attestation Created ✓</h2>
      <div style={s.successCard}>
        <p style={{ color: "var(--green)", fontWeight: 700, fontSize: 18, marginBottom: 16 }}>Claim attested</p>
        <p style={s.mono}>ID: {result.id}</p>
        <a href={`https://verify.identity.sovegent.com/p/${encodeURIComponent(result.id)}`}
          target="_blank" rel="noopener noreferrer" style={s.verifyLink}>View proof ↗</a>
        <button onClick={onDone} style={{ ...s.connectBtn, marginTop: 24 }}>View history</button>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <h2 style={s.pageTitle}>Issue an Attestation</h2>
      <p style={s.pageDesc}>Sign a claim about any wallet address. Recipients can share the proof link to verify.</p>
      <form onSubmit={handleSubmit} style={s.form}>
        <label style={s.label}>Subject wallet address</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="0x…" style={s.textInput} required />
        <label style={s.label}>Claim</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={claimKey} onChange={e => setClaimKey(e.target.value)} placeholder="key (e.g. isOver18)" style={{ ...s.textInput, flex: 1 }} required />
          <input value={claimVal} onChange={e => setClaimVal(e.target.value)} placeholder="value (e.g. true)" style={{ ...s.textInput, flex: 1 }} required />
        </div>
        {error && <p style={s.formError}>{error}</p>}
        <button type="submit" disabled={busy} style={s.connectBtn}>{busy ? "Issuing…" : "Issue Attestation"}</button>
      </form>
    </div>
  );
}

function HistoryView({ notarizations, attestations }: { notarizations: NotarizationRecord[]; attestations: AttestationRecord[] }) {
  const [tab, setTab] = useState<"notarizations" | "attestations">("notarizations");
  return (
    <div style={s.page}>
      <h2 style={s.pageTitle}>History</h2>
      <div style={s.tabs}>
        <button onClick={() => setTab("notarizations")} style={{ ...s.tab, ...(tab === "notarizations" ? s.tabActive : {}) }}>
          Notarizations ({notarizations.length})
        </button>
        <button onClick={() => setTab("attestations")} style={{ ...s.tab, ...(tab === "attestations" ? s.tabActive : {}) }}>
          Attestations ({attestations.length})
        </button>
      </div>
      {tab === "notarizations" && (
        notarizations.length === 0 ? <p style={s.empty}>No notarizations yet.</p>
          : notarizations.map(n => (
            <ProofRow key={n.id} id={n.id}
              title={n.label ?? n.documentHash.slice(0, 24) + "…"}
              sub={`${n.mimeType} · ${n.createdAt}`} anchored={!!n.anchor} />
          ))
      )}
      {tab === "attestations" && (
        attestations.length === 0 ? <p style={s.empty}>No attestations issued yet.</p>
          : attestations.map(a => (
            <ProofRow key={a.id} id={a.id}
              title={`Claim: ${JSON.stringify(a.claim)}`}
              sub={`Subject: ${a.subjectId} · ${a.issuedAt}`} anchored={false} />
          ))
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: "flex", minHeight: "100vh" },
  sidebar: { width: 220, background: "var(--surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: "24px 0" },
  sidebarLogo: { fontFamily: "var(--mono)", fontWeight: 700, fontSize: 16, padding: "0 20px 24px", display: "flex", gap: 8, alignItems: "center", borderBottom: "1px solid var(--border)" },
  nav: { display: "flex", flexDirection: "column", gap: 2, padding: "16px 8px", flex: 1 },
  navBtn: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 14, textAlign: "left" },
  navBtnActive: { background: "var(--accent-glow)", color: "var(--text)" },
  sidebarFooter: { padding: "16px 20px", borderTop: "1px solid var(--border)" },
  walletTypeBadge: { fontSize: 11, color: "var(--muted)", marginBottom: 4 },
  addressChip: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", marginBottom: 8 },
  signOutBtn: { background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", color: "var(--muted)", cursor: "pointer", fontSize: 12, width: "100%" },
  content: { flex: 1, overflow: "auto" },
  page: { maxWidth: 720, margin: "0 auto", padding: 40 },
  pageTitle: { fontSize: 24, fontWeight: 700, marginBottom: 8 },
  pageDesc: { color: "var(--muted)", fontSize: 14, marginBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: 600, margin: "32px 0 12px" },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 },
  statCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 4 },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 32, fontWeight: 700, fontFamily: "var(--mono)" },
  statLabel: { fontSize: 12, color: "var(--muted)" },
  proofRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "var(--surface)", borderRadius: 10, marginBottom: 8, border: "1px solid var(--border)" },
  proofTitle: { fontFamily: "var(--mono)", fontSize: 13 },
  proofSub: { fontSize: 11, color: "var(--muted)", marginTop: 2 },
  proofActions: { display: "flex", gap: 8, alignItems: "center" },
  anchorBadge: { fontSize: 11, background: "var(--green-dim)", color: "var(--green)", borderRadius: 6, padding: "2px 8px" },
  verifyLink: { fontSize: 12, color: "var(--accent)", textDecoration: "none" },
  form: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 },
  label: { fontSize: 13, color: "var(--muted)", marginBottom: -8 },
  fileInput: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, color: "var(--text)", fontSize: 13 },
  fileMeta: { fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" },
  textInput: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text)", fontSize: 14, outline: "none" },
  formError: { color: "var(--red)", fontSize: 13 },
  connectBtn: { background: "var(--accent)", border: "none", borderRadius: 10, padding: "12px 24px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 15 },
  successCard: { background: "var(--surface)", border: "1px solid var(--green)", borderRadius: 16, padding: 32, display: "flex", flexDirection: "column", gap: 8 },
  mono: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", wordBreak: "break-all" },
  tabs: { display: "flex", gap: 8, marginBottom: 20 },
  tab: { background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", color: "var(--muted)", cursor: "pointer", fontSize: 13 },
  tabActive: { background: "var(--accent-glow)", color: "var(--text)", borderColor: "var(--accent)" },
  empty: { color: "var(--muted)", fontSize: 14, padding: "32px 0" },
  errorBanner: { background: "rgba(239,68,68,0.1)", borderBottom: "1px solid var(--red)", padding: "12px 32px", color: "var(--red)", fontSize: 14, display: "flex", justifyContent: "space-between" },
  dismiss: { background: "none", border: "none", color: "var(--red)", cursor: "pointer" },
  loginPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" },
  loginCard: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: 48, textAlign: "center", maxWidth: 400, width: "100%" },
  bigLogo: { fontSize: 48, color: "var(--accent)", marginBottom: 8 },
  loginTitle: { fontSize: 28, fontWeight: 700, fontFamily: "var(--mono)", marginBottom: 8 },
  loginSub: { color: "var(--muted)", fontSize: 14, marginBottom: 32 },
  walletBadge: { fontSize: 12, background: "var(--green-dim)", borderRadius: 8, padding: "6px 12px", marginBottom: 16, display: "inline-flex", gap: 6, alignItems: "center" },
  loginError: { color: "var(--red)", fontSize: 13, marginTop: 12 },
  loginHint: { color: "var(--muted)", fontSize: 12, marginTop: 16 },
  installLink: { display: "block", marginTop: 12, color: "var(--accent)", fontSize: 13, textDecoration: "none" },
};
