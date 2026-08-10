// apps/landing is the static-first public marketing shell (docs/superpowers
// specs §3.1): tokens-only styling this slice, no shadcn component layer
// yet (that lands with the first real form in slice 2), and — per the
// Global Constraints in the slice-1 task briefs — NO BFF/API routes and NO
// Supabase server client. The authenticated surface lives only in
// apps/app.
export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 48,
        background: "var(--paper)",
        color: "var(--ink-950)",
      }}
    >
      <span
        className="brand"
        style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
      >
        GoProceed
      </span>
      <h1 style={{ maxWidth: 660, fontSize: "clamp(40px, 5vw, 64px)", letterSpacing: "-2px", marginTop: 24 }}>
        Evidence-to-payment operating layer
      </h1>
      <p style={{ maxWidth: 620, color: "var(--muted)", fontSize: 18, lineHeight: 1.55 }}>
        Evidence-to-payment operating layer. Публічний лендинг — наповнення далі.
      </p>
    </main>
  );
}
