import React, { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL ?? "https://api.identity.sovegent.com";

type ProofType = "notarization" | "attestation";

interface VerifyResult {
  type: ProofType;
  id: string;
  signer: string;
  algorithm: string;
  timestamp?: string;
  issuedAt?: string;
  expiresAt?: string | null;
  expired?: boolean;
  documentHash?: string;
  mimeType?: string;
  label?: string;
  issuer?: string;
  subject?: string;
  claim?: Record<string, unknown>;
  anchor?: { chain: string; txHash: string; blockNumber?: number; anchoredAt: string } | null;
  verifiedAt: string;
}

export function App() {
  const [proofId, setProofId] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = window.location.pathname.replace(/^\/p\//, "").replace(/^\//, "");
    if (id && id !== "") {
      setProofId(id);
      fetchProof(id);
    }
  }, []);

  async function fetchProof(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/verify/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const j = await res.json() as { error: string };
        setError(j.error ?? "Proof not found");
        return;
      }
      setResult(await res.json() as VerifyResult);
    } catch {
      setError("Could not reach verification server. You can verify this proof offline using the Sovegent Identity SDK.");
    } finally {
      setLoading(false);
    }
  }

  function handleLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const id = (fd.get("id") as string ?? "").trim();
    if (!id) return;
    setProofId(id);
    window.history.pushState(null, "", `/p/${id}`);
    fetchProof(id);
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoMark}>⬡</span>
          <span style={styles.logoText}>Sovegent Identity</span>
          <span style={styles.logoBadge}>VERIFY</span>
        </div>
        <p style={styles.tagline}>Cryptographic proof verification — no account required</p>
      </header>

      <main style={styles.main}>
        {!proofId && (
          <form onSubmit={handleLookup} style={styles.lookupForm}>
            <p style={styles.lookupLabel}>Enter a proof ID to verify:</p>
            <div style={styles.lookupRow}>
              <input name="id" style={styles.input} placeholder="urn:sovegent:notarization:..." />
              <button type="submit" style={styles.btn}>Verify</button>
            </div>
          </form>
        )}

        {loading && <StatusCard status="loading" />}
        {error && <StatusCard status="error" message={error} />}
        {result && <ProofCard result={result} onReset={() => { setResult(null); setProofId(null); window.history.pushState(null, "", "/"); }} />}

        {!proofId && !result && (
          <div style={styles.hint}>
            <p>Or navigate directly to:</p>
            <code style={styles.code}>verify.identity.sovegent.com/p/YOUR_PROOF_ID</code>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <a href="https://identity.sovegent.com" style={styles.footerLink}>identity.sovegent.com</a>
        <span style={styles.muted}>·</span>
        <a href="https://github.com/sovegent/sovegent-identity" style={styles.footerLink}>GitHub</a>
        <span style={styles.muted}>·</span>
        <span style={styles.muted}>Part of the Sovegent ecosystem</span>
      </footer>
    </div>
  );
}

function StatusCard({ status, message }: { status: "loading" | "error"; message?: string }) {
  if (status === "loading") {
    return (
      <div style={styles.card}>
        <div style={styles.spinner} />
        <p style={{ color: "var(--muted)", marginTop: 12 }}>Fetching proof…</p>
      </div>
    );
  }
  return (
    <div style={{ ...styles.card, borderColor: "var(--red)", background: "var(--red-glow)" }}>
      <div style={styles.statusIcon}>✗</div>
      <p style={{ color: "var(--red)", fontWeight: 600 }}>Proof Not Found</p>
      <p style={{ color: "var(--muted)", marginTop: 8, fontSize: 14 }}>{message}</p>
    </div>
  );
}

