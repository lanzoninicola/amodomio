import type { ReactNode } from "react";

export function Tooltip({
  label,
  children,
  grow = false,
}: {
  label: string;
  children: ReactNode;
  grow?: boolean;
}) {
  return (
    <span
      title={label}
      style={{
        display: "inline-flex",
        minWidth: 0,
        flex: grow ? 1 : undefined,
      }}
    >
      {children}
    </span>
  );
}
