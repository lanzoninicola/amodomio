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
import { Text as BaseText } from "../ui/Text";
import { Button as BaseButton } from "../ui/Button";
import { Input as BaseInput } from "../ui/Input";
import { Card as BaseCard } from "../ui/Card";
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
const palette = {
  background: "#101010",
  card: "#282828",
  border: "#444444",
  foreground: "#ffffff",
  mutedForeground: "#b3b3b3",
  muted: "#181818",
  accent: "#fdbc12",
};
function Text({ style, ...props }: ComponentProps<typeof BaseText>) {
  return <BaseText {...props} style={[{ color: palette.foreground }, style]} />;
}
function Card({ style, ...props }: ComponentProps<typeof BaseCard>) {
  return (
    <BaseCard
      {...props}
      style={{
        backgroundColor: palette.card,
        borderColor: palette.border,
        borderRadius: 8,
        ...style,
      }}
    />
  );
}
function Input({ label, style, ...props }: ComponentProps<typeof BaseInput>) {
  return (
    <View style={{ gap: 8 }}>
      {label && <Text>{label}</Text>}
      <BaseInput
        {...props}
        placeholderTextColor={palette.mutedForeground}
        style={[
          {
            backgroundColor: palette.card,
            color: palette.foreground,
            borderColor: palette.border,
            fontSize: 18,
            minHeight: 52,
          },
          style,
        ]}
      />
    </View>
  );
}
function Button({
  style,
  children,
  variant,
  ...props
}: ComponentProps<typeof BaseButton>) {
  const active = !variant || variant === "primary";
  return (
    <BaseButton
      {...props}
      variant={variant}
      style={{
        minHeight: 48,
        borderRadius: 8,
        backgroundColor: active ? palette.accent : palette.card,
        borderColor: palette.border,
        ...style,
      }}
    >
      {typeof children === "string" ? (
        <Text
          style={{
            color: active ? "#101010" : palette.foreground,
            fontFamily: theme.typography.semibold,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </BaseButton>
  );
}

function HeaderAction({
  icon,
  label,
  onPress,
  disabled = false,
  expanded,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  expanded?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled,
        ...(expanded === undefined ? {} : { expanded }),
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerAction,
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text accessible={false} style={styles.headerActionIcon}>
        {icon}
      </Text>
      <Text style={styles.headerActionLabel}>{label}</Text>
    </Pressable>
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
  const listColumns = width >= 1400 ? 3 : width >= 800 ? 2 : 1;
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [showPreparation, setShowPreparation] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [ingredientAreaWidth, setIngredientAreaWidth] = useState(0);
  const ingredientColumns = Math.max(
    1,
    Math.floor((ingredientAreaWidth + 12) / (360 * fontScale + 12))
  );
  const ingredientCardWidth =
    ingredientAreaWidth > 0
      ? Math.min(
          520,
          (ingredientAreaWidth - (ingredientColumns - 1) * 12) /
            ingredientColumns
        )
      : undefined;
  const [history, setHistory] = useState<Page[]>([{ kind: "list" }]);
  const page = history[history.length - 1];
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [recipe, setRecipe] = useState<MobileRecipe | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [template, setTemplate] = useState<SavedTemplate | null>(null);
  const [query, setQuery] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [listPage, setListPage] = useState(1);
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
    optionsOpen
      ? setOptionsOpen(false)
      : history.length > 1
      ? setHistory((current) => current.slice(0, -1))
      : onBack();
  const open = (next: Page) => {
    setError("");
    setOptionsOpen(false);
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
    setShowPreparation(false);
    setScale(1);
    setUnits({});
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
        <View
          style={styles.ingredientGrid}
          onLayout={(event) =>
            setIngredientAreaWidth(event.nativeEvent.layout.width)
          }
        >
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
                  gap: 16,
                  padding: 16,
                  width: ingredientCardWidth ?? "100%",
                  maxWidth: 520,
                }}
              >
                <View style={styles.ingredientRow}>
                  {!preview && (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${row.name}: ${
                        marked.includes(row.id) ? "adicionado" : "pendente"
                      }`}
                      accessibilityState={{ checked: marked.includes(row.id) }}
                      onPress={() => toggle(row.id)}
                      style={styles.check}
                    >
                      <Text style={{ fontSize: 26, color: palette.accent }}>
                        {marked.includes(row.id) ? "☑" : "□"}
                      </Text>
                    </Pressable>
                  )}
                  <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                    <Text
                      style={[
                        styles.ingredientName,
                        {
                          fontSize: 18 * fontScale,
                          lineHeight: 25 * fontScale,
                          textDecorationLine: marked.includes(row.id)
                            ? "line-through"
                            : "none",
                        },
                      ]}
                    >
                      {row.name}
                    </Text>
                    {row.notes && (
                      <Text
                        style={{ color: palette.mutedForeground, fontSize: 16 }}
                      >
                        {row.notes}
                      </Text>
                    )}
                    {source?.subRecipe && (
                      <Button
                        variant="ghost"
                        onPress={() =>
                          open({
                            kind: "recipe",
                            recipeId: source.subRecipe!.id,
                          })
                        }
                      >
                        Ver sub-receita
                      </Button>
                    )}
                  </View>
                </View>
                <View style={styles.ingredientAmounts}>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.quantityHint}>Quantidade</Text>
                    <Button
                      variant="ghost"
                      style={{
                        paddingHorizontal: 0,
                        paddingVertical: 0,
                        justifyContent: "flex-start",
                      }}
                      disabled={
                        preview || !!template || !source || source.quantity <= 0
                      }
                      onPress={() => {
                        setRecalculate(source!);
                        setAvailable(String(row.quantity));
                        setAvailableUnit(row.unit);
                      }}
                    >
                      <Text
                        style={[
                          styles.quantity,
                          {
                            fontSize: (width < 500 ? 24 : 32) * fontScale,
                            color: palette.accent,
                          },
                        ]}
                      >
                        {quantity(row.quantity)}
                      </Text>
                    </Button>
                  </View>
                  <View
                    style={[
                      styles.wrap,
                      { justifyContent: "flex-end", maxWidth: "48%" },
                    ]}
                  >
                    {options.map((unit) => (
                      <Button
                        key={unit}
                        style={{ width: 56, paddingHorizontal: 0 }}
                        disabled={preview || saving || !source}
                        variant={row.unit === unit ? "primary" : "outline"}
                        onPress={() => source && changeUnit(source, unit)}
                      >
                        {unit}
                      </Button>
                    ))}
                  </View>
                </View>
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
  const filtered = recipes.filter((entry) =>
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
    <Screen style={{ backgroundColor: palette.background }}>
      <View style={styles.header}>
        <HeaderAction icon="‹" label="Voltar" onPress={back} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerCaption}>RECEITAS · PRODUÇÃO</Text>
          <Text numberOfLines={2} style={styles.title}>
            {recipe?.name || "Receitas"}
          </Text>
        </View>
        {page.kind === "recipe" && recipe && (
          <View style={styles.headerActions}>
            <HeaderAction
              icon={showPreparation ? "▣" : "▤"}
              label={showPreparation ? "Esconder preparo" : "Mostrar preparo"}
              expanded={showPreparation}
              onPress={() => setShowPreparation((value) => !value)}
            />
            <HeaderAction
              icon="▥"
              label="Templates"
              onPress={() => open({ kind: "templates", recipeId })}
            />
            <HeaderAction
              icon="+"
              label="Criar template"
              disabled={!validScale || !recipe.ingredients.length}
              onPress={() => {
                setName("");
                setDescription("");
                open({ kind: "create", recipeId });
              }}
            />
            <HeaderAction
              icon="⚙"
              label="Ajustes"
              onPress={() => setOptionsOpen(true)}
            />
          </View>
        )}
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
          split={
            tabletLandscape && (page.kind === "recipe" || page.kind === "list")
          }
          scrollRef={scroll}
        >
          {page.kind === "list" ? (
            <View style={tabletLandscape ? styles.listLayout : styles.stacked}>
              <RecipePane landscape={tabletLandscape} sidebar>
                <Input
                  label="Pesquisar receita"
                  placeholder="Nome da receita"
                  value={query}
                  onChangeText={setQuery}
                  showSoftInputOnFocus={false}
                  autoCorrect={false}
                  autoCapitalize="characters"
                />
                <View style={styles.wrap}>
                  <Button
                    variant="outline"
                    style={{ flex: 1 }}
                    disabled={!query}
                    onPress={() =>
                      setQuery((value) =>
                        Array.from(value).slice(0, -1).join("")
                      )
                    }
                  >
                    ⌫ Apagar
                  </Button>
                  <Button
                    variant="outline"
                    style={{ flex: 1 }}
                    disabled={!query}
                    onPress={() => setQuery("")}
                  >
                    Limpar
                  </Button>
                </View>
                <View style={styles.alphabet}>
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                    .split("")
                    .map((value) => (
                      <Button
                        key={value}
                        style={{ width: "17%", paddingHorizontal: 0 }}
                        variant="outline"
                        onPress={() => setQuery((current) => current + value)}
                      >
                        {value}
                      </Button>
                    ))}
                  <Button
                    variant="outline"
                    style={{ width: "100%" }}
                    onPress={() => setQuery((current) => current + " ")}
                  >
                    Espaço
                  </Button>
                </View>
              </RecipePane>
              <RecipePane landscape={tabletLandscape} scrollRef={scroll}>
                <Text accessibilityLiveRegion="polite">
                  {filtered.length} receitas
                </Text>
                <View style={styles.grid}>
                  {filtered.map((entry) => (
                    <Pressable
                      key={entry.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir receita ${entry.name}`}
                      onPress={() =>
                        open({ kind: "recipe", recipeId: entry.id })
                      }
                      style={({ pressed }) => [
                        styles.recipeCard,
                        {
                          width:
                            listColumns === 3
                              ? "31.8%"
                              : listColumns === 2
                              ? "48.5%"
                              : "100%",
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <Text style={styles.recipeCardTitle}>{entry.name}</Text>
                        <Text style={{ fontSize: 26, color: palette.accent }}>
                          ›
                        </Text>
                      </View>
                      {entry.Item && (
                        <Text style={styles.recipeCardItem}>
                          {entry.Item.name}
                        </Text>
                      )}
                      {entry.description && (
                        <Text
                          numberOfLines={3}
                          style={{
                            color: palette.mutedForeground,
                            fontSize: 16,
                          }}
                        >
                          {entry.description}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
                {!filtered.length && (
                  <Text>
                    Nenhuma receita encontrada. Tente outro nome ou letra.
                  </Text>
                )}
              </RecipePane>
            </View>
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
                    <Modal
                      visible={optionsOpen}
                      transparent
                      animationType="fade"
                      onRequestClose={() => setOptionsOpen(false)}
                    >
                      <KeyboardAvoidingView
                        style={styles.overlay}
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                      >
                        <View style={[styles.dialogFrame, styles.optionsFrame]}>
                          <View style={styles.optionsHeader}>
                            <Text style={styles.heading}>
                              Ajustes da receita
                            </Text>
                            <Text style={styles.optionsRecipeName}>
                              {recipe.name}
                            </Text>
                          </View>
                          <ScrollView
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={styles.optionsBody}
                          >
                            <View style={styles.optionsSection}>
                              <Text style={styles.optionsSectionTitle}>
                                Rendimento e quantidades
                              </Text>
                              <Text style={styles.optionsHint}>
                                Ajuste o rendimento para recalcular todos os
                                ingredientes.
                              </Text>
                              {baseYield && (
                                <Input
                                  label={`Rendimento desejado (${
                                    recipe.yieldUnit || "UN"
                                  })`}
                                  keyboardType="decimal-pad"
                                  value={
                                    yieldInput ?? String(baseYield * scale)
                                  }
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
                            </View>
                            <View style={styles.optionsSection}>
                              <View style={styles.optionsSectionHeading}>
                                <View style={{ flex: 1, gap: 4 }}>
                                  <Text style={styles.optionsSectionTitle}>
                                    Tamanho do texto
                                  </Text>
                                  <Text style={styles.optionsHint}>
                                    Ajuste a leitura da receita.
                                  </Text>
                                </View>
                                <View style={styles.wrap}>
                                  <Button
                                    variant="outline"
                                    style={{ width: 56 }}
                                    disabled={fontScale <= 0.8}
                                    onPress={() =>
                                      setFontScale((value) =>
                                        Math.max(0.8, +(value - 0.1).toFixed(1))
                                      )
                                    }
                                  >
                                    A−
                                  </Button>
                                  <Text style={styles.fontValue}>
                                    {Math.round(fontScale * 100)}%
                                  </Text>
                                  <Button
                                    variant="outline"
                                    style={{ width: 56 }}
                                    disabled={fontScale >= 1.5}
                                    onPress={() =>
                                      setFontScale((value) =>
                                        Math.min(1.5, +(value + 0.1).toFixed(1))
                                      )
                                    }
                                  >
                                    A+
                                  </Button>
                                </View>
                              </View>
                            </View>
                          </ScrollView>
                          <View style={styles.optionsFooter}>
                            <Button onPress={() => setOptionsOpen(false)}>
                              Concluir
                            </Button>
                          </View>
                        </View>
                      </KeyboardAvoidingView>
                    </Modal>
                    <RecipePane landscape={tabletLandscape} scrollRef={scroll}>
                      <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Ingredientes</Text>
                        <Text>
                          {
                            recipe.ingredients.filter((item) =>
                              marked.includes(item.id)
                            ).length
                          }
                          /{recipe.ingredients.length} adicionados
                        </Text>
                      </View>
                      {marked.length > 0 && (
                        <Button
                          variant="outline"
                          onPress={() =>
                            setChecks((current) => ({
                              ...current,
                              [checklistKey]: [],
                            }))
                          }
                        >
                          Reiniciar marcações
                        </Button>
                      )}
                      {ingredients()}
                      {recipe.ingredients.filter(
                        (item) => !marked.includes(item.id)
                      ).length > 0 &&
                        recipe.ingredients.filter(
                          (item) => !marked.includes(item.id)
                        ).length <= 2 && (
                          <View
                            accessibilityLiveRegion="polite"
                            style={styles.pending}
                          >
                            <Text
                              style={{
                                color: "#93451c",
                                fontFamily: theme.typography.bold,
                              }}
                            >
                              Falta adicionar:{" "}
                              {recipe.ingredients
                                .filter((item) => !marked.includes(item.id))
                                .map((item) => item.name)
                                .join(" e ")}
                            </Text>
                          </View>
                        )}
                    </RecipePane>
                    {showPreparation && (
                      <RecipePane landscape={tabletLandscape}>
                        <Card style={{ gap: 16 }}>
                          <Text style={styles.sectionTitle}>
                            Modo de preparo
                          </Text>
                          <Text
                            style={{
                              fontSize: 20 * fontScale,
                              lineHeight: 30 * fontScale,
                            }}
                          >
                            {recipe.productionProcedure ||
                              "Modo de preparo ainda não cadastrado."}
                          </Text>
                        </Card>
                        <Text style={styles.sectionTitle}>Pré-aquecimento</Text>
                        {thermal(recipe.preheating)}
                        <Text style={styles.sectionTitle}>Aquecimento</Text>
                        {thermal(recipe.baking)}
                        <Card style={{ gap: 16 }}>
                          <Text style={styles.sectionTitle}>Observações</Text>
                          <Text
                            style={{
                              fontSize: 18 * fontScale,
                              lineHeight: 28 * fontScale,
                            }}
                          >
                            {recipe.productionNotes ||
                              "Sem observações cadastradas."}
                          </Text>
                        </Card>
                      </RecipePane>
                    )}
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
  headerActions: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  headerAction: {
    width: 72,
    minHeight: 64,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  headerActionIcon: { fontSize: 24, lineHeight: 28, color: palette.foreground },
  headerActionLabel: {
    fontSize: 10,
    lineHeight: 13,
    textAlign: "center",
    color: palette.foreground,
    fontFamily: theme.typography.medium,
  },
  optionsFrame: {
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
  },
  optionsHeader: {
    padding: 20,
    gap: 6,
    borderBottomWidth: 1,
    borderColor: palette.border,
  },
  optionsRecipeName: { fontSize: 16, color: palette.mutedForeground },
  optionsBody: { padding: 20, gap: 16 },
  optionsSection: {
    backgroundColor: palette.muted,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  optionsSectionTitle: { fontSize: 16, fontFamily: theme.typography.semibold },
  optionsHint: { fontSize: 13, lineHeight: 19, color: palette.mutedForeground },
  optionsSectionHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  fontValue: {
    minWidth: 48,
    textAlign: "center",
    fontFamily: theme.typography.semibold,
  },
  optionsFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  listLayout: { flex: 1, flexDirection: "row", minHeight: 0 },
  alphabet: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 6,
  },
  recipeCard: {
    minHeight: 180,
    padding: 20,
    borderRadius: 8,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 16,
  },
  recipeCardTitle: {
    flex: 1,
    fontSize: 24,
    lineHeight: 32,
    fontFamily: theme.typography.bold,
  },
  recipeCardItem: {
    fontSize: 18,
    color: palette.mutedForeground,
    borderTopWidth: 1,
    borderColor: palette.border,
    paddingTop: 12,
  },
  ingredientGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "flex-start",
  },
  ingredientAmounts: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderColor: palette.border,
    paddingTop: 12,
  },
  ingredientRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    minHeight: 52,
  },
  headerText: { color: "#ffffff", fontFamily: theme.typography.semibold },
  headerCaption: { color: "#b3b3b3", fontSize: 10, letterSpacing: 1 },
  sectionHeader: {
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderColor: "#444444",
    gap: 6,
  },
  sectionTitle: { fontSize: 20, fontFamily: theme.typography.bold },
  pending: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#fff1e7",
    borderWidth: 1,
    borderColor: "#ee8043",
  },
  header: {
    backgroundColor: "#101010",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderColor: palette.border,
  },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  split: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0,
    gap: 2,
    backgroundColor: palette.border,
  },
  stacked: { gap: 16 },
  sidebar: {
    width: 260,
    flexGrow: 0,
    borderRightWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.muted,
  },
  mainPanel: { flex: 1, minWidth: 0, backgroundColor: palette.background },
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
    borderColor: palette.border,
    paddingTop: 12,
  },
  ingredientName: {
    fontSize: 18,
    lineHeight: 25,
    fontFamily: theme.typography.semibold,
    color: palette.foreground,
  },
  quantity: {
    fontSize: 24,
    fontFamily: theme.typography.bold,
    color: palette.foreground,
  },
  quantityHint: { fontSize: 12, color: palette.mutedForeground },
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
    color: "#ffffff",
  },
  heading: {
    fontSize: 24,
    fontFamily: theme.typography.bold,
    color: palette.foreground,
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
    borderColor: palette.border,
    borderRadius: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  dialog: {
    backgroundColor: palette.background,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
});
