import { Recipe } from "@prisma/client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { AlertTriangle, Check, ChevronsUpDown, SaveIcon } from "lucide-react";
import { Form, Link } from "@remix-run/react";
import { DecimalInput } from "~/components/inputs/inputs";
import InputItem from "~/components/primitives/form/input-item/input-item";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import Fieldset from "~/components/ui/fieldset";
import { Textarea } from "~/components/ui/textarea";
import SelectRecipeType from "../select-recipe-type/select-recipe-type";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

type RecipeFormRecipe = Recipe & {
  costingMode?: string | null;
  yieldQuantity?: number | null;
  yieldUnit?: string | null;
};

interface RecipeFormProps {
  recipe?: RecipeFormRecipe;
  actionName: "recipe-create" | "recipe-update";
  items?: Array<{
    id: string;
    name: string;
    classification?: string | null;
    consumptionUm?: string | null;
  }>;
  variations?: Array<{ id: string; name: string; kind?: string | null }>;
  title?: string;
  unitOptions?: string[];
  requireItemRemapConfirmation?: boolean;
  hiddenFields?: Array<{ name: string; value: string }>;
  formAction?: string;
  createCostSheetOption?: {
    enabled: boolean;
    helperText?: string;
  };
}

function buildRecipeName(itemName?: string) {
  if (!itemName) return "";
  return `Receita ${itemName}`;
}

