import { Await, Link, useActionData, useLoaderData } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { badRequest, ok } from "~/utils/http-response.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import tryit from "~/utils/try-it";
import { toast } from "~/components/ui/use-toast";
import prismaClient from "~/lib/prisma/client.server";
import { Suspense } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
    const topItems = (async () => {
        try {
            const items = await prismaClient.menuItem.findMany({
                where: {
                    visible: true,
                    active: true,
                },
                select: {
                    id: true,
                    name: true,
                    MenuItemLike: {
                        where: { deletedAt: null },
                        select: { amount: true },
                    },
                },
            });

            return items
                .map((item) => ({
                    id: item.id,
                    name: item.name,
                    likesAmount: item.MenuItemLike.reduce(
                        (sum, like) => sum + (Number(like.amount) || 0),
                        0
                    ),
                }))
                .sort((a, b) => {
                    if (b.likesAmount !== a.likesAmount) {
                        return b.likesAmount - a.likesAmount;
                    }
                    return a.name.localeCompare(b.name);
                })
                .slice(0, 8);
        } catch (error) {
            console.error("[AdminIndex.loader] erro ao buscar topItems", error);
            return [];
        }
    })();

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

    return defer({ topItems, topNav });
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
                <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-2">
                    <section className="rounded-lg border border-muted bg-white p-5 shadow-sm">
                        <h2 className="text-base font-semibold text-slate-900">
                            Mais acessados no admin
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Atalhos rápidos para as páginas que você mais usa no painel.
                        </p>
                        <Suspense
                            fallback={(
                                <div className="mt-4 rounded-md border border-muted bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                                    Carregando acessos do admin...
                                </div>
                            )}
                        >
                            <Await resolve={loaderData.topNav}>
                                {(topNav: { id: string; href: string; title: string; count: number }[]) =>
                                    topNav.length === 0 ? (
                                        <p className="mt-3 text-sm text-muted-foreground">
                                            Sem dados de navegação ainda.
                                        </p>
                                    ) : (
                                        <div className="mt-4 grid gap-3">
                                            {topNav.map((navItem) => (
                                                <Link
                                                    key={navItem.id}
                                                    to={navItem.href}
                                                    className="flex items-center justify-between rounded-md border border-muted bg-slate-50 px-4 py-3 text-sm transition hover:border-slate-300 hover:bg-white"
                                                >
                                                    <span className="font-medium text-slate-900">
                                                        {navItem.title}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {navItem.count} acessos
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    )
                                }
                            </Await>
                        </Suspense>
                    </section>
                    <section className="rounded-lg border border-muted bg-white p-5 shadow-sm">
                        <h2 className="text-base font-semibold text-slate-900">
                            Mais clicados no cardápio
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Acesso rápido aos sabores que recebem mais cliques no cardápio.
                        </p>
                        <Suspense
                            fallback={(
                                <div className="mt-4 rounded-md border border-muted bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                                    Carregando cliques do cardápio...
                                </div>
                            )}
                        >
                            <Await resolve={loaderData.topItems}>
                                {(topItems: { id: string; name: string; likesAmount: number }[]) =>
                                    topItems.length === 0 ? (
                                        <p className="mt-3 text-sm text-muted-foreground">
                                            Sem dados de cliques ainda.
                                        </p>
                                    ) : (
                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            {topItems.map((item) => (
                                                <Link
                                                    key={item.id}
                                                    to={`/admin/gerenciamento/cardapio/${item.id}/main`}
                                                    className="flex items-center justify-between rounded-md border border-muted bg-slate-50 px-4 py-3 text-sm transition hover:border-slate-300 hover:bg-white"
                                                >
                                                    <span className="font-medium text-slate-900">
                                                        {item.name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {item.likesAmount} cliques
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    )
                                }
                            </Await>
                        </Suspense>
                    </section>
                </div>
            </div>
        </Container>
    )
}
