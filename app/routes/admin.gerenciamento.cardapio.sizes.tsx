import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import prismaClient from "~/lib/prisma/client.server";

export const meta: MetaFunction = () => [{ title: "Cardápio • Tamanhos" }];

type ActionData = {
    fieldError?: Record<string, string>;
    formError?: string;
    intent?: string;
};

function str(v: FormDataEntryValue | null) {
    return (v == null ? "" : String(v)).trim();
}

function optionalStr(v: FormDataEntryValue | null) {
    const value = str(v);
    return value.length ? value : null;
}

function num(v: FormDataEntryValue | null, fallback = 0) {
    const n = Number(str(v));
    return Number.isFinite(n) ? n : fallback;
}

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";

    const where = q
        ? {
            OR: [
                { name: { contains: q, mode: "insensitive" } },
                { key: { contains: q, mode: "insensitive" } },
                { nameAbbreviated: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { nameShort: { contains: q, mode: "insensitive" } },
                { maxToppingsAmountDescription: { contains: q, mode: "insensitive" } },
                { maxServeAmountDescription: { contains: q, mode: "insensitive" } },
            ],
        }
        : {};

    const sizes = await prismaClient.menuItemSize.findMany({
        where,
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
    });

    return json({ sizes, q });
}

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    const intent = String(formData.get("_action") || "");

    const name = str(formData.get("name"));
    const key = optionalStr(formData.get("key"));
    const nameAbbreviated = optionalStr(formData.get("nameAbbreviated"));
    const nameShort = optionalStr(formData.get("nameShort"));
    const description = optionalStr(formData.get("description"));
    const sortOrderIndex = Math.trunc(num(formData.get("sortOrderIndex"), 0));
    const pizzaDoughCostAmount = num(formData.get("pizzaDoughCostAmount"), 0);
    const packagingCostAmount = num(formData.get("packagingCostAmount"), 0);
    const maxToppingsAmount = num(formData.get("maxToppingsAmount"), 0);
    const maxToppingsAmountDescription = optionalStr(formData.get("maxToppingsAmountDescription"));
    const maxServeAmount = num(formData.get("maxServeAmount"), 0);
    const maxServeAmountDescription = optionalStr(formData.get("maxServeAmountDescription"));
    const visible = formData.get("visible") === "on";
    const visibleAdmin = formData.get("visibleAdmin") === "on";

    if (intent === "create") {
        const fieldError: Record<string, string> = {};
        if (!name) fieldError.name = "Obrigatório";

        if (Object.keys(fieldError).length) {
            return json({ fieldError, intent } satisfies ActionData, { status: 400 });
        }

        await prismaClient.menuItemSize.create({
            data: {
                key,
                name,
                nameAbbreviated,
                nameShort,
                description,
                sortOrderIndex,
                pizzaDoughCostAmount,
                packagingCostAmount,
                maxToppingsAmount,
                maxToppingsAmountDescription,
                maxServeAmount,
                maxServeAmountDescription,
                visible,
                visibleAdmin,
                createdAt: new Date(),
            },
        });

        return redirect("/admin/gerenciamento/cardapio/sizes");
    }

    if (intent === "update") {
        const id = str(formData.get("id"));
        const fieldError: Record<string, string> = {};
        if (!id) fieldError.id = "ID inválido";
        if (!name) fieldError.name = "Obrigatório";

        if (Object.keys(fieldError).length) {
            return json({ fieldError, intent } satisfies ActionData, { status: 400 });
        }

        await prismaClient.menuItemSize.update({
            where: { id },
            data: {
                key,
                name,
                nameAbbreviated,
                nameShort,
                description,
                sortOrderIndex,
                pizzaDoughCostAmount,
                packagingCostAmount,
                maxToppingsAmount,
                maxToppingsAmountDescription,
                maxServeAmount,
                maxServeAmountDescription,
                visible,
                visibleAdmin,
            },
        });

        return redirect("/admin/gerenciamento/cardapio/sizes");
    }

    if (intent === "delete") {
        const id = str(formData.get("id"));
        if (!id) {
            return json({ formError: "ID inválido", intent } satisfies ActionData, { status: 400 });
        }

        await prismaClient.menuItemSize.delete({ where: { id } });
        return redirect("/admin/gerenciamento/cardapio/sizes");
    }

    return json({ formError: "Ação inválida", intent } satisfies ActionData, { status: 400 });
}

