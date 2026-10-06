// app/routes/admin.gerenciamento.cardapio.groups.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "@remix-run/react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GripVertical,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  EyeOff,
  Eye,
} from "lucide-react";
import prismaClient from "~/lib/prisma/client.server";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { invalidateCardapioIndexCache } from "~/domain/cardapio/cardapio-cache.server";

// ----------------------------------------------------
// LOADER
// ----------------------------------------------------
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const showDeleted = url.searchParams.get("showDeleted") === "true";

  const groups = await prismaClient.itemGroup.findMany({
    where: showDeleted ? {} : { deletedAt: null },
    orderBy: [{ sortOrderIndex: "asc" }, { id: "asc" }],
    include: { ProductLine: true },
  });

  const productLines = await prismaClient.productLine.findMany({
    where: { active: true },
    orderBy: { sortOrderIndex: "asc" },
  });

  return json({
    groups,
    productLines,
    showDeleted,
  });
}

// ----------------------------------------------------
// ACTION (sem zod)
// ----------------------------------------------------
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("_intent");
  const currentUserId = "admin@gpt"; // mock

  // helper simples pra pegar boolean
  const toBool = (v: FormDataEntryValue | null) => {
    if (!v) return false;
    return v === "true" || v === "on" || v === "1";
  };

  if (intent === "reorder") {
    let ids: unknown;
    try {
      ids = JSON.parse(String(formData.get("ids") ?? ""));
    } catch {
      return json({ ok: false, error: "Ordem inválida." }, { status: 400 });
    }
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.some((id) => typeof id !== "string") ||
      new Set(ids).size !== ids.length
    ) {
      return json({ ok: false, error: "Ordem inválida." }, { status: 400 });
    }
    const orderedIds = ids as string[];
    try {
      const saved = await prismaClient.$transaction(async (tx) => {
        const current = await tx.itemGroup.findMany({
          where: { deletedAt: null },
          select: { id: true },
        });
        const currentIds = new Set(current.map((group) => group.id));
        if (
          current.length !== orderedIds.length ||
          orderedIds.some((id) => !currentIds.has(id))
        )
          return false;
        await Promise.all(
          orderedIds.map((id, index) =>
            tx.itemGroup.update({
              where: { id },
              data: { sortOrderIndex: (index + 1) * 1000 },
            })
          )
        );
        return true;
      });
      if (!saved)
        return json(
          {
            ok: false,
            error:
              "A lista de grupos mudou. Atualize a página e tente novamente.",
          },
          { status: 409 }
        );
      await invalidateCardapioIndexCache();
      return json({ ok: true });
    } catch {
      return json(
        {
          ok: false,
          error: "Não foi possível salvar a ordem. Tente novamente.",
        },
        { status: 500 }
      );
    }
  }

  // CREATE
  if (intent === "create") {
    const key = (formData.get("key") || "").toString().trim();
    const name = (formData.get("name") || "").toString().trim();
    const description = (formData.get("description") || "").toString();
    const sortOrderIndexRaw = (
      formData.get("sortOrderIndex") || "1000"
    ).toString();
    const visible = toBool(formData.get("visible"));
    const featured = toBool(formData.get("featured"));
    const productLineId = (formData.get("productLineId") || "").toString();

    const errors: Record<string, string> = {};
    if (!key) errors.key = "Informe a chave";
    if (!name) errors.name = "Informe o nome";
    if (!productLineId) errors.productLineId = "Selecione a linha de produto";

    const sortOrderIndex = Number.isNaN(Number(sortOrderIndexRaw))
      ? 1000
      : Number(sortOrderIndexRaw);

    if (Object.keys(errors).length > 0) {
      return json(
        {
          ok: false,
          error: "Erro ao validar dados",
          errors,
          form: Object.fromEntries(formData),
        },
        { status: 400 }
      );
    }

    await prismaClient.itemGroup.create({
      data: {
        key,
        name,
        description,
        sortOrderIndex,
        visible,
        featured,
        productLineId,
        createdAt: new Date(),
      },
    });

    return redirect("/admin/gerenciamento/cardapio/groups");
  }

  // UPDATE
  if (intent === "update") {
    const id = (formData.get("id") || "").toString();
    const key = (formData.get("key") || "").toString().trim();
    const name = (formData.get("name") || "").toString().trim();
    const description = (formData.get("description") || "").toString();
    const sortOrderIndexRaw = (
      formData.get("sortOrderIndex") || "1000"
    ).toString();
    const visible = toBool(formData.get("visible"));
    const featured = toBool(formData.get("featured"));
    const productLineId = (formData.get("productLineId") || "").toString();

    const errors: Record<string, string> = {};
    if (!id) errors.id = "ID inválido";
    if (!key) errors.key = "Informe a chave";
    if (!name) errors.name = "Informe o nome";
    if (!productLineId) errors.productLineId = "Selecione a linha de produto";

    const sortOrderIndex = Number.isNaN(Number(sortOrderIndexRaw))
      ? 1000
      : Number(sortOrderIndexRaw);

    if (Object.keys(errors).length > 0) {
      return json(
        {
          ok: false,
          error: "Erro ao validar dados",
          errors,
          form: Object.fromEntries(formData),
        },
        { status: 400 }
      );
    }

    await prismaClient.itemGroup.update({
      where: { id },
      data: {
        key,
        name,
        description,
        sortOrderIndex,
        visible,
        featured,
        productLineId,
      },
    });

    return redirect("/admin/gerenciamento/cardapio/groups");
  }

  // SOFT DELETE
  if (intent === "delete") {
    const id = (formData.get("id") || "").toString();
    if (!id) {
      return json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    await prismaClient.itemGroup.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: currentUserId,
        visible: false,
      },
    });

    return redirect("/admin/gerenciamento/cardapio/groups?showDeleted=true");
  }

  // RESTORE
  if (intent === "restore") {
    const id = (formData.get("id") || "").toString();
    if (!id) {
      return json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    await prismaClient.itemGroup.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedBy: null,
        visible: true,
      },
    });

    return redirect("/admin/gerenciamento/cardapio/groups");
  }

  return json({ ok: false, error: "Intent desconhecida" }, { status: 400 });
}

