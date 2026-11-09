import type { KdsOrder } from "./types";

export function OrderWhatsappButton({
  order,
  onContact,
  busy = false,
}: {
  order: KdsOrder;
  onContact: (order: KdsOrder) => void;
  busy?: boolean;
}) {
  const hasPhone = Boolean(order.customerPhone?.trim());
  const label = hasPhone
    ? `WhatsApp do pedido #${order.commandNumber ?? "VL"}: ${
        order.customerPhone
      }`
    : "WhatsApp: telefone não informado";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={busy || !hasPhone}
      onClick={(event) => {
        event.stopPropagation();
        onContact(order);
      }}
      style={{
        width: 44,
        height: 44,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "1px solid #25d366",
        borderRadius: 8,
        color: "#25d366",
        opacity: hasPhone ? (busy ? 0.6 : 1) : 0.25,
        cursor: busy || !hasPhone ? "default" : "pointer",
        flexShrink: 0,
      }}
    >
      <svg
        width="25"
        height="25"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 11.5a9 9 0 0 1-13.5 8L3 21l1.5-4.5A9 9 0 1 1 21 11.5Z" />
        <path d="m8 7 2 3-1.2 1.2a9 9 0 0 0 4 4L14 14l3 2c-.5 2-2 2-3 1.5A13 13 0 0 1 6.5 10C6 9 6 7.5 8 7Z" />
      </svg>
    </button>
  );
}
