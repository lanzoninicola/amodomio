import { Recipe } from "@prisma/client";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Form } from "@remix-run/react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { cn } from "~/lib/utils";

interface RecipeFormProps {
    recipe?: Recipe;
    actionName: "recipe-create" | "recipe-update";
    items?: Array<{ id: string; name: string; classification?: string | null }>;
    variations?: Array<{ id: string; name: string; kind?: string | null }>;
    title?: string;
}

function buildRecipeName(itemName?: string, variationName?: string) {
    if (!itemName) return "";
    return variationName ? `Receita ${itemName} (${variationName})` : `Receita ${itemName}`;
}

const NO_LINKED_VARIATION_VALUE = "__no_linked_variation__";

export default function RecipeForm({ recipe, actionName, items = [], variations = [], title }: RecipeFormProps) {
    const isCreate = actionName === "recipe-create";
    const [name, setName] = useState(recipe?.name || "");
    const [nameTouched, setNameTouched] = useState(Boolean(recipe?.name));
    const [linkedItemId, setLinkedItemId] = useState(recipe?.itemId || "");
    const [linkedVariationId, setLinkedVariationId] = useState((((recipe as any)?.variationId as string) || ""));
    const [itemComboboxOpen, setItemComboboxOpen] = useState(false);

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
    const selectedVariationName = useMemo(
        () => variations.find((variation) => variation.id === linkedVariationId)?.name || "",
        [variations, linkedVariationId]
    );
    const generatedName = useMemo(
        () => buildRecipeName(selectedItemName, selectedVariationName),
        [selectedItemName, selectedVariationName]
    );
    const isNameMatchingSuggestion = useMemo(
        () => Boolean(generatedName) && name.trim() === generatedName,
        [generatedName, name]
    );

    useEffect(() => {
        if (isCreate || !recipe) return;
        setName(recipe.name || "");
        setNameTouched(Boolean(recipe.name));
        setLinkedItemId(recipe.itemId || "");
        setLinkedVariationId((((recipe as any)?.variationId as string) || ""));
    }, [isCreate, recipe?.id, recipe?.updatedAt, recipe?.name, recipe?.itemId, (recipe as any)?.variationId]);

    useEffect(() => {
        if (!isCreate) return;
        if (!generatedName) return;
        if (!nameTouched || !name.trim() || name === generatedName) {
            setName(generatedName);
            setNameTouched(false);
        }
    }, [generatedName, isCreate, name, nameTouched]);

    return (
        <Form method="post">
            <input type="hidden" name="recipeId" value={recipe?.id} />
            <div className="mb-8">
                <div className={`mb-4 flex items-center gap-3 ${title ? "justify-between" : "justify-end"}`}>
                    {title ? (
                        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
                    ) : null}
                    <SaveItemButton actionName={actionName} label="Salvar" labelClassName="uppercase font-semibold tracking-wider text-xs" variant={"outline"} />
                </div>
                <div className="flex flex-col gap-4">
                    <div className="border rounded-md p-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                            <Fieldset className="grid-cols-3">
                                <Label htmlFor="linkedItemId">Item vinculado</Label>
                                <div className="col-span-2">
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
                                </div>
                            </Fieldset>
                            <Fieldset className="grid-cols-3">
                                <Label htmlFor="linkedVariationId">Variação vinculada</Label>
                                <div className="col-span-2">
                                    <input type="hidden" name="linkedVariationId" value={linkedVariationId} />
                                    <Select
                                        value={linkedVariationId || NO_LINKED_VARIATION_VALUE}
                                        onValueChange={(value) => setLinkedVariationId(value === NO_LINKED_VARIATION_VALUE ? "" : value)}
                                    >
                                        <SelectTrigger id="linkedVariationId">
                                            <SelectValue placeholder="Sem variação vinculada" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NO_LINKED_VARIATION_VALUE}>
                                                Sem variação vinculada
                                            </SelectItem>
                                            {variations.map((variation) => (
                                                <SelectItem key={variation.id} value={variation.id}>
                                                    {variation.name}{variation.kind ? ` (${variation.kind})` : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                        placeholder="Receita {item vinculado} ({variação})"
                                        className="text-sm"
                                        required
                                    />
                                    {isCreate && generatedName ? (
                                        isNameMatchingSuggestion ? (
                                            <p className="text-xs text-muted-foreground leading-4">
                                                Nome gerado automaticamente a partir do item e da variação.
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
