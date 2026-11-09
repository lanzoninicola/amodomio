import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { ApiError, getPurchaseLists, submitPurchaseList } from "../api/client";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { theme } from "../ui/theme";

type Product = {
  id: string;
  name: string;
  defaultUnit: string;
  unitOptions: string[];
  suppliers: { id: string; name: string }[];
};
type PurchaseItem = {
  id: string;
  quantity: number;
  unit: string;
  purchased: boolean;
  Item?: { name: string };
};
type PurchaseList = { id: string; name: string; Items: PurchaseItem[] };
type Selection = Record<string, { quantity: string; unit: string }>;
type Option = { id: string; name: string };
const colors = {
  ink: "#1e3028",
  muted: "#748078",
  background: "#f5f6f2",
  line: "#e4e8e1",
  orange: "#ee8043",
  pale: "#eef3e9",
  green: "#35704b",
};
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const quantityNumber = (value: string) => Number(value.replace(",", "."));

function Bag({ large = false }: { large?: boolean }) {
  return (
    <View style={[styles.bag, large && styles.bagLarge]}>
      <View style={styles.bagHandle} />
      <View style={styles.bagLine} />
    </View>
  );
}
function Action({
  label,
  onPress,
  disabled,
  loading,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        disabled: Boolean(disabled || loading),
        busy: Boolean(loading),
      }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary && styles.actionSecondary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <>
          <Text
            style={[
              styles.actionLabel,
              secondary && styles.actionSecondaryLabel,
            ]}
          >
            {label}
          </Text>
          <Text
            style={[
              styles.actionArrow,
              secondary && styles.actionSecondaryLabel,
            ]}
          >
            →
          </Text>
        </>
      )}
    </Pressable>
  );
}
function Empty({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Bag large />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}
function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.search}>
      <View style={styles.searchIcon} />
      <TextInput
        accessibilityLabel={placeholder}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChange}
        style={styles.searchInput}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpar busca"
          onPress={() => onChange("")}
          style={styles.clear}
        >
          <Text style={styles.clearText}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