function ProofCard({ result, onReset }: { result: VerifyResult; onReset: () => void }) {
  const [showRaw, setShowRaw] = useState(false);
  const isExpired = result.expired;
  const isValid = !isExpired;

  const borderColor = isValid ? "var(--green)" : "var(--red)";
  const bgColor = isValid ? "var(--green-glow)" : "var(--red-glow)";

  return (
    <div style={{ ...styles.card, borderColor, background: bgColor }}>
      <div style={styles.statusIcon}>{isValid ? "✓" : "✗"}</div>

      <p style={{ color: isValid ? "var(--green)" : "var(--red)", fontWeight: 700, fontSize: 22, marginBottom: 4 }}>
        {isValid ? "VERIFIED" : "EXPIRED"}
      </p>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24 }}>
        {result.type === "notarization" ? "Document Notarization" : "Signed Attestation"}
      </p>

      <div style={styles.fields}>
        {result.label && <Field label="Label" value={result.label} />}
        {result.documentHash && <Field label="SHA-256" value={result.documentHash} mono />}
        {result.mimeType && <Field label="Type" value={result.mimeType} />}
        {result.issuer && <Field label="Issuer" value={result.issuer} mono />}
        {result.subject && <Field label="Subject" value={result.subject} mono />}
        {result.claim && <Field label="Claim" value={JSON.stringify(result.claim, null, 2)} mono />}
        <Field label="Signed by" value={result.signer} mono />
        <Field label="Algorithm" value={result.algorithm} />
        <Field label="Timestamp" value={result.timestamp ?? result.issuedAt ?? ""} />
        {result.expiresAt && <Field label="Expires" value={result.expiresAt} />}
        {result.anchor ? (
          <>
            <Field label="Chain" value={result.anchor.chain} />
            <Field label="Tx Hash" value={result.anchor.txHash} mono />
          </>
        ) : (
          <Field label="On-chain anchor" value="Not anchored" />
        )}
        <Field label="Verified at" value={result.verifiedAt} />
      </div>

      <div style={styles.actions}>
        <button onClick={() => setShowRaw(!showRaw)} style={styles.btnGhost}>
          {showRaw ? "Hide" : "View"} raw JSON
        </button>
        <button onClick={onReset} style={styles.btnGhost}>Verify another</button>
      </div>

      {showRaw && (
        <pre style={styles.rawJson}>{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}</span>
      <span style={{ ...styles.fieldValue, fontFamily: mono ? "var(--mono)" : "var(--sans)", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px" },
  header: { textAlign: "center", marginBottom: 40 },
  logo: { display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 8 },
  logoMark: { fontSize: 28, color: "var(--accent)" },
  logoText: { fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--text)" },
  logoBadge: { fontSize: 11, fontWeight: 700, fontFamily: "var(--mono)", color: "var(--accent)", background: "var(--accent-glow)", border: "1px solid var(--accent)", borderRadius: 4, padding: "2px 6px", letterSpacing: 1 },
  tagline: { color: "var(--muted)", fontSize: 14 },
  main: { width: "100%", maxWidth: 640, flex: 1 },
  lookupForm: { marginBottom: 32 },
  lookupLabel: { color: "var(--muted)", fontSize: 14, marginBottom: 10 },
  lookupRow: { display: "flex", gap: 8 },
  input: { flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 13, outline: "none" },
  btn: { background: "var(--accent)", border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  btnGhost: { background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", color: "var(--muted)", cursor: "pointer", fontSize: 13 },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, textAlign: "center" },
  statusIcon: { fontSize: 40, marginBottom: 12 },
  fields: { textAlign: "left", marginTop: 24, display: "flex", flexDirection: "column", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 2, borderBottom: "1px solid var(--border)", paddingBottom: 10 },
  fieldLabel: { fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "var(--mono)" },
  fieldValue: { fontSize: 13, color: "var(--text)" },
  actions: { display: "flex", gap: 8, justifyContent: "center", marginTop: 24, flexWrap: "wrap" },
  rawJson: { textAlign: "left", marginTop: 16, background: "var(--surface2)", borderRadius: 8, padding: 16, fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)", overflowX: "auto", whiteSpace: "pre-wrap" },
  spinner: { width: 32, height: 32, border: "3px solid var(--border)", borderTop: "3px solid var(--accent)", borderRadius: "50%", margin: "0 auto", animation: "spin 1s linear infinite" },
  hint: { textAlign: "center", color: "var(--muted)", fontSize: 14, marginTop: 32, display: "flex", flexDirection: "column", gap: 8 },
  code: { fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)", background: "var(--surface)", padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)" },
  footer: { marginTop: 60, display: "flex", gap: 12, alignItems: "center", fontSize: 13 },
  footerLink: { color: "var(--accent)", textDecoration: "none" },
  muted: { color: "var(--muted)" },
};
