import type { ReactNode } from "react";
import { MapPin, Pencil, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

type Children = { children: ReactNode };

export function OrderDetailsHeader({ children }: Children) {
  return <header className="heading">{children}</header>;
}

export function OrderCustomerCard({ children }: Children) {
  return (
    <section
      className="order-customer-card"
      aria-label="Informações do cliente"
    >
      <span className="customer-avatar" aria-hidden="true">
        <UserRound size={24} />
      </span>
      {children}
    </section>
  );
}

export function OrderStatusAlerts({
  children,
  checking,
}: Children & { checking: boolean }) {
  return (
    <section
      className="order-checks"
      aria-label="Verificações do pedido"
      aria-busy={checking}
    >
      {children}
    </section>
  );
}

export function OrderInformation({ children }: Children) {
  return (
    <section className="order-information" aria-label="Dados do pedido">
      <h3 className="section-title">Dados do pedido</h3>
      {children}
    </section>
  );
}

export function OrderDeliverySection({ children }: Children) {
  return (
    <section className="delivery-section" aria-label="Entrega">
      <h3 className="section-title">Entrega</h3>
      {children}
    </section>
  );
}

export function OrderItemsSection({
  children,
  count,
}: Children & { count: number }) {
  return (
    <section className="items-section" aria-label="Itens do pedido">
      <div className="items-section-heading">
        <h3 className="section-title items-title">
          Itens do pedido{" "}
          <span className="section-count">
            {count} {count === 1 ? "item" : "itens"}
          </span>
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled
          title="Adicione itens no pedido original do Suitable"
        >
          + Adicionar item
        </Button>
      </div>
      {children}
    </section>
  );
}

export function OrderItemRow({
  children,
  index,
}: Children & { index: number }) {
  return (
    <article className="item" aria-label={`Item ${index + 1}`}>
      {children}
    </article>
  );
}

export function OrderDetailsFooter({ children }: Children) {
  return <footer className="footer">{children}</footer>;
}

type SummaryItem = { name: string; quantity: number; size: string | null };
type SummaryProps = {
  hidden: boolean;
  total: string;
  subtotal: string;
  fee: string;
  status: string;
  items: SummaryItem[];
  name: string;
  phone: string;
  takeAway: boolean;
  neighborhood?: string;
  city?: string | null;
  onEdit: (section: "items" | "delivery") => void;
};

export function OrderSummaryPanel({
  hidden,
  total,
  subtotal,
  fee,
  status,
  items,
  name,
  phone,
  takeAway,
  neighborhood,
  city,
  onEdit,
}: SummaryProps) {
  return (
    <aside
      id="order-summary"
      className="order-summary"
      aria-label="Resumo do pedido"
      hidden={hidden}
    >
      <div className="summary-heading">
        <h2>Resumo do pedido</h2>
        <span className="summary-status">{status}</span>
      </div>
      <dl className="summary-amounts">
        <div>
          <dt>
            Subtotal ({items.length} {items.length === 1 ? "item" : "itens"})
          </dt>
          <dd>{subtotal}</dd>
        </div>
        {!takeAway && (
          <div>
            <dt>Taxa de entrega</dt>
            <dd>{fee}</dd>
          </div>
        )}
        <div className="summary-grand-total">
          <dt>Total do pedido</dt>
          <dd>{total}</dd>
        </div>
      </dl>
      <section className="summary-section">
        <div className="summary-section-heading">
          <h3>Itens</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit("items")}
          >
            <Pencil size={14} /> Editar
          </Button>
        </div>
        <ol className="summary-items">
          {items.map((item, index) => (
            <li key={index}>
              <span className="summary-item-number">{index + 1}.</span>
              <div>
                <strong>{item.name || `Item ${index + 1}`}</strong>
                <p>
                  Qtd. {item.quantity}
                  {item.size ? ` · Tamanho ${item.size}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="summary-section">
        <div className="summary-section-heading">
          <h3>{takeAway ? "Retirada" : "Entrega"}</h3>
          {!takeAway && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEdit("delivery")}
            >
              <Pencil size={14} /> Editar
            </Button>
          )}
        </div>
        <div className="summary-info">
          <span className="summary-info-icon">
            <MapPin size={19} />
          </span>
          <div>
            <strong>
              {takeAway
                ? "Retirada no balcão"
                : neighborhood || "Bairro não selecionado"}
            </strong>
            {!takeAway && <p>{city || "Selecione o bairro de entrega"}</p>}
          </div>
        </div>
        {!takeAway && (
          <div className="summary-info">
            <span className="summary-info-icon">
              <Truck size={19} />
            </span>
            <div>
              <p>Taxa de entrega</p>
              <strong>{fee}</strong>
            </div>
          </div>
        )}
      </section>
      <section className="summary-section">
        <div className="summary-section-heading">
          <h3>Cliente</h3>
        </div>
        <div className="summary-info">
          <span className="customer-avatar">
            <UserRound size={23} />
          </span>
          <div>
            <strong>{name || "Cliente não informado"}</strong>
            <p>{phone || "Telefone não informado"}</p>
          </div>
        </div>
      </section>
    </aside>
  );
}
