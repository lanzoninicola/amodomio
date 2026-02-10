import { Await, Link, useActionData, useFetcher, useLoaderData, useRevalidator } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { badRequest, ok } from "~/utils/http-response.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import tryit from "~/utils/try-it";
import { toast } from "~/components/ui/use-toast";
import prismaClient from "~/lib/prisma/client.server";
import { Suspense, useEffect, useRef, useState } from "react";
import { Loader2, Pin, PinOff, Settings } from "lucide-react";

export async function loader() {
    const topNav = (async () => {
        try {
            return await prismaClient.adminNavigationClick.findMany({
                orderBy: [{ count: "desc" }, { lastClickedAt: "desc" }],
                take: 8,
            });
        } catch (error) {
            console.error("[AdminIndex.loader] erro ao buscar topNav", error);
            return [];
        }
    })();

    const pinnedNav = (async () => {
        try {
            return await prismaClient.adminNavigationClick.findMany({
                where: { pinned: true },
                orderBy: [{ lastClickedAt: "desc" }],
                take: 8,
            });
        } catch (error) {
            console.error("[AdminIndex.loader] erro ao buscar pinnedNav", error);
            return [];
        }
    })();

    return defer({ topNav, pinnedNav });
}


export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "menu-item-visibility-change") {
        const id = values?.id as string

        const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

        if (errItem) {
            return badRequest(errItem)
        }

        if (!item) {
            return badRequest("Item não encontrado")
        }

        const [err, result] = await tryit(menuItemPrismaEntity.update(id, {
            visible: !item.visible
        }))

        if (err) {
            return badRequest(err)
        }

        const returnedMessage = !item.visible === true ? `Sabor "${item.name}" visivel no cardápio` : `Sabor "${item.name}" não visivel no cardápio`;

        return ok(returnedMessage);
    }

    if (_action === "menu-item-activation-change") {
        const id = values?.id as string

        const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

        if (errItem) {
            return badRequest(errItem)
        }

        if (!item) {
            return badRequest("Item não encontrado")
        }

        const [err, result] = await tryit(menuItemPrismaEntity.softDelete(id))

        if (err) {
            return badRequest(err)
        }

        const returnedMessage = !item.active === true ? `Sabor "${item.name}" ativado` : `Sabor "${item.name}" desativado`;

        return ok(returnedMessage);
    }

    return null

}