function ChoiceSheet({
  title,
  options,
  selected,
  searchable = false,
  onSelect,
  onClose,
}: {
  title: string;
  options: Option[];
  selected: string;
  searchable?: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const visible = options.filter((option) =>
    normalize(option.name).includes(normalize(query))
  );
  return (
    <Modal
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalBackdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar opções"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar opções"
              onPress={onClose}
              style={styles.iconButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          {searchable ? (
            <Search
              value={query}
              onChange={setQuery}
              placeholder="Buscar fornecedor"
            />
          ) : null}
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={visible}
            keyExtractor={(item) => item.id}
            style={styles.sheetList}
            ListEmptyComponent={
              <Text style={styles.noOptions}>
                Nenhum fornecedor encontrado.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected === item.id }}
                onPress={() => onSelect(item.id)}
                style={[
                  styles.option,
                  selected === item.id && styles.optionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    selected === item.id && styles.selectedText,
                  ]}
                >
                  {item.name}
                </Text>
                <Text style={styles.optionCheck}>
                  {selected === item.id ? "✓" : ""}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}
function ProductRow({
  item,
  selected,
  disabled,
  onToggle,
  onUpdate,
  onUnit,
}: {
  item: Product;
  selected?: Selection[string];
  disabled: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<Selection[string]>) => void;
  onUnit: () => void;
}) {
  const invalid =
    selected &&
    (!Number.isFinite(quantityNumber(selected.quantity)) ||
      quantityNumber(selected.quantity) <= 0);
  function step(delta: number) {
    const current = selected ? quantityNumber(selected.quantity) : 1;
    onUpdate({
      quantity: String(
        Math.round(
          Math.max(0.01, (Number.isFinite(current) ? current : 0) + delta) * 100
        ) / 100
      ),
    });
  }
  return (
    <View style={[styles.product, selected && styles.productSelected]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={item.name}
        accessibilityState={{ checked: Boolean(selected), disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={styles.productTop}
      >
        <View style={styles.productCopy}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text numberOfLines={1} style={styles.productMeta}>
            {item.suppliers.length
              ? item.suppliers.map((row) => row.name).join(" · ")
              : "Sem fornecedor no histórico"}
          </Text>
        </View>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          <Text style={selected ? styles.checkWhite : styles.addText}>
            {selected ? "✓" : "+"}
          </Text>
        </View>
      </Pressable>
      {selected ? (
        <View style={styles.productControls}>
          <View style={[styles.stepper, invalid && styles.invalid]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Diminuir quantidade de ${item.name}`}
              disabled={disabled || quantityNumber(selected.quantity) <= 0.01}
              onPress={() => step(-1)}
              style={styles.stepButton}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <TextInput
              accessibilityLabel={`Quantidade de ${item.name}`}
              value={selected.quantity}
              onChangeText={(quantity) => onUpdate({ quantity })}
              keyboardType="decimal-pad"
              selectTextOnFocus
              editable={!disabled}
              style={styles.quantity}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Aumentar quantidade de ${item.name}`}
              disabled={disabled}
              onPress={() => step(1)}
              style={styles.stepButton}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Unidade de ${item.name}: ${selected.unit}`}
            disabled={disabled}
            onPress={onUnit}
            style={styles.unit}
          >
            <Text style={styles.unitText}>{selected.unit}</Text>
            <Text style={styles.unitChevron}>⌄</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remover ${item.name}`}
            disabled={disabled}
            onPress={onToggle}
            style={styles.remove}
          >
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        </View>
      ) : null}
      {invalid ? (
        <Text style={styles.fieldError}>
          Informe uma quantidade maior que zero.
        </Text>
      ) : null}
    </View>
  );
}

export function PurchaseListsScreen({
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
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [lists, setLists] = useState<PurchaseList[]>([]);
  const [list, setList] = useState<PurchaseList | null>(null);
  const [creating, setCreating] = useState(false);
  const [review, setReview] = useState(false);
  const [query, setQuery] = useState("");
  const [supplier, setSupplier] = useState("");
  const [sheet, setSheet] = useState<"suppliers" | Product | null>(null);
  const [detailTab, setDetailTab] = useState<"pending" | "purchased">(
    "pending"
  );
  const [selection, setSelection] = useState<Selection>({});
  const [name, setName] = useState(
    () => `Compras ${new Date().toLocaleDateString("pt-BR")}`
  );
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState("");
  async function run(task: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized();
      else
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível completar a operação."
        );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function load() {
    const data = await getPurchaseLists(apiUrl, token);
    setCatalog(data.catalog);
    setLists(data.lists);
    setLoaded(true);
  }
  useEffect(() => {
    void run(load);
  }, [apiUrl, token]);
  function back() {
    if (busy) return;
    Keyboard.dismiss();
    setError("");
    if (sheet) setSheet(null);
    else if (review && creating) setReview(false);
    else if (list || creating) {
      setList(null);
      setCreating(false);
      void run(load);
    } else onBack();
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        back();
        return true;
      }
    );
    return () => subscription.remove();
  }, [list, creating, review, sheet, busy, onBack]);
  const suppliers = useMemo(
    () =>
      Array.from(
        new Map(
          catalog.flatMap((item) => item.suppliers).map((row) => [row.id, row])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [catalog]
  );
  const selectedCount = Object.keys(selection).length;
  const selectedSupplier =
    suppliers.find((row) => row.id === supplier)?.name ||
    (supplier === "none" ? "Sem histórico" : "Fornecedores");
  const visible = useMemo(
    () =>
      catalog.filter((item) =>
        review
          ? Boolean(selection[item.id])
          : normalize(item.name).includes(normalize(query)) &&
            (!supplier ||
              (supplier === "none"
                ? !item.suppliers.length
                : item.suppliers.some((row) => row.id === supplier)))
      ),
    [catalog, review, selection, query, supplier]
  );
  function toggle(item: Product) {
    setSelection((current) => {
      const next = { ...current };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = { quantity: "1", unit: item.defaultUnit };
      return next;
    });
  }
  function update(id: string, patch: Partial<Selection[string]>) {
    setSelection((current) =>
      current[id] ? { ...current, [id]: { ...current[id], ...patch } } : current
    );
  }
  function start() {
    setCreating(true);
    setReview(false);
    setQuery("");
    setSupplier("");
    setError("");
  }
  async function create() {
    Keyboard.dismiss();
    await run(async () => {
      const items = Object.entries(selection).map(([itemId, value]) => ({
        itemId,
        quantity: quantityNumber(value.quantity),
        unit: value.unit,
      }));
      if (!name.trim()) throw new Error("Dê um nome para a sua lista.");
      if (
        !items.length ||
        items.some(
          (item) => !Number.isFinite(item.quantity) || item.quantity <= 0
        )
      )
        throw new Error("Revise as quantidades dos produtos.");
      const result = await submitPurchaseList(apiUrl, token, {
        intent: "create",
        name: name.trim(),
        items,
      });
      setList(result.list);
      setCreating(false);
      setReview(false);
      setSelection({});
      setDetailTab("pending");
      setName(`Compras ${new Date().toLocaleDateString("pt-BR")}`);
    });
  }
  const purchased = list?.Items.filter((item) => item.purchased).length || 0;
  const pending = list ? list.Items.length - purchased : 0;
  const detailItems =
    list?.Items.filter((item) =>
      detailTab === "pending" ? !item.purchased : item.purchased
    ) || [];
  const validSelection =
    selectedCount > 0 &&
    Object.values(selection).every(
      (value) =>
        Number.isFinite(quantityNumber(value.quantity)) &&
        quantityNumber(value.quantity) > 0
    );
  return (
    <Screen style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={review ? "Voltar aos produtos" : "Voltar"}
              disabled={busy}
              onPress={back}
              style={styles.iconButton}
            >
              <Text style={styles.backGlyph}>‹</Text>
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>AMODOMIO / COMPRAS</Text>
              <Text style={styles.headerTitle}>
                {list
                  ? "Sua lista"
                  : creating
                  ? review
                    ? "Revisar lista"
                    : "Selecionar produtos"
                  : "Lista de compras"}
              </Text>
            </View>
            {creating ? (
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{review ? "2" : "1"}/2</Text>
              </View>
            ) : (
              <View style={styles.headerBag}>
                <Bag />
              </View>
            )}
          </View>
          {error ? (
            <View style={styles.errorBanner}>
              <Text accessibilityRole="alert" style={styles.errorText}>
                {error}
              </Text>
              {!creating && !list ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void run(load)}
                  style={styles.retry}
                >
                  <Text style={styles.errorText}>Tentar novamente</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {creating ? (
            <>
              <View style={styles.catalogHeader}>
                {review ? (
                  <>
                    <Text style={styles.inputLabel}>NOME DA LISTA</Text>
                    <TextInput
                      accessibilityLabel="Nome da lista"
                      value={name}
                      onChangeText={setName}
                      maxLength={200}
                      placeholder="Ex.: Compras da semana"
                      style={styles.nameInput}
                      editable={!busy}
                    />
                    <Text style={styles.helper}>
                      Confira as quantidades antes de salvar.
                    </Text>
                  </>
                ) : (
                  <>
                    <Search
                      value={query}
                      onChange={setQuery}
                      placeholder="Buscar produto…"
                    />
                    <View style={styles.filterRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Filtrar por fornecedor: ${selectedSupplier}`}
                        onPress={() => {
                          Keyboard.dismiss();
                          setSheet("suppliers");
                        }}
                        style={[
                          styles.filter,
                          Boolean(supplier) && styles.filterActive,
                        ]}
                      >
                        <Text numberOfLines={1} style={styles.filterText}>
                          {selectedSupplier}
                        </Text>
                        <Text style={styles.filterChevron}>⌄</Text>
                      </Pressable>
                      {supplier ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Limpar filtro de fornecedor"
                          onPress={() => setSupplier("")}
                          style={styles.iconButton}
                        >
                          <Text style={styles.closeText}>×</Text>
                        </Pressable>
                      ) : null}
                      <Text style={styles.resultCount}>
                        {visible.length} produtos
                      </Text>
                    </View>
                  </>
                )}
              </View>
              <FlatList
                key={review ? "review" : "catalog"}
                data={visible}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={styles.productList}
                renderItem={({ item }) => (
                  <ProductRow
                    item={item}
                    selected={selection[item.id]}
                    disabled={busy}
                    onToggle={() => toggle(item)}
                    onUpdate={(patch) => update(item.id, patch)}
                    onUnit={() => {
                      Keyboard.dismiss();
                      setSheet(item);
                    }}
                  />
                )}
                ListEmptyComponent={
                  <Empty
                    title={
                      review
                        ? "Sua lista está vazia"
                        : "Nenhum produto encontrado"
                    }
                    description={
                      review
                        ? "Volte aos produtos para adicionar o que precisa comprar."
                        : "Tente outro nome ou escolha outro fornecedor."
                    }
                  />
                }
              />
              <View style={styles.footer}>
                <View style={styles.footerSummary}>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{selectedCount}</Text>
                  </View>
                  <View style={styles.flexCopy}>
                    <Text style={styles.footerTitle}>
                      {selectedCount === 1
                        ? "produto selecionado"
                        : "produtos selecionados"}
                    </Text>
                    <Text style={styles.footerHint}>
                      {review
                        ? "Tudo certo? Salve para compartilhar."
                        : "Monte a lista do seu jeito."}
                    </Text>
                  </View>
                </View>
                <Action
                  label={review ? "Criar lista" : "Revisar lista"}
                  loading={busy}
                  disabled={
                    review ? !validSelection || !name.trim() : !selectedCount
                  }
                  onPress={() => {
                    Keyboard.dismiss();
                    if (review) void create();
                    else setReview(true);
                  }}
                />
              </View>
            </>
          ) : list ? (
            <>
              <View style={styles.detailHeader}>
                <Text style={styles.pageTitle}>{list.name}</Text>
                <View style={styles.progressLabels}>
                  <Text style={styles.helper}>
                    {purchased} de {list.Items.length} comprados
                  </Text>
                  <Text style={styles.progressPercent}>
                    {list.Items.length
                      ? Math.round((purchased / list.Items.length) * 100)
                      : 0}
                    %
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${
                          list.Items.length
                            ? (purchased / list.Items.length) * 100
                            : 0
                        }%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.tabs}>
                  {(
                    [
                      { id: "pending", label: "Pendentes", count: pending },
                      { id: "purchased", label: "Comprados", count: purchased },
                    ] as const
                  ).map((tab) => (
                    <Pressable
                      key={tab.id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: detailTab === tab.id }}
                      onPress={() => setDetailTab(tab.id)}
                      style={[
                        styles.tab,
                        detailTab === tab.id && styles.tabActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabText,
                          detailTab === tab.id && styles.tabTextActive,
                        ]}
                      >
                        {tab.label} · {tab.count}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <FlatList
                data={detailItems}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.productList}
                ListEmptyComponent={
                  <Empty
                    title={
                      detailTab === "pending"
                        ? "Tudo comprado!"
                        : "Ainda está tudo na lista"
                    }
                    description={
                      detailTab === "pending"
                        ? "Sua lista está concluída. As compras ficam na aba Comprados."
                        : "Toque no círculo de cada produto quando colocar no carrinho."
                    }
                  />
                }
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${item.Item?.name || "Produto"}, ${
                      item.quantity
                    } ${item.unit}`}
                    accessibilityState={{
                      checked: item.purchased,
                      disabled: busy,
                    }}
                    disabled={busy}
                    onPress={() =>
                      void run(async () => {
                        const result = await submitPurchaseList(apiUrl, token, {
                          intent: "toggle",
                          listId: list.id,
                          listItemId: item.id,
                          purchased: !item.purchased,
                        });
                        setList(result.list);
                      })
                    }
                    style={({ pressed }) => [
                      styles.purchaseRow,
                      item.purchased && styles.purchasedRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        item.purchased && styles.checkboxSelected,
                      ]}
                    >
                      {item.purchased ? (
                        <Text style={styles.checkWhite}>✓</Text>
                      ) : null}
                    </View>
                    <View style={styles.flexCopy}>
                      <Text
                        style={[
                          styles.productName,
                          item.purchased && styles.purchasedName,
                        ]}
                      >
                        {item.Item?.name || "Produto"}
                      </Text>
                      <Text style={styles.productMeta}>
                        {item.purchased ? "Comprado" : "Pendente"}
                      </Text>
                    </View>
                    <View style={styles.quantityBadge}>
                      <Text style={styles.quantityBadgeText}>
                        {item.quantity} {item.unit}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
              <View style={styles.footer}>
                {pending ? (
                  <>
                    <Text style={styles.footerHint}>
                      {pending === 1
                        ? "1 produto para comprar"
                        : `${pending} produtos para comprar`}
                    </Text>
                    <Action
                      label="Enviar pelo WhatsApp"
                      loading={busy}
                      onPress={() =>
                        void run(async () => {
                          const message = [
                            list.name,
                            ...list.Items.filter((item) => !item.purchased).map(
                              (item) =>
                                `• ${item.quantity} ${item.unit} — ${
                                  item.Item?.name || "Produto"
                                }`
                            ),
                          ].join("\n");
                          await Linking.openURL(
                            `https://wa.me/?text=${encodeURIComponent(message)}`
                          );
                        })
                      }
                    />
                  </>
                ) : (
                  <Action label="Voltar às listas" onPress={back} />
                )}
              </View>
            </>
          ) : (
            <>
              <ScrollView contentContainerStyle={styles.overview}>
                <View style={styles.overviewHeading}>
                  <Text style={styles.pageTitle}>Suas listas</Text>
                  <Text style={styles.helper}>Da organização ao carrinho.</Text>
                </View>
                <View style={styles.newListCard}>
                  <View style={styles.newListHeading}>
                    <View style={styles.newListIcon}>
                      <Bag large />
                    </View>
                    <Text style={styles.newListTitle}>
                      {selectedCount
                        ? "Sua lista está esperando"
                        : "O que vamos comprar?"}
                    </Text>
                  </View>
                  <Text style={styles.newListDescription}>
                    {selectedCount
                      ? `${selectedCount} produtos no rascunho. Continue de onde parou.`
                      : "Escolha os produtos, ajuste as quantidades e envie pelo WhatsApp."}
                  </Text>
                  <Action
                    label={
                      selectedCount
                        ? "Continuar lista"
                        : "Nova lista de compras"
                    }
                    disabled={busy || !loaded}
                    onPress={start}
                  />
                </View>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Em andamento</Text>
                  <View style={styles.listCount}>
                    <Text style={styles.listCountText}>{lists.length}</Text>
                  </View>
                </View>
                {busy && !loaded ? (
                  <View style={styles.loading}>
                    <ActivityIndicator color={colors.ink} />
                    <Text style={styles.helper}>Buscando suas listas…</Text>
                  </View>
                ) : null}
                {loaded && !lists.length ? (
                  <Empty
                    title="Tudo organizado por aqui"
                    description="As listas que você criar aparecem aqui até concluir suas compras."
                  />
                ) : null}
                {lists.map((row) => {
                  const count = row.Items.filter(
                    (item) => item.purchased
                  ).length;
                  return (
                    <Pressable
                      key={row.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir ${row.name}, ${count} de ${row.Items.length} comprados`}
                      disabled={busy}
                      onPress={() =>
                        void run(async () => {
                          const result = await getPurchaseLists(
                            apiUrl,
                            token,
                            row.id
                          );
                          setList(result.list);
                          setDetailTab("pending");
                        })
                      }
                      style={({ pressed }) => [
                        styles.listCard,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.listCardTop}>
                        <View style={styles.flexCopy}>
                          <Text style={styles.listName}>{row.name}</Text>
                          <Text style={styles.helper}>
                            {row.Items.length - count} pendentes ·{" "}
                            {row.Items.length} produtos
                          </Text>
                        </View>
                        <Text style={styles.listArrow}>↗</Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${
                                row.Items.length
                                  ? (count / row.Items.length) * 100
                                  : 0
                              }%`,
                            },
                          ]}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
          {sheet ? (
            <ChoiceSheet
              title={
                sheet === "suppliers"
                  ? "Filtrar por fornecedor"
                  : `Unidade · ${sheet.name}`
              }
              options={
                sheet === "suppliers"
                  ? [
                      { id: "", name: "Todos os fornecedores" },
                      { id: "none", name: "Sem fornecedor no histórico" },
                      ...suppliers,
                    ]
                  : sheet.unitOptions.map((unit) => ({ id: unit, name: unit }))
              }
              selected={
                sheet === "suppliers"
                  ? supplier
                  : selection[sheet.id]?.unit || ""
              }
              searchable={sheet === "suppliers"}
              onClose={() => setSheet(null)}
              onSelect={(id) => {
                if (sheet === "suppliers") setSupplier(id);
                else update(sheet.id, { unit: id });
                setSheet(null);
              }}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  fill: { flex: 1 },
  container: { flex: 1, width: "100%", maxWidth: 760, alignSelf: "center" },
  flexCopy: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.8,
    fontFamily: theme.typography.bold,
    color: colors.muted,
    marginBottom: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: theme.typography.bold,
    color: colors.ink,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "white",
  },
  backGlyph: { fontSize: 34, lineHeight: 38, color: colors.ink },
  closeText: { fontSize: 26, color: colors.muted },
  headerBag: {
    width: 44,
    height: 44,
    backgroundColor: colors.pale,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  bag: {
    width: 19,
    height: 20,
    borderWidth: 1.7,
    borderColor: colors.ink,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  bagLarge: { width: 27, height: 29, borderRadius: 6, borderWidth: 2 },
  bagHandle: {
    width: 9,
    height: 7,
    borderWidth: 1.7,
    borderBottomWidth: 0,
    borderColor: colors.ink,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    position: "absolute",
    top: -7,
  },
  bagLine: {
    height: 2,
    width: "40%",
    backgroundColor: colors.orange,
    borderRadius: 2,
  },
  pageTitle: {
    fontSize: 29,
    lineHeight: 37,
    fontFamily: theme.typography.bold,
    letterSpacing: -1,
    color: colors.ink,
  },
  helper: { fontSize: 13, lineHeight: 20, color: colors.muted },
  overview: { padding: 20, paddingTop: 4, paddingBottom: 32, gap: 16 },
  overviewHeading: { gap: 5, marginBottom: 4 },
  newListCard: {
    backgroundColor: "#eaf0e1",
    borderRadius: 24,
    padding: 22,
    gap: 16,
  },
  newListHeading: { flexDirection: "row", alignItems: "center", gap: 14 },
  newListIcon: {
    width: 52,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dfe8d1",
    borderRadius: 18,
  },
  newListTitle: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    fontFamily: theme.typography.bold,
    letterSpacing: -0.5,
  },
  newListDescription: { color: "#59674f", fontSize: 14, lineHeight: 22 },
  action: {
    minHeight: 54,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: colors.ink,
    borderRadius: 17,
  },
  actionLabel: {
    flexShrink: 1,
    color: "white",
    fontSize: 15,
    fontFamily: theme.typography.semibold,
  },
  actionArrow: { color: colors.orange, fontSize: 22 },
  actionSecondary: { backgroundColor: colors.pale },
  actionSecondaryLabel: { color: colors.ink },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: theme.typography.bold,
    color: colors.ink,
    flexShrink: 1,
  },
  listCount: {
    backgroundColor: "#e6eae1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  listCountText: {
    fontSize: 11,
    color: colors.ink,
    fontFamily: theme.typography.semibold,
  },
  listCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 18,
    gap: 17,
    borderWidth: 1,
    borderColor: colors.line,
  },
  listCardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  listName: {
    fontSize: 16,
    fontFamily: theme.typography.semibold,
    color: colors.ink,
    marginBottom: 5,
  },
  listArrow: { fontSize: 23, color: colors.muted },
  progressTrack: {
    height: 5,
    backgroundColor: "#e8ede3",
    borderRadius: 8,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#94b474", borderRadius: 8 },
  empty: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 25,
    backgroundColor: "#e9eee4",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: theme.typography.semibold,
    color: colors.ink,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    color: colors.muted,
    maxWidth: 290,
  },
  loading: { padding: 30, alignItems: "center", gap: 12 },
  catalogHeader: { paddingHorizontal: 20, paddingBottom: 14, gap: 12 },
  search: {
    minHeight: 50,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 18,
    gap: 12,
  },
  searchIcon: {
    width: 14,
    height: 14,
    borderWidth: 1.7,
    borderColor: colors.muted,
    borderRadius: 8,
    marginRight: 2,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontSize: 14,
    color: colors.ink,
    fontFamily: theme.typography.regular,
    paddingVertical: 12,
    paddingRight: 12,
  },
  clear: {
    width: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  clearText: { color: colors.muted, fontSize: 24 },
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filter: {
    flexShrink: 1,
    minHeight: 44,
    maxWidth: "74%",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    backgroundColor: "white",
  },
  filterActive: { backgroundColor: "#eaf0e1", borderColor: "#cddbbf" },
  filterText: {
    fontSize: 12,
    fontFamily: theme.typography.medium,
    color: colors.ink,
    flexShrink: 1,
  },
  filterChevron: { fontSize: 18, color: colors.muted },
  resultCount: {
    marginLeft: "auto",
    fontSize: 11,
    color: colors.muted,
    flexShrink: 0,
  },
  productList: { paddingHorizontal: 20, paddingBottom: 20, gap: 9 },
  product: {
    backgroundColor: "white",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  productSelected: { borderColor: "#b0c59d", backgroundColor: "#fefffc" },
  productTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 17,
    minHeight: 82,
  },
  productCopy: { flex: 1, minWidth: 0, gap: 5 },
  productName: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: theme.typography.semibold,
    color: colors.ink,
  },
  productMeta: { fontSize: 11, lineHeight: 17, color: colors.muted },
  checkbox: {
    height: 30,
    width: 30,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#d9e0d2",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  checkWhite: {
    color: "white",
    fontSize: 16,
    fontFamily: theme.typography.bold,
  },
  addText: { fontSize: 23, lineHeight: 26, color: colors.ink },
  productControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#edf0e9",
  },
  stepper: {
    flexDirection: "row",
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#f5f7f1",
    borderRadius: 12,
  },
  stepButton: {
    minHeight: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 23, color: colors.ink },
  quantity: {
    flex: 1,
    minWidth: 28,
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 0,
    textAlign: "center",
    color: colors.ink,
    fontSize: 16,
    fontFamily: theme.typography.semibold,
  },
  unit: {
    minHeight: 46,
    minWidth: 70,
    maxWidth: "32%",
    borderRadius: 12,
    backgroundColor: "#f1f3ec",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 9,
  },
  unitText: {
    fontSize: 12,
    fontFamily: theme.typography.semibold,
    color: colors.ink,
    flexShrink: 1,
  },
  unitChevron: { color: colors.muted, fontSize: 16 },
  remove: {
    width: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  removeText: { color: "#9c7162", fontSize: 24 },
  invalid: { borderColor: "#bc4f3c" },
  fieldError: {
    color: "#a24432",
    fontSize: 11,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: "white",
  },
  footerSummary: { flexDirection: "row", alignItems: "center", gap: 10 },
  countBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff0e5",
  },
  countText: {
    fontSize: 16,
    fontFamily: theme.typography.bold,
    color: "#ab552b",
  },
  footerTitle: {
    fontSize: 12,
    fontFamily: theme.typography.semibold,
    color: colors.ink,
  },
  footerHint: { fontSize: 11, lineHeight: 17, color: colors.muted },
  inputLabel: {
    fontSize: 10,
    letterSpacing: 1.3,
    color: colors.muted,
    fontFamily: theme.typography.semibold,
  },
  nameInput: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 17,
    fontFamily: theme.typography.semibold,
  },
  stepBadge: {
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: "#e8ede1",
  },
  stepBadgeText: {
    fontSize: 11,
    color: colors.ink,
    fontFamily: theme.typography.semibold,
  },
  detailHeader: { paddingHorizontal: 20, gap: 12, paddingBottom: 16 },
  progressLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressPercent: {
    fontSize: 12,
    fontFamily: theme.typography.semibold,
    color: colors.green,
  },
  tabs: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: "#e9ede4",
    padding: 4,
    borderRadius: 15,
    marginTop: 5,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: "white" },
  tabText: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: theme.typography.medium,
  },
  tabTextActive: { color: colors.ink, fontFamily: theme.typography.semibold },
  purchaseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    minHeight: 84,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "white",
  },
  purchasedRow: { backgroundColor: "#f0f4eb" },
  purchasedName: { textDecorationLine: "line-through", color: colors.muted },
  quantityBadge: {
    backgroundColor: "#f0f3eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: "35%",
  },
  quantityBadgeText: {
    fontSize: 12,
    color: colors.ink,
    fontFamily: theme.typography.semibold,
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    backgroundColor: "#faebe6",
    borderRadius: 14,
    gap: 8,
  },
  errorText: { color: "#993d2c", fontSize: 12, lineHeight: 19 },
  retry: { minHeight: 44, justifyContent: "center" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(14,28,20,0.42)",
    justifyContent: "flex-end",
  },
  sheet: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "80%",
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 32,
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 14,
  },
  sheetHandle: {
    height: 4,
    width: 36,
    backgroundColor: "#ccd4c6",
    borderRadius: 4,
    alignSelf: "center",
    marginTop: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  sheetList: { flexGrow: 0 },
  option: {
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 5,
  },
  optionSelected: { backgroundColor: "#e7eedc" },
  optionLabel: { fontSize: 14, lineHeight: 21, color: colors.ink, flex: 1 },
  selectedText: { fontFamily: theme.typography.semibold },
  optionCheck: { width: 20, color: colors.ink, fontSize: 17 },
  noOptions: { padding: 20, color: colors.muted, textAlign: "center" },
});