export default function RecipeForm({
  recipe,
  actionName,
  items = [],
  title,
  unitOptions = ["UN", "KG", "G", "L", "ML"],
  requireItemRemapConfirmation = false,
  hiddenFields = [],
  formAction,
  createCostSheetOption,
}: RecipeFormProps) {
  const isCreate = actionName === "recipe-create";
  const initialLinkedItemId = String(recipe?.itemId || "");
  const [name, setName] = useState(recipe?.name || "");
  const [nameTouched, setNameTouched] = useState(Boolean(recipe?.name));
  const [linkedItemId, setLinkedItemId] = useState(recipe?.itemId || "");
  const [costingMode, setCostingMode] = useState(
    String(recipe?.costingMode || "per_variation")
  );
  const [costingModeConfirmationOpen, setCostingModeConfirmationOpen] =
    useState(false);
  const [itemComboboxOpen, setItemComboboxOpen] = useState(false);
  const [confirmItemRemap, setConfirmItemRemap] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const costingModeConfirmationInputRef = useRef<HTMLInputElement>(null);
  const pendingSubmitterRef = useRef<HTMLButtonElement | null>(null);
  const costingModeConfirmedRef = useRef(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === linkedItemId) || null,
    [items, linkedItemId]
  );
  const selectedItemLabel = useMemo(() => {
    if (!selectedItem?.name) return "Automático pelo nome";
    return selectedItem.classification
      ? `${selectedItem.name} (${selectedItem.classification})`
      : selectedItem.name;
  }, [selectedItem]);
  const selectedItemName = useMemo(
    () => selectedItem?.name || "",
    [selectedItem]
  );
  const selectedItemUnit = String(selectedItem?.consumptionUm || "")
    .trim()
    .toUpperCase();
  const generatedName = useMemo(
    () => buildRecipeName(selectedItemName),
    [selectedItemName]
  );
  const isNameMatchingSuggestion = useMemo(
    () => Boolean(generatedName) && name.trim() === generatedName,
    [generatedName, name]
  );
  const hasItemChanged =
    !isCreate && String(linkedItemId || "") !== initialLinkedItemId;
  const initialCostingMode =
    String(recipe?.costingMode || "per_variation") === "yield"
      ? "yield"
      : "per_variation";
  const normalizedCostingMode =
    costingMode === "yield" ? "yield" : "per_variation";
  const hasCostingModeChanged =
    !isCreate && normalizedCostingMode !== initialCostingMode;

  useEffect(() => {
    if (isCreate || !recipe) return;
    setName(recipe.name || "");
    setNameTouched(Boolean(recipe.name));
    setLinkedItemId(recipe.itemId || "");
    setCostingMode(String(recipe.costingMode || "per_variation"));
  }, [
    isCreate,
    recipe?.id,
    recipe?.updatedAt,
    recipe?.name,
    recipe?.itemId,
    recipe?.costingMode,
  ]);

  useEffect(() => {
    if (!isCreate) return;
    if (!generatedName) return;
    if (!nameTouched || !name.trim() || name === generatedName) {
      setName(generatedName);
      setNameTouched(false);
    }
  }, [generatedName, isCreate, name, nameTouched]);

  useEffect(() => {
    if (!hasItemChanged) {
      setConfirmItemRemap(false);
    }
  }, [hasItemChanged]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!hasCostingModeChanged || costingModeConfirmedRef.current) {
      costingModeConfirmedRef.current = false;
      return;
    }

    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    pendingSubmitterRef.current =
      submitter instanceof HTMLButtonElement ? submitter : null;
    setCostingModeConfirmationOpen(true);
  };

  const confirmCostingModeChange = () => {
    costingModeConfirmedRef.current = true;
    if (costingModeConfirmationInputRef.current) {
      costingModeConfirmationInputRef.current.value = "yes";
    }
    setCostingModeConfirmationOpen(false);
    formRef.current?.requestSubmit(pendingSubmitterRef.current || undefined);
  };

  return (
    <Form
      ref={formRef}
      method="post"
      action={formAction}
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="recipeId" value={recipe?.id} />
      <input type="hidden" name="_action" value={actionName} />
      <input
        type="hidden"
        name="confirmItemRemap"
        value={confirmItemRemap ? "yes" : "no"}
      />
      <input
        type="hidden"
        name="costingMode"
        value={costingMode === "yield" ? "yield" : "per_variation"}
      />
      <input
        ref={costingModeConfirmationInputRef}
        type="hidden"
        name="confirmCostingModeChange"
        defaultValue="no"
      />
      {hiddenFields.map((field) => (
        <input
          key={field.name}
          type="hidden"
          name={field.name}
          value={field.value}
        />
      ))}
      <div className="mb-8">
        <div
          className={`mb-4 flex items-center gap-3 ${
            title ? "justify-between" : "justify-end"
          }`}
        >
          {title ? (
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          ) : null}
          <div className="flex items-center gap-2">
            {createCostSheetOption?.enabled ? (
              <Button
                type="submit"
                name="createItemCostSheet"
                value="yes"
                variant="outline"
                size="sm"
                className="text-xs uppercase font-semibold tracking-wider"
                disabled={
                  requireItemRemapConfirmation &&
                  hasItemChanged &&
                  !confirmItemRemap
                }
              >
                Vincular ficha técnica
              </Button>
            ) : null}
            <Button
              type="submit"
              size="sm"
              disabled={
                requireItemRemapConfirmation &&
                hasItemChanged &&
                !confirmItemRemap
              }
            >
              <SaveIcon size={16} />
              <span className="pl-2 text-xs uppercase font-semibold tracking-wider">
                Salvar
              </span>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="border rounded-md p-4">
            <div className="grid gap-4 lg:grid-cols-1">
              <Fieldset className="grid-cols-3">
                <Label htmlFor="linkedItemId">Item vinculado</Label>
                <div className="col-span-2">
                  <div className="mb-2 flex justify-end">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link
                        to="/admin/items/new"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Criar item
                      </Link>
                    </Button>
                  </div>
                  <input
                    type="hidden"
                    name="linkedItemId"
                    value={linkedItemId}
                  />
                  <Popover
                    open={itemComboboxOpen}
                    onOpenChange={setItemComboboxOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        id="linkedItemId"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={itemComboboxOpen}
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate text-left">
                          {selectedItemLabel}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Buscar item..." />
                        <CommandList className="max-h-[50vh]">
                          <CommandEmpty>Nenhum item encontrado.</CommandEmpty>
                          <CommandItem
                            value="automatico criar vincular pelo nome"
                            onSelect={() => {
                              setLinkedItemId("");
                              setItemComboboxOpen(false);
                            }}
                            className="items-start py-2"
                          >
                            <Check
                              className={cn(
                                "mt-0.5 mr-2 h-4 w-4",
                                !linkedItemId ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                Automático pelo nome
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                Criar/vincular usando o nome da receita
                              </div>
                            </div>
                          </CommandItem>
                          <CommandSeparator />
                          {items.map((item) => (
                            <CommandItem
                              key={item.id}
                              value={`${item.name} ${
                                item.classification || ""
                              } ${item.id}`}
                              onSelect={() => {
                                setLinkedItemId(item.id);
                                setItemComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  linkedItemId === item.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <span className="truncate">
                                {item.name}
                                {item.classification
                                  ? ` (${item.classification})`
                                  : ""}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {!linkedItemId ? (
                    <p className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                      O item vinculado é opcional. Se ficar em automático, o
                      sistema tenta encontrar um item pelo nome da receita; se
                      não encontrar, cria um item ao salvar e avisa na próxima
                      tela.
                    </p>
                  ) : null}
                  {linkedItemId ? (
                    selectedItemUnit ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        UM do item vinculado:{" "}
                        <span className="font-medium text-slate-700">
                          {selectedItemUnit}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                        O item vinculado ainda não tem UM de consumo. Para
                        receita por rendimento, o sistema usa a UM do rendimento
                        final ao salvar.
                      </p>
                    )
                  ) : null}
                  {requireItemRemapConfirmation && hasItemChanged ? (
                    <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                      <p className="text-xs font-semibold text-amber-900">
                        Trocar o item apaga os dados por variação (UM e
                        quantidade) e exige remapeamento.
                      </p>
                      <label className="mt-1 inline-flex items-center gap-2 text-xs text-amber-900">
                        <input
                          type="checkbox"
                          checked={confirmItemRemap}
                          onChange={(event) =>
                            setConfirmItemRemap(event.target.checked)
                          }
                          className="h-3.5 w-3.5 rounded border-amber-400"
                        />
                        Confirmo a troca e o remapeamento de variações.
                      </label>
                    </div>
                  ) : null}
                </div>
              </Fieldset>
            </div>
          </div>

          <div className="md:grid md:grid-cols-2 md:items-start flex flex-col gap-8 border rounded-md p-4 ">
            <div className="flex flex-col">
              <Fieldset className="grid-cols-3">
                <Label htmlFor="name">Nome</Label>
                <div className="col-span-2 space-y-1">
                  <InputItem
                    id="name"
                    name="name"
                    value={name}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      setName(event.target.value);
                      setNameTouched(true);
                    }}
                    placeholder="Receita {item vinculado}"
                    className="text-sm"
                    required
                  />
                  {isCreate && generatedName ? (
                    isNameMatchingSuggestion ? (
                      <p className="text-xs text-muted-foreground leading-4">
                        Nome gerado automaticamente a partir do item.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-4">
                        <span className="font-medium">Padrão sugerido:</span>{" "}
                        <span className="inline-block max-w-full align-bottom truncate">
                          {generatedName}
                        </span>
                      </p>
                    )
                  ) : null}
                </div>
              </Fieldset>
              <Fieldset className="grid-cols-3">
                <Label htmlFor="type">Tipo</Label>
                <SelectRecipeType
                  defaultValue={recipe?.type}
                  className="col-span-2"
                />
              </Fieldset>
              <Fieldset className="grid-cols-3">
                <Label>Modo da receita</Label>
                <div className="col-span-2 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setCostingMode("per_variation")}
                      className={cn(
                        "rounded-md border p-3 text-left transition-colors",
                        costingMode !== "yield"
                          ? "border-slate-900 bg-slate-50 text-slate-950"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      <span className="block text-sm font-semibold">
                        Por tamanho/variação
                      </span>
                      <span className="mt-1 block text-xs leading-4 text-slate-500">
                        Para sabores de pizza e composições que mudam conforme o
                        tamanho.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCostingMode("yield")}
                      className={cn(
                        "rounded-md border p-3 text-left transition-colors",
                        costingMode === "yield"
                          ? "border-slate-900 bg-slate-50 text-slate-950"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      <span className="block text-sm font-semibold">
                        Por rendimento
                      </span>
                      <span className="mt-1 block text-xs leading-4 text-slate-500">
                        Para pré-preparos que têm uma quantidade final pronta.
                      </span>
                    </button>
                  </div>
                  {costingMode === "yield" ? (
                    <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                      <div className="space-y-1">
                        <Label
                          htmlFor="yieldQuantity"
                          className="text-xs text-slate-500"
                        >
                          Rendimento final
                        </Label>
                        <DecimalInput
                          id="yieldQuantity"
                          name="yieldQuantity"
                          defaultValue={
                            recipe?.yieldQuantity == null
                              ? null
                              : recipe.yieldQuantity
                          }
                          placeholder="Ex: 0,450"
                          fractionDigits={3}
                          className="w-full h-10"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="yieldUnit"
                          className="text-xs text-slate-500"
                        >
                          UM
                        </Label>
                        <Select
                          name="yieldUnit"
                          defaultValue={String(
                            recipe?.yieldUnit || unitOptions[0] || "UN"
                          ).toUpperCase()}
                          required={costingMode === "yield"}
                        >
                          <SelectTrigger
                            id="yieldUnit"
                            className="h-10 bg-white"
                          >
                            <SelectValue placeholder="UM" />
                          </SelectTrigger>
                          <SelectContent>
                            {unitOptions.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Fieldset>
              <Fieldset className="grid-cols-3">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={recipe?.description || ""}
                  className="col-span-2"
                />
              </Fieldset>
            </div>
            <div className="flex flex-col">
              <Fieldset className="grid-cols-3">
                <Label htmlFor="isVegetarian">Vegetariana</Label>
                <Switch
                  id="isVegetarian"
                  name="isVegetarian"
                  defaultChecked={recipe?.isVegetarian}
                />
              </Fieldset>
              <Fieldset className="grid-cols-3">
                <Label htmlFor="isGlutenFree">Sem glútem</Label>
                <Switch
                  id="isGlutenFree"
                  name="isGlutenFree"
                  defaultChecked={recipe?.isGlutenFree}
                />
              </Fieldset>
            </div>
          </div>
        </div>
      </div>
      <Dialog
        open={costingModeConfirmationOpen}
        onOpenChange={setCostingModeConfirmationOpen}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirmar mudança do modo da receita
            </DialogTitle>
            <DialogDescription>
              Você está mudando de{" "}
              <strong>
                {initialCostingMode === "yield"
                  ? "Por rendimento"
                  : "Por tamanho/variação"}
              </strong>{" "}
              para{" "}
              <strong>
                {normalizedCostingMode === "yield"
                  ? "Por rendimento"
                  : "Por tamanho/variação"}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-slate-600">
            {normalizedCostingMode === "yield" ? (
              <p>
                As quantidades existentes serão preservadas, mas não serão
                convertidas automaticamente. A composição passará a usar o
                consumo do lote e o rendimento final informado.
              </p>
            ) : (
              <p>
                As quantidades existentes serão preservadas, mas o rendimento
                final deixará de ser usado e seus valores serão removidos ao
                salvar.
              </p>
            )}
            <p>
              As fichas técnicas vinculadas precisarão ser recalculadas para
              atualizar os custos.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCostingModeConfirmationOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={confirmCostingModeChange}>
              Confirmar e alterar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
