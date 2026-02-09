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
import { Loader2, Pin, PinOff } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
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
                                    <>
                                        {effectivePinnedNav.length > 0 ? (
                                            <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
                                                <h2 className="text-base font-semibold text-amber-900">
                                                    Fixados
                                                </h2>
                                                <p className="mt-1 text-sm text-amber-800/80">
                                                    Links que você fixou para acesso rápido.
                                                </p>
                                                <div className="mt-4 grid gap-2">
                                                    {effectivePinnedNav.map((navItem) => (
                                                        <div
                                                            key={navItem.id}
                                                            className="flex items-center justify-between rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
                                                        >
                                                            <Link
                                                                to={navItem.href}
                                                                className="flex flex-col gap-1"
                                                            >
                                                                <span className="font-medium text-slate-900">
                                                                    {navItem.title}
                                                                </span>
                                                                {navItem.groupTitle ? (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {navItem.groupTitle}
                                                                    </span>
                                                                ) : null}
                                                            </Link>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    {
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
                                                                className="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700 transition hover:bg-amber-100"
                                                                aria-pressed="true"
                                                                aria-label="Desfixar link"
                                                            >
                                                                {fetcher.state !== "idle" && pendingPinHref === navItem.href ? (
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <PinOff className="h-3.5 w-3.5" />
                                                                )}
                                                                <span className="hidden sm:inline">Desfixar</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        ) : null}

                                        <section className="rounded-lg border border-muted bg-white p-5 shadow-sm">
                                            <h2 className="text-base font-semibold text-slate-900">
                                                Mais acessados no admin
                                            </h2>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Atalhos rápidos para as páginas que você mais usa no painel.
                                            </p>
                                            <div className="mt-4 grid gap-3">
                                                {topNavUnpinned.map((navItem) => {
                                                    const isPinned = Boolean(navItem.pinned);
                                                    const isSubmittingCurrentPin = fetcher.state !== "idle" && pendingPinHref === navItem.href;
                                                    return (
                                                        <div
                                                            key={navItem.id}
                                                            className="flex items-center justify-between rounded-md border border-muted bg-slate-50 px-4 py-3 text-sm transition hover:border-slate-300 hover:bg-white"
                                                        >
                                                            <Link to={navItem.href} className="flex flex-col gap-1">
                                                                <span className="font-medium text-slate-900">
                                                                    {navItem.title}
                                                                </span>
                                                                {navItem.groupTitle ? (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {navItem.groupTitle}
                                                                    </span>
                                                                ) : null}
                                                            </Link>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xs text-muted-foreground">
                                                                    {navItem.count} acessos
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        {
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
                                                                    className={[
                                                                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                                                                        isPinned
                                                                            ? "border-amber-200 text-amber-700 hover:bg-amber-100"
                                                                            : "border-slate-200 text-slate-600 hover:bg-slate-100",
                                                                    ].join(" ")}
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
                                                                            <span className="hidden sm:inline">Desfixar</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            {isSubmittingCurrentPin ? (
                                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                            ) : (
                                                                                <Pin className="h-3.5 w-3.5" />
                                                                            )}
                                                                            <span className="hidden sm:inline">Fixar</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    </>
                                );
                            }}
                        </Await>
                    </Suspense>
                </div>
            </div>
        </Container>
    )
}
