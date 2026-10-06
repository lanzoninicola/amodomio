import { useState } from "react";
const paths: Record<string, string> = {
  compact: "M4 4h16v16H4z M9 9h11 M9 9v11",
  pin: "m9 3 6 0-1 6 4 4v2H6v-2l4-4-1-6 M12 15v6",
  widget: "M4 4h16v16H4z M12 12h8v8h-8z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
};
export function IconButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active?: boolean;
  onPress: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onPress}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        style={{
          width: 32,
          height: 32,
          padding: 6,
          border: "1px solid #d4d4d4",
          borderRadius: 6,
          background: active ? "#e5e5e5" : "white",
          color: "#262626",
          cursor: "pointer",
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
        >
          <path d={paths[icon] || paths.settings} />
        </svg>
      </button>
      {hover ? (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            zIndex: 10000,
            background: "#262626",
            color: "white",
            fontSize: 12,
            padding: "5px 8px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