// ----------------------------------------------------
// FORM DIALOG COMPONENT
// ----------------------------------------------------
type GroupFormDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  productLines: Array<{ id: string; name: string }>;
  defaultValues?: {
    id?: string;
    key?: string;
    name?: string;
    description?: string;
    sortOrderIndex?: number;
    visible?: boolean;
    featured?: boolean;
    productLineId?: string;
  };
  actionErrors?: Record<string, string>;
};

function GroupFormDialog({
  open,
  onOpenChange,
  mode,
  productLines,
  defaultValues,
  actionErrors,
}: GroupFormDialogProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Novo grupo de itens"
              : "Editar grupo de itens"}
          </DialogTitle>
          <DialogDescription>
            Grupos controlam a ordem e a visibilidade das seções do cardápio
            (1000, 2000, 3000...).
          </DialogDescription>
        </DialogHeader>

        <Form method="post" className="space-y-4">
          <input
            type="hidden"
            name="_intent"
            value={mode === "create" ? "create" : "update"}
          />
          {mode === "edit" ? (
            <input type="hidden" name="id" defaultValue={defaultValues?.id} />
          ) : null}

          <div className="space-y-1">
            <label className="text-sm font-medium">Linha de produto</label>
            <Select
              name="productLineId"
              defaultValue={defaultValues?.productLineId ?? productLines[0]?.id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a linha" />
              </SelectTrigger>
              <SelectContent>
                {productLines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {actionErrors?.productLineId ? (
              <p className="text-xs text-red-500">
                {actionErrors.productLineId}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Key</label>
            <Input
              name="key"
              defaultValue={defaultValues?.key ?? ""}
              placeholder="ex.: pizza, bebidas, sobremesas"
            />
            {actionErrors?.key ? (
              <p className="text-xs text-red-500">{actionErrors.key}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Nome</label>
            <Input
              name="name"
              defaultValue={defaultValues?.name ?? ""}
              placeholder="Pizzas"
            />
            {actionErrors?.name ? (
              <p className="text-xs text-red-500">{actionErrors.name}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Descrição</label>
            <Textarea
              name="description"
              defaultValue={defaultValues?.description ?? ""}
              placeholder="Pizzas clássicas, sabores mais pedidos..."
            />
          </div>

          <div className="flex gap-4 items-center">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Ordem (sortOrderIndex)
              </label>
              <Input
                name="sortOrderIndex"
                type="number"
                defaultValue={defaultValues?.sortOrderIndex ?? 1000}
                min={0}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  name="visible"
                  defaultChecked={defaultValues?.visible ?? true}
                />
                Visível
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  name="featured"
                  defaultChecked={defaultValues?.featured ?? false}
                />
                Destaque
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------
// PAGE COMPONENT
// ----------------------------------------------------
function SortableGroupRow({
  id,
  name,
  disabled,
  className,
  children,
}: {
  id: string;
  name: string;
  disabled: boolean;
  className: string;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(className, isDragging && "relative z-10 bg-muted")}
    >
      <TableCell>
        <Button
          ref={setActivatorNodeRef}
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="touch-none cursor-grab active:cursor-grabbing"
          aria-label={`Mover grupo ${name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      </TableCell>
      {children}
    </TableRow>
  );
}

export default function AdminGerenciamentoCardapioGroupsPage() {
  const { groups, productLines, showDeleted } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const reorder = useFetcher<{ ok: boolean; error?: string }>();
  const navigation = useNavigation();
  const [orderedGroups, setOrderedGroups] = useState(groups);
  const busy = reorder.state !== "idle" || navigation.state !== "idle";
  const sortingDisabled = busy || showDeleted;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  useEffect(() => {
    setOrderedGroups(groups);
  }, [groups]);
  useEffect(() => {
    if (reorder.state === "idle" && reorder.data?.ok === false)
      setOrderedGroups(groups);
  }, [reorder.state, reorder.data, groups]);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (sortingDisabled || !over || active.id === over.id) return;
    const from = orderedGroups.findIndex((group) => group.id === active.id);
    const to = orderedGroups.findIndex((group) => group.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(orderedGroups, from, to).map((group, index) => ({
      ...group,
      sortOrderIndex: (index + 1) * 1000,
    }));
    setOrderedGroups(next);
    reorder.submit(
      {
        _intent: "reorder",
        ids: JSON.stringify(next.map((group) => group.id)),
      },
      { method: "post" }
    );
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const [openDialog, setOpenDialog] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<any | null>(null);

  const submit = useSubmit();

  // abrir dialog de edição se action deu erro
  useEffect(() => {
    if (actionData && "form" in actionData && actionData.form) {
      // se veio erro, reabre
      setOpenDialog(true);
      setMode(actionData.form.id ? "edit" : "create");
      setSelected({
        id: actionData.form.id,
        key: actionData.form.key,
        name: actionData.form.name,
        description: actionData.form.description,
        sortOrderIndex: Number(actionData.form.sortOrderIndex ?? 1000),
        visible:
          actionData.form.visible === "true" ||
          actionData.form.visible === "on",
        featured:
          actionData.form.featured === "true" ||
          actionData.form.featured === "on",
        productLineId: actionData.form.productLineId,
      });
    }
  }, [actionData]);

  const handleNew = () => {
    setSelected(null);
    setMode("create");
    setOpenDialog(true);
  };

  const handleEdit = (g: any) => {
    setSelected(g);
    setMode("edit");
    setOpenDialog(true);
  };

  const handleDelete = (id: string) => {
    const fd = new FormData();
    fd.set("_intent", "delete");
    fd.set("id", id);
    submit(fd, { method: "post" });
  };

  const handleRestore = (id: string) => {
    const fd = new FormData();
    fd.set("_intent", "restore");
    fd.set("id", id);
    submit(fd, { method: "post" });
  };

  const toggleShowDeleted = () => {
    const sp = new URLSearchParams(searchParams);
    if (showDeleted) {
      sp.delete("showDeleted");
    } else {
      sp.set("showDeleted", "true");
    }
    setSearchParams(sp);
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Grupos do Cardápio
          </h1>
          <p className="text-sm text-muted-foreground">
            Arraste pela alça para ordenar os grupos. A ordem é salva
            automaticamente.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant={showDeleted ? "secondary" : "ghost"}
            type="button"
            onClick={toggleShowDeleted}
            disabled={busy}
            className="gap-1"
          >
            {showDeleted ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
            {showDeleted ? "Ver ativos" : "Ver excluídos"}
          </Button>
          <Button disabled={busy} onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo grupo
          </Button>
        </div>
      </div>

      <p
        role="status"
        className={cn(
          "text-sm",
          reorder.data?.ok === false && "text-destructive"
        )}
      >
        {reorder.state !== "idle"
          ? "Salvando ordem..."
          : reorder.data?.error ??
            (reorder.data?.ok
              ? "Ordem salva."
              : showDeleted
              ? "Para ordenar, selecione Ver ativos."
              : "")}
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedGroups.map((group) => group.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <span className="sr-only">Mover</span>
                  </TableHead>
                  <TableHead className="w-[220px]">Nome</TableHead>
                  <TableHead>Linha de produto</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[90px] text-right">Ordem</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[50px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-6 text-muted-foreground"
                    >
                      Nenhum grupo encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  orderedGroups.map((g) => (
                    <SortableGroupRow
                      key={g.id}
                      id={g.id}
                      name={g.name}
                      disabled={sortingDisabled}
                      className={cn(
                        g.deletedAt ? "opacity-60 bg-muted/40" : ""
                      )}
                    >
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell>{g.ProductLine.name}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {g.key}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm">
                        {g.description}
                      </TableCell>
                      <TableCell className="text-right">
                        {g.sortOrderIndex}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                          {g.visible ? (
                            <Badge variant="outline">Visível</Badge>
                          ) : (
                            <Badge
                              variant="destructive"
                              className="bg-destructive/10 text-destructive border-destructive/50"
                            >
                              Oculto
                            </Badge>
                          )}
                          {g.featured ? (
                            <Badge variant="secondary">Destaque</Badge>
                          ) : null}
                          {g.deletedAt ? (
                            <Badge variant="destructive">Excluído</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button disabled={busy} variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                              <span className="sr-only">Ações</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(g)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {g.deletedAt ? (
                              <DropdownMenuItem
                                onClick={() => handleRestore(g.id)}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Restaurar
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(g.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </SortableGroupRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SortableContext>
      </DndContext>
      <GroupFormDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        mode={mode}
        productLines={productLines}
        defaultValues={
          selected ?? {
            key: "",
            name: "",
            description: "",
            sortOrderIndex: 1000,
            visible: true,
            featured: false,
            productLineId: productLines[0]?.id,
          }
        }
        actionErrors={
          actionData && "errors" in actionData ? actionData.errors : undefined
        }
      />
    </div>
  );
}
