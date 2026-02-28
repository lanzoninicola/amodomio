import { LoaderFunction, type LinksFunction, MetaFunction, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Link, Outlet, useFetcher, useLoaderData, useLocation, useRevalidator, useRouteError } from "@remix-run/react";
import { AdminHeader } from "~/components/layout/admin-header/admin-header";
import { SidebarProvider, SidebarTrigger } from "~/components/ui/sidebar";
import { authenticator } from "~/domain/auth/google.server";
import { LoggedUser } from "~/domain/auth/types.server";
import ADMIN_NAVIGATION_LINKS from "~/domain/website-navigation/links/admin-navigation";
import { AdminSidebar } from "~/domain/website-navigation/components/admin-sidebar";
import prismaClient from "~/lib/prisma/client.server";
import { ok } from "~/utils/http-response.server";
import { lastUrlSegment } from "~/utils/url";
import RouteProgressBar from "~/components/route-progress-bar/route-progress-bar";
import { AlertTriangle, Copy, Loader2, MessageSquareReply, X, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "~/components/ui/use-toast";


export interface AdminOutletContext {
    loggedUser: LoggedUser | null
    operatorId: string
    setOperatorId: (operatorId: string) => void
}

const DEFAULT_REPLY_WAIT_SECONDS = 90;
const DASHBOARD_REFRESH_MS = 15_000;

type PendingReplyAlert = {
    customerId: string;
    phoneE164: string;
    name: string | null;
    secondsWaiting: number;
    messagePreview: string | null;
};

function formatWaitingTime(seconds: number) {
    const total = Math.max(0, Math.floor(seconds));
    const days = Math.floor(total / 86_400);
    const hours = Math.floor((total % 86_400) / 3_600);
    const minutes = Math.floor((total % 3_600) / 60);
    const remainingSeconds = total % 60;

    if (days > 0) {
        return `${days}d ${hours}h`;
    }

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }

    return `${remainingSeconds}s`;
}

export const meta: MetaFunction = () => [
    { name: "robots", content: "noindex" },
];


export const links: LinksFunction = () => [
    { rel: "preconnect", href: "https://api.fonts.coollabs.io" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
    },
    {
        href: "https://api.fonts.coollabs.io/css2?family=Inter:wght@400;600;800&display=swap",
        rel: "stylesheet",
    },
];

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
    const environment = process.env.NODE_ENV
    const prismaDbName = prismaClient.dbName
    const pathname = new URL(request.url).pathname;
    const isMobileRoute = pathname.startsWith("/admin/mobile");

    let user = await authenticator.isAuthenticated(request);

    if (!user) {
        return redirect("/login");
    }

    const slug = lastUrlSegment(request.url)

    const [pinnedNav, pendingReplyAlerts] = isMobileRoute
        ? [[], []]
        : await Promise.all([
            prismaClient.adminNavigationClick.findMany({
                where: { pinned: true },
                select: { href: true },
                orderBy: [{ lastClickedAt: "desc" }],
                take: 50,
            }),
            prismaClient.$queryRaw<Array<{
                customer_id: string;
                phone_e164: string;
                name: string | null;
                seconds_waiting: number;
                message_preview: string | null;
            }>>`
                WITH last_event_today AS (
                    SELECT DISTINCT ON (e.customer_id)
                        e.customer_id,
                        e.event_type,
                        e.created_at,
                        NULLIF(TRIM(COALESCE(e.payload ->> 'messageText', '')), '') AS message_preview
                    FROM crm_customer_event e
                    WHERE (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
                    ORDER BY e.customer_id, e.created_at DESC, e.id DESC
                )
                SELECT
                    c.id AS customer_id,
                    c.phone_e164,
                    c.name,
                    EXTRACT(EPOCH FROM (now() - le.created_at))::INT AS seconds_waiting,
                    le.message_preview
                FROM last_event_today le
                INNER JOIN crm_customer c ON c.id = le.customer_id
                WHERE le.event_type = 'WHATSAPP_SENT'
                  AND EXTRACT(EPOCH FROM (now() - le.created_at))::INT >= ${DEFAULT_REPLY_WAIT_SECONDS}
                ORDER BY le.created_at ASC
                LIMIT 15
            `,
        ]);

    return ok({
        user,
        slug,
        environment,
        prismaDbName,
        urlSegment: request.url,
        pinnedNavHrefs: pinnedNav.map((item) => item.href),
        pendingReplyAlerts: pendingReplyAlerts.map((row) => ({
            customerId: row.customer_id,
            phoneE164: row.phone_e164,
            name: row.name,
            secondsWaiting: Number(row.seconds_waiting ?? 0),
            messagePreview: row.message_preview,
        })),
    })
}




