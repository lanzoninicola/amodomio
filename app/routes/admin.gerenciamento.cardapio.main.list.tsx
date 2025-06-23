import { MenuItem, MenuItemGroup } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Await, defer, useActionData, useLoaderData } from "@remix-run/react";
import { Suspense, useEffect, useState } from "react";
import Loading from "~/components/loading/loading";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { toast } from "~/components/ui/use-toast";
import MenuItemList from "~/domain/cardapio/components/menu-item-list/menu-item-list";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import tryit from "~/utils/try-it";

export async function loader({ request }: LoaderFunctionArgs) {

    // https://github.com/remix-run/remix/discussions/6149

    // const categories = categoryPrismaEntity.findAll()
    const listFlat = menuItemPrismaEntity.findAll({
        option: {
            sorted: true,
            direction: "asc"
        }
    }, {
        imageTransform: true,
        imageScaleWidth: 64,
    })
    // const tags = menuItemTagPrismaEntity.findAll()
    // const sizeVariations = prismaClient.menuItemSize.findMany()
    const menuItemGroups = prismaClient.menuItemGroup.findMany({
        where: {
            deletedAt: null,
            visible: true
        }
    })

    const menuItemCategories = prismaClient.category.findMany({
        where: {
            type: "menu"
        }
    })

    // const data = Promise.all([categories, listFlat, tags, sizeVariations]);
    const data = Promise.all([listFlat, menuItemGroups, menuItemCategories]);

    return defer({ data });
}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // console.log({ action: _action, values })

    if (values?.action === "menu-item-move") {
        const items = JSON.parse(formData.get('items') as string);

        type MenuItemWithIndex = MenuItem & { index: number };
        const updateSortOrderIndexPromises = items.map((item: MenuItemWithIndex) => menuItemPrismaEntity.update(item.id, {
            sortOrderIndex: item.index
        }))

        const [err, result] = await tryit(Promise.all(updateSortOrderIndexPromises))

        if (err) {
            return badRequest(err)
        }

        return ok("Ordenamento atualizado");

    }

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

        const [err, result] = await tryit(menuItemPrismaEntity.update(id, {
            active: !item.active
        }))

        if (err) {
            return badRequest(err)
        }

        const returnedMessage = !item.active === true ? `O sabor "${item.name}" foi ativado` : `O sabor "${item.name}" foi desativado`;

        return ok(returnedMessage);
    }

    if (_action === "menu-item-upcoming-change") {
        const id = values?.id as string

        const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

        if (errItem) {
            return badRequest(errItem)
        }

        if (!item) {
            return badRequest("Item não encontrado")
        }

        const [err, result] = await tryit(menuItemPrismaEntity.update(id, {
            upcoming: !item.upcoming,
            visible: item.upcoming === true ? false : true
        }))

        if (err) {
            return badRequest(err)
        }

        const returnedMessage = !item.upcoming === true ? `O sabor "\${item.name}" é um futuro lançamento` : `O sabor ${item.name} foi removido da futuro lançamento`;

        return ok(returnedMessage);
    }

    return null
}

type MenuItemVisibilityFilterOption = "active" | "lancamento-futuro" | "venda-pausada" | "inactive"

