import { Recipe } from "@prisma/client";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Form, Link } from "@remix-run/react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";
import { Button } from "~/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandSeparator } from "~/components/ui/command";
import Fieldset from "~/components/ui/fieldset";
import { Textarea } from "~/components/ui/textarea";
import SelectRecipeType from "../select-recipe-type/select-recipe-type";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

interface RecipeFormProps {
    recipe?: Recipe;
    actionName: "recipe-create" | "recipe-update";
    items?: Array<{ id: string; name: string; classification?: string | null }>;
    variations?: Array<{ id: string; name: string; kind?: string | null }>;
    title?: string;
    requireItemRemapConfirmation?: boolean;
    hiddenFields?: Array<{ name: string; value: string }>;
    formAction?: string;
}

function buildRecipeName(itemName?: string) {
    if (!itemName) return "";
    return `Receita ${itemName}`;
}

export default function RecipeForm({ recipe, actionName, items = [], title, requireItemRemapConfirmation = false, hiddenFields = [], formAction }: RecipeFormProps) {
    const isCreate = actionName === "recipe-create";
    const initialLinkedItemId = String(recipe?.itemId || "");
    const [name, setName] = useState(recipe?.name || "");
    const [nameTouched, setNameTouched] = useState(Boolean(recipe?.name));
    const [linkedItemId, setLinkedItemId] = useState(recipe?.itemId || "");
    const [itemComboboxOpen, setItemComboboxOpen] = useState(false);
    const [confirmItemRemap, setConfirmItemRemap] = useState(false);

    const selectedItem = useMemo(
        () => items.find((item) => item.id === linkedItemId) || null,
        [items, linkedItemId]
    );
    const selectedItemLabel = useMemo(() => {
        if (!selectedItem?.name) return "Automático pelo nome";
        return selectedItem.classification ? `${selectedItem.name} (${selectedItem.classification})` : selectedItem.name;
    }, [selectedItem]);
    const selectedItemName = useMemo(
        () => selectedItem?.name || "",
        [selectedItem]
    );
    const generatedName = useMemo(
        () => buildRecipeName(selectedItemName),
        [selectedItemName]
    );
    const isNameMatchingSuggestion = useMemo(
        () => Boolean(generatedName) && name.trim() === generatedName,
        [generatedName, name]
    );
    const hasItemChanged = !isCreate && String(linkedItemId || "") !== initialLinkedItemId;

    useEffect(() => {
        if (isCreate || !recipe) return;
        setName(recipe.name || "");
        setNameTouched(Boolean(recipe.name));
        setLinkedItemId(recipe.itemId || "");
    }, [isCreate, recipe?.id, recipe?.updatedAt, recipe?.name, recipe?.itemId]);

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

    return (
        <Form method="post" action={formAction}>
            <input type="hidden" name="recipeId" value={recipe?.id} />
            <input type="hidden" name="confirmItemRemap" value={confirmItemRemap ? "yes" : "no"} />
            {hiddenFields.map((field) => (
                <input key={field.name} type="hidden" name={field.name} value={field.value} />
            ))}
            <div className="mb-8">
                <div className={`mb-4 flex items-center gap-3 ${title ? "justify-between" : "justify-end"}`}>
                    {title ? (
                        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                    ) : null}
                    <SaveItemButton
                        actionName={actionName}
                        label="Salvar"
                        labelClassName="uppercase font-semibold tracking-wider text-xs"
                        variant={"outline"}
                        disabled={requireItemRemapConfirmation && hasItemChanged && !confirmItemRemap}
                    />
                </div>
                <div className="flex flex-col gap-4">
                    <div className="border rounded-md p-4">
                        <div className="grid gap-4 lg:grid-cols-1">
                            <Fieldset className="grid-cols-3">
                                <Label htmlFor="linkedItemId">Item vinculado</Label>
                                <div className="col-span-2">
                                    <div className="mb-2 flex justify-end">
                                        <Button type="button" variant="outline" size="sm" asChild>
                                            <Link to="/admin/items/new" target="_blank" rel="noreferrer">
                                                Criar item
                                            </Link>
                                        </Button>
                                    </div>
                                    <input type="hidden" name="linkedItemId" value={linkedItemId} />
                                    <Popover open={itemComboboxOpen} onOpenChange={setItemComboboxOpen}>
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
                                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
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
                                                        <Check className={cn("mt-0.5 mr-2 h-4 w-4", !linkedItemId ? "opacity-100" : "opacity-0")} />
                                                        <div className="min-w-0">
                                                            <div className="truncate font-medium">Automático pelo nome</div>
                                                            <div className="truncate text-xs text-muted-foreground">
                                                                Criar/vincular usando o nome da receita
                                                            </div>
                                                        </div>
                                                    </CommandItem>
                                                    <CommandSeparator />
                                                    {items.map((item) => (
                                                        <CommandItem
                                                            key={item.id}
                                                            value={`${item.name} ${item.classification || ""} ${item.id}`}
                                                            onSelect={() => {
                                                                setLinkedItemId(item.id);
                                                                setItemComboboxOpen(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    linkedItemId === item.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <span className="truncate">
                                                                {item.name}
                                                                {item.classification ? ` (${item.classification})` : ""}
                                                            </span>
                                                        </CommandItem>
                                                    ))}
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    {!linkedItemId ? (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            O sistema tenta vincular automaticamente pelo nome da receita.
                                        </p>
                                    ) : null}
                                    {requireItemRemapConfirmation && hasItemChanged ? (
                                        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                                            <p className="text-xs font-semibold text-amber-900">
                                                Trocar o item apaga os dados por variação (UM, quantidade e custos) e exige remapeamento.
                                            </p>
                                            <label className="mt-1 inline-flex items-center gap-2 text-xs text-amber-900">
                                                <input
                                                    type="checkbox"
                                                    checked={confirmItemRemap}
                                                    onChange={(event) => setConfirmItemRemap(event.target.checked)}
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
                                <SelectRecipeType defaultValue={recipe?.type} className="col-span-2" />
                            </Fieldset>
                            <Fieldset className="grid-cols-3">
                                <Label htmlFor="description">Descrição</Label>
                                <Textarea id="description" name="description" defaultValue={recipe?.description || ""} className="col-span-2" />
                            </Fieldset>
                        </div>
                        <div className="flex flex-col">
                            <Fieldset className="grid-cols-3">
                                <Label htmlFor="isVegetarian">Vegetariana</Label>
                                <Switch id="isVegetarian" name="isVegetarian" defaultChecked={recipe?.isVegetarian} />
                            </Fieldset>
                            <Fieldset className="grid-cols-3">
                                <Label htmlFor="isGlutenFree">Sem glútem</Label>
                                <Switch id="isGlutenFree" name="isGlutenFree" defaultChecked={recipe?.isGlutenFree} />
                            </Fieldset>
                        </div>
                    </div>
                </div>
            </div>

        </Form>
    )
}
