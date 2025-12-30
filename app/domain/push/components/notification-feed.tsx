import { Link } from "@remix-run/react";
import { Bell, Inbox, AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { NotificationEntry } from "../notification-storage";

type Props = {
  items: NotificationEntry[];
  initialized: boolean;
  onMarkAsRead: (id: string) => void | Promise<void>;
  ctaItems?: NotificationCallToActionItem[];
  loadingMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

export type NotificationCallToActionItem = {
  id: string;
  title: string;
  description: string;
  severity?: "important" | "info";
  icon?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function NotificationFeedItem({ item, onMarkAsRead }: { item: NotificationEntry; onMarkAsRead: (id: string) => void }) {
  const isInternalUrl = item.url?.startsWith("/");
  const timeLabel = formatTime(item.ts);
  const primaryLabel = item.url ? "Abrir" : "Ok";

  return (
    <article
      className="overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-slate-100 transition hover:shadow-lg"
      role="article"
    >
      <div className="flex items-start gap-3 px-4 py-4 sm:px-5 sm:py-5 bg-slate-50/70">
        <div className="relative">
          <div className={
            cn(
              "flex h-9 w-9 items-center justify-center rounded-xl ",
              !item.read && "bg-amber-200/90 shadow-md ring-1 ring-amber-100"
            )
          }>
            <Bell className="h-5 w-5" />
          </div>

        </div>

        <div className="flex-1 ">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-tight">{item.title}</p>
            {timeLabel && <span className="text-sm font-semibold text-slate-700/80">{timeLabel}</span>}
          </div>

          {item.body && <p className="text-xs leading-snug text-slate-800/90">{item.body}</p>}

        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4  px-4 py-3 sm:px-5">
        <Button
          variant="ghost"
          className="h-11 text-slate-700 transition hover:bg-slate-900/5"
          onClick={() => onMarkAsRead(item.id)}
          disabled={item.read}
          type="button"
        >
          {item.read ? "Lida" : "Marcar lida"}
        </Button>

        {item.url ? (
          isInternalUrl ? (
            <Button
              asChild
              variant="secondary"
              className="h-9 rounded-lg"
              onClick={() => onMarkAsRead(item.id)}
              type="button"
            >
              <Link to={item.url} prefetch="intent">
                {primaryLabel}
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="secondary"
              className="h-9 rounded-lg"
              onClick={() => onMarkAsRead(item.id)}
              type="button"
            >
              <a href={item.url} target="_blank" rel="noreferrer">
                {primaryLabel}
              </a>
            </Button>
          )
        ) : (
          <Button
            variant="secondary"
            className="h-11 rounded-lg"
            onClick={() => onMarkAsRead(item.id)}
            type="button"
          >
            {item.read ? "Feito" : primaryLabel}
          </Button>
        )}
      </div>
    </article>
  );
}

export function NotificationFeed({
  items,
  initialized,
  onMarkAsRead,
  ctaItems,
  loadingMessage = "Carregando notificações...",
  emptyTitle = "Nenhuma notificação por aqui ainda.",
  emptyDescription = "Assim que chegarem, elas aparecem aqui.",
  className,
}: Props) {
  const hasCtas = (ctaItems?.length || 0) > 0;

  if (!initialized) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {hasCtas && ctaItems!.map((cta) => <NotificationFeedItemCallToAction key={cta.id} item={cta} />)}
        <p className="text-sm text-muted-foreground">{loadingMessage}</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {hasCtas && ctaItems!.map((cta) => <NotificationFeedItemCallToAction key={cta.id} item={cta} />)}
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Inbox className="h-8 w-8" aria-hidden />
          <p className="font-semibold text-slate-700">{emptyTitle}</p>
          {emptyDescription && <p className="text-xs text-slate-500">{emptyDescription}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {ctaItems?.map((cta) => (
        <NotificationFeedItemCallToAction key={cta.id} item={cta} />
      ))}
      {items.map((item) => (
        <NotificationFeedItem key={item.id} item={item} onMarkAsRead={onMarkAsRead} />
      ))}
    </div>
  );
}

function NotificationFeedItemCallToAction({ item }: { item: NotificationCallToActionItem }) {
  const isImportant = item.severity === "important";
  const ring = "ring-slate-100";
  const headerBg = "bg-slate-50/70";
  const iconBg = "bg-amber-200/90 shadow-md ring-1 ring-amber-100";
  const hasSecondary = !!(item.secondaryLabel && item.onSecondary);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl bg-white shadow-md ring-1 transition hover:shadow-lg",
        ring
      )}
      role="article"
    >
      <div className={cn("flex items-start gap-3 px-4 py-4 sm:px-5 sm:py-5", headerBg)}>
        <div className="relative">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", iconBg)}>
            {item.icon || <AlertTriangle className="h-5 w-5" />}
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-tight">{item.title}</p>
            <div className="flex items-center gap-1" />
          </div>

          <p className="text-xs leading-snug text-slate-800/90">{item.description}</p>
        </div>
      </div>

      <div className={cn("grid gap-x-4 px-4 py-3 sm:px-5", hasSecondary ? "grid-cols-2" : "grid-cols-1")}>
        <Button
          variant="secondary"
          className="h-11 rounded-lg"
          onClick={item.onPrimary}
          disabled={item.primaryDisabled}
          type="button"
        >
          {item.primaryLabel}
        </Button>
        {item.secondaryLabel && item.onSecondary && (
          <Button
            variant="ghost"
            className="h-11 rounded-lg"
            onClick={item.onSecondary}
            type="button"
          >
            {item.secondaryLabel}
          </Button>
        )}
      </div>
    </article>
  );
}