export default function AdminGerenciamentoCardapioMainListLayout() {

    const { data } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();

    if (actionData && actionData.status !== 200) {
        toast({
            title: "Erro",
            description: actionData.message,
        });
    }

    if (actionData && actionData.status === 200) {
        toast({
            title: "OK",
            description: actionData.message,
        });
    }

    return (
        <Suspense fallback={
            <div className="flex justify-center items-center h-[150px]">
                <Loading color="black" />
            </div>
        }>
            <Await resolve={data}>
                {([listFlat, menuItemGroups, menuItemCategories]) => {

                    const [items, setItems] = useState<any[]>([]);
                    const [search, setSearch] = useState("");
                    const [currentGroup, setCurrentGroup] = useState<MenuItemGroup["key"] | null>(null);
                    const [currentFilter, setCurrentFilter] = useState<MenuItemVisibilityFilterOption | null>("active");



                    // 🔥 Função que combina todos os filtros
                    const applyFilters = (
                        groupKey: MenuItemGroup["key"] | null,
                        visibility: MenuItemVisibilityFilterOption | null,
                        searchValue: string
                    ) => {
                        let filtered = listFlat;

                        // Filtro por grupo
                        if (groupKey) {
                            filtered = filtered.filter(item => item.MenuItemGroup?.key === groupKey);
                        }



                        // Filtro por visibilidade
                        if (visibility === "active") {
                            filtered = filtered.filter(item => item.active === true && item.upcoming === false);
                        }
                        if (visibility === "inactive") {
                            filtered = filtered.filter(item => item.active === false);
                        }
                        if (visibility === "lancamento-futuro") {
                            filtered = filtered.filter(item => item.active === true && item.upcoming === true);
                        }
                        if (visibility === "venda-pausada") {
                            filtered = filtered.filter(item => item.active === true && item.visible === false && item.upcoming === false);
                        }

                        // Filtro por busca
                        if (searchValue) {
                            filtered = filtered.filter(item =>
                                item.name?.toLowerCase().includes(searchValue.toLowerCase()) ||
                                item.ingredients?.toLowerCase().includes(searchValue.toLowerCase())
                            );
                        }

                        setItems(filtered);
                    };

                    // Handlers
                    const handleGroupChange = (groupKey: MenuItemGroup["key"] | null) => {
                        setCurrentGroup(groupKey);
                        applyFilters(groupKey, currentFilter, search);
                    };

                    const handleVisibilityChange = (visibility: MenuItemVisibilityFilterOption) => {
                        setCurrentFilter(visibility);
                        applyFilters(currentGroup, visibility, search);
                    };

                    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
                        const value = event.target.value;
                        setSearch(value);
                        applyFilters(currentGroup, currentFilter, value);
                    };

                    // Primeira renderização
                    useEffect(() => {
                        applyFilters(currentGroup, currentFilter, search);
                    }, []);

                    useEffect(() => {
                        applyFilters(currentGroup, currentFilter, search);
                    }, [currentGroup, currentFilter]);

                    return (
                        <div className="flex flex-col">
                            <div className="flex flex-col gap-4 md:grid md:grid-cols-8 md:gap-x-4 md:items-center">

                                {/* Select de Grupo */}
                                <Select name="group"
                                    onValueChange={(value) => {
                                        const parsed = value ? jsonParse(value) : null;
                                        handleGroupChange(parsed?.key || null);
                                    }}
                                >
                                    <SelectTrigger className="w-full md:col-span-2">
                                        <SelectValue placeholder="Selecionar grupo..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Todos os grupos</SelectItem>
                                        {menuItemGroups.sort((a, b) => a.sortOrderIndex - b.sortOrderIndex).map(g => (
                                            <SelectItem key={g.id} value={JSON.stringify(g)}>
                                                {g.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Select de Visibilidade */}
                                <Select
                                    onValueChange={(value) => handleVisibilityChange(value as MenuItemVisibilityFilterOption)}
                                    defaultValue={"active"}
                                >
                                    <SelectTrigger className="w-full md:col-span-2">
                                        <SelectValue placeholder="Filtrar vendas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Venda ativa</SelectItem>
                                        <SelectItem value="lancamento-futuro">Lançamento futuro</SelectItem>
                                        <SelectItem value="venda-pausada">Venda pausada</SelectItem>
                                        <SelectItem value="inactive">Inativos</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Campo de busca */}
                                <div className="items-center col-span-5 md:col-span-4">
                                    <Input
                                        name="search"
                                        className="w-full"
                                        placeholder="Pesquisar..."
                                        onChange={handleSearch}
                                        value={search}
                                    />
                                </div>
                            </div>

                            {/* Lista dos itens */}
                            <MenuItemList
                                // @ts-ignore
                                items={items}
                                // @ts-ignore
                                groups={menuItemGroups}
                                // @ts-ignore
                                categories={menuItemCategories}
                            />
                        </div>
                    );
                }}
            </Await>
        </Suspense>
    );
}