export default function AdminOutlet() {
    const loaderData = useLoaderData<typeof loader>();
    const location = useLocation();
    const alertsActionFetcher = useFetcher();
    const revalidator = useRevalidator();

    const loggedUser = loaderData?.payload?.user;
    const slug = loaderData?.payload?.slug;
    const urlSegment = loaderData?.payload?.urlSegment
    const env = loaderData?.payload?.environment
    const pinnedNavHrefs = loaderData?.payload?.pinnedNavHrefs ?? [];
    const pendingReplyAlerts = (loaderData?.payload?.pendingReplyAlerts ?? []) as PendingReplyAlert[];
    const [isAlertsPanelOpen, setIsAlertsPanelOpen] = useState(false);
    const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);
    const [isDraggingPanel, setIsDraggingPanel] = useState(false);
    const [expandedMessageCustomerId, setExpandedMessageCustomerId] = useState<string | null>(null);
    const panelRef = useRef<HTMLElement | null>(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const previousAlertsFetcherStateRef = useRef(alertsActionFetcher.state);
    const alertsFormData = alertsActionFetcher.formData as FormData | undefined;
    const isMobileRoute = location.pathname.startsWith("/admin/mobile");

    useEffect(() => {
        const timer = setInterval(() => {
            revalidator.revalidate();
        }, DASHBOARD_REFRESH_MS);

        return () => clearInterval(timer);
    }, [revalidator]);

    useEffect(() => {
        const previousState = previousAlertsFetcherStateRef.current;
        const currentState = alertsActionFetcher.state;
        previousAlertsFetcherStateRef.current = currentState;

        // Process response only once when the fetcher returns to idle.
        if (previousState === "idle" || currentState !== "idle") return;
        if (!alertsActionFetcher.data) return;

        const response = alertsActionFetcher.data as {
            status?: number;
            message?: string;
            payload?: { intent?: string };
        } | undefined;

        if (response?.status && response.status >= 400) {
            toast({
                title: "Ação não concluída",
                description: response.message || "Não foi possível concluir a ação.",
            });
            return;
        }

        const intent = String(alertsFormData?.get("_intent") ?? "");
        const successTitle =
            intent === "ignore"
                ? "Conversa ignorada"
                : intent === "quick-reply"
                    ? "Resposta rápida enviada"
                    : "Ação concluída";

        toast({
            title: successTitle,
            description: response?.message || "Painel atualizado.",
        });
        revalidator.revalidate();
    }, [alertsActionFetcher.state, alertsActionFetcher.data, alertsFormData, revalidator]);

    useEffect(() => {
        if (pendingReplyAlerts.length === 0) return;
        if (panelPosition) return;
        if (typeof window === "undefined") return;

        const panelWidth = Math.min(420, window.innerWidth - 24);
        setPanelPosition({
            x: Math.max(8, window.innerWidth - panelWidth - 20),
            y: window.innerWidth < 768 ? 96 : 108,
        });
    }, [pendingReplyAlerts.length, panelPosition]);

    const stopDraggingPanel = useCallback(() => {
        setIsDraggingPanel(false);
    }, []);

    const handlePanelDrag = useCallback(
        (event: MouseEvent) => {
            if (!isDraggingPanel) return;
            if (!panelRef.current) return;

            const panelWidth = panelRef.current.offsetWidth;
            const panelHeight = panelRef.current.offsetHeight;
            const margin = 8;
            const maxX = Math.max(margin, window.innerWidth - panelWidth - margin);
            const maxY = Math.max(margin, window.innerHeight - panelHeight - margin);

            const nextX = event.clientX - dragOffsetRef.current.x;
            const nextY = event.clientY - dragOffsetRef.current.y;

            setPanelPosition({
                x: Math.min(Math.max(margin, nextX), maxX),
                y: Math.min(Math.max(margin, nextY), maxY),
            });
        },
        [isDraggingPanel]
    );

    useEffect(() => {
        if (!isDraggingPanel) return;
        window.addEventListener("mousemove", handlePanelDrag);
        window.addEventListener("mouseup", stopDraggingPanel);
        return () => {
            window.removeEventListener("mousemove", handlePanelDrag);
            window.removeEventListener("mouseup", stopDraggingPanel);
        };
    }, [isDraggingPanel, handlePanelDrag, stopDraggingPanel]);

    const startDraggingPanel = (event: ReactMouseEvent<HTMLDivElement>) => {
        if (!panelRef.current) return;
        const rect = panelRef.current.getBoundingClientRect();
        dragOffsetRef.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
        setIsDraggingPanel(true);
        event.preventDefault();
    };

    const copyLast8Digits = useCallback(async (phone: string) => {
        const digits = phone.replace(/\D/g, "");
        const last8 = digits.slice(-8);
        if (!last8) return;

        if (typeof navigator === "undefined" || !navigator.clipboard) return;
        try {
            await navigator.clipboard.writeText(last8);
            toast({
                title: "Copiado",
                description: `Últimos 8 dígitos: ${last8}`,
            });
        } catch {
            toast({
                title: "Falha ao copiar",
                description: "Não foi possível copiar para a área de transferência.",
            });
        }
    }, []);

    if (isMobileRoute) {
        return (
            <div className="min-h-screen bg-slate-50">
                <RouteProgressBar />
                <Outlet context={{ loggedUser }} />
            </div>
        );
    }

    return (
        <SidebarProvider data-element="sidebar-provider">
            <RouteProgressBar />
            <AdminSidebar navigationLinks={ADMIN_NAVIGATION_LINKS} pinnedHrefs={pinnedNavHrefs} />
            <SidebarTrigger />
            {pendingReplyAlerts.length > 0 && isAlertsPanelOpen ? (
                <aside
                    ref={panelRef}
                    className={[
                        "fixed z-[80] w-[min(420px,calc(100vw-1.5rem))] rounded-2xl border border-red-300 bg-red-50/95 p-3 shadow-[0_30px_55px_-30px_rgba(220,38,38,0.75)] backdrop-blur-sm",
                        panelPosition ? "" : "right-3 top-24 md:right-5 md:top-28",
                    ].join(" ")}
                    style={panelPosition ? { left: panelPosition.x, top: panelPosition.y } : undefined}
                >
                    <div
                        className={[
                            "flex items-center justify-between gap-2 text-red-900",
                            isDraggingPanel ? "cursor-grabbing" : "cursor-grab",
                        ].join(" ")}
                        onMouseDown={startDraggingPanel}
                    >
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            <p className="text-sm font-bold">
                                {pendingReplyAlerts.length} aguardando resposta ({DEFAULT_REPLY_WAIT_SECONDS}s+)
                            </p>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onClick={() => revalidator.revalidate()}
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2"
                                        >
                                            {revalidator.state !== "idle" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                            {revalidator.state !== "idle" ? "Atualizando..." : "Atualizar"}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-[10px] font-semibold">
                                        Forçar nova verificação agora
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onClick={() => setIsAlertsPanelOpen(false)}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-300 bg-white text-red-700 transition hover:bg-red-100"
                                        aria-label="Fechar painel de alertas"
                                    >
                                        <ChevronUp className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent className="z-[130] text-[10px] font-semibold">
                                    Fechar painel
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <div className="mt-2 max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                        {pendingReplyAlerts.map((item) => {
                            const isSubmittingItem =
                                alertsActionFetcher.state !== "idle" &&
                                String(alertsFormData?.get("customerId") ?? "") === item.customerId;
                            const isSubmittingQuickReply = isSubmittingItem && String(alertsFormData?.get("_intent") ?? "") === "quick-reply";
                            const isSubmittingIgnore = isSubmittingItem && String(alertsFormData?.get("_intent") ?? "") === "ignore";

                            return (
                                <div
                                    key={item.customerId}
                                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-red-200 bg-white px-2.5 py-2"
                                >
                                    <span className="rounded-full bg-red-600 px-2 py-1 text-[11px] font-bold text-white">
                                        {formatWaitingTime(item.secondsWaiting)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setExpandedMessageCustomerId((current) =>
                                                current === item.customerId ? null : item.customerId
                                            )
                                        }
                                        className="min-w-0 text-left"
                                    >
                                        <span className="block truncate text-xs font-semibold text-slate-900">
                                            {item.name || "Sem nome"}
                                        </span>
                                        {item.messagePreview ? (
                                            <span
                                                className={[
                                                    "block text-[11px] text-slate-700",
                                                    expandedMessageCustomerId === item.customerId
                                                        ? "whitespace-pre-wrap break-words"
                                                        : "truncate",
                                                ].join(" ")}
                                            >
                                                {item.messagePreview}
                                            </span>
                                        ) : (
                                            <span className="block text-[11px] text-slate-500">
                                                Sem prévia da mensagem
                                            </span>
                                        )}
                                        <span className="block truncate text-[11px] text-slate-600">
                                            {item.phoneE164}
                                        </span>
                                    </button>
                                    <div className="flex items-center gap-1.5">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <alertsActionFetcher.Form method="post" action="/api/admin-wpp-alerts">
                                                    <input type="hidden" name="_intent" value="quick-reply" />
                                                    <input type="hidden" name="customerId" value={item.customerId} />
                                                    <input type="hidden" name="phoneE164" value={item.phoneE164} />
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            type="submit"
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                                            aria-label="Resposta rápida"
                                                            disabled={isSubmittingItem}
                                                        >
                                                            {isSubmittingQuickReply ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <MessageSquareReply className="h-3.5 w-3.5" />
                                                            )}
                                                        </button>
                                                    </TooltipTrigger>
                                                </alertsActionFetcher.Form>
                                                <TooltipContent className="z-[130] text-[10px] font-semibold">
                                                    Resposta rápida
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyLast8Digits(item.phoneE164)}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-700 transition hover:bg-red-100"
                                                        aria-label="Copiar últimos 8 dígitos"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent className="z-[130] text-[10px] font-semibold">
                                                    Copiar últimos 8 dígitos
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <alertsActionFetcher.Form method="post" action="/api/admin-wpp-alerts">
                                                    <input type="hidden" name="_intent" value="ignore" />
                                                    <input type="hidden" name="customerId" value={item.customerId} />
                                                    <input type="hidden" name="phoneE164" value={item.phoneE164} />
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            type="submit"
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                                            aria-label="IGNORAR"
                                                            disabled={isSubmittingItem}
                                                        >
                                                            {isSubmittingIgnore ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <X className="h-3.5 w-3.5" />
                                                            )}
                                                        </button>
                                                    </TooltipTrigger>
                                                </alertsActionFetcher.Form>
                                                <TooltipContent className="z-[130] text-[10px] font-semibold">
                                                    Ignorar conversa
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </aside>
            ) : null}
            <div className="flex flex-col w-screen">
                {pendingReplyAlerts.length > 0 ? (
                    <>
                        <div className="fixed inset-x-0 top-0 z-[70] flex h-6 items-center justify-end border-b border-red-300 bg-red-50/95 px-3 text-red-900 shadow-sm md:h-7 md:px-4">
                            <div className="flex items-center gap-2">
                                <p className="flex items-center gap-1.5 text-[11px] font-semibold md:text-xs">
                                    <AlertTriangle className="h-3.5 w-3.5 animate-pulse text-red-600" />
                                    <span>
                                        {pendingReplyAlerts.length} conversa(s) aguardando resposta ({DEFAULT_REPLY_WAIT_SECONDS}s+)
                                    </span>
                                </p>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={() => setIsAlertsPanelOpen((current) => !current)}
                                                className="text-[11px] font-semibold underline underline-offset-2 md:text-xs"
                                            >
                                                {isAlertsPanelOpen ? "Fechar painel" : "Abrir painel"}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent className="z-[130] text-[10px] font-semibold">
                                            {isAlertsPanelOpen ? "Esconder painel flutuante" : "Abrir painel flutuante"}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        <div className="h-6 md:h-7" aria-hidden />
                    </>
                ) : null}
                <AdminHeader slug={slug} urlSegment={urlSegment} />
                {/* {env === "development" && <EnvironmentAlert />} */}
                <div className="mt-6 mr-4 md:mr-12" data-element="outer-div-admin-outlet">
                    <Outlet context={{
                        loggedUser,
                    }} />
                </div>
            </div>
        </SidebarProvider>
    )
}

export function ErrorBoundary() {
    const error = useRouteError();

    console.error("[admin] route error boundary", error);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10">
            <div className="mx-auto max-w-2xl rounded-xl border bg-white p-6 md:p-8 shadow-sm space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Admin</p>
                <h1 className="text-2xl md:text-3xl font-semibold">Ocorreu um erro no painel administrativo</h1>
                <p className="text-sm md:text-base text-slate-600">
                    Atualize a página ou volte para o painel. Se o problema continuar, acione o suporte interno.
                </p>
                <div className="flex flex-wrap gap-2">
                    <Link
                        to="/admin"
                        className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                        Voltar ao painel
                    </Link>
                    <Link
                        to="/"
                        className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                        Ir para o site
                    </Link>
                </div>
            </div>
        </div>
    );
}
