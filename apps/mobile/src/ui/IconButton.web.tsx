import { useTextFont } from "./Text";
import { theme } from "./theme";
import { useState } from "react";
const paths: Record<string, string> = {
  refresh:
    "M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 6 M4 12l2 6a7 7 0 0 0 12-1",
  home: "m3 10 9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8",
  oven: "M4 3h16v18H4z M7 9h10v8H7z M7 6h.01 M12 6h.01 M17 6h.01",
  cancel: "m6 6 12 12 M18 6 6 18",
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
  onPress,
}: {
  label: string;
  disabled?: boolean;
  caption?: string;
  icon: string;
  active?: boolean;
  onPress: () => void;
}) {
  const fontFamily = useTextFont(theme.typography.semibold);
  const [hover, setHover] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
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
          width: caption ? "auto" : 34,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
          boxSizing: "border-box",
          flexShrink: 0,
          fontFamily,
          opacity: disabled ? 0.5 : 1,
          height: 36,
          padding: 6,
          border: `1px solid ${
            active
              ? theme.colors.primary
              : hover
              ? theme.colors.ring
              : theme.colors.border
          }`,
          borderRadius: theme.radius.full,
          background: active
            ? theme.colors.primary
            : hover
            ? theme.colors.secondary
            : theme.colors.card,
          color: active ? theme.colors.primaryForeground : theme.colors.primary,
          cursor: disabled ? "default" : "pointer",
        }}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
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
