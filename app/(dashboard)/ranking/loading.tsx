export default function RankingLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Title area */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ width: 120, height: 32, borderRadius: 6, background: "var(--bolao-surface-2)", marginBottom: 8 }} className="bolao-skeleton" />
        <div style={{ width: 260, height: 14, borderRadius: 4, background: "var(--bolao-surface-2)" }} className="bolao-skeleton" />
      </div>

      {/* Group tabs placeholder */}
      <div style={{
        display: "flex",
        padding: 4,
        gap: 4,
        borderRadius: 13,
        background: "var(--bolao-surface)",
        border: "1px solid var(--bolao-hairline)",
        marginBottom: 20,
      }}>
        {[100, 80, 110].map((w, i) => (
          <div
            key={i}
            style={{ width: w, height: 34, borderRadius: 9, background: "var(--bolao-surface-2)", flexShrink: 0 }}
            className="bolao-skeleton"
          />
        ))}
      </div>

      {/* Podium skeleton */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 8,
        marginBottom: 22,
        padding: "0 4px",
      }}>
        {/* 2nd */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 52, height: 52, borderRadius: 99, background: "var(--bolao-surface-2)" }} className="bolao-skeleton" />
          <div style={{ width: "100%", height: 80, borderRadius: "10px 10px 0 0", background: "var(--bolao-surface-2)" }} className="bolao-skeleton" />
        </div>
        {/* 1st */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 64, height: 64, borderRadius: 99, background: "var(--bolao-surface-2)" }} className="bolao-skeleton" />
          <div style={{ width: "100%", height: 110, borderRadius: "10px 10px 0 0", background: "var(--bolao-surface-2)" }} className="bolao-skeleton" />
        </div>
        {/* 3rd */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 52, height: 52, borderRadius: 99, background: "var(--bolao-surface-2)" }} className="bolao-skeleton" />
          <div style={{ width: "100%", height: 60, borderRadius: "10px 10px 0 0", background: "var(--bolao-surface-2)" }} className="bolao-skeleton" />
        </div>
      </div>

      {/* List rows skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 56,
              borderRadius: 12,
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
