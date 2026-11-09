import { useRef, useState, type ReactNode } from "react";
import { PanResponder, View, type GestureResponderHandlers } from "react-native";
import { Text } from "../ui/Text";
import { colors } from "./order-ui";

const GAP = 12;

type Item = { id: string; fixed?: boolean };

/**
 * Lista com reordenação por arrastar (alça ⠿). Itens `fixed` não se movem
 * nem aceitam receber outro item na sua posição. Usa só o PanResponder do RN.
 */
export function ReorderableList<T extends Item>({ items, disabled, onReorder, renderItem }: {
  items: T[]; disabled?: boolean;
  onReorder: (ids: string[]) => void | Promise<unknown>;
  renderItem: (item: T, index: number, handle: ReactNode) => ReactNode;
}) {
  const [local, setLocal] = useState<string[] | null>(null);
  const [drag, setDrag] = useState<{ id: string; dy: number } | null>(null);
  const heights = useRef<Record<string, number>>({});
  const responders = useRef<Record<string, GestureResponderHandlers>>({});
  const latest = useRef({ ordered: items, disabled, onReorder });

  const ordered = local ? local.map((id) => items.find((i) => i.id === id)).filter((i): i is T => Boolean(i)) : items;
  latest.current = { ordered, disabled, onReorder };
  const movable = ordered.filter((i) => !i.fixed);
  const sizeOf = (id: string) => (heights.current[id] ?? 0) + GAP;

  function hoverFor(id: string, dy: number) {
    const list = latest.current.ordered.filter((i) => !i.fixed);
    const from = list.findIndex((i) => i.id === id);
    let offset = 0;
    for (let i = 0; i < from; i++) offset += sizeOf(list[i].id);
    const center = offset + (heights.current[id] ?? 0) / 2 + dy;
    let top = 0;
    for (let i = 0; i < list.length; i++) {
      const bottom = top + sizeOf(list[i].id);
      if (center < bottom) return { from, hover: i };
      top = bottom;
    }
    return { from, hover: list.length - 1 };
  }

  function responderFor(id: string) {
    if (!responders.current[id]) {
      responders.current[id] = PanResponder.create({
        onStartShouldSetPanResponder: () => !latest.current.disabled,
        onMoveShouldSetPanResponder: () => !latest.current.disabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => setDrag({ id, dy: 0 }),
        onPanResponderMove: (_, g) => setDrag({ id, dy: g.dy }),
        onPanResponderRelease: (_, g) => {
          const { from, hover } = hoverFor(id, g.dy);
          setDrag(null);
          if (from < 0 || from === hover) return;
          const list = latest.current.ordered.filter((i) => !i.fixed).map((i) => i.id);
          list.splice(hover, 0, list.splice(from, 1)[0]);
          const next = [...list, ...latest.current.ordered.filter((i) => i.fixed).map((i) => i.id)];
          setLocal(next);
          void Promise.resolve(latest.current.onReorder(list)).finally(() => setLocal(null));
        },
        onPanResponderTerminate: () => setDrag(null),
      }).panHandlers;
    }
    return responders.current[id];
  }

  const hovering = drag ? hoverFor(drag.id, drag.dy) : null;
  const draggedHeight = drag ? sizeOf(drag.id) : 0;
  return <View>
    {ordered.map((item, index) => {
      const slot = movable.findIndex((i) => i.id === item.id);
      let shift = 0;
      if (drag && hovering && !item.fixed && item.id !== drag.id) {
        if (hovering.from < hovering.hover && slot > hovering.from && slot <= hovering.hover) shift = -draggedHeight;
        if (hovering.from > hovering.hover && slot >= hovering.hover && slot < hovering.from) shift = draggedHeight;
      }
      const dragging = drag?.id === item.id;
      const handle = item.fixed || disabled ? null : <View {...responderFor(item.id)} accessibilityLabel="Arrastar para mudar a ordem" accessibilityRole="adjustable"
        style={[{ width: 44, height: 44, alignItems: "center", justifyContent: "center", cursor: "grab" } as object, { touchAction: "none" } as object]}>
        <Text style={{ color: colors.muted, fontSize: 24 }}>⠿</Text>
      </View>;
      return <View key={item.id} onLayout={(e) => { heights.current[item.id] = e.nativeEvent.layout.height; }}
        style={{ marginBottom: GAP, zIndex: dragging ? 10 : 0, opacity: dragging ? 0.92 : 1,
          transform: [{ translateY: dragging ? drag!.dy : shift }] }}>
        {renderItem(item, index, handle)}
      </View>;
    })}
  </View>;
}
