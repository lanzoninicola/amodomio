import { Form, Link, useOutletContext } from "@remix-run/react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import useSaveShortcut from "~/hooks/use-save-shortcut.hook";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import type { AdminItemOutletContext } from "./admin.items.$id";

export default function AdminItemMainTab() {
  const { item, classifications, unitOptions, categories } = useOutletContext<AdminItemOutletContext>();
  const [classificationValue, setClassificationValue] = useState(item.classification || classifications[0] || "");
  const [categoryIdValue, setCategoryIdValue] = useState(item.categoryId || "__EMPTY__");
  const [consumptionUmValue, setConsumptionUmValue] = useState(item.consumptionUm || "__EMPTY__");
  const [recipeVariationPolicyValue, setRecipeVariationPolicyValue] = useState(item.recipeVariationPolicy || "auto");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  useSaveShortcut({
    callback: () => {
      formRef.current?.requestSubmit();
    },
  });

  return (
    <div className="space-y-4">
      <Form method="post" action=".." className="space-y-4" ref={formRef}>
        <input type="hidden" name="_action" value="item-update" />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" defaultValue={item.name} required />
              </div>
              <div>
                <Label htmlFor="classification">Classificação</Label>
                <input type="hidden" name="classification" value={classificationValue} />
                <Select value={classificationValue} onValueChange={setClassificationValue}>
                  <SelectTrigger id="classification" className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classifications.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input id="description" name="description" defaultValue={item.description || ""} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="consumptionUm">Unidade de consumo</Label>
                <input
                  type="hidden"
                  name="consumptionUm"
                  value={consumptionUmValue === "__EMPTY__" ? "" : consumptionUmValue}
                />
                <Select value={consumptionUmValue} onValueChange={setConsumptionUmValue}>
                  <SelectTrigger id="consumptionUm" className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__EMPTY__">Selecionar...</SelectItem>
                    {unitOptions.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="recipeVariationPolicy">Variação na receita</Label>
                <input type="hidden" name="recipeVariationPolicy" value={recipeVariationPolicyValue} />
                <Select value={recipeVariationPolicyValue} onValueChange={setRecipeVariationPolicyValue}>
                  <SelectTrigger id="recipeVariationPolicy" className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático (regra)</SelectItem>
                    <SelectItem value="hide">Ocultar variação</SelectItem>
                    <SelectItem value="show">Sempre mostrar variação</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-slate-600">
                  Auto mostra o campo só quando existir mais de uma variação com custo diferente.
                </p>
              </div>
              <div>
                <Label htmlFor="categoryId">Categoria</Label>
                <input
                  type="hidden"
                  name="categoryId"
                  value={categoryIdValue === "__EMPTY__" ? "" : categoryIdValue}
                />
                <Select value={categoryIdValue} onValueChange={setCategoryIdValue}>
                  <SelectTrigger id="categoryId" className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__EMPTY__">Sem categoria</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Configurações do item</h3>
              <p className="text-xs text-slate-600">Ative somente os comportamentos que este item precisa.</p>
            </div>

            <div className="space-y-4">
              <FlagSection title="Status">
                <FlagSwitchField
                  id="active"
                  name="active"
                  label="Ativo"
                  description="Controla se o item pode ser usado normalmente no sistema."
                  defaultChecked={!!item.active}
                />
              </FlagSection>

              <FlagSection title="Operação">
                <FlagSwitchField
                  id="canPurchase"
                  name="canPurchase"
                  label="Pode comprar"
                  description="Permite usar o item em fluxos de compra e abastecimento."
                  defaultChecked={!!item.canPurchase}
                />
                <FlagSwitchField
                  id="canTransform"
                  name="canTransform"
                  label="Pode transformar"
                  description="Indica que o item pode participar de processos de transformação/produção."
                  defaultChecked={!!item.canTransform}
                />
                <FlagSwitchField
                  id="canSell"
                  name="canSell"
                  label="Pode vender"
                  description="Permite vender este item diretamente. Disponibilidade no cardápio é derivada desta opção."
                  defaultChecked={!!item.canSell}
                />
              </FlagSection>

              <FlagSection title="Estoque">
                <FlagSwitchField
                  id="canStock"
                  name="canStock"
                  label="Tem estoque"
                  description="Controla se o item deve movimentar e manter saldo em estoque."
                  defaultChecked={!!item.canStock}
                />
              </FlagSection>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
              Salvar item
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/admin/items/new" target="_blank" rel="noreferrer">
                Criar item
              </Link>
            </Button>
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive">
                  Eliminar item
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar item?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação remove <strong>{item.name}</strong>. Se a eliminação for permitida, você será redirecionado para a lista completa de itens.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <Form method="post" action="..">
                    <input type="hidden" name="_action" value="item-delete" />
                    <Button type="submit" variant="destructive">
                      Confirmar eliminação
                    </Button>
                  </Form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Form>

    </div>
  );
}

function FlagSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function FlagSwitchField({
  id,
  name,
  label,
  description,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium text-slate-900">
          {label}
        </Label>
        <p className="text-xs text-slate-600">{description}</p>
      </div>
      <Switch id={id} name={name} defaultChecked={defaultChecked} />
    </div>
  );
}