export default function AdminIndex() {
    const actionData = useActionData<typeof action>();
    const loaderData = useLoaderData<typeof loader>();
    const fetcher = useFetcher();
    const revalidator = useRevalidator();
    const pendingPinRequestIdRef = useRef<string | null>(null);
    const pendingPinPrevPinnedRef = useRef<boolean | null>(null);
    const [pendingPinHref, setPendingPinHref] = useState<string | null>(null);
    const [pinOverrides, setPinOverrides] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (fetcher.state !== "idle") return;
        if (!pendingPinRequestIdRef.current) return;
        const response = fetcher.data as {
            status?: number;
            message?: string;
            payload?: { requestId?: string; pinned?: boolean };
        } | undefined;
        const responseRequestId = response?.payload?.requestId ?? "";
        if (responseRequestId !== pendingPinRequestIdRef.current) return;

        if (response?.status && response.status >= 400) {
            if (pendingPinHref && pendingPinPrevPinnedRef.current !== null) {
                setPinOverrides((prev) => ({
                    ...prev,
                    [pendingPinHref]: Boolean(pendingPinPrevPinnedRef.current),
                }));
            }
            toast({
                title: "Erro ao atualizar fixado",
                description: response.message || "Não foi possível fixar/desfixar o link.",
            });
            pendingPinRequestIdRef.current = null;
            pendingPinPrevPinnedRef.current = null;
            setPendingPinHref(null);
            return;
        }

        const pinned = Boolean(response?.payload?.pinned);
        toast({
            title: pinned ? "Link fixado" : "Link desfixado",
            description: pinned
                ? "Atalho adicionado aos fixados."
                : "Atalho removido dos fixados.",
        });

        pendingPinRequestIdRef.current = null;
        pendingPinPrevPinnedRef.current = null;
        setPendingPinHref(null);
        revalidator.revalidate();
    }, [fetcher.state, fetcher.data, pendingPinHref, revalidator]);

    if (actionData && actionData.status > 399) {
        toast({
            title: "Erro",
            description: actionData.message,
        });
    }

    if (actionData && actionData.status === 200) {
        toast({
            title: "Ok",
            description: actionData.message,
        });
    }

    return (
        <Container className="md:max-w-none">
            <div className="grid place-items-center h-full gap-8 py-10">
                <div className="w-full max-w-5xl">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                Dashboard
                            </p>
                            <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                                Bem vindo ao painel de administração! 👋🏻
                            </h1>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Acesse rapidamente as áreas mais usadas do dia a dia.
                            </p>
                        </div>
                        <Link
                            to="/admin/administracao/settings"
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <Settings className="h-4 w-4" />
                            Configurações
                        </Link>
                    </div>
                </div>
                <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-1">
                    <Suspense
                        fallback={(
                            <div className="rounded-lg border border-muted bg-white p-5 shadow-sm">
                                <div className="mt-2 rounded-md border border-muted bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                                    Carregando acessos do admin...
                                </div>
                            </div>
                        )}
                    >
                        <Await resolve={Promise.all([loaderData.topNav, loaderData.pinnedNav])}>
                            {([topNav, pinnedNav]: [
                                { id: string; href: string; title: string; count: number; groupTitle?: string | null; pinned?: boolean }[],
                                { id: string; href: string; title: string; count: number; groupTitle?: string | null; pinned?: boolean }[]
                            ]) => {
                                const topNavWithOverrides = topNav.map((item) => ({
                                    ...item,
                                    pinned: pinOverrides[item.href] ?? Boolean(item.pinned),
                                }));
                                const pinnedNavWithOverrides = pinnedNav.filter(
                                    (item) => (pinOverrides[item.href] ?? true) === true
                                );
                                const pinnedFromTopOverride = topNavWithOverrides.filter(
                                    (item) =>
                                        item.pinned === true &&
                                        pinnedNavWithOverrides.some((p) => p.href === item.href) === false
                                );
                                const effectivePinnedNav = [...pinnedNavWithOverrides, ...pinnedFromTopOverride];
                                const topNavUnpinned = topNavWithOverrides.filter((item) => item.pinned !== true);
                                const hasAny = topNavUnpinned.length > 0 || effectivePinnedNav.length > 0;

                                if (!hasAny) {
                                    return (
                                        <section className="rounded-lg border border-muted bg-white p-5 shadow-sm">
                                            <h2 className="text-base font-semibold text-slate-900">
                                                Mais acessados no admin
                                            </h2>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Atalhos rápidos para as páginas que você mais usa no painel.
                                            </p>
                                            <p className="mt-3 text-sm text-muted-foreground">
                                                Sem dados de navegação ainda.
                                            </p>
                                        </section>
                                    );
                                }

                                return (
                                    <div className="grid gap-5 lg:grid-cols-2">
                                        {effectivePinnedNav.length > 0 ? (
                                            <section className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.55)] backdrop-blur-sm">
                                                <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                                                    URLs fixadas
                                                </h2>
                                                <div className="mt-3 grid gap-2.5">
                                                    {effectivePinnedNav.map((navItem) => (
                                                        <div
                                                            key={navItem.id}
                                                            className="grid grid-cols-[74px_1fr] items-center gap-2.5"
                                                        >
                                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const requestId = `${Date.now()}-${navItem.href}`;
                                                                        pendingPinRequestIdRef.current = requestId;
                                                                        pendingPinPrevPinnedRef.current = true;
                                                                        setPendingPinHref(navItem.href);
                                                                        setPinOverrides((prev) => ({ ...prev, [navItem.href]: false }));
                                                                        fetcher.submit(
                                                                            {
                                                                                href: navItem.href,
                                                                                title: navItem.title,
                                                                                groupTitle: navItem.groupTitle ?? "",
                                                                                pinned: "false",
                                                                                requestId,
                                                                            },
                                                                            { method: "post", action: "/api/admin-nav-pin" }
                                                                        );
                                                                    }
                                                                    }
                                                                    disabled={fetcher.state !== "idle" && pendingPinHref === navItem.href}
                                                                    className="inline-flex h-10 w-full items-center justify-center rounded-full bg-amber-500 text-white shadow-[0_8px_18px_-12px_rgba(245,158,11,0.95)] transition hover:bg-amber-400 disabled:opacity-80"
                                                                    aria-pressed="true"
                                                                    aria-label="Desfixar link"
                                                                >
                                                                    {fetcher.state !== "idle" && pendingPinHref === navItem.href ? (
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    ) : (
                                                                        <PinOff className="h-3.5 w-3.5" />
                                                                    )}
                                                                </button>
                                                                <span className="text-[10px] font-medium tracking-tight text-slate-500">
                                                                    Desfixar
                                                                </span>
                                                            </div>
                                                            <Link
                                                                to={navItem.href}
                                                                className="group flex min-h-[72px] flex-col justify-center rounded-[22px] bg-slate-100/90 px-4 py-2.5 transition hover:bg-slate-100"
                                                            >
                                                                <span className="text-base font-semibold tracking-tight text-slate-900 md:text-lg">
                                                                    {navItem.title}
                                                                </span>
                                                                {navItem.groupTitle ? (
                                                                    <span className="mt-0.5 text-xs text-slate-500">
                                                                        {navItem.groupTitle}
                                                                    </span>
                                                                ) : null}
                                                            </Link>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        ) : null}

                                            <section
                                            className={[
                                                "rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.55)] backdrop-blur-sm",
                                                effectivePinnedNav.length > 0 ? "" : "lg:col-span-2",
                                            ].join(" ")}
                                        >
                                            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                                                Atalhos rápidos
                                            </h2>
                                            <div className="mt-3 grid gap-2.5">
                                                {topNavUnpinned.map((navItem) => {
                                                    const isPinned = Boolean(navItem.pinned);
                                                    const isSubmittingCurrentPin = fetcher.state !== "idle" && pendingPinHref === navItem.href;
                                                    return (
                                                        <div
                                                            key={navItem.id}
                                                            className="grid grid-cols-[74px_1fr] items-center gap-2.5"
                                                        >
                                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const requestId = `${Date.now()}-${navItem.href}`;
                                                                        pendingPinRequestIdRef.current = requestId;
                                                                        pendingPinPrevPinnedRef.current = isPinned;
                                                                        setPendingPinHref(navItem.href);
                                                                        setPinOverrides((prev) => ({ ...prev, [navItem.href]: !isPinned }));
                                                                        fetcher.submit(
                                                                            {
                                                                                href: navItem.href,
                                                                                title: navItem.title,
                                                                                groupTitle: navItem.groupTitle ?? "",
                                                                                pinned: isPinned ? "false" : "true",
                                                                                requestId,
                                                                            },
                                                                            { method: "post", action: "/api/admin-nav-pin" }
                                                                        );
                                                                    }
                                                                    }
                                                                    disabled={isSubmittingCurrentPin}
                                                                    className="inline-flex h-10 w-full items-center justify-center rounded-full bg-amber-500 text-white shadow-[0_8px_18px_-12px_rgba(245,158,11,0.95)] transition hover:bg-amber-400"
                                                                    aria-pressed={isPinned}
                                                                    aria-label={isPinned ? "Desfixar link" : "Fixar link"}
                                                                >
                                                                    {isPinned ? (
                                                                        <>
                                                                            {isSubmittingCurrentPin ? (
                                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            ) : (
                                                                                <PinOff className="h-3.5 w-3.5" />
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            {isSubmittingCurrentPin ? (
                                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            ) : (
                                                                                <Pin className="h-3.5 w-3.5" />
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </button>
                                                                <span className="text-[10px] font-medium tracking-tight text-slate-500">
                                                                    {isPinned ? "Desfixar" : "Fixar"}
                                                                </span>
                                                            </div>
                                                            <Link to={navItem.href} className="group flex min-h-[72px] flex-col justify-center rounded-[22px] bg-slate-100/90 px-4 py-2.5 transition hover:bg-slate-100">
                                                                <span className="text-base font-semibold tracking-tight text-slate-900 md:text-lg">
                                                                    {navItem.title}
                                                                </span>
                                                                {navItem.groupTitle ? (
                                                                    <span className="mt-0.5 text-xs text-slate-500">
                                                                        {navItem.groupTitle}
                                                                    </span>
                                                                ) : null}
                                                                <span className="mt-0.5 text-xs text-slate-500">
                                                                    {navItem.count} acessos
                                                                </span>
                                                            </Link>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    </div>
                                );
                            }}
                        </Await>
                    </Suspense>
                </div>
            </div>
        </Container>
    )
}
