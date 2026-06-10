export default function PalpitesLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ width: 130, height: 32, borderRadius: 6, background: "var(--bolao-surface-2)", marginBottom: 8 }} className="bolao-skeleton" />
        <div style={{ width: 220, height: 14, borderRadius: 4, background: "var(--bolao-surface-2)" }} className="bolao-skeleton" />
      </div>

      {/* View toggle (crono / grupos) */}
      <div style={{
        display: "flex",
        padding: 4,
        gap: 4,
        borderRadius: 13,
        background: "var(--bolao-surface)",
        border: "1px solid var(--bolao-hairline)",
        marginBottom: 20,
        width: "fit-content",
      }}>
        {[90, 80].map((w, i) => (
          <div
            key={i}
            style={{ width: w, height: 34, borderRadius: 9, background: "var(--bolao-surface-2)", flexShrink: 0 }}
            className="bolao-skeleton"
          />
        ))}
      </div>

      {/* Date group header */}
      <div style={{ width: 110, height: 13, borderRadius: 4, background: "var(--bolao-surface-2)", marginBottom: 12 }} className="bolao-skeleton" />

      {/* Game cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              height: 88,
              borderRadius: 16,
              background: "var(--bolao-surface)",
              border: "1px solid var(--bolao-hairline)",
            }}
            className="bolao-skeleton"
          />
        ))}
      </div>
    </div>
  );
}
