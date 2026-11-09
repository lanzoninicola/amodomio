import type { ReactNode } from "react";

export function ToolbarLayout({
  children,
  compact,
}: {
  children: ReactNode;
  compact: boolean;
}) {
  return (
    <div
      style={{
        display: compact ? "grid" : "flex",
        gridTemplateColumns: compact
          ? "max-content max-content minmax(0, 1fr)"
          : undefined,
        alignItems: "center",
        gap: compact ? 12 : 8,
        padding: 8,
        backgroundColor: "#000000",
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}