type SizeFormDefaults = {
    id?: string;
    key?: string | null;
    name?: string;
    nameAbbreviated?: string | null;
    description?: string | null;
    nameShort?: string | null;
    sortOrderIndex?: number;
    pizzaDoughCostAmount?: number;
    packagingCostAmount?: number;
    maxToppingsAmount?: number;
    maxToppingsAmountDescription?: string | null;
    maxServeAmount?: number;
    maxServeAmountDescription?: string | null;
    visible?: boolean;
    visibleAdmin?: boolean;
};

function SizeFormFields({
    defaultValues,
    errors,
    idPrefix,
}: {
    defaultValues?: SizeFormDefaults;
    errors?: Record<string, string>;
    idPrefix: string;
}) {
    return (
        <main>
            <section className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-name`}>Nome</Label>
                    <Input id={`${idPrefix}-name`} name="name" defaultValue={defaultValues?.name ?? ""} />
                    {errors?.name && <p className="text-xs text-red-600">{errors.name}</p>}
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-nameAbbreviated`}>Nome abreviado</Label>
                    <Input
                        id={`${idPrefix}-nameAbbreviated`}
                        name="nameAbbreviated"
                        defaultValue={defaultValues?.nameAbbreviated ?? ""}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-key`}>Chave</Label>
                    <Input id={`${idPrefix}-key`} name="key" defaultValue={defaultValues?.key ?? ""} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-nameShort`}>Nome curto</Label>
                    <Input id={`${idPrefix}-nameShort`} name="nameShort" defaultValue={defaultValues?.nameShort ?? ""} />
                </div>

                <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor={`${idPrefix}-description`}>Descrição</Label>
                    <Textarea
                        id={`${idPrefix}-description`}
                        name="description"
                        defaultValue={defaultValues?.description ?? ""}
                    />
                </div>


            </section>

            <Separator className="my-4" />

            <section className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-sortOrderIndex`}>Ordem</Label>
                    <Input
                        id={`${idPrefix}-sortOrderIndex`}
                        name="sortOrderIndex"
                        type="number"
                        step="1"
                        defaultValue={defaultValues?.sortOrderIndex ?? 0}
                    />
                </div>
            </section>

            <Separator className="my-4" />

            <section className="grid gap-4 md:grid-cols-2">



                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-maxServeAmount`}>Máximo pessoas</Label>
                    <Input
                        id={`${idPrefix}-maxServeAmount`}
                        name="maxServeAmount"
                        type="number"
                        step="1"
                        defaultValue={defaultValues?.maxServeAmount ?? 0}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-maxServeAmountDescription`}>Descrição máximo pessoas</Label>
                    <Input
                        id={`${idPrefix}-maxServeAmountDescription`}
                        name="maxServeAmountDescription"
                        defaultValue={defaultValues?.maxServeAmountDescription ?? ""}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-maxToppingsAmount`}>Máximo de sabores</Label>
                    <Input
                        id={`${idPrefix}-maxToppingsAmount`}
                        name="maxToppingsAmount"
                        type="number"
                        step="1"
                        defaultValue={defaultValues?.maxToppingsAmount ?? 0}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-maxToppingsAmountDescription`}>Descrição máximo sabores</Label>
                    <Input
                        id={`${idPrefix}-maxToppingsAmountDescription`}
                        name="maxToppingsAmountDescription"
                        defaultValue={defaultValues?.maxToppingsAmountDescription ?? ""}
                    />
                </div>

            </section>

            <Separator className="my-4" />

            <section className="grid gap-4 md:grid-cols-2">

                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-pizzaDoughCostAmount`}>Custo massa</Label>
                    <Input
                        id={`${idPrefix}-pizzaDoughCostAmount`}
                        name="pizzaDoughCostAmount"
                        type="number"
                        step="0.01"
                        defaultValue={defaultValues?.pizzaDoughCostAmount ?? 0}
                    />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-packagingCostAmount`}>Custo embalagem</Label>
                    <Input
                        id={`${idPrefix}-packagingCostAmount`}
                        name="packagingCostAmount"
                        type="number"
                        step="0.01"
                        defaultValue={defaultValues?.packagingCostAmount ?? 0}
                    />
                </div>

            <div className="flex items-center gap-2 md:col-span-2">
                <Switch id={`${idPrefix}-visible`} name="visible" defaultChecked={defaultValues?.visible ?? true} />
                <Label htmlFor={`${idPrefix}-visible`}>Visível no cardápio</Label>
            </div>

            <div className="flex items-center gap-2 md:col-span-2">
                <Switch
                    id={`${idPrefix}-visibleAdmin`}
                    name="visibleAdmin"
                    defaultChecked={defaultValues?.visibleAdmin ?? true}
                />
                <Label htmlFor={`${idPrefix}-visibleAdmin`}>Visível no admin</Label>
            </div>
            </section>
        </main>
    );
}

export default function CardapioSizesAdminPage() {
    const { sizes, q } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const navigation = useNavigation();
    const isSubmitting = navigation.state !== "idle";
    const actionData = useActionData<typeof action>();

    return (
        <div className="space-y-6 p-4 md:p-8">
            <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">Tamanhos do Cardápio</h1>
                    <p className="text-sm text-muted-foreground">Cadastre e organize tamanhos, custos e limites de sabores.</p>
                </div>

                <Dialog>
                    <DialogTrigger asChild>
                        <Button>Novo tamanho</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Criar tamanho</DialogTitle>
                        </DialogHeader>
                        <Form method="post" className="space-y-4">
                            <input type="hidden" name="_action" value="create" />
                            <SizeFormFields
                                idPrefix="create"
                                errors={actionData?.intent === "create" ? actionData?.fieldError : undefined}
                            />
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="secondary" type="button">
                                        Cancelar
                                    </Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmitting}>
                                    Salvar
                                </Button>
                            </DialogFooter>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <CardTitle className="text-lg">Lista</CardTitle>
                    <Form method="get" className="flex items-center gap-2 w-full md:w-auto" onChange={(e) => submit(e.currentTarget)}>
                        <Label htmlFor="q" className="sr-only">
                            Buscar
                        </Label>
                        <Input id="q" name="q" placeholder="Buscar por nome, chave, descrição" defaultValue={q ?? ""} className="w-full md:w-80" />
                        <Button type="submit" variant="secondary">
                            Buscar
                        </Button>
                    </Form>
                </CardHeader>
                <Separator />
                <CardContent>
                    <Table>
                        <TableCaption>
                            {sizes.length === 0 ? (
                                <span className="text-muted-foreground">Nenhum registro encontrado</span>
                            ) : (
                                <span>{sizes.length} registro(s)</span>
                            )}
                        </TableCaption>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Chave</TableHead>
                                <TableHead>Abrev.</TableHead>
                                <TableHead>Curto</TableHead>
                                <TableHead>Ordem</TableHead>
                                <TableHead>Sabores</TableHead>
                                <TableHead>Pessoas</TableHead>
                                <TableHead>Visível no cardápio</TableHead>
                                <TableHead>Visível no admin</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sizes.map((size) => (
                                <TableRow key={size.id}>
                                    <TableCell className="font-medium">{size.name}</TableCell>
                                    <TableCell>{size.key ?? "-"}</TableCell>
                                    <TableCell>{size.nameAbbreviated ?? "-"}</TableCell>
                                    <TableCell>{size.nameShort ?? "-"}</TableCell>
                                    <TableCell>{size.sortOrderIndex}</TableCell>
                                    <TableCell>{size.maxToppingsAmount ?? 0}</TableCell>
                                    <TableCell>{size.maxServeAmount ?? 0}</TableCell>
                                    <TableCell>{size.visible ? "Sim" : "Não"}</TableCell>
                                    <TableCell>{size.visibleAdmin ? "Sim" : "Não"}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="secondary" size="sm">
                                                        Editar
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl">
                                                    <DialogHeader>
                                                        <DialogTitle>Editar tamanho</DialogTitle>
                                                    </DialogHeader>
                                                    <Form method="post" className="space-y-4">
                                                        <input type="hidden" name="_action" value="update" />
                                                        <input type="hidden" name="id" value={size.id} />
                                                        <SizeFormFields
                                                            idPrefix={`edit-${size.id}`}
                                                            defaultValues={size}
                                                            errors={actionData?.intent === "update" ? actionData?.fieldError : undefined}
                                                        />
                                                        <DialogFooter>
                                                            <DialogClose asChild>
                                                                <Button variant="secondary" type="button">
                                                                    Cancelar
                                                                </Button>
                                                            </DialogClose>
                                                            <Button type="submit" disabled={isSubmitting}>
                                                                Salvar
                                                            </Button>
                                                        </DialogFooter>
                                                    </Form>
                                                </DialogContent>
                                            </Dialog>

                                            <Form
                                                method="post"
                                                onSubmit={(event) => {
                                                    if (!confirm("Remover este tamanho?")) {
                                                        event.preventDefault();
                                                    }
                                                }}
                                            >
                                                <input type="hidden" name="_action" value="delete" />
                                                <input type="hidden" name="id" value={size.id} />
                                                <Button variant="destructive" size="sm" type="submit" disabled={isSubmitting}>
                                                    Excluir
                                                </Button>
                                            </Form>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
