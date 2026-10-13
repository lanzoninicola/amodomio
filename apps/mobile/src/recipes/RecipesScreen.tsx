import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode, RefObject } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ApiError, getRecipes, submitRecipe } from "../api/client";
import { Alert } from "../platform/alert";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { Button as BaseButton } from "../ui/Button";
import { Input } from "../ui/Input";
import { Card } from "../ui/Card";
import { theme } from "../ui/theme";
import {
  applyTemplateUnitPreference,
  createRecipeTemplateSnapshot,
  getTemplateIngredientDisplayUnits,
} from "./template";
import { calculateRecipeScaleFromIngredient } from "./scaling";
import type {
  Ingredient,
  MobileRecipe,
  RecipeSummary,
  SavedTemplate,
  TemplateSummary,
  ThermalPhase,
} from "./types";

type Page =
  | { kind: "list" }
  | { kind: "recipe" | "templates" | "create"; recipeId: string }
  | { kind: "template"; recipeId: string; templateId: string };
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
const numeric = (value: string) => Number(value.trim().replace(",", "."));
const quantity = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const tabs = [
  "Ingredientes",
  "Procedimento",
  "Pré-aquecimento",
  "Forno",
  "Observações",
];

function Button({ style, ...props }: ComponentProps<typeof BaseButton>) {
  return (
    <BaseButton
      {...props}
      style={{ minHeight: 48, borderRadius: 12, ...style }}
    />
  );
}

