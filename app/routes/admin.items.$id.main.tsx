import {
  Form,
  Link,
  useLocation,
  useNavigate,
  useNavigation,
  useOutletContext,
  useSearchParams,
} from "@remix-run/react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
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
import { Checkbox } from "~/components/ui/checkbox";
import useSaveShortcut from "~/hooks/use-save-shortcut.hook";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { buildAdminItemsMeta } from "~/domain/item/admin-items-meta";
import type { AdminItemOutletContext } from "./admin.items.$id";
import { Separator } from "~/components/ui/separator";

export const meta = buildAdminItemsMeta("Principal");

export default function AdminItemMainTab() {
  const { item, classifications, unitOptions, categories } =
    useOutletContext<AdminItemOutletContext>();
  const [classificationValue, setClassificationValue] = useState(
    item.classification || classifications[0] || ""
  );
  const [categoryIdValue, setCategoryIdValue] = useState(
    item.categoryId || "__EMPTY__"
  );
  const [consumptionUmValue, setConsumptionUmValue] = useState(
    item.consumptionUm || "__EMPTY__"
  );
  const [recipeVariationPolicyValue, setRecipeVariationPolicyValue] = useState(
    item.recipeVariationPolicy || "auto"
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const duplicatedItemId = searchParams.get("duplicatedItemId");
  const duplicatedItemName = searchParams.get("duplicatedItemName");
  const showDuplicationSuccess = Boolean(duplicatedItemId);
  const navigation = useNavigation();
  const isDuplicating =
    navigation.state !== "idle" &&
    navigation.formData?.get("_action") === "item-duplicate";
  const formRef = useRef<HTMLFormElement | null>(null);

  const closeDuplicateDialog = () => {
    setShowDuplicateDialog(false);
    if (showDuplicationSuccess) {
      navigate(location.pathname, { replace: true });
    }
  };

  useSaveShortcut({
    callback: () => {
      formRef.current?.requestSubmit();
    },
  });

  return (
    <div className="space-y-4">
      <Form method="post" action=".." className="space-y-4" ref={formRef}>
        <input type="hidden" name="_action" value="item-update" />

        <div className="flex justify-end">
          <div className="flex flex-wrap items-center gap-3 ">
            <Button type="submit" className="bg-slate-900 hover:bg-slate-700">
              Salvar item
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/admin/items/new" target="_blank" rel="noreferrer">
                Criar item
              </Link>
            </Button>
            <AlertDialog
              open={showDuplicateDialog || showDuplicationSuccess}
              onOpenChange={(open) => {
                if (isDuplicating) return;
                if (open) setShowDuplicateDialog(true);
                else closeDuplicateDialog();
              }}
            >
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline">
                  Duplicar item
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                {showDuplicationSuccess ? (
                  <>
                    <AlertDialogHeader>
                      <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="size-5" />
                      </div>
                      <AlertDialogTitle>
                        Item duplicado com sucesso
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        <strong>{duplicatedItemName || "O novo item"}</strong>{" "}
                        foi criado com todos os vínculos selecionados. Agora
                        você pode abrir e revisar o novo cadastro.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeDuplicateDialog}
                      >
                        Fechar
                      </Button>
                      <Button asChild>
                        <Link
                          to={`/admin/items/${duplicatedItemId}/main`}
                          onClick={() => setShowDuplicateDialog(false)}
                        >
                          Abrir item novo
                        </Link>
                      </Button>
                    </AlertDialogFooter>
                  </>
                ) : (
                  <>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Duplicar item</AlertDialogTitle>
                      <AlertDialogDescription>
                        Crie um novo item a partir de{" "}
                        <strong>{item.name}</strong>. O nome precisa ser
                        diferente do original.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Form
                      method="post"
                      action=".."
                      className="space-y-4"
                      aria-busy={isDuplicating}
                    >
                      <input
                        type="hidden"
                        name="_action"
                        value="item-duplicate"
                      />
                      <div className="space-y-2">
                        <Label htmlFor="duplicateName">Nome do novo item</Label>
                        <Input
                          id="duplicateName"
                          name="duplicateName"
                          defaultValue={`${item.name} (cópia)`}
                          required
                          disabled={isDuplicating}
                        />
                      </div>
                      {Number(item._linkedRecipeCount || 0) > 0 ||
                      Number(item._itemCostSheetCount || 0) > 0 ? (
                        <div className="space-y-3 rounded-md border border-slate-200 p-4">
                          {Number(item._linkedRecipeCount || 0) > 0 ? (
                            <label className="flex items-start gap-3 text-sm">
                              <Checkbox
                                name="duplicateRecipe"
                                disabled={isDuplicating}
                              />
                              <span>
                                <span className="font-medium">
                                  Duplicar receita
                                </span>
                                <span className="block text-slate-500">
                                  Copia e vincula{" "}
                                  {Number(item._linkedRecipeCount)} receita(s)
                                  ao novo item.
                                </span>
                              </span>
                            </label>
                          ) : null}
                          {Number(item._itemCostSheetCount || 0) > 0 ? (
                            <label className="flex items-start gap-3 text-sm">
                              <Checkbox
                                name="duplicateCostSheet"
                                disabled={isDuplicating}
                              />
                              <span>
                                <span className="font-medium">
                                  Duplicar ficha de custo
                                </span>
                                <span className="block text-slate-500">
                                  Copia a ficha mais recente, vincula às novas
                                  variações e deixa ativa.
                                </span>
                              </span>
                            </label>
                          ) : null}
                        </div>
                      ) : null}
                      {isDuplicating ? (
                        <div
                          className="flex items-start gap-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600"
                          role="status"
                          aria-live="polite"
                        >
                          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
                          <span>
                            Duplicando item e processando os vínculos
                            selecionados. Aguarde até a conclusão.
                          </span>
                        </div>
                      ) : null}
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDuplicating}>
                          Cancelar
                        </AlertDialogCancel>
                        <Button type="submit" disabled={isDuplicating}>
                          {isDuplicating ? (
                            <>
                              <Loader2 className="mr-2 size-4 animate-spin" />
                              Duplicando...
                            </>
                          ) : (
                            "Duplicar item"
                          )}
                        </Button>
                      </AlertDialogFooter>
                    </Form>
                  </>
                )}
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog
              open={showDeleteDialog}
              onOpenChange={setShowDeleteDialog}
            >
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive">
                  Eliminar item
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar item?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação remove <strong>{item.name}</strong>. Escolha
                    abaixo se os registros vinculados também devem ser
                    eliminados. Se a eliminação for permitida, você será
                    redirecionado para a lista completa de itens.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Form method="post" action=".." className="space-y-4">
                  <input type="hidden" name="_action" value="item-delete" />
                  <div className="space-y-3 rounded-md border border-slate-200 p-4">
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        id="deleteLinkedRecipe"
                        name="deleteLinkedRecipe"
                        disabled={Number(item._linkedRecipeCount || 0) === 0}
                      />
                      <span>
                        <span className="font-medium">
                          Eliminar receita produzida por este item
                        </span>
                        <span className="block text-slate-500">
                          {Number(item._linkedRecipeCount || 0)} receita(s)
                          vinculada(s)
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox
                        id="deleteLinkedCostSheets"
                        name="deleteLinkedCostSheets"
                        disabled={Number(item._itemCostSheetCount || 0) === 0}
                      />
                      <span>
                        <span className="font-medium">
                          Eliminar fichas de custo vinculadas
                        </span>
                        <span className="block text-slate-500">
                          {Number(item._itemCostSheetCount || 0)} ficha(s)
                          vinculada(s)
                        </span>
                      </span>
                    </label>
                    <p className="text-xs text-slate-500">
                      Se este item fizer parte da composição de outra receita, a
                      eliminação será bloqueada mesmo com estas opções marcadas.
                    </p>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <Button type="submit" variant="destructive">
                      Confirmar eliminação
                    </Button>
                  </AlertDialogFooter>
                </Form>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className=" p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={item.name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="classification">Classificação</Label>
                <input
                  type="hidden"
                  name="classification"
                  value={classificationValue}
                />
                <Select
                  value={classificationValue}
                  onValueChange={setClassificationValue}
                >
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
              <Input
                id="description"
                name="description"
                defaultValue={item.description || ""}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="consumptionUm">Unidade de consumo</Label>
                <input
                  type="hidden"
                  name="consumptionUm"
                  value={
                    consumptionUmValue === "__EMPTY__" ? "" : consumptionUmValue
                  }
                />
                <Select
                  value={consumptionUmValue}
                  onValueChange={setConsumptionUmValue}
                >
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
                <Label htmlFor="recipeVariationPolicy">
                  Variação na receita
                </Label>
                <input
                  type="hidden"
                  name="recipeVariationPolicy"
                  value={recipeVariationPolicyValue}
                />
                <Select
                  value={recipeVariationPolicyValue}
                  onValueChange={setRecipeVariationPolicyValue}
                >
                  <SelectTrigger id="recipeVariationPolicy" className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático (regra)</SelectItem>
                    <SelectItem value="hide">Ocultar variação</SelectItem>
                    <SelectItem value="show">
                      Sempre mostrar variação
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-slate-600">
                  Auto mostra o campo só quando existir mais de uma variação com
                  custo diferente.
                </p>
              </div>
              <div>
                <Label htmlFor="categoryId">Categoria</Label>
                <input
                  type="hidden"
                  name="categoryId"
                  value={categoryIdValue === "__EMPTY__" ? "" : categoryIdValue}
                />
                <Select
                  value={categoryIdValue}
                  onValueChange={setCategoryIdValue}
                >
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

          <div className=" p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Configurações do item
              </h3>
              <p className="text-xs text-slate-600">
                Ative somente os comportamentos que este item precisa.
              </p>
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
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h4>
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
