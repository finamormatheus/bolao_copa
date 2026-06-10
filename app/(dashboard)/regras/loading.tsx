export default function RegrasLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Title */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ width: 110, height: 36, borderRadius: 6, background: "var(--bolao-surface-2)", marginBottom: 8 }} className="bolao-skeleton" />
        <div style={{ width: 300, height: 14, borderRadius: 4, background: "var(--bolao-surface-2)" }} className="bolao-skeleton" />
      </div>

      {/* Reward cards row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 30 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: "1 1 160px",
              height: 100,
              borderRadius: 18,
              background: "var(--bolao-surface)",
              border: "1px solid var(--bolao-hairline)",
            }}
            className="bolao-skeleton"
          />
        ))}
      </div>

      <div style={{ height: 1, background: "var(--bolao-hairline)", margin: "0 0 30px" }} />

      {/* Rule blocks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {[180, 220, 160, 140].map((h, i) => (
          <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "var(--bolao-surface-2)", flexShrink: 0 }} className="bolao-skeleton" />
            <div style={{ flex: 1 }}>
              <div style={{ width: 160, height: 20, borderRadius: 5, background: "var(--bolao-surface-2)", marginBottom: 10 }} className="bolao-skeleton" />
              <div style={{ height: h, borderRadius: 12, background: "var(--bolao-surface)", border: "1px solid var(--bolao-hairline)" }} className="bolao-skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
