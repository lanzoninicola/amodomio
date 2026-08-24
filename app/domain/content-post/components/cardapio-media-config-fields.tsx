import { useState } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "~/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
  DEFAULT_CONTENT_LINK_BACKGROUND_COLOR,
  DEFAULT_CONTENT_LINK_TEXT_COLOR,
} from "../content-post-media.shared";
import type { CardapioFeaturedMediaConfig } from "../content-post.shared";

export function CardapioMediaConfigFields({
  index,
  media,
  itemOptions,
}: {
  index: number;
  media: CardapioFeaturedMediaConfig;
  itemOptions: SearchableSelectOption[];
}) {
  const [mode, setMode] = useState<
    "none" | "external" | "internal" | "item" | "modal"
  >(
    media.chipAction === "none"
      ? "none"
      : media.chipAction === "modal"
      ? "modal"
      : media.linkMenuItemId
      ? "item"
      : media.linkUrl?.startsWith("/")
      ? "internal"
      : "external"
  );
  const [menuItemId, setMenuItemId] = useState(media.linkMenuItemId || "");
  const [linkText, setLinkText] = useState(media.linkText || "");

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label>Tipo de chip</Label>
        <Select
          name={`linkMode_${index}`}
          value={mode}
          onValueChange={(value) => setMode(value as typeof mode)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Não exibir chip</SelectItem>
            <SelectItem value="item">Item do cardápio</SelectItem>
            <SelectItem value="internal">Link interno</SelectItem>
            <SelectItem value="external">Link externo</SelectItem>
            <SelectItem value="modal">Modal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === "item" ? (
        <div className="grid gap-2">
          <Label>Item do cardápio</Label>
          <input
            type="hidden"
            name={`linkMenuItemId_${index}`}
            value={menuItemId}
          />
          <SearchableSelect
            value={menuItemId}
            onValueChange={(value) => {
              setMenuItemId(value);
              if (!linkText)
                setLinkText(
                  itemOptions.find((item) => item.value === value)?.label || ""
                );
            }}
            options={itemOptions}
            placeholder="Buscar item..."
            triggerClassName="w-full max-w-none"
          />
        </div>
      ) : mode === "modal" ? (
        <>
          <div className="grid gap-2">
            <Label>Título do modal</Label>
            <Input
              name={`chipModalTitle_${index}`}
              defaultValue={media.chipModalTitle || ""}
            />
          </div>
          <div className="grid gap-2">
            <Label>Texto do modal</Label>
            <Textarea
              name={`chipModalBody_${index}`}
              defaultValue={media.chipModalBody || ""}
              rows={5}
            />
          </div>
        </>
      ) : mode === "none" ? null : (
        <div className="grid gap-2">
          <Label>{mode === "internal" ? "Link interno" : "Link externo"}</Label>
          <Input
            name={`linkUrl_${index}`}
            defaultValue={media.linkUrl || ""}
            placeholder={
              mode === "internal"
                ? "/cardapio/dicas"
                : "https://www.exemplo.com"
            }
          />
        </div>
      )}
      {mode === "none" ? null : (
        <div className="grid gap-2">
          <Label>Texto do link</Label>
          <Input
            name={`linkText_${index}`}
            value={linkText}
            onChange={(event) => setLinkText(event.target.value)}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Input
          name={`linkBackgroundColor_${index}`}
          type="color"
          defaultValue={
            media.linkBackgroundColor || DEFAULT_CONTENT_LINK_BACKGROUND_COLOR
          }
        />
        <Input
          name={`linkTextColor_${index}`}
          type="color"
          defaultValue={media.linkTextColor || DEFAULT_CONTENT_LINK_TEXT_COLOR}
        />
      </div>
      <div className="grid gap-2">
        <Label>Posição do link</Label>
        <Select
          name={`linkPosition_${index}`}
          defaultValue={media.linkPosition}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Topo</SelectItem>
            <SelectItem value="bottom">Rodapé</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Abrir link</Label>
        <Select
          name={`linkNewTab_${index}`}
          defaultValue={media.linkNewTab ? "true" : "false"}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Nova aba</SelectItem>
            <SelectItem value="false">Mesma aba</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
