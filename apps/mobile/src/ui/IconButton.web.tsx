import { useTextFont } from "./Text";
import { theme } from "./theme";
import { desktop } from "../platform/desktop";
import { useState } from "react";
const paths: Record<string, string> = {
  calendar:
    "M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h.01 M12 14h.01 M16 14h.01 M8 18h.01 M12 18h.01",
  stock: "M3 7l9-4 9 4v12l-9 3-9-3z M3 7l9 4 9-4 M12 11v11 M7 5l9 4",
  previous: "m15 6-6 6 6 6",
  next: "m9 6 6 6-6 6",
  kanban:
    "M3 4h18v16H3z M9 4v16 M15 4v16 M5 8h2 M11 8h2 M17 8h2 M5 12h2 M11 12h2",
  reduced: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  refresh:
    "M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 6 M4 12l2 6a7 7 0 0 0 12-1",
  filter: "M3 4h18l-7 8v7l-4 2v-9z",
  "filter-off": "M3 4h18l-7 8v7l-4 2v-9z M2 2l20 20",
  home: "m3 10 9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8",
  oven: "M4 3h16v18H4z M7 9h10v8H7z M7 6h.01 M12 6h.01 M17 6h.01",
  cancel: "m6 6 12 12 M18 6 6 18",
  undo: "M3 4v6h6 M3 10l4-4a7 7 0 1 1-1 10",
  flame:
    "M12 3c1 5 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 3 2 4 3 4 2-3 1-6 0-10z",
  status: "M4 7h16 m-4-4 4 4-4 4 M20 17H4 m4-4-4 4 4 4",
  compact: "M4 4h16v16H4z M9 9h11 M9 9v11",
  pin: "m9 3 6 0-1 6 4 4v2H6v-2l4-4-1-6 M12 15v6",
  widget: "M4 4h16v16H4z M12 12h8v8h-8z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
};
export function IconButton({
  label,
  disabled,
  caption,
  icon,
  active,
  appearance = "toolbar",
  onPress,
}: {
  label: string;
  disabled?: boolean;
  caption?: string;
  icon: string;
  active?: boolean;
  appearance?: "toolbar" | "card";
  onPress: () => void;
}) {
  const fontFamily = useTextFont(theme.typography.semibold);
  const [hover, setHover] = useState(false);
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        flex: appearance === "card" && caption ? "1 1 0" : undefined,
        minWidth: 0,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        title={label}
        aria-label={label}
        aria-pressed={active}
        onClick={onPress}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        style={{
          width:
            appearance === "card" && caption ? "100%" : caption ? "auto" : 48,
          flexDirection: appearance === "card" ? "column" : "row",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: appearance === "card" ? "normal" : "nowrap",
          textAlign: "center",
          boxSizing: "border-box",
          flexShrink: 0,
          fontFamily,
          opacity: disabled ? 0.65 : 1,
          height: appearance === "card" && caption ? undefined : 48,
          minHeight: appearance === "card" && caption ? 72 : 48,
          padding: appearance === "card" ? "10px 6px" : 6,
          border: `1px solid ${
            icon === "filter-off"
              ? "#2563eb"
              : appearance === "card"
              ? active
                ? theme.colors.brandYellow
                : "#ffffff"
              : desktop
              ? active || hover
                ? "#ffffff"
                : "#666666"
              : active
              ? theme.colors.primary
              : hover
              ? theme.colors.ring
              : theme.colors.border
          }`,
          borderRadius: theme.radius.md,
          background:
            icon === "filter-off"
              ? "#2563eb"
              : appearance === "card"
              ? active
                ? "#282828"
                : "#ffffff"
              : desktop
              ? "#000000"
              : active
              ? theme.colors.primary
              : hover
              ? theme.colors.secondary
              : theme.colors.card,
          color:
            icon === "filter-off"
              ? "#ffffff"
              : appearance === "card"
              ? active
                ? theme.colors.brandYellow
                : "#282828"
              : desktop
              ? "#ffffff"
              : active
              ? theme.colors.primaryForeground
              : theme.colors.primary,
          cursor: disabled ? "default" : "pointer",
        }}
      >
        <svg
          aria-hidden="true"
          width={appearance === "card" ? 26 : 18}
          height={appearance === "card" ? 26 : 18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <path d={paths[icon] || paths.settings} />
        </svg>
        {caption || null}
      </button>
    </span>
  );
}
