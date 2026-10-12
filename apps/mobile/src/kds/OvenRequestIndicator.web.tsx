export function OvenRequestIndicator() {
  return (
    <span
      role="img"
      aria-label="Forno solicitado"
      title="Forno solicitado"
      style={{ alignSelf: "center", display: "inline-flex", color: "#ff6464" }}
    >
      <svg
        aria-hidden="true"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 3c1 5 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 3 2 4 3 4 2-3 1-6 0-10z" />
      </svg>
    </span>
  );
}