function RecipePane({
  landscape,
  sidebar = false,
  children,
  scrollRef,
}: {
  landscape: boolean;
  sidebar?: boolean;
  children: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  if (!landscape) return <View style={styles.panel}>{children}</View>;
  return (
    <ScrollView
      ref={scrollRef}
      style={sidebar ? styles.sidebar : styles.mainPanel}
      contentContainerStyle={styles.panel}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

function RecipeViewport({
  split,
  children,
  scrollRef,
}: {
  split: boolean;
  children: ReactNode;
  scrollRef: RefObject<ScrollView | null>;
}) {
  if (split) return <View style={{ flex: 1, minHeight: 0 }}>{children}</View>;
  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      {children}
    </ScrollView>
  );
}

export function RecipesScreen({
  apiUrl,
  token,
  onBack,
  onUnauthorized,
}: {
  apiUrl: string;
  token: string;
  onBack: () => void;
  onUnauthorized: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const tabletLandscape = width >= 800 && width > height;
  const twoIngredientColumns = tabletLandscape && width >= 1000;
  const [history, setHistory] = useState<Page[]>([{ kind: "list" }]);
  const page = history[history.length - 1];
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [recipe, setRecipe] = useState<MobileRecipe | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [template, setTemplate] = useState<SavedTemplate | null>(null);
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [listPage, setListPage] = useState(1);
  const [tab, setTab] = useState(0);
  const [scale, setScale] = useState(1);
  const [yieldInput, setYieldInput] = useState<string | null>(null);
  const [units, setUnits] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [recalculate, setRecalculate] = useState<Ingredient | null>(null);
  const [available, setAvailable] = useState("");
  const [availableUnit, setAvailableUnit] = useState("");
  const generation = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const back = () =>
    history.length > 1
      ? setHistory((current) => current.slice(0, -1))
      : onBack();
  const open = (next: Page) => {
    setError("");
    setHistory((current) => [...current, next]);
  };
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => listener.remove();
  });
  const report = (reason: unknown) => {
    if (reason instanceof ApiError && reason.status === 401) onUnauthorized();
    else
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível concluir a operação."
      );
  };
  const recipeId = page.kind === "list" ? "" : page.recipeId;
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setTemplate(null);
    setRecipe(null);
    const params = new URLSearchParams();
    if (recipeId) params.set("recipeId", recipeId);
    if (page.kind === "templates") params.set("templates", "1");
    if (page.kind === "template") params.set("templateId", page.templateId);
    getRecipes(apiUrl, token, params.toString(), controller.signal)
      .then((data) => {
        if (current !== generation.current) return;
        if (data.recipes) setRecipes(data.recipes);
        if (data.recipe) setRecipe(data.recipe);
        if (data.templates) {
          setTemplates(data.templates);
          setListPage(1);
        }
        if (data.template) setTemplate(data.template);
        scroll.current?.scrollTo({ y: 0, animated: false });
      })
      .catch((reason) => {
        if (!controller.signal.aborted) report(reason);
      })
      .finally(() => {
        if (current === generation.current) setBusy(false);
      });
    return () => {
      generation.current++;
      controller.abort();
    };
  }, [page, apiUrl, token, reload]);
  useEffect(() => {
    setScale(1);
    setUnits({});
    setTab(0);
    setYieldInput(null);
  }, [recipeId]);
  const baseYield =
    recipe?.costingMode === "yield" && Number(recipe.yieldQuantity) > 0
      ? Number(recipe.yieldQuantity)
      : null;
  const validScale =
    Number.isFinite(scale) &&
    scale > 0 &&
    (!baseYield || yieldInput === null || numeric(yieldInput) > 0);
  const selectedUnit = (ingredient: Ingredient) =>
    units[ingredient.id] || ingredient.preferredUnit || ingredient.unit;
  const run = async (operation: () => Promise<unknown>) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await operation();
    } catch (reason) {
      report(reason);
    } finally {
      setSaving(false);
    }
  };
  const changeUnit = (ingredient: Ingredient, unit: string) => {
    Alert.alert("Unidade de leitura", `${ingredient.name}: ${unit}`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Só agora",
        onPress: () =>
          setUnits((current) => ({ ...current, [ingredient.id]: unit })),
      },
      {
        text: "Salvar preferência",
        onPress: () =>
          void run(async () => {
            await submitRecipe(apiUrl, token, {
              recipeId,
              intent: "save-display-unit",
              ingredientId: ingredient.id,
              unit,
            });
            setUnits((current) => ({ ...current, [ingredient.id]: unit }));
            setRecipe(
              (current) =>
                current && {
                  ...current,
                  ingredients: current.ingredients.map((entry) =>
                    entry.id === ingredient.id
                      ? { ...entry, preferredUnit: unit }
                      : entry
                  ),
                }
            );
          }),
      },
    ]);
  };
  const deleteTemplate = (entry: TemplateSummary) =>
    Alert.alert(
      "Excluir template?",
      `“${entry.name}” será excluído permanentemente. A receita será preservada.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () =>
            void run(async () => {
              await submitRecipe(apiUrl, token, {
                recipeId,
                intent: "delete-template",
                templateId: entry.id,
              });
              setTemplates((current) =>
                current.filter((item) => item.id !== entry.id)
              );
              if (page.kind === "template") back();
            }),
        },
      ]
    );
  const checklistKey =
    page.kind === "template"
      ? `template:${page.templateId}`
      : `recipe:${recipeId}`;
  const marked = checks[checklistKey] || [];
  const toggle = (id: string) =>
    setChecks((current) => ({
      ...current,
      [checklistKey]: marked.includes(id)
        ? marked.filter((value) => value !== id)
        : [...marked, id],
    }));
  const ingredients = (preview = false) => {
    if (!recipe) return null;
    let rows: {
      id: string;
      name: string;
      quantity: number;
      unit: string;
      notes: string | null;
    }[];
    if (template)
      rows = template.snapshot.ingredients.map((saved) =>
        applyTemplateUnitPreference(
          saved,
          recipe.ingredients.find((item) => item.id === saved.id),
          units[saved.id] ||
            recipe.ingredients.find((item) => item.id === saved.id)
              ?.preferredUnit
        )
      );
    else if (preview)
      rows = validScale
        ? createRecipeTemplateSnapshot(recipe, scale, units).ingredients
        : [];
    else
      rows = recipe.ingredients.map((item) => {
        const unit = selectedUnit(item);
        return {
          ...item,
          unit,
          quantity:
            item.quantity *
            (item.displayUnits.find((entry) => entry.unit === unit)?.factor ||
              1) *
            scale,
        };
      });
    return (
      <>
        {!rows.length && <Text>Sem ingredientes cadastrados.</Text>}
        <View style={styles.grid}>
          {rows.map((row) => {
            const source = recipe.ingredients.find(
              (item) => item.id === row.id
            );
            const options = template
              ? getTemplateIngredientDisplayUnits(
                  template.snapshot.ingredients.find(
                    (item) => item.id === row.id
                  )!,
                  source
                )
              : source?.displayUnits.map((entry) => entry.unit) || [row.unit];
            return (
              <Card
                key={row.id}
                style={{
                  opacity: !preview && marked.includes(row.id) ? 0.45 : 1,
                  gap: 10,
                  padding: 16,
                  width: twoIngredientColumns ? "48.8%" : "100%",
                }}
              >
                <Text style={styles.ingredientName}>{row.name}</Text>
                <Button
                  variant="ghost"
                  disabled={
                    preview || !!template || !source || source.quantity <= 0
                  }
                  onPress={() => {
                    setRecalculate(source!);
                    setAvailable(String(row.quantity));
                    setAvailableUnit(row.unit);
                  }}
                >
                  <View style={{ alignItems: "center", gap: 3 }}>
                    <Text style={styles.quantity}>{`${quantity(row.quantity)} ${
                      row.unit
                    }`}</Text>
                    {!template && !preview && (
                      <Text style={styles.quantityHint}>
                        Recalcular quantidade
                      </Text>
                    )}
                  </View>
                </Button>
                {row.notes && (
                  <Button
                    variant="outline"
                    onPress={() => Alert.alert(row.name, row.notes!)}
                  >
                    Observação
                  </Button>
                )}
                {source?.subRecipe && (
                  <Button
                    variant="outline"
                    onPress={() =>
                      open({ kind: "recipe", recipeId: source.subRecipe!.id })
                    }
                  >{`Sub-receita: ${source.subRecipe.name}`}</Button>
                )}
                {!preview && (
                  <View style={styles.ingredientFooter}>
                    <View style={[styles.wrap, { flex: 1 }]}>
                      {options.map((unit) => (
                        <Button
                          key={unit}
                          disabled={saving || !source}
                          variant={row.unit === unit ? "primary" : "outline"}
                          onPress={() => source && changeUnit(source, unit)}
                        >
                          {unit}
                        </Button>
                      ))}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityLabel={`Marcar ${row.name} como adicionado`}
                        accessibilityState={{
                          checked: marked.includes(row.id),
                        }}
                        onPress={() => toggle(row.id)}
                        style={styles.check}
                      >
                        <Text style={{ fontSize: 28 }}>
                          {marked.includes(row.id) ? "☑" : "□"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      </>
    );
  };
  const thermal = (phase: ThermalPhase) => (
    <Card>
      {phase ? (
        <>
          <Text>Superior: {phase.upperTemperatureCelsius ?? "—"} °C</Text>
          <Text>Inferior: {phase.lowerTemperatureCelsius ?? "—"} °C</Text>
          <Text>Tempo: {phase.durationMinutes ?? "—"} min</Text>
          {phase.notes && <Text>{phase.notes}</Text>}
        </>
      ) : (
        <Text>Sem informações cadastradas.</Text>
      )}
    </Card>
  );
  const filtered = recipes.filter(
    (entry) =>
      (!letter ||
        normalize(entry.name.trim()).charAt(0).toUpperCase() === letter) &&
      normalize(
        [entry.name, entry.description, entry.Item?.name].join(" ")
      ).includes(normalize(query.trim()))
  );
  const filteredTemplates = templates.filter((entry) =>
    normalize(`${entry.name} ${entry.description || ""}`).includes(
      normalize(listQuery.trim())
    )
  );
  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / 10));
  const currentPage = Math.min(listPage, totalPages);
  return (
    <Screen>
      <View style={styles.header}>
        <Button variant="ghost" onPress={back}>
          ‹ Voltar
        </Button>
        <Text style={styles.title}>Receitas</Text>
      </View>
      {error ? (
        <View style={styles.content}>
          <Text style={{ color: theme.colors.destructive }}>{error}</Text>
          <Button
            variant="outline"
            onPress={() => setReload((value) => value + 1)}
          >
            Tentar novamente
          </Button>
        </View>
      ) : null}
      {busy ? (
        <ActivityIndicator style={{ margin: 24 }} />
      ) : (
        <RecipeViewport
          split={tabletLandscape && page.kind === "recipe"}
          scrollRef={scroll}
        >
          {page.kind === "list" ? (
            <>
              <Input
                label="Pesquisar receita"
                placeholder="Digite o nome da receita"
                value={query}
                onChangeText={setQuery}
              />
              <View style={styles.wrap}>
                <Button
                  variant={!letter ? "primary" : "outline"}
                  onPress={() => setLetter(null)}
                >
                  Todos
                </Button>
                {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((value) => (
                  <Button
                    key={value}
                    disabled={
                      !recipes.some(
                        (entry) =>
                          normalize(entry.name.trim())
                            .charAt(0)
                            .toUpperCase() === value
                      )
                    }
                    variant={letter === value ? "primary" : "outline"}
                    onPress={() => setLetter(letter === value ? null : value)}
                  >
                    {value}
                  </Button>
                ))}
              </View>
              <Text>{filtered.length} receitas</Text>
              <View style={styles.grid}>
                {filtered.map((entry) => (
                  <Button
                    key={entry.id}
                    style={{
                      width: tabletLandscape ? "48.8%" : "100%",
                      minHeight: 64,
                      borderRadius: 12,
                      alignItems: "flex-start",
                    }}
                    variant="outline"
                    onPress={() => open({ kind: "recipe", recipeId: entry.id })}
                  >
                    {entry.name}
                  </Button>
                ))}
              </View>
              {!filtered.length && <Text>Nenhuma receita encontrada.</Text>}
            </>
          ) : recipe ? (
            <>
              {page.kind !== "recipe" && (
                <Text style={styles.heading}>
                  {page.kind === "template" ? template?.name : recipe.name}
                </Text>
              )}
              {page.kind === "recipe" ? (
                <>
                  <View style={tabletLandscape ? styles.split : styles.stacked}>
                    <RecipePane landscape={tabletLandscape} sidebar>
                      <Text style={styles.heading}>{recipe.name}</Text>
                      {recipe.description && <Text>{recipe.description}</Text>}
                      <View style={styles.wrap}>
                        <Button
                          onPress={() => open({ kind: "templates", recipeId })}
                        >
                          Templates
                        </Button>
                        <Button
                          disabled={!validScale || !recipe.ingredients.length}
                          onPress={() => {
                            setName("");
                            setDescription("");
                            open({ kind: "create", recipeId });
                          }}
                        >
                          Criar template
                        </Button>
                      </View>
                      {baseYield && (
                        <Input
                          label={`Rendimento desejado (${
                            recipe.yieldUnit || "UN"
                          })`}
                          keyboardType="decimal-pad"
                          value={yieldInput ?? String(baseYield * scale)}
                          onChangeText={(value) => {
                            setYieldInput(value);
                            if (numeric(value) > 0)
                              setScale(numeric(value) / baseYield);
                          }}
                        />
                      )}
                      <Button
                        variant="outline"
                        onPress={() => {
                          setScale(1);
                          setYieldInput(null);
                        }}
                      >
                        Restaurar quantidades
                      </Button>
                      <View>
                        <View
                          style={
                            tabletLandscape ? styles.sideTabs : styles.wrap
                          }
                        >
                          {tabs.map((label, index) => (
                            <Button
                              key={label}
                              variant={tab === index ? "primary" : "outline"}
                              onPress={() => setTab(index)}
                            >
                              {label}
                            </Button>
                          ))}
                        </View>
                      </View>
                    </RecipePane>
                    <RecipePane landscape={tabletLandscape} scrollRef={scroll}>
                      {tab === 0 ? (
                        ingredients()
                      ) : tab === 1 ? (
                        <Card>
                          <Text>
                            {recipe.productionProcedure ||
                              "Sem procedimento cadastrado."}
                          </Text>
                        </Card>
                      ) : tab === 2 ? (
                        thermal(recipe.preheating)
                      ) : tab === 3 ? (
                        thermal(recipe.baking)
                      ) : (
                        <Card>
                          <Text>
                            {recipe.productionNotes ||
                              "Sem observações cadastradas."}
                          </Text>
                        </Card>
                      )}
                    </RecipePane>
                  </View>
                </>
              ) : page.kind === "templates" ? (
                <>
                  <Button
                    onPress={() => {
                      setName("");
                      setDescription("");
                      open({ kind: "create", recipeId });
                    }}
                  >
                    Novo template
                  </Button>
                  <Input
                    label="Pesquisar template"
                    value={listQuery}
                    onChangeText={(value) => {
                      setListQuery(value);
                      setListPage(1);
                    }}
                  />
                  <View style={styles.grid}>
                    {filteredTemplates
                      .slice((currentPage - 1) * 10, currentPage * 10)
                      .map((entry) => (
                        <Card
                          key={entry.id}
                          style={{
                            gap: 12,
                            width: tabletLandscape ? "48.8%" : "100%",
                          }}
                        >
                          <Button
                            variant="ghost"
                            onPress={() =>
                              open({
                                kind: "template",
                                recipeId,
                                templateId: entry.id,
                              })
                            }
                          >
                            {entry.name}
                          </Button>
                          <Text>
                            {new Date(entry.createdAt).toLocaleDateString(
                              "pt-BR"
                            )}
                          </Text>
                          {entry.description && (
                            <Text>{entry.description}</Text>
                          )}
                          <Button
                            variant="destructive"
                            disabled={saving}
                            onPress={() => deleteTemplate(entry)}
                          >
                            Excluir
                          </Button>
                        </Card>
                      ))}
                  </View>
                  {!filteredTemplates.length && (
                    <Text>Nenhum template encontrado.</Text>
                  )}
                  <View style={styles.wrap}>
                    <Button
                      disabled={currentPage <= 1}
                      onPress={() => setListPage(currentPage - 1)}
                    >
                      Anterior
                    </Button>
                    <Text>
                      {currentPage} / {totalPages}
                    </Text>
                    <Button
                      disabled={currentPage >= totalPages}
                      onPress={() => setListPage(currentPage + 1)}
                    >
                      Próxima
                    </Button>
                  </View>
                </>
              ) : page.kind === "create" ? (
                <>
                  <Input
                    label="Nome do template"
                    maxLength={120}
                    value={name}
                    onChangeText={setName}
                  />
                  <Input
                    label="Descrição (opcional)"
                    multiline
                    maxLength={2000}
                    value={description}
                    onChangeText={setDescription}
                  />
                  <Text style={styles.title}>Prévia das quantidades</Text>
                  {baseYield && (
                    <Text>
                      Rendimento: {quantity(baseYield * scale)}{" "}
                      {recipe.yieldUnit}
                    </Text>
                  )}
                  {ingredients(true)}
                  <Button
                    loading={saving}
                    disabled={
                      !name.trim() || !validScale || !recipe.ingredients.length
                    }
                    onPress={() =>
                      void run(async () => {
                        const result = await submitRecipe(apiUrl, token, {
                          recipeId,
                          intent: "create-template",
                          name: name.trim(),
                          description,
                          scaleFactor: scale,
                          selectedUnits: units,
                        });
                        if (result.createdTemplateId)
                          setHistory((current) => [
                            ...current.slice(0, -1),
                            {
                              kind: "template",
                              recipeId,
                              templateId: result.createdTemplateId!,
                            },
                          ]);
                      })
                    }
                  >
                    Salvar template
                  </Button>
                </>
              ) : template ? (
                <>
                  <Text>{template.description}</Text>
                  {template.snapshot.yieldQuantity != null && (
                    <Text>
                      Rendimento: {quantity(template.snapshot.yieldQuantity)}{" "}
                      {template.snapshot.yieldUnit}
                    </Text>
                  )}
                  <Button
                    variant="outline"
                    onPress={() =>
                      setChecks((current) => ({
                        ...current,
                        [checklistKey]: [],
                      }))
                    }
                  >
                    Limpar checklist
                  </Button>
                  {ingredients()}
                  <Button
                    variant="destructive"
                    disabled={saving}
                    onPress={() => deleteTemplate(template)}
                  >
                    Excluir template
                  </Button>
                </>
              ) : null}
            </>
          ) : null}
        </RecipeViewport>
      )}
      <Modal
        visible={!!recalculate}
        transparent
        animationType="slide"
        onRequestClose={() => setRecalculate(null)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.dialogFrame}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.dialog}
            >
              <Text style={styles.heading}>Quantidade disponível</Text>
              <Text>{recalculate?.name}</Text>
              <View style={styles.wrap}>
                {recalculate?.displayUnits.map((option) => (
                  <Button
                    key={option.unit}
                    variant={
                      availableUnit === option.unit ? "primary" : "outline"
                    }
                    onPress={() => {
                      const from =
                        recalculate.displayUnits.find(
                          (entry) => entry.unit === availableUnit
                        )?.factor || 1;
                      if (Number.isFinite(numeric(available)))
                        setAvailable(
                          String((numeric(available) / from) * option.factor)
                        );
                      setAvailableUnit(option.unit);
                    }}
                  >
                    {option.unit}
                  </Button>
                ))}
              </View>
              <Input
                label={`Quanto você tem em ${availableUnit}?`}
                keyboardType="decimal-pad"
                value={available}
                onChangeText={setAvailable}
              />
              <Button
                disabled={!(numeric(available) > 0)}
                onPress={() => {
                  if (!recalculate) return;
                  const factor =
                    recalculate.displayUnits.find(
                      (entry) => entry.unit === availableUnit
                    )?.factor || 1;
                  const next = calculateRecipeScaleFromIngredient({
                    baseQuantity: recalculate.quantity * factor,
                    availableQuantity: numeric(available),
                  });
                  if (next) {
                    setScale(next);
                    setYieldInput(baseYield ? String(baseYield * next) : "");
                    setUnits((current) => ({
                      ...current,
                      [recalculate.id]: availableUnit,
                    }));
                    setRecalculate(null);
                  }
                }}
              >
                Recalcular receita
              </Button>
              <Button variant="outline" onPress={() => setAvailable("")}>
                Limpar quantidade
              </Button>
              <Button variant="ghost" onPress={() => setRecalculate(null)}>
                Cancelar
              </Button>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  split: { flex: 1, flexDirection: "row", minHeight: 0 },
  stacked: { gap: 16 },
  sidebar: {
    width: 260,
    flexGrow: 0,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.muted,
  },
  mainPanel: { flex: 1, minWidth: 0 },
  panel: { padding: 16, gap: 16, paddingBottom: 32 },
  sideTabs: { gap: 8 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  ingredientFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    paddingTop: 12,
  },
  ingredientName: {
    fontSize: 18,
    lineHeight: 25,
    fontFamily: theme.typography.semibold,
    color: theme.colors.foreground,
  },
  quantity: {
    fontSize: 24,
    fontFamily: theme.typography.bold,
    color: theme.colors.foreground,
  },
  quantityHint: { fontSize: 12, color: theme.colors.mutedForeground },
  dialogFrame: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "100%",
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: theme.typography.semibold,
    color: theme.colors.foreground,
  },
  heading: {
    fontSize: 24,
    fontFamily: theme.typography.bold,
    color: theme.colors.foreground,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  check: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  dialog: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
});
